import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';

type EncPayload = {
  iv: string;
  authTag: string;
  ciphertext: string;
};

function parseKey(raw: string): Buffer {
  const trimmed = raw.trim();

  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const key = Buffer.from(`${normalized}${padding}`, 'base64');

  if (key.length === 32) {
    return key;
  }

  throw new Error('TOKEN_ENCRYPTION_KEY must be 64-char hex or 32-byte base64/base64url');
}

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY || process.env.NOTION_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('Missing TOKEN_ENCRYPTION_KEY (or NOTION_TOKEN_ENCRYPTION_KEY)');
  }
  return parseKey(raw);
}

export function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);

  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const payload: EncPayload = {
    iv: iv.toString('base64url'),
    authTag: authTag.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
  };

  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decryptToken(encodedPayload: string): string {
  let payload: EncPayload;

  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as EncPayload;
  } catch {
    throw new Error('Invalid encrypted token payload');
  }

  if (!payload?.iv || !payload?.authTag || !payload?.ciphertext) {
    throw new Error('Invalid encrypted token payload');
  }

  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(payload.iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64url'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64url')),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

/**
 * Check if a value looks like an encrypted payload (base64url-encoded JSON with expected fields).
 * Used to detect whether a token has already been encrypted during migration.
 */
export function isEncryptedPayload(value: string): boolean {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    return !!(parsed?.iv && parsed?.authTag && parsed?.ciphertext);
  } catch {
    return false;
  }
}
