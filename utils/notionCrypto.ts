import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey() {
  const secret = process.env.NOTION_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('Missing NOTION_TOKEN_ENCRYPTION_KEY');
  }

  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptNotionToken(token: string) {
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptNotionToken(payload: string) {
  const [ivB64, authTagB64, bodyB64] = payload.split(':');
  if (!ivB64 || !authTagB64 || !bodyB64) {
    throw new Error('Invalid encrypted token payload');
  }

  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

  const decrypted = Buffer.concat([decipher.update(Buffer.from(bodyB64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}
