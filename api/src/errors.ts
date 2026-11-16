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
  forbidden: { status: 403, message_hr: 'Za ovo nemate ovlasti.', message_en: "You don't have permission to do this." },
  not_found: { status: 404, message_hr: 'Traženi podatak više ne postoji.', message_en: 'This item no longer exists.' },
  invalid_input: { status: 400, message_hr: 'Provjerite unesene podatke.', message_en: 'Please check the details you entered.' },
  consent_required: { status: 400, message_hr: 'Potrebna je potvrda točnosti podataka.', message_en: 'The accuracy consent is needed.' },
  already_checked_in: { status: 409, message_hr: 'Dolazak je već evidentiran za ovaj sat.', message_en: 'This member is already checked in to this class.' },
  day_closed: { status: 409, message_hr: 'Taj dan je neradni, sat je otkazan.', message_en: 'The studio is closed that day; the class is cancelled.' },
  session_has_visits: { status: 409, message_hr: 'Termin s evidentiranim dolascima ne može se ukloniti.', message_en: 'A class with check-ins can’t be removed.' },
  member_not_found: { status: 404, message_hr: 'Ime i prezime ne odgovaraju nijednom članu studija. Upišite ih kao na upisnici ili se javite studiju.', message_en: 'That first and last name don’t match any member of the studio. Enter them as on your enrolment form, or contact the studio.' },
  session_over: { status: 409, message_hr: 'Ovaj sat je već završio.', message_en: 'This class has already finished.' },
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
