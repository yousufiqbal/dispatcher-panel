// Label Sheet — packs label pages 4-up (2×2) onto A4, rotated to portrait.
// Ported from the PostEx Labels Combiner app. Pure pdf-lib, so it runs in the
// browser (the Labels page) and in Node (tests) alike — files never leave the
// machine.

import {
	PDFDocument,
	degrees,
	rgb,
	PDFName,
	PDFNumber,
	PDFBool,
	PDFArray,
	PDFRawStream,
	decodePDFRawStream,
	type PDFPage,
	type PDFEmbeddedPage,
	type PDFImage,
	type PDFContext,
	type PDFDict,
	type PDFObject
} from 'pdf-lib';

export const A4 = { w: 595.28, h: 841.89 }; // points
const MM = 72 / 25.4;

export type Paper = 'a4' | '4x6';

/** Page sizes in points, portrait. 4×6 in is the standard thermal label size. */
export const PAPER: Record<Paper, { w: number; h: number; label: string }> = {
	a4: { ...A4, label: 'A4' },
	'4x6': { w: 4 * 72, h: 6 * 72, label: '4×6' }
};

/** A4 packs four labels 2×2; 4×6 holds one label per page. */
export function perPage(s: Pick<SheetSettings, 'paper'>): number {
	return s.paper === '4x6' ? 1 : 4;
}

export interface SheetSettings {
	/**
	 * Output paper. 4×6 puts one label per page, edge to edge — a PostEx label
	 * is exactly 4×6 in once turned upright — so margin, gap, cut lines and fill
	 * order only apply to A4.
	 */
	paper: Paper;
	/** 'auto' rotates landscape labels to portrait; 'keep' leaves them as they are. */
	orient: 'auto' | 'keep';
	/** Which way 'auto' turns a landscape label. */
	dir: 'cw' | 'ccw';
	/** Extra 180° turn, for labels that come out upside down. */
	flip: boolean;
	/** Page margin, mm. */
	margin: number;
	/** Gap between labels, mm. */
	gap: number;
	cutLines: boolean;
	/** Fill down then across instead of across then down. */
	colFirst: boolean;
}

export const DEFAULT_SETTINGS: SheetSettings = {
	paper: 'a4',
	orient: 'auto',
	dir: 'cw',
	flip: false,
	margin: 7,
	gap: 8,
	cutLines: true,
	colFirst: false
};

interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Label {
	index: number;
	/** Raw (unrotated) size, points for PDFs, pixels for images. */
	w: number;
	h: number;
	/** The page's own /Rotate, normalised to 0/90/180/270. */
	rot: number;
	box?: Box;
	/**
	 * Where the printed content actually is, in the same raw coordinates as
	 * `box`. Label PDFs carry white space inside the page; cut lines hug this
	 * instead of the page box so they sit evenly around the visible label.
	 * Measured in the browser (see measureInk); absent means "use the box".
	 */
	ink?: Box;
}

export interface SheetSource {
	name: string;
	kind: 'pdf' | 'image';
	bytes: Uint8Array;
	labels: Label[];
	/** Loaded document for PDFs. */
	src?: PDFDocument;
}

const norm = (a: number) => (((Math.round(a / 90) * 90) % 360) + 360) % 360;

/** Reads a PDF: one label per page. Throws if the file can't be parsed. */
export async function readPdf(name: string, bytes: Uint8Array): Promise<SheetSource> {
	const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
	const labels = src.getPages().map((p, index) => {
		const box = p.getCropBox();
		return { index, w: box.width, h: box.height, rot: norm(p.getRotation().angle), box };
	});
	return { name, kind: 'pdf', bytes, labels, src };
}

/** Wraps a PNG/JPG (its pixel size measured by the caller) as a single label. */
export function readImage(name: string, bytes: Uint8Array, w: number, h: number): SheetSource {
	return { name, kind: 'image', bytes, labels: [{ index: 0, w, h, rot: 0 }] };
}

export function countLabels(sources: SheetSource[]): number {
	return sources.reduce((n, s) => n + s.labels.length, 0);
}

// ---------- Geometry ----------

