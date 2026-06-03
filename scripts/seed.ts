/**
 * Seed script — creates the initial admin account.
 * Run: npx tsx scripts/seed.ts
 *
 * Set these env vars first (or put them in .env):
 *   DATABASE_URL
 *   ADMIN_EMAIL (defaults to admin@example.com)
 *   ADMIN_PASSWORD (required)
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { admin } from '../src/lib/server/db/schema.js';
import { hash } from 'argon2';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error('ERROR: DATABASE_URL is not set');
	process.exit(1);
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
	console.error('ERROR: ADMIN_PASSWORD is not set');
	process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function main() {
	console.log(`Creating admin: ${ADMIN_EMAIL}`);

	const existing = await db.select().from(admin).where(eq(admin.email, ADMIN_EMAIL));
	if (existing.length > 0) {
		console.log('Admin already exists. Updating password...');
		const passwordHash = await hash(ADMIN_PASSWORD!);
		await db.update(admin).set({ passwordHash, updatedAt: new Date() }).where(eq(admin.email, ADMIN_EMAIL));
		console.log('Password updated.');
	} else {
		const passwordHash = await hash(ADMIN_PASSWORD!);
		await db.insert(admin).values({ email: ADMIN_EMAIL, passwordHash });
		console.log('Admin created successfully!');
	}

	console.log('\nNext steps:');
	console.log('1. Run: npm run db:push');
	console.log('2. Run: npm run dev');
	console.log(`3. Log in at http://localhost:5173/login with ${ADMIN_EMAIL}`);
	console.log('4. Complete 2FA setup on first login');

	await client.end();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
