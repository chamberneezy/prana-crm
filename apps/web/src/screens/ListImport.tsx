import type { ImportField, MembersImportReadResponse, MembersImportResponse } from '@prana/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiClientError, api } from '../api/client';
import { Avatar, Button, Checkbox, Notice, PageHeader, Tag } from '../components';
import { useLang } from '../i18n';
import styles from './ListImport.module.css';

/** What the file input offers for a list of members. An old .xls is let through so the API can say what to do. */
export const LIST_ACCEPT = '.csv,.tsv,.txt,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
export const MAX_LIST_BYTES = 5 * 1024 * 1024;

/** Sends the file to be read; nothing is saved yet. */
export async function readList(file: File): Promise<MembersImportReadResponse> {
  const form = new FormData();
  form.append('file', file);
  return api<MembersImportReadResponse>('POST', '/members/import/read', form);
}

/**
 * Members from a CSV or Excel file: who was found, who is already a member (not added again), and one button that
 * adds the rest once the person importing confirms everyone signed an upisnica. The iPhone app shows the same.
 */
export function ListImport({ filename, preview, onAnother }: { filename: string; preview: MembersImportReadResponse; onAnother: () => void }) {
  const { t, tn, lang } = useLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const fresh = preview.rows.filter((r) => !r.duplicate);
  const duplicates = preview.rows.length - fresh.length;
  const field = (f: ImportField | string) => t(`listImport.field.${f}` as Parameters<typeof t>[0]);

  const save = async () => {
    setSaving(true);
    setFailure(null);
    try {
      const members = fresh.map(({ first_name, last_name, email, phone, dob, is_student_or_retired, member_since, notes }) => ({
        first_name,
        last_name,
        email,
        phone,
        dob,
        is_student_or_retired,
        member_since,
        notes,
      }));
      const result = await api<MembersImportResponse>('POST', '/members/import', { consent_accuracy: true, members });
      await queryClient.invalidateQueries({ queryKey: ['members'] });
      setDone(t('listImport.done', { created: tn('members.count', result.created), skipped: result.skipped }));
    } catch (error) {
      setFailure(error instanceof ApiClientError && error.messages ? error.messages[lang] : t('import.error.unreadable'));
      setSaving(false);
    }
  };

  if (done)
    return (
      <div className={styles.page}>
        <PageHeader title={t('listImport.title')} />
        <p className={styles.done} role="status">
          {done}
        </p>
        <div className={styles.doneActions}>
          <Button onClick={() => navigate('/clanovi')}>{t('nav.members')}</Button>
          <Button variant="secondary" onClick={onAnother}>
            {t('listImport.another')}
          </Button>
        </div>
      </div>
    );

  return (
    <div className={styles.page}>
      <button type="button" className={styles.back} onClick={onAnother}>
        ‹ {t('listImport.another')}
      </button>
      <PageHeader title={t('listImport.title')} />
      <div className={styles.summary}>
        <strong>{filename}</strong>
        <span>
          {t('listImport.found', { count: tn('members.count', preview.rows.length) })}
          {duplicates > 0 && ` · ${t('listImport.duplicates', { n: duplicates })}`}
        </span>
        {preview.columns.length > 0 && <small>{t('listImport.columns', { columns: preview.columns.map((c) => `${c.header} → ${field(c.field)}`).join(', ') })}</small>}
      </div>

      {preview.rows.length === 0 ? (
        <Notice>{t('listImport.empty')}</Notice>
      ) : (
        <ul className={styles.rows}>
          {preview.rows.map((row) => {
            const name = [row.first_name, row.last_name].filter(Boolean).join(' ');
            const details = [row.email, row.phone, row.dob?.split('-').reverse().join('.')].filter(Boolean).join(' · ');
            return (
              <li key={row.line} className={row.duplicate ? styles.duplicate : undefined}>
                <Avatar name={name} />
                <div className={styles.who}>
                  <strong>{name}</strong>
                  {details && <span>{details}</span>}
                  <div className={styles.tags}>
                    {row.duplicate && <Tag>{t('listImport.duplicate')}</Tag>}
                    {row.is_student_or_retired && <Tag kind="plan">{t('listImport.student')}</Tag>}
                    {row.problems.length > 0 && <Tag kind="health">{t('listImport.unreadable', { fields: row.problems.map(field).join(', ') })}</Tag>}
                  </div>
                </div>
                <small className={styles.line}>{t('listImport.line', { n: row.line })}</small>
              </li>
            );
          })}
        </ul>
      )}

      {failure && <Notice>{failure}</Notice>}
      {fresh.length > 0 && (
        <div className={styles.actions}>
          <Checkbox checked={confirmed} onChange={setConfirmed}>
            {t('listImport.consent')}
          </Checkbox>
          <Button disabled={!confirmed || saving} onClick={() => void save()}>
            {saving ? t('listImport.adding') : t('listImport.add', { count: tn('members.count', fresh.length) })}
          </Button>
        </div>
      )}
    </div>
  );
}