/** Final clockwise rotation to apply to the raw (unrotated) label content. */
function finalRotation(label: Label, s: SheetSettings): number {
	let r = label.rot; // what a viewer shows by default
	if (s.orient === 'auto') {
		const shownW = r % 180 ? label.h : label.w;
		const shownH = r % 180 ? label.w : label.h;
		if (shownW > shownH) r += s.dir === 'cw' ? 90 : 270;
	}
	if (s.flip) r += 180;
	return norm(r);
}

type Cell = Box & { col: number; row: number };

/** Distance from each label's printed edge to its cut line, mm. */
export const CUT_OFFSET_MM = 4;
/** Paper edge most printers can't print on, mm. A cut line must sit inside it. */
const UNPRINTABLE_MM = 3;

/**
 * Smallest margin and gap that leave room for cut lines CUT_OFFSET_MM from
 * every label edge: the outer lines need to stay printable, and two labels
 * need room for one shared line CUT_OFFSET_MM from each.
 */
export function minSpacing(s: Pick<SheetSettings, 'paper' | 'cutLines'>): { margin: number; gap: number } {
	if (s.paper !== 'a4' || !s.cutLines) return { margin: 0, gap: 0 };
	return { margin: CUT_OFFSET_MM + UNPRINTABLE_MM, gap: CUT_OFFSET_MM * 2 };
}

function cells(s: SheetSettings): Cell[] {
	if (s.paper === '4x6') return [{ x: 0, y: 0, width: PAPER['4x6'].w, height: PAPER['4x6'].h, col: 0, row: 0 }];
	const min = minSpacing(s);
	const m = Math.max(s.margin, min.margin) * MM;
	const g = Math.max(s.gap, min.gap) * MM;
	const cw = (A4.w - 2 * m - g) / 2;
	const ch = (A4.h - 2 * m - g) / 2;
	const pos: Cell[] = [];
	for (let k = 0; k < 4; k++) {
		const col = s.colFirst ? Math.floor(k / 2) : k % 2;
		const row = s.colFirst ? k % 2 : Math.floor(k / 2);
		pos.push({ x: m + col * (cw + g), y: A4.h - m - (row + 1) * ch - row * g, width: cw, height: ch, col, row });
	}
	return pos;
}

/**
 * Place content of raw size (w,h), rotated clockwise by r, centred and fitted
 * in the cell. pdf-lib rotates counter-clockwise about (x,y), hence the
 * origin shift and the negated angle.
 */
function placement(w: number, h: number, r: number, cell: Box, ink?: { u: number; v: number; w: number; h: number }) {
	const fw = r % 180 ? h : w; // footprint after rotation
	const fh = r % 180 ? w : h;
	const sc = Math.min(cell.width / fw, cell.height / fh);
	const sw = w * sc;
	const sh = h * sc;
	const bx = cell.x + (cell.width - fw * sc) / 2; // footprint bottom-left
	const by = cell.y + (cell.height - fh * sc) / 2;
	let x = bx;
	let y = by;
	if (r === 90) y = by + sw;
	else if (r === 180) {
		x = bx + sw;
		y = by + sh;
	} else if (r === 270) x = bx + sh;
	// The printed content's rectangle, carried through the same clockwise
	// rotation and scaling. (u, v) is a raw point measured from the label's
	// bottom-left; this is where it lands relative to the footprint corner.
	const map = (u: number, v: number): [number, number] => {
		if (r === 90) return [v, w - u];
		if (r === 180) return [w - u, h - v];
		if (r === 270) return [h - v, u];
		return [u, v];
	};
	let footprint: Box = { x: bx, y: by, width: fw * sc, height: fh * sc };
	if (ink) {
		const corners = [map(ink.u, ink.v), map(ink.u + ink.w, ink.v + ink.h)];
		const xs = corners.map((c) => bx + c[0] * sc);
		const ys = corners.map((c) => by + c[1] * sc);
		footprint = { x: Math.min(...xs), y: Math.min(...ys), width: Math.abs(xs[1] - xs[0]), height: Math.abs(ys[1] - ys[0]) };
	}

	return {
		draw: { x, y, width: sw, height: sh, rotate: degrees(-r) },
		/** Where the visible label lands on the page — its ink if measured, else the whole page box. */
		footprint
	};
}

