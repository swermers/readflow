export type SignalTier = 'high_signal' | 'news' | 'reference' | 'unclassified';

const HIGH_SIGNAL_KEYWORDS = [
  'playbook',
  'strategy',
  'framework',
  'deep dive',
  'analysis',
  'market map',
  'operator',
  'benchmark',
  'alpha',
  'roadmap',
  'thesis',
  'case study',
  'signals',
  'opportunity',
  'fundraising',
  'pricing',
  'growth',
  'retention',
  'gtm',
  'go-to-market',
];

const NEWS_KEYWORDS = [
  'daily',
  'breaking',
  'headlines',
  'roundup',
  'this week',
  'today in',
  'digest',
  'briefing',
  'updates',
  'news',
  'recap',
  'bulletin',
  'morning',
];

const REFERENCE_KEYWORDS = [
  'guide',
  'tutorial',
  'documentation',
  'resources',
  'cheat sheet',
  'checklist',
  'toolkit',
  'template',
  'collection',
  'library',
  'best practices',
  'evergreen',
  'archive',
];

function countMatches(haystack: string, needles: string[]) {
  return needles.reduce((total, keyword) => {
    return total + (haystack.includes(keyword) ? 1 : 0);
  }, 0);
}

export function classifyIssueSignal(params: {
  subject?: string | null;
  snippet?: string | null;
  bodyText?: string | null;
}) {
  const subject = (params.subject || '').toLowerCase();
  const snippet = (params.snippet || '').toLowerCase();
  const body = (params.bodyText || '').toLowerCase();
  const text = `${subject}\n${snippet}\n${body}`;

  const highSignalScore = countMatches(text, HIGH_SIGNAL_KEYWORDS) + countMatches(subject, ['strategy', 'playbook', 'deep dive']) * 2;
  const newsScore = countMatches(text, NEWS_KEYWORDS) + countMatches(subject, ['daily', 'news', 'roundup']) * 2;
  const referenceScore = countMatches(text, REFERENCE_KEYWORDS);

  if (highSignalScore === 0 && newsScore === 0 && referenceScore === 0) {
    return {
      tier: 'unclassified' as SignalTier,
      reason: 'No clear signal markers detected yet.',
    };
  }

  if (highSignalScore >= newsScore && highSignalScore >= referenceScore) {
    return {
      tier: 'high_signal' as SignalTier,
      reason: 'Detected strategy/actionable language.',
    };
  }

  if (newsScore >= highSignalScore && newsScore >= referenceScore) {
    return {
      tier: 'news' as SignalTier,
      reason: 'Detected recap/update newsletter language.',
    };
  }

  return {
    tier: 'reference' as SignalTier,
    reason: 'Detected evergreen or resource-style language.',
  };
}
