import { foldText, splitFullName } from './text';

/**
 * Reading a list of members from a spreadsheet: CSV (any of , ; or tab, UTF-8 or the Windows encodings Excel
 * writes) and Excel .xlsx (the first sheet). The old binary .xls is not read: save it as .xlsx or CSV.
 * Used by the API for both the web app and the iPhone app, so both read a file the same way.
 */

export class SpreadsheetError extends Error {
  constructor(readonly reason: 'unreadable' | 'old_excel' | 'no_name_column') {
    super(reason);
  }
}

/** The cells of the file, row by row, as text. */
export async function readTable(bytes: Uint8Array): Promise<string[][]> {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return readXlsx(bytes);
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) throw new SpreadsheetError('old_excel');
  return parseCsv(decodeText(bytes));
}

function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes); // drops a BOM
  } catch {
    for (const encoding of ['windows-1250', 'windows-1252']) {
      try {
        return new TextDecoder(encoding).decode(bytes);
      } catch {
        // This runtime doesn't know the encoding; try the next.
      }
    }
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/** RFC 4180, with the delimiter guessed from the first line (Croatian Excel writes ";"). */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const count = (d: string) => firstLine.split(d).length - 1;
  const delimiter = [';', ',', '\t'].reduce((best, d) => (count(d) > count(best) ? d : best), ',');

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// ---- .xlsx: a zip of XML files ----

async function unzip(bytes: Uint8Array): Promise<Map<string, () => Promise<string>>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65_535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new SpreadsheetError('unreadable');
  const entries = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = new Map<string, () => Promise<string>>();
  const utf8 = new TextDecoder();
  for (let n = 0; n < entries; n++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new SpreadsheetError('unreadable');
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = utf8.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extraLength + commentLength;

    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    files.set(name, async () => {
      if (method === 0) return utf8.decode(data);
      if (method !== 8) throw new SpreadsheetError('unreadable');
      const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return utf8.decode(new Uint8Array(await new Response(stream).arrayBuffer()));
    });
  }
  return files;
}

function xmlText(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** All <t> runs inside one piece of XML, joined: a shared or inline string. */
function runs(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => xmlText(m[1]!)).join('');
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

async function readXlsx(bytes: Uint8Array): Promise<string[][]> {
  let files: Map<string, () => Promise<string>>;
  try {
    files = await unzip(bytes);
  } catch {
    throw new SpreadsheetError('unreadable');
  }

  // The first sheet in the workbook's own order.
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const workbook = await files.get('xl/workbook.xml')?.();
  const rels = await files.get('xl/_rels/workbook.xml.rels')?.();
  const firstId = workbook && /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1];
  if (firstId && rels) {
    const target = new RegExp(`<Relationship\\b[^>]*Id="${firstId}"[^>]*Target="([^"]+)"`).exec(rels)?.[1] ?? new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${firstId}"`).exec(rels)?.[1];
    if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
  }
  const sheet = await files.get(sheetPath)?.();
  if (!sheet) throw new SpreadsheetError('unreadable');
  const sharedXml = (await files.get('xl/sharedStrings.xml')?.()) ?? '';
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => runs(m[1]!));

  const rows: string[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(/\br="(\d+)"/.exec(rowMatch[1]!)?.[1] ?? rows.length + 1);
    const cells: string[] = [];
    for (const cell of rowMatch[2]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cell[1]!;
      const inner = cell[2] ?? '';
      const ref = /\br="([A-Z]+)\d*"/.exec(attributes)?.[1];
      const type = /\bt="(\w+)"/.exec(attributes)?.[1];
      const value = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let text = '';
      if (type === 's') text = shared[Number(value)] ?? '';
      else if (type === 'inlineStr') text = runs(inner);
      else if (value !== undefined) text = xmlText(value);
      cells[ref ? columnIndex(ref) : cells.length] = text;
    }
    rows[rowNumber - 1] = Array.from(cells, (c) => c ?? '');
  }
  return Array.from(rows, (r) => r ?? []);
}

// ---- From a table to members ----

export type ImportField = 'full_name' | 'first_name' | 'last_name' | 'email' | 'phone' | 'dob' | 'is_student_or_retired' | 'member_since' | 'notes';

/** Folded header words for each field, Croatian and English. */
const HEADERS: [ImportField, string[]][] = [
  ['full_name', ['ime i prezime', 'ime prezime', 'prezime i ime', 'clan', 'clanica', 'polaznik', 'polaznica', 'name', 'full name', 'naziv']],
  ['first_name', ['ime', 'first name', 'firstname', 'given name']],
  ['last_name', ['prezime', 'last name', 'lastname', 'surname', 'family name']],
  ['email', ['e-mail', 'email', 'mail', 'e mail', 'adresa e-poste', 'e-posta']],
  ['phone', ['mobitel', 'broj mobitela', 'telefon', 'tel', 'mob', 'broj telefona', 'kontakt', 'phone', 'mobile', 'gsm']],
  ['dob', ['datum rodenja', 'rodendan', 'roden', 'rodena', 'dob', 'date of birth', 'birthday', 'birth date']],
  ['is_student_or_retired', ['student / umirovljenik', 'student/umirovljenik', 'student', 'umirovljenik', 'popust', 'student or retired']],
  ['member_since', ['clan od', 'datum upisa', 'upisan', 'upisana', 'upis', 'member since', 'joined']],
  ['notes', ['napomena', 'napomene', 'biljeska', 'biljeske', 'komentar', 'notes', 'note']],
];

