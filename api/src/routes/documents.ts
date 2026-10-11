import { documentPatchSchema, type DocumentResponse, type DocumentSource, documentSourceSchema, MAX_DOCUMENT_BYTES } from '@prana/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { document, member } from '../db/schema';
import type { AppEnv } from '../env';
import { ApiError } from '../errors';
import { created, ctx, owned, parseBody, publicRow, removed, touched } from '../lib/http';

export const documents = new Hono<AppEnv>();

const EXTENSIONS: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic' };

/** The file type from its first bytes; what the browser claims is not trusted. */
function sniffMime(bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (ascii(0, 5) === '%PDF-') return 'application/pdf';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(4, 8) === 'ftyp' && ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'heif'].includes(ascii(8, 12))) return 'image/heic';
  return null;
}

documents.post('/', async (c) => {
  const { db, businessId, staff, now } = ctx(c);

  // Refuse oversized uploads before reading them (the form adds a little on top of the file).
  if (Number(c.req.header('Content-Length') ?? 0) > MAX_DOCUMENT_BYTES + 64 * 1024) throw new ApiError('file_too_large');

  let form: Record<string, string | File>;
  try {
    form = await c.req.parseBody();
  } catch {
    throw new ApiError('invalid_input', ['file']);
  }
  const file = form.file;
  if (!(file instanceof File)) throw new ApiError('invalid_input', ['file']);
  if (file.size > MAX_DOCUMENT_BYTES) throw new ApiError('file_too_large');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime) throw new ApiError('unsupported_file');

  const given = documentSourceSchema.safeParse(form.source);
  const source: DocumentSource = given.success ? given.data : mime === 'application/pdf' ? 'pdf' : 'image';

  const base = created(businessId, now);
  const row = {
    ...base,
    member_id: null,
    kind: 'upisnica' as const,
    r2_key: `${businessId}/documents/${base.id}`,
    mime,
    source,
    filename: file.name ? file.name.slice(0, 200) : null,
    size_bytes: bytes.byteLength,
    ocr_json: null,
    created_by: staff.id,
  };
  await c.env.BUCKET.put(row.r2_key, bytes, { httpMetadata: { contentType: mime } });
  await db.insert(document).values(row);

  const body: DocumentResponse = { document: publicRow(row) };
  return c.json(body, 201);
});

// Files are never public: they are streamed here, after the same staff check as every other request.
documents.get('/:id/file', async (c) => {
  const { db, businessId } = ctx(c);
  const row = await owned(db, document, c.req.param('id'), businessId);
  const object = await c.env.BUCKET.get(row.r2_key);
  if (!object) throw new ApiError('not_found');
  return new Response(object.body as ReadableStream, {
    headers: {
      'Content-Type': row.mime,
      'Content-Length': String(object.size),
      'Content-Disposition': `inline; filename="upisnica.${EXTENSIONS[row.mime] ?? 'bin'}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

documents.patch('/:id', async (c) => {
  const { db, businessId, now } = ctx(c);
  const input = await parseBody(c, documentPatchSchema);
  const existing = await owned(db, document, c.req.param('id'), businessId);
  if (input.member_id) await owned(db, member, input.member_id, businessId);

  const patch = {
    ...('member_id' in input ? { member_id: input.member_id ?? null } : {}),
    ...('ocr_json' in input ? { ocr_json: input.ocr_json ?? null } : {}),
    ...touched(now),
  };
  await db.update(document).set(patch).where(eq(document.id, existing.id));
  const body: DocumentResponse = { document: publicRow({ ...existing, ...patch }) };
  return c.json(body);
});

documents.delete('/:id', async (c) => {
  const { db, businessId, now } = ctx(c);
  const existing = await owned(db, document, c.req.param('id'), businessId);
  await c.env.BUCKET.delete(existing.r2_key);
  await db
    .update(document)
    .set({ ...removed(now), ocr_json: null })
    .where(eq(document.id, existing.id));
  return c.body(null, 204);
});
