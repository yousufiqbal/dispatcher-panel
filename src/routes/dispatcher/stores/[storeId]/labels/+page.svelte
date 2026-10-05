<script lang="ts">
	// Labels — combine courier label PDFs (and PNG/JPG) four per A4 sheet.
	// Everything happens in the browser: files are never uploaded.
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { addToast } from '$lib/toast.svelte';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import PrinterIcon from '@lucide/svelte/icons/printer';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import XIcon from '@lucide/svelte/icons/x';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
	import {
		DEFAULT_SETTINGS,
		PAPER,
		perPage,
		minSpacing,
		buildSheet,
		countLabels,
		outputName,
		readImage,
		readPdf,
		type SheetSettings,
		type SheetSource
	} from '$lib/label-sheet';
	import { measureInk } from '$lib/label-ink';

	type Entry = { id: number; name: string; kind: 'pdf' | 'image'; loading: boolean; error?: string; source?: SheetSource };

	let entries = $state<Entry[]>([]);
	let settings = $state<SheetSettings>({ ...DEFAULT_SETTINGS });
	let output = $state<Uint8Array | null>(null);
	let outputUrl = $state<string | null>(null);
	let building = $state(false);
	let dragOver = $state(false);
	// Rendered preview sheets. Svelte owns the list; each canvas is handed to
	// its slot with an attachment. $state.raw: canvases aren't proxied.
	let sheets = $state.raw<HTMLCanvasElement[]>([]);
	let previewWidth = $state(0);
	let nextId = 1;

	const sources = $derived(entries.flatMap((e) => (e.source && !e.error && !e.loading ? [e.source] : [])));
	const labelCount = $derived(countLabels(sources));
	const pageCount = $derived(Math.ceil(labelCount / perPage(settings)));
	const paperLabel = $derived(PAPER[settings.paper].label);
	// Cut lines need room around each label, so margin and gap have floors
	// while they're on; the sliders start there.
	const floors = $derived(minSpacing(settings));
	const margin = $derived(Math.max(settings.margin, floors.margin));
	const gap = $derived(Math.max(settings.gap, floors.gap));

	// pdf.js only renders the preview, and only exists in the browser.
	let pdfjs: typeof import('pdfjs-dist') | null = null;
	let pdfjsReady: Promise<typeof import('pdfjs-dist')> | null = null;
	onMount(() => {
		pdfjsReady = import('pdfjs-dist').then((lib) => {
			lib.GlobalWorkerOptions.workerSrc = workerUrl;
			pdfjs = lib;
			if (output) renderPreview(output, buildToken);
			return lib;
		});
		// Dropping anywhere on the page adds files, not just on the drop zone.
		const prevent = (e: DragEvent) => e.preventDefault();
		const onDrop = (e: DragEvent) => {
			e.preventDefault();
			if (e.dataTransfer?.files.length) addFiles([...e.dataTransfer.files]);
		};
		window.addEventListener('dragover', prevent);
		window.addEventListener('drop', onDrop);
		return () => {
			window.removeEventListener('dragover', prevent);
			window.removeEventListener('drop', onDrop);
			if (outputUrl) URL.revokeObjectURL(outputUrl);
		};
	});

	// ---- File intake ---------------------------------------------------------
	const isPdf = (f: File) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name);
	const isImage = (f: File) => /^image\/(png|jpe?g)$/i.test(f.type);

	function imageSize(file: File): Promise<{ w: number; h: number }> {
		return new Promise((resolve, reject) => {
			const url = URL.createObjectURL(file);
			const img = new Image();
			img.onload = () => {
				resolve({ w: img.naturalWidth, h: img.naturalHeight });
				URL.revokeObjectURL(url);
			};
			img.onerror = reject;
			img.src = url;
		});
	}

	async function addFiles(files: File[]) {
		const accepted = files.filter((f) => isPdf(f) || isImage(f));
		if (accepted.length < files.length) addToast('Skipped unsupported files — use PDF, PNG or JPG.', 'error');
		for (const f of accepted) {
			const entry: Entry = { id: nextId++, name: f.name, kind: isImage(f) ? 'image' : 'pdf', loading: true };
			entries.push(entry);
			const live = entries[entries.length - 1];
			try {
				const bytes = new Uint8Array(await f.arrayBuffer());
				if (live.kind === 'pdf') {
					const source = await readPdf(f.name, bytes);
					// Measure where each label's ink is so cut lines sit evenly around
					// the printed border. Optional: if it fails, lines use the page box.
					try {
						if (pdfjsReady) await measureInk(await pdfjsReady, bytes, source.labels);
					} catch (err) {
						console.warn('Ink measurement skipped for', f.name, err);
					}
					live.source = source;
				} else {
					const { w, h } = await imageSize(f);
					live.source = readImage(f.name, bytes, w, h);
				}
			} catch (err) {
				console.error(err);
				live.error = 'Could not read this file';
			}
			live.loading = false;
		}
		rebuild();
	}

	function move(i: number, delta: -1 | 1) {
		const j = i + delta;
		if (j < 0 || j >= entries.length) return;
		[entries[i], entries[j]] = [entries[j], entries[i]];
		rebuild();
	}

	function remove(i: number) {
		entries.splice(i, 1);
		rebuild();
	}

	function clearAll() {
		entries = [];
		rebuild();
	}

	// ---- Build + preview -------------------------------------------------------
	// Debounced, and token-guarded so a slider drag doesn't pile up builds: a
	// newer build makes any older one bail out.
	let buildToken = 0;
	let buildTimer: ReturnType<typeof setTimeout> | undefined;

	function rebuild() {
		clearTimeout(buildTimer);
		buildTimer = setTimeout(build, 120);
	}

	async function build() {
		const token = ++buildToken;
		const snapshot = $state.snapshot(settings) as SheetSettings;
		const srcs = sources;
		if (countLabels(srcs) === 0) {
			setOutput(null);
			sheets = [];
			building = false;
			return;
		}
		building = true;
		try {
			const bytes = await buildSheet(srcs, snapshot, () => token !== buildToken);
			if (token !== buildToken || !bytes) return;
			setOutput(bytes);
			await renderPreview(bytes, token);
		} catch (err) {
			console.error(err);
			if (token === buildToken) addToast(`Couldn't build the PDF: ${err instanceof Error ? err.message : err}`, 'error');
		} finally {
			if (token === buildToken) building = false;
		}
	}

	function setOutput(bytes: Uint8Array | null) {
		if (outputUrl) URL.revokeObjectURL(outputUrl);
		output = bytes;
		outputUrl = bytes ? URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' })) : null;
	}

	async function renderPreview(bytes: Uint8Array, token: number) {
		if (!pdfjs) return;
		// pdf.js 6 has no eval-based font rendering, so the CVE-2024-4367 class
		// of malicious-PDF attack (which hit the original app's 3.x) can't apply.
		const task = pdfjs.getDocument({ data: bytes.slice() });
		try {
			const doc = await task.promise;
			// Render at on-screen width × device pixel ratio so it stays crisp.
			const dpr = Math.min(window.devicePixelRatio || 1, 3);
			const cssW = Math.min(Math.max(320, previewWidth / 2 || 0), 760);
			const next: HTMLCanvasElement[] = [];
			for (let n = 1; n <= doc.numPages; n++) {
				const pg = await doc.getPage(n);
				const vp = pg.getViewport({ scale: (cssW / pg.getViewport({ scale: 1 }).width) * dpr });
				const canvas = document.createElement('canvas');
				canvas.width = vp.width;
				canvas.height = vp.height;
				canvas.className = 'w-full h-auto block';
				const ctx = canvas.getContext('2d')!;
				ctx.fillStyle = '#fff';
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				await pg.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
				if (token !== buildToken) return;
				next.push(canvas);
			}
			sheets = next;
		} finally {
			task.destroy();
		}
	}

	// Mounts a rendered canvas into its preview slot.
	const mountCanvas = (canvas: HTMLCanvasElement) => (el: HTMLElement) => {
		el.replaceChildren(canvas);
	};

	// ---- Output ----------------------------------------------------------------
	function download() {
		if (!outputUrl) return;
		const a = document.createElement('a');
		a.href = outputUrl;
		a.download = outputName(sources, settings.paper);
		document.body.appendChild(a);
		a.click();
		a.remove();
	}

	function openToPrint() {
		if (!outputUrl) return;
		if (!window.open(outputUrl, '_blank')) addToast('Pop-up blocked — use Download instead.', 'error');
	}

	function set<K extends keyof SheetSettings>(key: K, value: SheetSettings[K]) {
		settings[key] = value;
		rebuild();
	}
