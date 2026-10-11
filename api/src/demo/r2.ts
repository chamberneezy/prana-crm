import type { DemoStorage } from './index';

const FILE_PREFIX = 'file:';

interface StoredFile {
  bytes: Uint8Array;
  contentType: string;
}

// Each stored value is the content type, a NUL, then the bytes: one blob per file, no second lookup.
function pack(file: StoredFile): Uint8Array {
  const head = new TextEncoder().encode(`${file.contentType}\0`);
  const packed = new Uint8Array(head.length + file.bytes.length);
  packed.set(head);
  packed.set(file.bytes, head.length);
  return packed;
}

function unpack(packed: Uint8Array): StoredFile {
  const split = packed.indexOf(0);
  return { contentType: new TextDecoder().decode(packed.subarray(0, split)), bytes: packed.subarray(split + 1) };
}

/** The part of the R2 binding the API uses (put, get, delete), kept in the browser's own storage. */
export function createR2(storage: DemoStorage): R2Bucket {
  const bucket = {
    async put(key: string, value: ArrayBuffer | ArrayBufferView, options?: { httpMetadata?: { contentType?: string } }) {
      const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      await storage.put(FILE_PREFIX + key, pack({ bytes, contentType: options?.httpMetadata?.contentType ?? 'application/octet-stream' }));
      return { key, size: bytes.byteLength };
    },
    async get(key: string) {
      const packed = await storage.get(FILE_PREFIX + key);
      if (!packed) return null;
      const file = unpack(packed);
      return { key, size: file.bytes.byteLength, httpMetadata: { contentType: file.contentType }, body: new Response(file.bytes).body };
    },
    async delete(keys: string | string[]) {
      for (const key of Array.isArray(keys) ? keys : [keys]) await storage.delete(FILE_PREFIX + key);
    },
  };
  return bucket as unknown as R2Bucket;
}
