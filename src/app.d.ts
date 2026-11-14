import type { SessionData } from '$lib/server/session';
import type { StoreRecord } from '$lib/server/store';

declare global {
	namespace App {
		interface Locals {
			session: SessionData | null;
			/** The deployment's one store (see $lib/server/store). */
			store: StoreRecord;
		}
		interface PageData {
			session?: SessionData | null;
		}
	}
}

export {};
