import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

function decodeKey(secret: string) {
  const trimmed = secret.trim();

  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  const base64 = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = Buffer.from(base64, 'base64');
  if (decoded.length === KEY_BYTES) {
    return decoded;
  }

  throw new Error(
    'NOTION_TOKEN_ENCRYPTION_KEY must be 32 bytes encoded as base64(base64url) or 64-char hex.',
  );
}

function getKey() {
  const secret = process.env.NOTION_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('Missing NOTION_TOKEN_ENCRYPTION_KEY');
  }

  const key = decodeKey(secret);
  if (key.length !== KEY_BYTES) {
    throw new Error('Invalid NOTION_TOKEN_ENCRYPTION_KEY length');
  }

  return key;
}

export function encryptNotionToken(token: string) {
  if (!token) throw new Error('Cannot encrypt empty Notion access token');

  const iv = crypto.randomBytes(IV_BYTES);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptNotionToken(payload: string) {
  const [ivB64, authTagB64, bodyB64] = payload.split(':');
  if (!ivB64 || !authTagB64 || !bodyB64) {
    throw new Error('Invalid encrypted token payload');
  }

  const iv = Buffer.from(ivB64, 'base64url');
  if (iv.length !== IV_BYTES) {
    throw new Error('Invalid encryption iv');
  }

  const authTag = Buffer.from(authTagB64, 'base64url');
  if (authTag.length !== 16) {
    throw new Error('Invalid encryption auth tag');
  }

  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(Buffer.from(bodyB64, 'base64url')), decipher.final()]);
  return decrypted.toString('utf8');
}
