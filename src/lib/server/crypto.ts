import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from '$env/dynamic/private';

function getKey(): Buffer {
	const key = env.ENCRYPTION_KEY;
	if (!key || key.length < 32) throw new Error('ENCRYPTION_KEY must be at least 32 characters');
	return Buffer.from(key.padEnd(64, '0').slice(0, 64), 'hex');
}

export function encrypt(plaintext: string): string {
	const key = getKey();
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(ciphertext: string): string {
	const key = getKey();
	const [ivHex, tagHex, dataHex] = ciphertext.split(':');
	const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
	decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
	return decipher.update(Buffer.from(dataHex, 'hex')).toString('utf8') + decipher.final('utf8');
}
