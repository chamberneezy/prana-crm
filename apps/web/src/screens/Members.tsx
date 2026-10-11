import type { ApiMemberStatus, MessageKey } from '@prana/shared';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { errorMessage } from '../api/client';
import { useMembers } from '../api/queries';
import { Button, Card, EmptyState, MemberRow, Notice, PageHeader } from '../components';
import { cx } from '../components/cx';
import { useLang } from '../i18n';
import { memberSubline, statusLabel } from '../lib/member';
import styles from './Members.module.css';

type Filter = 'all' | Exclude<ApiMemberStatus, 'none'>;

const FILTERS: Array<{ id: Filter; label: MessageKey }> = [
  { id: 'all', label: 'filter.all' },
  { id: 'active', label: 'filter.active' },
  { id: 'expiring', label: 'filter.expiring' },
  { id: 'unpaid', label: 'filter.unpaid' },
  { id: 'trial', label: 'filter.trial' },
  { id: 'frozen', label: 'filter.frozen' },
];

const SEARCH_DELAY_MS = 250;

export function Members() {
  const strings = useLang();
  const { t, tn, lang } = strings;
  const navigate = useNavigate();

  // Search and filter live in the address, so coming back from a profile keeps the view.
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const filter = (FILTERS.find((f) => f.id === params.get('stanje'))?.id ?? 'all') as Filter;

  const [text, setText] = useState(q);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (text.trim() === q) return;
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (text.trim()) next.set('q', text.trim());
          else next.delete('q');
          return next;
        },
        { replace: true },
      );
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, q, setParams]);

  const pick = (id: Filter) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === 'all') next.delete('stanje');
        else next.set('stanje', id);
        return next;
      },
      { replace: true },
    );

  const { data, error, isPending, refetch } = useMembers({ q: q || undefined, status: filter === 'all' ? undefined : filter });
  const members = data?.members ?? [];
  const nothingYet = data && data.counts.all === 0 && !q;

  return (
    <>
      <PageHeader title={t('members.title')}>
        <label className={styles.search}>
          <Search size={16} strokeWidth={1.5} aria-hidden />
          <span className={styles.srOnly}>{t('members.search.label')}</span>
          <input type="search" placeholder={t('members.search.placeholder')} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <Button onClick={() => navigate('/clanovi/novi')}>{t('members.new')}</Button>
      </PageHeader>

      <div role="tablist" aria-label={t('members.filterLabel')} className={styles.filters}>
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={f.id === filter} onClick={() => pick(f.id)} className={cx(styles.filter, f.id === filter && styles.filterSelected)}>
            {t(f.label)}
            {data && ` ${data.counts[f.id]}`}
          </button>
        ))}
      </div>

      {error ? (
        <Notice title={t('members.loadFailed')}>
          {errorMessage(error, lang, { generic: t('error.generic'), offline: t('error.offline') })}{' '}
          <button type="button" className={styles.retry} onClick={() => void refetch()}>
            {t('common.retry')}
          </button>
        </Notice>
      ) : nothingYet ? (
        <Card>
          <EmptyState
            title={t('members.empty.title')}
            action={
              <Button variant="secondary" size="sm" onClick={() => navigate('/clanovi/novi')}>
                {t('members.new')}
              </Button>
            }
          >
            {t('members.empty.body')}
          </EmptyState>
        </Card>
      ) : (
        <section aria-label={t('members.listLabel')} aria-busy={isPending} className={styles.list}>
          <div className={styles.listHead}>
            <span>{data ? tn('members.count', members.length) : t('common.loading')}</span>
            <span>{t('members.state')}</span>
          </div>
          {members.map((m) => (
            <MemberRow
              key={m.id}
              name={m.full_name}
              sub={memberSubline(m, strings)}
              note={m.health_text ?? undefined}
              status={m.status}
              statusLabel={statusLabel(m.status, m.days_left, strings)}
              // The profile's back link returns to this same search and filter.
              onClick={() => navigate(`/clanovi/${m.id}`, { state: { listSearch: params.toString() } })}
            />
          ))}
          {data && members.length === 0 && (
            <div className={styles.noResults}>
              <EmptyState title={t('members.noResults.title')}>{t('members.noResults.body')}</EmptyState>
            </div>
          )}
        </section>
      )}
    </>
  );
}
