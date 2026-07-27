// In-memory draft for the "build lines -> review -> save" purchase flow.
// Deliberately not persisted (no localStorage) — it only needs to survive the
// Review <-> New back-and-forth within the same session.

export interface DraftLine {
	key: string;
	variantId: string;
	productId: string;
	productTitle: string;
	variantTitle: string | null;
	sku: string;
	imageUrl: string | null;
	quantity: number;
	unitCost: string;
}

export interface DraftHeader {
	supplier: string;
	purchaseDate: string;
	note: string;
}

let lines = $state<DraftLine[]>([]);
let header = $state<DraftHeader>({ supplier: '', purchaseDate: '', note: '' });

export function getDraftLines(): DraftLine[] {
	return lines;
}

export function setDraftLines(l: DraftLine[]): void {
	lines = l;
}

export function getDraftHeader(): DraftHeader {
	return header;
}

export function setDraftHeader(h: DraftHeader): void {
	header = h;
}

export function clearDraft(): void {
	lines = [];
	header = { supplier: '', purchaseDate: '', note: '' };
}