function fieldFor(header: string): ImportField | null {
  const h = foldText(header).replace(/[.:*]/g, '').replace(/\s+/g, ' ').trim();
  if (!h) return null;
  for (const [field, words] of HEADERS) if (words.includes(h)) return field;
  // "Ime (obavezno)", "E-mail adresa": a known heading as whole words inside a longer one.
  const within = (w: string) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')}($|[^a-z])`).test(h);
  for (const [field, words] of HEADERS) if (words.some(within)) return field;
  return null;
}

export interface ImportRow {
  /** The line in the file, counting from 1, for "line 14 has no name". */
  line: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  is_student_or_retired: boolean;
  member_since: string | null;
  notes: string | null;
  /** Cells that were there but couldn't be read (left empty instead). */
  problems: ('email' | 'dob' | 'member_since')[];
}

export interface ImportTable {
  /** Which header went to which field. */
  columns: { header: string; field: ImportField }[];
  rows: ImportRow[];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2.11.1979.", "02/11/1979", "1979-11-02", "2.11.79" or an Excel day number → "1979-11-02". */
export function readDate(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  const local = /^(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{2}|\d{4})\.?$/.exec(t);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (local) {
    [d, m, y] = [Number(local[1]), Number(local[2]), Number(local[3])];
    if (y < 100) y += y > new Date().getFullYear() % 100 ? 1900 : 2000;
  } else if (/^\d{4,5}(\.0+)?$/.test(t)) {
    // Excel counts days from 1899-12-30.
    const date = new Date(Date.UTC(1899, 11, 30) + Number(t) * 86_400_000);
    [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
  } else return null;
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d || y < 1900 || y > 2100) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

const YES = new Set(['da', 'd', 'yes', 'y', 'x', '1', 'true', 'istina', '✓', '✔', 'student', 'umirovljenik', 'umirovljenica', 'studentica']);

/** Finds the header row (within the first ten) and reads every row under it that has a name. */
export function membersFromTable(table: string[][]): ImportTable {
  let headerIndex = -1;
  let fields: (ImportField | null)[] = [];
  for (let i = 0; i < Math.min(10, table.length); i++) {
    const candidate = (table[i] ?? []).map((cell) => fieldFor(cell ?? ''));
    const hasName = candidate.includes('full_name') || candidate.includes('first_name') || candidate.includes('last_name');
    if (hasName) {
      headerIndex = i;
      fields = candidate;
      break;
    }
  }
  if (headerIndex < 0) throw new SpreadsheetError('no_name_column');

  // A header used twice (two "Ime" columns): only the first counts.
  const seen = new Set<ImportField>();
  fields = fields.map((f) => (f && !seen.has(f) ? (seen.add(f), f) : null));
  const header = table[headerIndex]!;
  const columns = fields.flatMap((field, i) => (field ? [{ header: header[i]!.trim(), field }] : []));

  const rows: ImportRow[] = [];
  for (let i = headerIndex + 1; i < table.length; i++) {
    const cells = table[i] ?? [];
    const get = (field: ImportField) => {
      const index = fields.indexOf(field);
      return index < 0 ? '' : (cells[index] ?? '').replace(/\s+/g, ' ').trim();
    };
    let first = get('first_name');
    let last = get('last_name');
    const full = get('full_name');
    if (!first && !last && full) ({ first_name: first, last_name: last } = splitFullName(full));
    else if (!first && last.includes(' ') && !fields.includes('first_name')) ({ first_name: first, last_name: last } = splitFullName(last));
    if (!first && !last) continue;
    if (!first) [first, last] = [last, ''];

    const problems: ImportRow['problems'] = [];
    const rawEmail = get('email').toLowerCase();
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : null;
    if (rawEmail && !email) problems.push('email');
    const rawDob = get('dob');
    const dob = readDate(rawDob);
    if (rawDob && !dob) problems.push('dob');
    const rawSince = get('member_since');
    const since = readDate(rawSince);
    if (rawSince && !since) problems.push('member_since');

    rows.push({
      line: i + 1,
      first_name: first.slice(0, 100),
      last_name: last.slice(0, 100),
      email: email && email.length <= 200 ? email : null,
      phone: get('phone').slice(0, 40) || null,
      dob,
      is_student_or_retired: YES.has(foldText(get('is_student_or_retired'))),
      member_since: since,
      notes: get('notes').slice(0, 2000) || null,
      problems,
    });
  }
  return { columns, rows };
}
