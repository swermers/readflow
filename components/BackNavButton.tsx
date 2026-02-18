'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

type BackNavButtonProps = {
  label?: string;
  fallbackHref?: string;
  className?: string;
  iconClassName?: string;
};

export default function BackNavButton({
  label = 'Back',
  fallbackHref = '/',
  className,
  iconClassName,
}: BackNavButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    const canUseHistory = typeof window !== 'undefined' && window.history.length > 1;

    if (canUseHistory) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  };

  return (
    <button type="button" onClick={handleBack} className={className}>
      <ArrowLeft className={iconClassName ?? 'h-4 w-4'} />
      {label}
    </button>
  );
}
