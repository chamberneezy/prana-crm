import { foldText } from '../text';
import type { UpisnicaPlan } from '../types';
import { hasUnreadable, normalizeDate, normalizeEmail, normalizePhone, titleCaseName } from './normalize';
import { REVIEW_BELOW_CONFIDENCE, SCAN_FIELDS, type ScanField, type ScanLine, type ScanRegion, type UpisnicaScan } from './types';

/**
 * Reads an upisnica from lines of recognised text (see docs/handoff-web.md, A6).
 * The same steps are implemented in Swift for iOS; both must pass fixtures/upisnica/.
 *
 * 1. Find the label anchors, ignoring case and diacritics and allowing small misreadings.
 * 2. Read each value: on the label's own line, to its right, or on the row below.
 * 3. For choices, find the option with a tick mark. Without one the field is flagged, never guessed.
 * 4. Normalise, then flag whatever is missing, unclear or invalid.
 *
 * Handwriting and the signature are not read in v1.
 */

// ── Anchors (folded: lower-case, no diacritics, × as x) ───────────────────────

const ANCHORS = {
  name: ['ime i prezime'],
  email: ['e-mail', 'email'],
  phone: ['broj mobitela', 'mobitel', 'telefon'],
  dob: ['datum rodenja'],
  student: ['student / umirovljenik', 'student/umirovljenik'],
  plan: ['odaberite clanstvo'],
  health: ['postoji li nesto sto bi ucitelj trebao znati'],
  healthText: ['molimo navedite'],
  consent: ['potvrdujem da su navedeni podaci tocni'],
  news: ['zelim primati obavijesti'],
  placeDate: ['mjesto i datum'],
  signature: ['potpis'],
} as const;
type AnchorKey = keyof typeof ANCHORS;

const PLAN_OPTIONS: Array<[UpisnicaPlan, string]> = [
  ['1x', '1x tjedno'],
  ['2x', '2x tjedno'],
  ['3x', '3x tjedno'],
  ['unl', 'neograniceno'],
];
const YES_NO: Array<[boolean, string]> = [
  [true, 'da'],
  [false, 'ne'],
];

const CHECKED = String.raw`[✓✔☑☒■●◉⊠✗✘]|\[\s*[x✓]\s*\]|\(\s*[x✓•]\s*\)`;
const UNCHECKED = String.raw`[☐□○◯]|\[\s*\]|\(\s*\)`;
const MARKER = new RegExp(`^(?:${CHECKED}|${UNCHECKED})\\s*`);

/** An anchor counts only at the start of a line (after a tick box), so "…putem e-maila" is not the E-mail label. */
const ANCHOR_MAX_OFFSET = 2;
const FUZZY_MIN_LENGTH = 6;
const FUZZY_MIN_SIMILARITY = 0.8;

// ── Text helpers ──────────────────────────────────────────────────────────────

/** Folding that keeps the length, so positions in the folded text are positions in the original. */
const fold = (text: string) => foldText(text).replace(/×/g, 'x');

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

interface Item extends ScanLine {
  folded: string;
  /** Length of a leading tick box, if any. */
  markerLength: number;
  confidence: number;
  label?: AnchorKey;
  /** Where the label text ends in `text`. */
  labelEnd?: number;
}

function matchAnchor(item: Item, anchor: string): { score: number; end: number } | null {
  const body = item.folded.slice(item.markerLength);
  const index = body.indexOf(anchor);
  if (index >= 0 && index <= ANCHOR_MAX_OFFSET) return { score: 1, end: item.markerLength + index + anchor.length };
  if (anchor.length < FUZZY_MIN_LENGTH || body.length < anchor.length - 1) return null;
  const similarity = 1 - editDistance(body.slice(0, anchor.length), anchor) / anchor.length;
  return similarity >= FUZZY_MIN_SIMILARITY ? { score: similarity, end: item.markerLength + anchor.length } : null;
}

// ── Geometry ──────────────────────────────────────────────────────────────────

const bottom = (i: ScanLine) => i.y + i.height;
const right = (i: ScanLine) => i.x + i.width;

function sameRow(a: ScanLine, b: ScanLine): boolean {
  const overlap = Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y);
  return overlap >= 0.5 * Math.min(a.height, b.height);
}

function union(items: ScanLine[]): ScanRegion | undefined {
  if (!items.length) return undefined;
  const x = Math.min(...items.map((i) => i.x));
  const y = Math.min(...items.map((i) => i.y));
  return { x, y, width: Math.max(...items.map(right)) - x, height: Math.max(...items.map(bottom)) - y };
}

// ── Reading ───────────────────────────────────────────────────────────────────

interface Read {
  text: string;
  confidence: number;
  region?: ScanRegion;
  /** The label was found, whether or not it had a value. */
  found: boolean;
}

const NOTHING: Read = { text: '', confidence: 0, found: false };

