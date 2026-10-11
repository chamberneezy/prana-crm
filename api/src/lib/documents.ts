import { and, eq, isNull } from 'drizzle-orm';
import { document } from '../db/schema';
import type { Db } from '../env';
import { removed } from './http';

/** Deleting a member deletes their stored files: R2 objects first, then the rows are marked deleted. */
export async function deleteMemberDocuments(db: Db, bucket: R2Bucket, businessId: string, memberId: string, now: string): Promise<void> {
  const docs = await db
    .select({ id: document.id, r2_key: document.r2_key })
    .from(document)
    .where(and(eq(document.business_id, businessId), eq(document.member_id, memberId), isNull(document.deleted_at)));
  if (!docs.length) return;
  await bucket.delete(docs.map((d) => d.r2_key));
  await db
    .update(document)
    .set({ ...removed(now), ocr_json: null })
    .where(and(eq(document.business_id, businessId), eq(document.member_id, memberId), isNull(document.deleted_at)));
}
