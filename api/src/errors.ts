import type { ErrorCode, ErrorResponse } from '@prana/shared';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

interface ErrorSpec {
  status: ContentfulStatusCode;
  message_hr: string;
  message_en: string;
}

// Plain wording, no technical terms: these are shown to the owner as they are.
export const ERRORS: Record<ErrorCode, ErrorSpec> = {
  unauthenticated: { status: 401, message_hr: 'Prijavite se ponovno.', message_en: 'Please sign in again.' },
  no_access: { status: 403, message_hr: 'Ovaj račun nema pristup studiju.', message_en: 'This account has no access to the studio.' },
  not_found: { status: 404, message_hr: 'Traženi podatak više ne postoji.', message_en: 'This item no longer exists.' },
  invalid_input: { status: 400, message_hr: 'Provjerite unesene podatke.', message_en: 'Please check the details you entered.' },
  consent_required: { status: 400, message_hr: 'Potrebna je potvrda točnosti podataka.', message_en: 'The accuracy consent is needed.' },
  already_checked_in: { status: 409, message_hr: 'Dolazak je već evidentiran za ovaj sat.', message_en: 'This member is already checked in to this class.' },
  file_too_large: { status: 413, message_hr: 'Datoteka je veća od 20 MB.', message_en: 'The file is larger than 20 MB.' },
  unsupported_file: { status: 415, message_hr: 'Odaberite PDF, JPG, PNG ili HEIC datoteku.', message_en: 'Choose a PDF, JPG, PNG or HEIC file.' },
  internal: { status: 500, message_hr: 'Nešto nije uspjelo. Pokušajte ponovno.', message_en: 'Something went wrong. Please try again.' },
};

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly fields?: string[],
  ) {
    super(code);
  }
}

export function errorBody(code: ErrorCode, fields?: string[]): ErrorResponse {
  const { message_hr, message_en } = ERRORS[code];
  return { error: { code, message_hr, message_en, ...(fields?.length ? { fields } : {}) } };
}