</script>

<svelte:head>
	<title>Labels — Pro Shipper</title>
</svelte:head>

{#snippet seg<K extends 'paper' | 'orient' | 'dir'>(key: K, options: [SheetSettings[K], string][], disabled = false)}
	<div class="inline-flex w-full rounded-lg border border-border bg-muted/40 p-0.5 text-xs {disabled ? 'opacity-50 pointer-events-none' : ''}">
		{#each options as [value, label] (value)}
			<button
				type="button"
				onclick={() => set(key, value)}
				class="flex-1 px-2.5 py-1.5 rounded-md font-medium transition-colors {settings[key] === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
			>
				{label}
			</button>
		{/each}
	</div>
{/snippet}

<div class="p-3 sm:p-6">
	<p class="text-sm text-muted-foreground mb-4">
		Drop label PDFs — every page becomes one label, turned to portrait and packed four per A4 sheet, or one per 4×6 page for a thermal printer. Files stay on this computer; nothing is uploaded.
	</p>

	<div class="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
		<!-- Controls -->
		<aside class="space-y-4">
			<div class="card p-3 space-y-3">
				<label
					for="label-files"
					class="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors
						{dragOver ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}"
					ondragenter={(e) => { e.preventDefault(); dragOver = true; }}
					ondragover={(e) => { e.preventDefault(); dragOver = true; }}
					ondragleave={() => (dragOver = false)}
					ondrop={() => (dragOver = false)}
				>
					<UploadIcon class="size-6 text-muted-foreground mb-1" />
					<span class="text-sm font-medium">Drop label files here</span>
					<span class="text-xs text-muted-foreground">or click to browse · PDF, PNG, JPG · multiple OK</span>
					<input
						id="label-files"
						type="file"
						accept="application/pdf,.pdf,image/png,image/jpeg"
						multiple
						class="hidden"
						onchange={(e) => {
							addFiles([...(e.currentTarget.files ?? [])]);
							e.currentTarget.value = '';
						}}
					/>
				</label>

				{#if entries.length > 0}
					<ul class="space-y-1.5">
						{#each entries as e, i (e.id)}
							<li class="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
								<span class="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{e.kind === 'pdf' ? 'PDF' : 'IMG'}</span>
								<div class="min-w-0 flex-1">
									<div class="truncate text-xs font-medium" title={e.name}>{e.name}</div>
									<div class="text-[11px] {e.error ? 'text-destructive' : 'text-muted-foreground'}">
										{#if e.loading}Reading…{:else if e.error}{e.error}{:else}{e.source?.labels.length} label{e.source?.labels.length === 1 ? '' : 's'}{/if}
									</div>
								</div>
								<div class="flex shrink-0 items-center">
									<button type="button" class="p-1 rounded text-muted-foreground hover:bg-accent disabled:opacity-30" title="Move up" disabled={i === 0} onclick={() => move(i, -1)}><ArrowUpIcon class="size-3.5" /></button>
									<button type="button" class="p-1 rounded text-muted-foreground hover:bg-accent disabled:opacity-30" title="Move down" disabled={i === entries.length - 1} onclick={() => move(i, 1)}><ArrowDownIcon class="size-3.5" /></button>
									<button type="button" class="p-1 rounded text-muted-foreground hover:bg-accent hover:text-destructive" title="Remove" onclick={() => remove(i)}><XIcon class="size-3.5" /></button>
								</div>
							</li>
						{/each}
					</ul>
					<div class="flex items-center justify-between text-xs text-muted-foreground">
						<span>{entries.length} file{entries.length === 1 ? '' : 's'} · {labelCount} labels</span>
						<button type="button" class="hover:text-foreground underline" onclick={clearAll}>Clear all</button>
					</div>
				{/if}
			</div>

			<div class="card p-3 space-y-3 text-sm">
				<div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Layout</div>

				<div class="space-y-1.5">
					<span class="text-xs text-muted-foreground">Paper</span>
					{@render seg('paper', [['a4', 'A4 · 4 per sheet'], ['4x6', '4×6 in · 1 per page']])}
				</div>

				<div class="space-y-1.5">
					<span class="text-xs text-muted-foreground">Orientation</span>
					{@render seg('orient', [['auto', 'Auto portrait'], ['keep', 'Keep as is']])}
				</div>
				<div class="space-y-1.5">
					<span class="text-xs text-muted-foreground">Rotate direction</span>
					{@render seg('dir', [['cw', '↻ Clockwise'], ['ccw', '↺ Counter']], settings.orient !== 'auto')}
				</div>

				<label class="flex items-center justify-between gap-3 cursor-pointer">
					<span class="text-xs">Flip 180° <span class="text-muted-foreground">(if labels come out upside down)</span></span>
					<input type="checkbox" class="size-4 accent-primary" checked={settings.flip} onchange={(e) => set('flip', e.currentTarget.checked)} />
				</label>

				{#if settings.paper === 'a4'}
				<label class="block space-y-1">
					<span class="flex justify-between text-xs"><span>Page margin</span><span class="font-mono text-muted-foreground">{margin} mm</span></span>
					<input type="range" min={floors.margin} max="20" step="1" class="w-full accent-primary" value={margin} oninput={(e) => set('margin', +e.currentTarget.value)} />
				</label>
				<label class="block space-y-1">
					<span class="flex justify-between text-xs"><span>Gap between labels</span><span class="font-mono text-muted-foreground">{gap} mm</span></span>
					<input type="range" min={floors.gap} max="20" step="1" class="w-full accent-primary" value={gap} oninput={(e) => set('gap', +e.currentTarget.value)} />
				</label>

				<label class="flex items-center justify-between gap-3 cursor-pointer">
					<span class="text-xs">Dashed cut lines</span>
					<input type="checkbox" class="size-4 accent-primary" checked={settings.cutLines} onchange={(e) => set('cutLines', e.currentTarget.checked)} />
				</label>
				<label class="flex items-center justify-between gap-3 cursor-pointer">
					<span class="text-xs">Fill column-first <span class="text-muted-foreground">(↓ then →)</span></span>
					<input type="checkbox" class="size-4 accent-primary" checked={settings.colFirst} onchange={(e) => set('colFirst', e.currentTarget.checked)} />
				</label>
				{:else}
					<p class="text-xs text-muted-foreground">Each label fills its own 4×6 page, edge to edge — for thermal label printers.</p>
				{/if}
			</div>

			<div class="card grid grid-cols-3 divide-x divide-border text-center">
				<div class="py-3"><div class="text-xl font-bold tabular-nums">{labelCount}</div><div class="text-[11px] text-muted-foreground">labels</div></div>
				<div class="py-3"><div class="text-xl font-bold tabular-nums">{pageCount}</div><div class="text-[11px] text-muted-foreground">{paperLabel} pages</div></div>
				<div class="py-3"><div class="text-xl font-bold tabular-nums">{Math.max(0, labelCount - pageCount)}</div><div class="text-[11px] text-muted-foreground">sheets saved</div></div>
			</div>

			<div class="grid grid-cols-2 gap-2">
				<Button onclick={download} disabled={!output || building}><DownloadIcon class="size-4" />Download PDF</Button>
				<Button variant="outline" onclick={openToPrint} disabled={!output || building}><PrinterIcon class="size-4" />Open &amp; print</Button>
			</div>
			<p class="text-xs text-muted-foreground">When printing, choose <strong>{settings.paper === '4x6' ? '4×6 in (101.6 × 152.4 mm)' : 'A4'}</strong> paper and <strong>Actual size / 100%</strong> scale.</p>
		</aside>

		<!-- Preview -->
		<section class="min-w-0">
			<div class="flex items-center justify-between mb-2">
				<span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</span>
				<span class="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
					{#if building}<Loader2Icon class="size-3 animate-spin" />Building…{:else if output}{pageCount} page{pageCount === 1 ? '' : 's'} · {paperLabel}{/if}
				</span>
			</div>
			{#if labelCount === 0}
				<div class="card border-dashed py-16 text-center">
					<div class="mx-auto mb-3 grid w-16 grid-cols-2 gap-1 opacity-30">
						<div class="aspect-[2/3] rounded-sm bg-muted-foreground"></div>
						<div class="aspect-[2/3] rounded-sm bg-muted-foreground"></div>
						<div class="aspect-[2/3] rounded-sm bg-muted-foreground"></div>
						<div class="aspect-[2/3] rounded-sm bg-muted-foreground"></div>
					</div>
					<p class="text-sm text-muted-foreground">Your A4 sheets will appear here.</p>
				</div>
			{/if}
			<div bind:clientWidth={previewWidth} class="grid gap-4 sm:grid-cols-2 {labelCount === 0 ? 'hidden' : ''}">
				{#each sheets as canvas, i (canvas)}
					<div class="rounded-md border border-border bg-white shadow-sm overflow-hidden">
						<div {@attach mountCanvas(canvas)}></div>
						<div class="px-2 py-1 text-[11px] text-muted-foreground border-t border-border bg-muted/30">Page {i + 1} / {sheets.length}</div>
					</div>
				{/each}
			</div>
		</section>
	</div>
</div>
