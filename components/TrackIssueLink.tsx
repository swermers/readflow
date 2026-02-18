'use client';

import Link, { LinkProps } from 'next/link';
import { ReactNode } from 'react';

type Props = LinkProps & {
  issueId: string;
  senderEmail?: string | null;
  className?: string;
  children: ReactNode;
};

export default function TrackIssueLink({ issueId, senderEmail, children, ...rest }: Props) {
  const track = () => {
    void fetch('/api/events/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issueId,
        senderEmail,
        eventType: 'issue_opened',
      }),
      keepalive: true,
    }).catch(() => {
      // best effort
    });
  };

  return (
    <Link {...rest} onClick={track}>
      {children}
    </Link>
  );
}