export function parseUpisnica(lines: ScanLine[]): UpisnicaScan {
  const items: Item[] = lines
    .map((line) => {
      const text = line.text.normalize('NFC').replace(/\s+/g, ' ').trim();
      const folded = fold(text);
      return { ...line, text, folded, markerLength: MARKER.exec(folded)?.[0].length ?? 0, confidence: line.confidence ?? 1 };
    })
    .filter((item) => item.text)
    .sort((a, b) => (sameRow(a, b) ? a.x - b.x : a.y - b.y));

  // 1. Label anchors: each anchor claims the line that matches it best.
  const labels = new Map<AnchorKey, Item>();
  for (const key of Object.keys(ANCHORS) as AnchorKey[]) {
    let best: { item: Item; score: number; end: number } | undefined;
    for (const item of items) {
      if (item.label) continue;
      for (const anchor of ANCHORS[key]) {
        const match = matchAnchor(item, anchor);
        if (match && (!best || match.score > best.score)) best = { item, ...match };
      }
    }
    if (best) {
      best.item.label = key;
      best.item.labelEnd = best.end;
      labels.set(key, best.item);
    }
  }

  /** Lines that hold a value for `label`: the rest of its own line, else to its right, else the row below. */
  const valueOf = (key: AnchorKey): Read => {
    const label = labels.get(key);
    if (!label) return NOTHING;
    const base = { found: true, region: union([label]) };

    // What follows the label on its own line, past any note in brackets: "…trebao znati (npr. …)? Ne" → "Ne".
    const inline = label.text
      .slice(label.labelEnd)
      .replace(/^\s*\([^)]*\)/, '')
      .replace(/^[\s:?.\-–]+/, '')
      .trim();
    if (inline) return { ...base, text: inline, confidence: label.confidence };

    // The label's column runs from its left edge to the next label on the same row.
    const rowLabels = items.filter((i) => i.label && i !== label && sameRow(i, label) && i.x > label.x);
    const columnEnd = Math.min(...rowLabels.map((i) => i.x), Number.POSITIVE_INFINITY);
    const tolerance = label.height;

    const beside = items.filter((i) => !i.label && sameRow(i, label) && i.x >= right(label) - tolerance && i.x < columnEnd);
    if (beside.length) return collect(beside, base.region);

    const below = items
      .filter((i) => i.y > label.y + 0.5 * label.height && i.y <= bottom(label) + 2.5 * label.height && i.x >= label.x - tolerance && i.x < columnEnd - tolerance)
      .sort((a, b) => a.y - b.y);
    const first = below[0];
    // Another label right below means this field was left empty.
    if (!first || first.label) return { ...base, text: '', confidence: 0 };
    return collect(
      below.filter((i) => !i.label && sameRow(i, first)),
      base.region,
    );
  };

  const collect = (found: Item[], fallback: ScanRegion | undefined): Read => ({
    found: true,
    text: found
      .sort((a, b) => a.x - b.x)
      .map((i) => i.text)
      .join(' '),
    confidence: Math.min(...found.map((i) => i.confidence)),
    region: union(found) ?? fallback,
  });

  /** Everything between a section label and the next section label, in reading order. */
  const blockAfter = (key: AnchorKey, until: AnchorKey[]): Read => {
    const label = labels.get(key);
    if (!label) return NOTHING;
    const start = items.indexOf(label);
    const stops = until.map((k) => labels.get(k)).filter((i): i is Item => Boolean(i));
    const block: Item[] = [];
    for (const item of items.slice(start + 1)) {
      if (stops.includes(item)) break;
      block.push(item);
    }
    const inline = label.text.slice(label.labelEnd).trim();
    return {
      found: true,
      text: [inline, ...block.map((i) => i.text)].join(' '),
      confidence: block.length ? Math.min(...block.map((i) => i.confidence)) : label.confidence,
      region: union([label, ...block]),
    };
  };

  // ── Assemble ────────────────────────────────────────────────────────────────

  const confidence = Object.fromEntries(SCAN_FIELDS.map((f) => [f, 0])) as Record<ScanField, number>;
  const regions: Partial<Record<ScanField, ScanRegion>> = {};
  const flagged = new Set<ScanField>();

  const record = (field: ScanField, read: Read, certainty = read.confidence) => {
    confidence[field] = certainty;
    if (read.region) regions[field] = read.region;
    if (certainty < REVIEW_BELOW_CONFIDENCE) flagged.add(field);
  };

  /** A plain text field: empty or unreadable is flagged; `tidy` cleans it up and says whether it is valid. */
  const textField = (field: ScanField, read: Read, tidy: (raw: string) => { value: string; valid: boolean }): string => {
    record(field, read, read.text ? read.confidence : 0);
    if (!read.text) return '';
    const { value, valid } = tidy(read.text);
    if (!valid || hasUnreadable(read.text)) flagged.add(field);
    return value;
  };

  const nameRead = valueOf('name');
  const name = textField('name', nameRead, (raw) => ({ value: titleCaseName(raw), valid: true }));
  const email = textField('email', valueOf('email'), normalizeEmail);
  const phone = textField('phone', valueOf('phone'), normalizePhone);
  const dob = textField('dob', valueOf('dob'), (raw) => {
    const date = normalizeDate(raw);
    return { ...date, valid: date.valid && Number(date.value.slice(6, 10)) <= new Date().getFullYear() };
  });

  const studentRead = valueOf('student');
  const student = choose(studentRead.text, YES_NO);
  record('student', studentRead, student === undefined ? 0 : studentRead.confidence);

  const planRead = blockAfter('plan', ['health', 'healthText', 'consent', 'news', 'placeDate', 'signature']);
  const plan = choose(planRead.text, PLAN_OPTIONS);
  record('plan', planRead, plan === undefined ? 0 : planRead.confidence);

  const healthTextRead = valueOf('healthText');
  const healthText = healthTextRead.text.trim();
  const healthRead = valueOf('health');
  const healthChoice = choose(healthRead.text, YES_NO);
  // A written note means "yes", whatever was (or wasn't) ticked.
  const health = healthText ? true : (healthChoice ?? false);
  record('health', healthRead, healthText ? Math.max(healthRead.confidence, healthTextRead.confidence) : healthChoice === undefined ? 0 : healthRead.confidence);
  if (healthText) {
    record('healthText', healthTextRead);
    if (hasUnreadable(healthText)) flagged.add('healthText');
  } else {
    // Nothing written: only worth a look when "yes" was ticked.
    confidence.healthText = healthTextRead.found ? healthTextRead.confidence : 0;
    if (healthTextRead.region) regions.healthText = healthTextRead.region;
    if (health) flagged.add('healthText');
  }

  const tick = (key: 'consent' | 'news'): boolean | undefined => {
    const label = labels.get(key);
    if (!label) return undefined;
    regions[key] = union([label]);
    const own = label.folded.slice(0, label.markerLength);
    // The tick box can also be a separate run just left of the sentence.
    const beside = items.filter((i) => !i.label && sameRow(i, label) && i.x < label.x && label.x - right(i) < 3 * label.height).pop();
    const mark = own || beside?.folded || '';
    if (new RegExp(CHECKED).test(mark)) return true;
    if (new RegExp(UNCHECKED).test(mark)) return false;
    return undefined;
  };
  const consent = tick('consent');
  confidence.consent = consent === undefined ? 0 : (labels.get('consent')?.confidence ?? 0);
  if (confidence.consent < REVIEW_BELOW_CONFIDENCE) flagged.add('consent');
  const news = tick('news');
  confidence.news = news === undefined ? 0 : (labels.get('news')?.confidence ?? 0);
  // A form without the newsletter sentence simply has no opt-in; nothing to review.
  if (labels.has('news') && confidence.news < REVIEW_BELOW_CONFIDENCE) flagged.add('news');

  const placeDateRead = valueOf('placeDate');
  const dateMatch = /\d{1,2}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{4}\s*\.?/.exec(placeDateRead.text);
  const place = (dateMatch ? placeDateRead.text.slice(0, dateMatch.index) : placeDateRead.text).replace(/[\s,;]+$/, '').trim();
  const signed = dateMatch ? normalizeDate(dateMatch[0]) : { value: '', valid: true };
  confidence.place = place ? placeDateRead.confidence : 0;
  confidence.date = signed.value ? placeDateRead.confidence : 0;
  if (placeDateRead.region) regions.place = regions.date = placeDateRead.region;
  // Place and date are optional (the form falls back to today), so only unclear or invalid ones are flagged.
  if (place && (placeDateRead.confidence < REVIEW_BELOW_CONFIDENCE || hasUnreadable(place))) flagged.add('place');
  if (signed.value && (placeDateRead.confidence < REVIEW_BELOW_CONFIDENCE || !signed.valid)) flagged.add('date');

  return {
    name,
    email,
    phone,
    dob,
    student: student ?? false,
    plan: plan ?? '2x',
    health,
    healthText,
    consent: consent ?? false,
    news: news ?? false,
    place,
    date: signed.valid ? signed.value : '',
    signaturePresent: false,
    confidence,
    needsReview: SCAN_FIELDS.filter((f) => flagged.has(f)),
    regions,
  };
}

/**
 * Picks the chosen option from text such as "☐ NE ☑ DA", "NE [x] DA" or just "DA".
 * One ticked option wins. With no tick marks, a lone option is taken as the answer. Otherwise undefined.
 */
function choose<T>(text: string, options: Array<[T, string]>): T | undefined {
  const folded = fold(text);
  const ticked: T[] = [];
  const present: T[] = [];
  for (const [value, label] of options) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // The option as a whole word, with whatever tick box sits right before it.
    const pattern = new RegExp(`(${CHECKED}|${UNCHECKED})?\\s*(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'g');
    for (const match of folded.matchAll(pattern)) {
      if (!present.includes(value)) present.push(value);
      if (match[1] && new RegExp(`^(?:${CHECKED})$`).test(match[1]) && !ticked.includes(value)) ticked.push(value);
    }
  }
  if (ticked.length === 1) return ticked[0];
  if (ticked.length === 0 && present.length === 1 && !new RegExp(UNCHECKED).test(folded)) return present[0];
  return undefined;
}
