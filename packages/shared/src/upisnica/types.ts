import type { UpisnicaValue } from '../types';

/** One run of recognised text with its box. Origin is the top-left of the page; any unit, as long as it is consistent. */
export interface ScanLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0–1. A PDF text layer is 1; recognised text reports its own. Left out means 1. */
  confidence?: number;
}

export const SCAN_FIELDS = ['name', 'email', 'phone', 'dob', 'student', 'plan', 'health', 'healthText', 'consent', 'news', 'place', 'date'] as const;
export type ScanField = (typeof SCAN_FIELDS)[number];

export interface ScanRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What the parser read from one upisnica. Never saved as is: the owner always reviews it first. */
export interface UpisnicaScan extends UpisnicaValue {
  place: string;
  /** dd.mm.yyyy. */
  date: string;
  /** Not read in v1: always false. Kept so both apps share one shape. */
  signaturePresent: boolean;
  /** 0–1 per field; 0 when the field was not found. */
  confidence: Record<ScanField, number>;
  /** Fields the owner should read before saving, in form order. */
  needsReview: ScanField[];
  /** Where each field's value (or, failing that, its label) sits on the page, for outlining it in the review. */
  regions: Partial<Record<ScanField, ScanRegion>>;
}

/** Below this, a field is flagged for review. */
export const REVIEW_BELOW_CONFIDENCE = 0.6;
