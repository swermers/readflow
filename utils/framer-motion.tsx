'use client';

import React, { createElement, forwardRef, useEffect, useMemo, useRef, useState } from 'react';

type Subscriber<T = unknown> = (value: T) => void;

class MotionValue<T = unknown> {
  private value: T;
  private subscribers = new Set<Subscriber<T>>();

  constructor(initial: T) {
    this.value = initial;
  }

  get() {
    return this.value;
  }

  set(next: T) {
    this.value = next;
    this.subscribers.forEach((sub) => sub(next));
  }

  onChange(subscriber: Subscriber<T>) {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }
}

function lerpValue(progress: number, input: number[], output: Array<number | string>) {
  if (!input.length || !output.length) return output[0] ?? progress;
  const clamped = Math.min(Math.max(progress, input[0]), input[input.length - 1]);

  let index = input.findIndex((value) => clamped <= value);
  if (index <= 0) index = 1;

  const start = input[index - 1];
  const end = input[index];
  const ratio = end === start ? 0 : (clamped - start) / (end - start);

  const from = output[index - 1];
  const to = output[index];

  if (typeof from === 'number' && typeof to === 'number') {
    return from + (to - from) * ratio;
  }

  return ratio > 0.5 ? to : from;
}

function normalizeStyleValue(value: unknown) {
  if (Array.isArray(value)) return value[value.length - 1];
  return value;
}

function useResolvedStyle(style: Record<string, unknown> | undefined, animate: Record<string, unknown> | undefined) {
  const [dynamicStyle, setDynamicStyle] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!style) return;

    const unsubscribers: Array<() => void> = [];
    const next: Record<string, unknown> = {};

    Object.entries(style).forEach(([key, value]) => {
      if (value instanceof MotionValue) {
        next[key] = value.get();
        unsubscribers.push(value.onChange((updated) => setDynamicStyle((prev) => ({ ...prev, [key]: updated }))));
      } else {
        next[key] = value;
      }
    });

    setDynamicStyle(next);

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [style]);

  const animatedStyle = useMemo(() => {
    if (!animate) return {};
    return Object.fromEntries(Object.entries(animate).map(([k, v]) => [k, normalizeStyleValue(v)]));
  }, [animate]);

  return { ...dynamicStyle, ...animatedStyle };
}

function buildMotionComponent(tag: string) {
  return forwardRef<HTMLElement, any>(function MotionComponent(
    { children, initial: _initial, whileInView: _whileInView, transition: _transition, viewport: _viewport, variants: _variants, exit: _exit, layoutId: _layoutId, animate, style, ...rest },
    ref
  ) {
    const combinedStyle = useResolvedStyle(style, animate);
    return createElement(tag, { ...rest, ref, style: combinedStyle }, children);
  });
}

export const motion = new Proxy(
  {},
  {
    get: (_, tag: string) => buildMotionComponent(tag),
  }
) as Record<string, ReturnType<typeof buildMotionComponent>>;

export function AnimatePresence({ children }: { children: React.ReactNode; [key: string]: unknown }) {
  return <>{children}</>;
}

export function useScroll({ target }: { target?: React.RefObject<HTMLElement>; [key: string]: unknown }) {
  const scrollYProgressRef = useRef(new MotionValue(0));

  useEffect(() => {
    const update = () => {
      const targetEl = target?.current;
      if (!targetEl) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        scrollYProgressRef.current.set(max > 0 ? window.scrollY / max : 0);
        return;
      }

      const rect = targetEl.getBoundingClientRect();
      const start = window.innerHeight;
      const end = -rect.height;
      const progress = (start - rect.top) / (start - end);
      scrollYProgressRef.current.set(Math.min(1, Math.max(0, progress)));
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [target]);

  return { scrollYProgress: scrollYProgressRef.current };
}

export function useTransform(value: MotionValue<number>, input: number[], output: Array<number | string>) {
  const resultRef = useRef(new MotionValue<number | string>(lerpValue(value.get(), input, output)));

  useEffect(() => {
    const update = (next: number) => {
      const mapped = lerpValue(next, input, output);
      resultRef.current.set(mapped);
    };

    update(value.get());
    return value.onChange(update);
  }, [input, output, value]);

  return resultRef.current;
}
