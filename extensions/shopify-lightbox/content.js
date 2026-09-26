// Pro Shipper — Shopify admin order lightbox.
//
// On an order page in admin.shopify.com, clicking a line-item thumbnail opens
// a full-screen gallery of every line-item image on the page: ← / → to move,
// Esc to close, with the product title, variant and quantity in the footer.
// Mirrors the Lightbox component in the Pro Shipper panel.
//
// Everything runs locally in the page — no network calls of our own, no data
// stored or sent anywhere. If Shopify changes its markup so thumbnails stop
// matching, clicks simply fall through to Shopify's normal behaviour.
(() => {
	'use strict';

	const ORDER_PATH = /\/orders\/\d+/;

	// Shopify CDN size tokens sit right before the extension: `_160x160`,
	// `_x800`, `_800x`, optionally with `_crop_center` and/or `@2x`.
	const SIZE_TOKEN = /_(?:\d+x\d*|x\d+)(?:_crop_[a-z]+)?(?:@\d+x)?(?=\.[a-z0-9]+$)/i;

	const isOrderPage = () => ORDER_PATH.test(location.pathname);

	function srcOf(img) {
		return img.currentSrc || img.src || '';
	}

	function isCdnImage(img) {
		return /(^|\.)cdn\.shopify\.com$/i.test(safeUrl(srcOf(img))?.hostname ?? '');
	}

	function safeUrl(src) {
		try {
			return new URL(src, location.href);
		} catch {
			return null;
		}
	}

	// Strip the size token so the CDN serves the original upload. The `?v=`
	// cache-buster is kept — dropping it can serve a stale image after a
	// product photo is replaced.
	function fullRes(src) {
		const u = safeUrl(src);
		if (!u) return src;
		u.pathname = u.pathname.replace(SIZE_TOKEN, '');
		u.searchParams.delete('width');
		u.searchParams.delete('height');
		u.searchParams.delete('crop');
		return u.toString();
	}

	// `.thumbnail` is Shopify's own wrapper and the primary signal. The CDN +
	// size-token check is the fallback in case that class is ever renamed.
	function isProductThumb(img) {
		if (!img || img.tagName !== 'IMG' || !isCdnImage(img)) return false;
		if (img.closest('.thumbnail')) return true;
		const u = safeUrl(srcOf(img));
		return !!u && SIZE_TOKEN.test(u.pathname);
	}

	// Shopify's admin is built from web components, so line items can live
	// inside shadow roots. Plain querySelectorAll / parentElement / innerText
	// all stop at a shadow boundary; these helpers walk through them.

	// Every element under `root`, descending into open shadow roots.
	function* deepElements(root) {
		const stack = [root];
		while (stack.length) {
			const node = stack.pop();
			const kids = node.children ? Array.from(node.children) : [];
			for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
			if (node.shadowRoot) stack.push(node.shadowRoot);
			if (node !== root && node.nodeType === 1) yield node;
		}
	}

	// Parent that crosses a shadow boundary: from a shadow root's top element
	// up to the host that owns it.
	function deepParent(el) {
		if (el.parentElement) return el.parentElement;
		const root = el.getRootNode?.();
		return root && root.host ? root.host : null;
	}

	// Text lines of an element including shadow content — innerText skips it.
	function deepLines(el) {
		const lines = [];
		const walk = (node) => {
			if (node.nodeType === 3) {
				const t = node.textContent.trim();
				if (t) lines.push(t);
				return;
			}
			if (node.nodeType !== 1 && node.nodeType !== 11) return;
			if (node.nodeType === 1 && /^(SCRIPT|STYLE|TEMPLATE)$/.test(node.tagName)) return;
			if (node.shadowRoot) walk(node.shadowRoot);
			for (const child of node.childNodes) walk(child);
		};
		walk(el);
		return lines;
	}

	function deepThumbs(root) {
		const out = [];
		for (const el of deepElements(root)) if (isProductThumb(el)) out.push(el);
		return out;
	}

	// Shopify can render the same list twice (e.g. one copy per breakpoint),
	// so only count thumbnails that are actually on screen.
	function visibleThumbs() {
		return deepThumbs(document).filter((img) => img.getClientRects().length > 0);
	}

	// The line-item row is the largest ancestor that still holds exactly one
	// thumbnail — climbing further would swallow neighbouring rows and pick
	// up their titles.
	function rowFor(img) {
		let row = null;
		let el = deepParent(img);
		for (let i = 0; i < 14 && el && el !== document.body; i++) {
			if (deepThumbs(el).length !== 1) break;
			row = el;
			el = deepParent(el);
		}
		return row;
	}

	const PRICE = /\d[\d,]*\.\d{2}/;

	// Title/variant/quantity from the row text. Best-effort: anything it can't
	// read is simply left out of the footer. The img `alt` is the image's own
	// alt text, not the product title, so it's only the last resort.
	function infoFor(img) {
		const row = rowFor(img);
		if (!row) return { title: img.alt || '', subtitle: null, quantity: null };

		let link = null;
		for (const el of deepElements(row)) {
			if (el.tagName === 'A' && /\/products\//.test(el.getAttribute('href') || '')) {
				link = el;
				break;
			}
		}
		const lines = deepLines(row);
		const linkText = link ? deepLines(link).join(' ').trim() : '';

		const title = linkText || lines[0] || img.alt || '';
		const titleIdx = lines.indexOf(title);

		const qtyMatch = lines.join(' ').match(/×\s*(\d+)/);
		const quantity = qtyMatch ? Number(qtyMatch[1]) : null;

		const subtitle =
			lines
				.slice(titleIdx >= 0 ? titleIdx + 1 : 1)
				.find(
					(l) =>
						l !== title &&
						l.length <= 80 &&
						!PRICE.test(l) &&
						!l.includes('×') &&
						!/^sku\b/i.test(l) &&
						!/^\d+$/.test(l)
				) ?? null;

		return { title, subtitle, quantity };
	}

	// ---------------------------------------------------------------------
	// Lightbox UI — lives in a Shadow DOM so Shopify's styles can't reach in
	// and ours can't leak out.

	let host = null;
	let ui = null;
	let items = [];
	let index = 0;
	let prevOverflow = '';

	const CSS = `
		:host { all: initial; }
		.overlay {
			position: fixed; inset: 0; z-index: 2147483647;
			background: rgba(0, 0, 0, 0.92);
			display: flex; align-items: center; justify-content: center;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
			user-select: none;
		}
		.stage { position: relative; display: flex; align-items: center; justify-content: center;
			max-width: 92vw; max-height: 80vh; }
		img.main { max-width: 92vw; max-height: 80vh; object-fit: contain; border-radius: 6px;
			transition: opacity 120ms ease; }
		img.main.loading { opacity: 0.35; }
		button {
			all: unset; cursor: pointer; box-sizing: border-box;
			display: flex; align-items: center; justify-content: center;
			color: #fff; background: rgba(255, 255, 255, 0.12);
			border-radius: 999px; transition: background 120ms ease;
		}
		button:hover { background: rgba(255, 255, 255, 0.25); }
		button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
		.close { position: fixed; top: 16px; right: 16px; width: 40px; height: 40px; font-size: 22px; }
		.nav { position: fixed; top: 50%; transform: translateY(-50%); width: 48px; height: 48px; font-size: 26px; }
		.prev { left: 16px; }
		.next { right: 16px; }
		.counter {
			position: fixed; top: 22px; left: 20px;
			color: rgba(255, 255, 255, 0.85); font-size: 13px; font-weight: 600;
			font-variant-numeric: tabular-nums;
		}
		.footer {
			position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
			max-width: 86vw; text-align: center;
		}
		.title { color: #fff; font-size: 14px; font-weight: 500; line-height: 1.35; }
		.meta { margin-top: 6px; display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
		.chip { padding: 2px 7px; border-radius: 4px; font-size: 12px; font-weight: 600;
			background: rgba(255, 255, 255, 0.15); color: rgba(255, 255, 255, 0.92); }
		.qty { padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 700;
			background: rgba(255, 255, 255, 0.9); color: #111; }
		.qty.many { background: #dc2626; color: #fff; }
		[hidden] { display: none !important; }
	`;

	function build() {
		host = document.createElement('div');
		host.id = 'pro-shipper-lightbox';
		const root = host.attachShadow({ mode: 'open' });
		root.innerHTML = `
			<style>${CSS}</style>
			<div class="overlay" role="dialog" aria-modal="true" aria-label="Product images">
				<div class="counter"></div>
				<button class="close" aria-label="Close">✕</button>
				<button class="nav prev" aria-label="Previous image">‹</button>
				<div class="stage"><img class="main" alt="" draggable="false" /></div>
				<button class="nav next" aria-label="Next image">›</button>
				<div class="footer">
					<div class="title"></div>
					<div class="meta"><span class="chip"></span><span class="qty"></span></div>
				</div>
			</div>
		`;
		const $ = (sel) => root.querySelector(sel);
		ui = {
			overlay: $('.overlay'),
			img: $('img.main'),
			counter: $('.counter'),
			prev: $('.prev'),
			next: $('.next'),
			close: $('.close'),
			title: $('.title'),
			chip: $('.chip'),
			qty: $('.qty')
		};

		ui.close.addEventListener('click', close);
		ui.prev.addEventListener('click', (e) => { e.stopPropagation(); go(-1); });
		ui.next.addEventListener('click', (e) => { e.stopPropagation(); go(1); });
		// Clicking the dark backdrop closes; clicking the image doesn't.
		ui.overlay.addEventListener('click', (e) => { if (e.target === ui.overlay) close(); });
		ui.img.addEventListener('load', () => ui.img.classList.remove('loading'));
		ui.img.addEventListener('error', () => {
			// Full-res failed (unusual URL shape) — fall back to the thumbnail.
			const item = items[index];
			if (item && ui.img.src !== item.thumb) ui.img.src = item.thumb;
			ui.img.classList.remove('loading');
		});

		// Swipe on touch screens.
		let startX = null;
		ui.overlay.addEventListener('pointerdown', (e) => { startX = e.clientX; });
		ui.overlay.addEventListener('pointerup', (e) => {
			if (startX === null) return;
			const dx = e.clientX - startX;
			startX = null;
			if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
		});
	}

	function render() {
		const item = items[index];
		if (!item) return;
		ui.img.classList.add('loading');
		ui.img.src = item.full;
		ui.img.alt = item.title;

		const many = items.length > 1;
		ui.counter.textContent = many ? `${index + 1} / ${items.length}` : '';
		ui.prev.hidden = !many;
		ui.next.hidden = !many;

		ui.title.textContent = item.title;
		ui.title.hidden = !item.title;
		ui.chip.textContent = item.subtitle ?? '';
		ui.chip.hidden = !item.subtitle;
		ui.qty.textContent = item.quantity ? `×${item.quantity}` : '';
		ui.qty.hidden = !item.quantity;
		ui.qty.classList.toggle('many', (item.quantity ?? 0) > 1);

		// Warm the neighbours so arrowing through feels instant.
		for (const d of [1, -1]) {
			const n = items[(index + d + items.length) % items.length];
			if (n) new Image().src = n.full;
		}
	}

	function go(delta) {
		if (items.length < 2) return;
		index = (index + delta + items.length) % items.length;
		render();
	}

	// Capture phase + stopPropagation so Shopify's own keyboard shortcuts don't
	// fire underneath the gallery.
	function onKey(e) {
		if (e.key === 'Escape') close();
		else if (e.key === 'ArrowRight') go(1);
		else if (e.key === 'ArrowLeft') go(-1);
		else return;
		e.preventDefault();
		e.stopPropagation();
	}

	// The order page carries other Shopify CDN images besides line items —
	// timeline entries for order edits, staff avatars, app icons. A real line
	// item always shows a price with "× qty"; nothing else on the page does,
	// so that's what separates them.
	const isHeading = (el) =>
		/^(H[1-6]|S-HEADING)$/.test(el.tagName) || el.getAttribute('role') === 'heading';

	// The heading of the card each thumbnail sits in ("Unfulfilled", "Fulfilled",
	// "Removed", …), found as the nearest heading before it in document order —
	// that holds whatever wrappers Shopify puts around a card.
	function sectionHeadings() {
		const map = new Map();
		let last = '';
		for (const el of deepElements(document)) {
			if (isHeading(el)) last = deepLines(el).join(' ').trim();
			else if (isProductThumb(el)) map.set(el, last);
		}
		return map;
	}

	// Edited orders list removed items in their own "Removed" card, still with
	// a price and "× qty" — so they need excluding explicitly.
	function isRemovedItem(img, section, quantity) {
		if (quantity === 0) return true;
		if (/^removed\b/i.test(section)) return true;
		const row = rowFor(img);
		return !!row && deepLines(row).some((l) => /^removed$/i.test(l));
	}

	function galleryFor(clicked) {
		const candidates = visibleThumbs();
		if (!candidates.includes(clicked)) candidates.unshift(clicked);
		const sections = sectionHeadings();

		const all = candidates.map((img) => {
			const info = infoFor(img);
			const section = sections.get(img) ?? '';
			return {
				el: img,
				thumb: srcOf(img),
				full: fullRes(srcOf(img)),
				section,
				removed: isRemovedItem(img, section, info.quantity),
				...info
			};
		});
		const lineItems = all.filter((it) => (it.quantity != null && !it.removed) || it.el === clicked);

		// Fall back to every image only when no quantity parsed anywhere — that
		// means Shopify's markup changed, and a gallery of everything beats a
		// gallery of one. Keying on "any quantity found" rather than on how many
		// items survived keeps a one-item edited order from dragging its removed
		// items back in.
		const parsedAny = all.some((it) => it.quantity != null);
		const chosen = parsedAny ? lineItems : all;

		console.groupCollapsed(`[Pro Shipper lightbox] ${chosen.length} of ${all.length} image(s) in gallery`);
		console.table(
			all.map((it) => ({
				kept: chosen.includes(it),
				section: it.section,
				removed: it.removed,
				title: it.title,
				variant: it.subtitle,
				qty: it.quantity,
				file: it.full.split('/').pop().split('?')[0]
			}))
		);
		console.groupEnd();

		return chosen;
	}

	function open(clicked) {
		items = galleryFor(clicked);
		index = Math.max(0, items.findIndex((it) => it.el === clicked));

		if (!host) build();
		if (!host.isConnected) document.body.appendChild(host);

		prevOverflow = document.documentElement.style.overflow;
		document.documentElement.style.overflow = 'hidden';
		window.addEventListener('keydown', onKey, true);
		render();
		ui.close.focus({ preventScroll: true });
	}

	function close() {
		window.removeEventListener('keydown', onKey, true);
		document.documentElement.style.overflow = prevOverflow;
		host?.remove();
		items = [];
	}

	// ---------------------------------------------------------------------
	// Wiring. One delegated listener on the document means it keeps working
	// as Shopify's single-page app swaps views, with no per-image setup.

	// The click is retargeted at every shadow boundary, so by the time it
	// reaches the document `e.target` is the outer component, not the <img>.
	// composedPath() still lists the real element the click landed on.
	function thumbFromEvent(e) {
		for (const node of e.composedPath()) {
			if (node === document || node === window) break;
			if (node.nodeType !== 1) continue;
			if (isProductThumb(node)) return node;
			// Clicks can land on the .thumbnail wrapper rather than the image.
			if (node.classList?.contains('thumbnail')) {
				const inner = node.querySelector('img');
				if (isProductThumb(inner)) return inner;
			}
		}
		return null;
	}

	document.addEventListener(
		'click',
		(e) => {
			if (!isOrderPage()) return;
			if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

			const img = thumbFromEvent(e);
			if (!img) return;

			// Thumbnails may sit inside a link to the product — stop that
			// navigation and open the gallery instead.
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			open(img);
		},
		true
	);

	console.info('[Pro Shipper lightbox] loaded on', location.pathname);

	// Zoom cursor on thumbnails, only while an order page is showing. Shopify
	// navigates without page loads, so poll the path cheaply rather than
	// patching its router.
	const cursorStyle = document.createElement('style');
	cursorStyle.textContent = 'html[data-pro-shipper-lightbox] .thumbnail img { cursor: zoom-in; }';
	document.head.appendChild(cursorStyle);

	let lastPath = '';
	setInterval(() => {
		if (location.pathname === lastPath) return;
		lastPath = location.pathname;
		document.documentElement.toggleAttribute('data-pro-shipper-lightbox', isOrderPage());
		// One diagnostic line per order page: if this says 0 thumbnails, the
		// page markup has changed and isProductThumb() needs updating.
		if (isOrderPage()) {
			setTimeout(() => {
				console.info(`[Pro Shipper lightbox] order page — ${visibleThumbs().length} thumbnail(s) found`);
			}, 1500);
		}
		// Leaving the order page with the gallery open (browser back) closes it.
		if (!isOrderPage() && host?.isConnected) close();
	}, 500);
})();
