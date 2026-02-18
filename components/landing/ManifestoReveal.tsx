'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const manifestoText = `The Readflow Manifesto

We are drowning in information, but starving for wisdom.

Your inbox was designed for communication, but it has become a battlefield of attention. Every "Unsubscribe" is a micro-stress. Every "Sale" is a distraction. The writers you love are buried under the clutter of the things you merely tolerate.

We believe:

Attention is your most valuable asset. It should not be sold to the highest bidder.

Curation is a superpower. What you don't read is as important as what you do.

Knowledge should compound. A newsletter shouldn't disappear after you read it; it should become a permanent brick in your intellectual foundation.

The Readflow Library is your sanctuary. It is the quiet room in a loud world. It is where inbox anxiety goes to die and where insights go to live.

Filter the noise. Keep the signal. Build your library.`;

export default function ManifestoReveal() {
  const [visibleChars, setVisibleChars] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    let started = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry.isIntersecting || started) return;
        started = true;
        let cursor = 0;
        const timer = setInterval(() => {
          cursor = Math.min(cursor + 8, manifestoText.length);
          setVisibleChars(cursor);
          if (cursor >= manifestoText.length) {
            clearInterval(timer);
          }
        }, 20);
      },
      { threshold: 0.25 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const rendered = useMemo(() => manifestoText.slice(0, visibleChars), [visibleChars]);

  return (
    <div ref={containerRef} className="rounded-2xl border border-line bg-surface-raised p-8 shadow-sm md:p-12">
      <pre className="whitespace-pre-wrap font-sans text-base leading-8 text-ink md:text-lg">{rendered}</pre>
    </div>
  );
}