const CUT_OFFSET = CUT_OFFSET_MM * MM;

/**
 * Edges of the cut lines along one axis. Each column (or row) gets a line
 * CUT_OFFSET outside its labels on both sides, so every label has the same
 * narrow border all round. Where two neighbours are too close for two lines,
 * they share one down the middle of the gap.
 */
function cutPositions(spans: { lo: number; hi: number }[]): number[] {
	const sorted = [...spans].sort((a, b) => a.lo - b.lo);
	const lines: number[] = [];
	sorted.forEach((span, i) => {
		const lo = span.lo - CUT_OFFSET;
		const prev = lines[lines.length - 1];
		if (i > 0 && prev !== undefined && lo <= prev) lines[lines.length - 1] = (sorted[i - 1].hi + span.lo) / 2;
		else lines.push(lo);
		lines.push(span.hi + CUT_OFFSET);
	});
	return lines;
}

/**
 * Dashed guides on all four sides of every label, running edge to edge across
 * the page so a trimmer can cut a whole row or column in one pass. Lines sit
 * between rows and columns, so they never cross a label.
 */
function drawCutLines(page: PDFPage, placed: { cell: Cell; footprint: Box }[]) {
	const { width: pw, height: ph } = page.getSize();
	const style = { thickness: 0.5, color: rgb(0.55, 0.55, 0.55), dashArray: [3, 3] };

	const spansBy = (key: 'col' | 'row') => {
		const groups = new Map<number, { lo: number; hi: number }>();
		for (const { cell, footprint: f } of placed) {
			const lo = key === 'col' ? f.x : f.y;
			const hi = key === 'col' ? f.x + f.width : f.y + f.height;
			const g = groups.get(cell[key]);
			groups.set(cell[key], g ? { lo: Math.min(g.lo, lo), hi: Math.max(g.hi, hi) } : { lo, hi });
		}
		return [...groups.values()];
	};

	for (const x of cutPositions(spansBy('col'))) {
		page.drawLine({ start: { x, y: 0 }, end: { x, y: ph }, ...style });
	}
	for (const y of cutPositions(spansBy('row'))) {
		page.drawLine({ start: { x: 0, y }, end: { x: pw, y }, ...style });
	}
}

// ---------- Build ----------

/**
 * Builds the A4 sheet PDF. Returns null when there's nothing to build, or when
 * `isStale` reports that a newer build has superseded this one (settings
 * changed mid-build).
 */
export async function buildSheet(
	sources: SheetSource[],
	s: SheetSettings,
	isStale: () => boolean = () => false
): Promise<Uint8Array | null> {
	// A saved zero-page PDF reads back as one blank page, so never produce one.
	if (countLabels(sources) === 0) return null;
	const out = await PDFDocument.create();
	const paper = PAPER[s.paper];
	const per = perPage(s);
	out.setTitle(s.paper === '4x6' ? 'Labels — 4×6' : 'Labels — 4 per A4');
	out.setProducer('Pro Shipper Label Sheet');
	const grid = cells(s);

	// Embed everything first, in order.
	const items: { kind: 'pdf' | 'image'; obj: PDFEmbeddedPage | PDFImage; label: Label }[] = [];
	for (const f of sources) {
		if (f.kind === 'pdf' && f.src) {
			const pagesSrc = f.src.getPages();
			const boxes = f.labels.map((l) => {
				const b = l.box!;
				return { left: b.x, bottom: b.y, right: b.x + b.width, top: b.y + b.height };
			});
			const embedded = await out.embedPages(pagesSrc, boxes);
			f.labels.forEach((l, i) => items.push({ kind: 'pdf', obj: embedded[i], label: l }));
		} else if (f.kind === 'image') {
			const isPng = f.bytes[0] === 0x89 && f.bytes[1] === 0x50;
			const img = isPng ? await out.embedPng(f.bytes) : await out.embedJpg(f.bytes);
			items.push({ kind: 'image', obj: img, label: f.labels[0] });
		}
		if (isStale()) return null;
	}

	// Cut lines need every label on the sheet placed first (they hug the
	// actual label edges), so collect footprints and draw per page at the end.
	const sheets: { page: PDFPage; placed: { cell: Cell; footprint: Box }[] }[] = [];
	items.forEach((it, i) => {
		const slot = i % per;
		if (slot === 0) sheets.push({ page: out.addPage([paper.w, paper.h]), placed: [] });
		const sheet = sheets[sheets.length - 1];
		const { box, ink } = it.label;
		const inkRel = box && ink ? { u: ink.x - box.x, v: ink.y - box.y, w: ink.width, h: ink.height } : undefined;
		const { draw, footprint } = placement(it.label.w, it.label.h, finalRotation(it.label, s), grid[slot], inkRel);
		if (it.kind === 'pdf') sheet.page.drawPage(it.obj as PDFEmbeddedPage, draw);
		else sheet.page.drawImage(it.obj as PDFImage, draw);
		sheet.placed.push({ cell: grid[slot], footprint });
	});
	if (s.cutLines && s.paper === 'a4') for (const sh of sheets) drawCutLines(sh.page, sh.placed);

	sharpenImages(out);
	const bytes = await out.save();
	return isStale() ? null : bytes;
}

