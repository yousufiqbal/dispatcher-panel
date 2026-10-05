// Browser-only: finds where each label's printed content actually is, so cut
// lines can hug the visible label rather than the PDF page box (label PDFs
// carry uneven white space inside the page).

import type { Label } from './label-sheet';

type PdfJs = typeof import('pdfjs-dist');

/** Render resolution for measuring, in pixels per point. 2 is ~0.35 pt accuracy. */
const SCALE = 2;
/** A pixel counts as ink when its darkest channel is below this (skips faint antialiasing). */
const INK_THRESHOLD = 200;

/**
 * Sets `ink` on each label, in the same raw (unrotated) coordinates as its
 * `box`. Labels where nothing is found are left alone, so their cut lines fall
 * back to the page box. Throws only if the PDF itself can't be opened.
 */
export async function measureInk(pdfjs: PdfJs, bytes: Uint8Array, labels: Label[]): Promise<void> {
	const task = pdfjs.getDocument({ data: bytes.slice() });
	try {
		const doc = await task.promise;
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

		for (const label of labels) {
			const page = await doc.getPage(label.index + 1);
			// rotation: 0 renders the raw page, ignoring /Rotate — the same
			// coordinate space as label.box, which placement() then rotates.
			const vp = page.getViewport({ scale: SCALE, rotation: 0 });
			canvas.width = Math.ceil(vp.width);
			canvas.height = Math.ceil(vp.height);
			ctx.fillStyle = '#fff';
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;

			const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
			let minX = width, minY = height, maxX = -1, maxY = -1;
			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const i = (y * width + x) * 4;
					if (Math.min(data[i], data[i + 1], data[i + 2]) < INK_THRESHOLD) {
						if (x < minX) minX = x;
						if (x > maxX) maxX = x;
						if (y < minY) minY = y;
						if (y > maxY) maxY = y;
					}
				}
			}
			page.cleanup();
			if (maxX < 0) continue; // blank page

			// Canvas y runs down, PDF y runs up; view[0..1] is the page box origin.
			const [x0, y0] = page.view;
			label.ink = {
				x: x0 + minX / SCALE,
				y: y0 + (height - (maxY + 1)) / SCALE,
				width: (maxX + 1 - minX) / SCALE,
				height: (maxY + 1 - minY) / SCALE
			};
		}
	} finally {
		task.destroy();
	}
}
