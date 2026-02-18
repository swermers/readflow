const TAG_RULES: Array<{ tag: string; patterns: RegExp[] }> = [
  { tag: 'ai', patterns: [/\b(ai|llm|gpt|agentic|machine learning|ml)\b/i] },
  { tag: 'startups', patterns: [/\b(startup|founder|venture|vc|seed|series [abc])\b/i] },
  { tag: 'product', patterns: [/\b(product|roadmap|ux|ui|retention|onboarding)\b/i] },
  { tag: 'marketing', patterns: [/\b(marketing|growth|seo|content|funnel|gtm)\b/i] },
  { tag: 'finance', patterns: [/\b(finance|market|stocks?|investing|revenue|pricing)\b/i] },
  { tag: 'ops', patterns: [/\b(operations|workflow|automation|process|kpi|dashboard)\b/i] },
];

export function deriveAutoTags(highlightedText: string, note?: string | null): string[] {
  const source = `${highlightedText || ''}\n${note || ''}`.toLowerCase();

  const matched = TAG_RULES.filter(({ patterns }) => patterns.some((pattern) => pattern.test(source))).map(({ tag }) => tag);

  if (matched.length > 0) {
    return matched.slice(0, 4);
  }

  if (source.includes('?')) {
    return ['follow-up'];
  }

  return ['general'];
}