// ---------- Image sharpening ----------
/*
 * Courier labels embed barcodes/QR codes as tiny bitmaps (e.g. 312×5 px) that
 * viewers and printers smooth when scaling up, which makes them blurry.
 * Upscale every small Flate-encoded image with nearest-neighbour so edges stay
 * crisp at any zoom.
 */
const TARGET_PX = 1200;
const MAX_FACTOR = 8;
const MAX_BYTES = 24e6;

function sharpenImages(doc: PDFDocument) {
	const ctx = doc.context;
	for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
		if (!(obj instanceof PDFRawStream)) continue;
		try {
			const next = upscaleImage(ctx, obj);
			if (next) ctx.assign(ref, next);
		} catch (err) {
			console.warn('Skipped image', ref.toString(), err);
		}
	}
}

function upscaleImage(ctx: PDFContext, stream: PDFRawStream) {
	const d = stream.dict;
	const name = (k: string) => {
		const v = d.lookup(PDFName.of(k));
		return v instanceof PDFName ? v.asString() : null;
	};
	const num = (dict: PDFDict | undefined, k: string) => {
		const v = dict?.lookup(PDFName.of(k));
		return v instanceof PDFNumber ? v.asNumber() : null;
	};
	if (name('Subtype') !== '/Image') return null;

	// Only plain Flate (possibly with PNG predictor); leave JPEG, JBIG2, CCITT etc. alone.
	let filter: PDFObject | undefined = d.lookup(PDFName.of('Filter'));
	if (filter instanceof PDFArray) filter = filter.size() === 1 ? filter.lookup(0) : undefined;
	if (!(filter instanceof PDFName) || filter.asString() !== '/FlateDecode') return null;
	let parms: PDFObject | undefined = d.lookup(PDFName.of('DecodeParms'));
	if (parms instanceof PDFArray) parms = parms.lookup(0);

	const w = num(d, 'Width');
	const h = num(d, 'Height');
	const isMask = d.lookup(PDFName.of('ImageMask')) === PDFBool.True;
	const bpc = isMask ? 1 : num(d, 'BitsPerComponent');
	const colors = isMask ? 1 : colorComponents(d.lookup(PDFName.of('ColorSpace')));
	if (!w || !h || !bpc || !colors) return null;
	const bpp = bpc * colors; // bits per pixel
	if (bpp % 8 && 8 % bpp) return null;

	const k = Math.min(MAX_FACTOR, Math.ceil(TARGET_PX / Math.max(w, h)));
	if (k < 2) return null;
	const srcRow = Math.ceil((w * bpp) / 8);
	const dstRow = Math.ceil((w * k * bpp) / 8);
	if (dstRow * h * k > MAX_BYTES) return null;

	let data = decodePDFRawStream(stream).decode();
	const predictor = num(parms as PDFDict | undefined, 'Predictor') || 1;
	if (predictor >= 10) data = unPng(data, srcRow, Math.max(1, Math.ceil(bpp / 8)), h);
	else if (predictor !== 1) return null;
	if (data.length < srcRow * h) return null;

	// Scale one row horizontally, then repeat it k times vertically.
	const out = new Uint8Array(dstRow * h * k);
	const row = new Uint8Array(dstRow);
	for (let y = 0; y < h; y++) {
		row.fill(0);
		const s = y * srcRow;
		if (bpp % 8 === 0) {
			const pb = bpp / 8;
			for (let x = 0, o = 0; x < w; x++) {
				const p = s + x * pb;
				for (let r = 0; r < k; r++) for (let b = 0; b < pb; b++) row[o++] = data[p + b];
			}
		} else {
			const mask = (1 << bpp) - 1;
			for (let x = 0, o = 0; x < w; x++) {
				const bit = x * bpp;
				const v = (data[s + (bit >> 3)] >> (8 - bpp - (bit & 7))) & mask;
				for (let r = 0; r < k; r++, o += bpp) row[o >> 3] |= v << (8 - bpp - (o & 7));
			}
		}
		for (let r = 0; r < k; r++) out.set(row, (y * k + r) * dstRow);
	}

	const next = ctx.flateStream(out);
	for (const [key, val] of d.entries()) {
		const k2 = key.asString();
		if (['/Filter', '/DecodeParms', '/Length', '/Width', '/Height', '/Interpolate'].includes(k2)) continue;
		next.dict.set(key, val);
	}
	next.dict.set(PDFName.of('Width'), PDFNumber.of(w * k));
	next.dict.set(PDFName.of('Height'), PDFNumber.of(h * k));
	next.dict.set(PDFName.of('Interpolate'), PDFBool.False);
	return next;
}

