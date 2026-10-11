import { MAX_DOCUMENT_BYTES, type ScanLine } from '@prana/shared';

/** What the review screen needs from a chosen file. Everything here happens in the browser. */
export interface Extracted {
  kind: 'pdf' | 'image';
  /** Text runs from the first page; empty for photos and for PDFs without a text layer. */
  lines: ScanLine[];
  pageWidth: number;
  pageHeight: number;
  /** An image of the first page, as an object URL. Release it with URL.revokeObjectURL. */
  previewUrl: string;
  pages: number;
}

export type ImportStep = 'loading' | 'reading' | 'filling';
export type FileProblem = 'type' | 'size';

const PREVIEW_SCALE = 2;

/** The web app takes PDF, JPG and PNG, up to 20 MB. Returns what is wrong with the file, if anything. */
export function checkFile(file: File): FileProblem | null {
  const name = file.name.toLowerCase();
  const pdf = file.type === 'application/pdf' || name.endsWith('.pdf');
  const image = file.type === 'image/jpeg' || file.type === 'image/png' || /\.(jpe?g|png)$/.test(name);
  if (!pdf && !image) return 'type';
  if (file.size > MAX_DOCUMENT_BYTES) return 'size';
  return null;
}

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/** Reads a chosen file: a PDF's text layer and first page, or an image as it is. */
export async function extractFile(file: File, onStep: (step: ImportStep) => void): Promise<Extracted> {
  onStep('loading');
  if (!isPdf(file)) {
    const previewUrl = URL.createObjectURL(file);
    try {
      const bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;
      bitmap.close();
      return { kind: 'image', lines: [], pageWidth: width, pageHeight: height, previewUrl, pages: 1 };
    } catch (error) {
      URL.revokeObjectURL(previewUrl);
      throw error;
    }
  }

  // pdf.js is large, so it is fetched only when a PDF is actually imported.
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });

    onStep('reading');
    const content = await page.getTextContent();
    const runs: ScanLine[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      // transform = [a, b, c, d, x, y] with the origin at the bottom-left; d is the font height.
      const height = item.height || Math.abs(item.transform[3] ?? 0);
      runs.push({ text: item.str, x: item.transform[4] ?? 0, y: viewport.height - (item.transform[5] ?? 0) - height, width: item.width, height, confidence: 1 });
    }

    const canvas = document.createElement('canvas');
    const scaled = page.getViewport({ scale: PREVIEW_SCALE });
    canvas.width = Math.ceil(scaled.width);
    canvas.height = Math.ceil(scaled.height);
    await page.render({ canvas, viewport: scaled }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('could not render the page');

    return { kind: 'pdf', lines: joinRuns(runs), pageWidth: viewport.width, pageHeight: viewport.height, previewUrl: URL.createObjectURL(blob), pages: pdf.numPages };
  } finally {
    void task.destroy();
  }
}

/**
 * A PDF often splits one phrase into several runs. Runs on the same baseline with no more
 * than a space between them are joined; a label and its value further along stay apart.
 */
export function joinRuns(runs: ScanLine[]): ScanLine[] {
  const sorted = [...runs].sort((a, b) => (Math.abs(a.y - b.y) < 0.5 * Math.min(a.height, b.height) ? a.x - b.x : a.y - b.y));
  const lines: ScanLine[] = [];
  for (const run of sorted) {
    const last = lines[lines.length - 1];
    const sameBaseline = last && Math.abs(last.y - run.y) < 0.5 * Math.min(last.height, run.height);
    const gap = last ? run.x - (last.x + last.width) : Number.POSITIVE_INFINITY;
    if (last && sameBaseline && gap < 0.6 * last.height && gap > -0.5 * last.height) {
      const spaced = gap > 0.15 * last.height && !last.text.endsWith(' ') && !run.text.startsWith(' ');
      last.text += (spaced ? ' ' : '') + run.text;
      last.width = run.x + run.width - last.x;
      last.height = Math.max(last.height, run.height);
    } else {
      lines.push({ ...run });
    }
  }
  return lines;
}
