export const ANTHROPIC_MODEL_CANDIDATES = [
  process.env.ANTHROPIC_MODEL,
  'claude-3-5-haiku-20241022',
  'claude-3-haiku-20240307',
].filter((model): model is string => typeof model === 'string' && model.trim().length > 0);

export const XAI_MODEL_CANDIDATES = [
  process.env.XAI_MODEL,
  process.env.GROK_MODEL,
  'grok-2-latest',
  'grok-beta',
].filter((model): model is string => typeof model === 'string' && model.trim().length > 0);

export function isModelNotFoundError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('model not found') || normalized.includes('not_found_error') || normalized.includes('invalid argument');
}