function colorComponents(cs: PDFObject | undefined): number {
	if (cs instanceof PDFName) {
		const map: Record<string, number> = {
			'/DeviceGray': 1, '/CalGray': 1, '/G': 1,
			'/DeviceRGB': 3, '/CalRGB': 3, '/RGB': 3,
			'/DeviceCMYK': 4, '/CMYK': 4
		};
		return map[cs.asString()] || 0;
	}
	if (cs instanceof PDFArray && cs.size()) {
		const first = cs.lookup(0);
		const kind = first instanceof PDFName ? first.asString() : '';
		if (kind === '/Indexed' || kind === '/I') return 1;
		if (kind === '/CalGray') return 1;
		if (kind === '/CalRGB' || kind === '/Lab') return 3;
		if (kind === '/ICCBased') {
			const icc = cs.lookup(1) as PDFObject & { dict?: PDFDict };
			const n = icc?.dict?.lookup(PDFName.of('N'));
			return n instanceof PDFNumber ? n.asNumber() : 0;
		}
	}
	return 0;
}

/** Reverse PNG row filters (PDF Predictor >= 10). */
function unPng(src: Uint8Array, rowLen: number, bpp: number, rows: number): Uint8Array {
	const out = new Uint8Array(rowLen * rows);
	let prev = new Uint8Array(rowLen);
	for (let y = 0, p = 0; y < rows && p < src.length; y++) {
		const type = src[p++];
		const cur = out.subarray(y * rowLen, (y + 1) * rowLen);
		for (let i = 0; i < rowLen; i++) {
			const raw = src[p++] || 0;
			const a = i >= bpp ? cur[i - bpp] : 0;
			const b = prev[i];
			const c = i >= bpp ? prev[i - bpp] : 0;
			let v: number;
			switch (type) {
				case 1: v = raw + a; break;
				case 2: v = raw + b; break;
				case 3: v = raw + ((a + b) >> 1); break;
				case 4: {
					const pa = Math.abs(b - c);
					const pb = Math.abs(a - c);
					const pc = Math.abs(a + b - 2 * c);
					v = raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
					break;
				}
				default: v = raw;
			}
			cur[i] = v & 0xff;
		}
		prev = cur;
	}
	return out;
}

/** "label-A4.pdf" / "label-4x6.pdf", with "-combined" for several inputs. */
export function outputName(sources: SheetSource[], paper: Paper = 'a4'): string {
	const base = sources[0] ? sources[0].name.replace(/\.[^.]+$/, '') : 'labels';
	return `${base}${sources.length > 1 ? '-combined' : ''}-${paper === '4x6' ? '4x6' : 'A4'}.pdf`;
}
