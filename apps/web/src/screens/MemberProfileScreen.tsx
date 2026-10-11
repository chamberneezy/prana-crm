import { formatDate, formatDayMonth, formatMoney, isoToDisplayDate, localDate, type DocumentRecord, type UpisnicaValue } from '@prana/shared';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ApiClientError, apiFile, errorMessage } from '../api/client';
import { useFreezeMembership, useMember, useUpdateMember } from '../api/queries';
import { useToast } from '../app/ToastProvider';
import { Button, Card, EmptyState, MemberProfile, MembershipCard, Notice, SidePanel, UpisnicaForm } from '../components';
import { useLang } from '../i18n';
import { fieldErrors, memberToUpisnica, planLabel, statusLabel, type UpisnicaErrors, upisnicaToPatch, validateUpisnica } from '../lib/member';
import styles from './MemberProfileScreen.module.css';
import { AddMembershipForm, FreezeMembershipForm, RenewMembershipForm } from './MembershipForm';
import { PaymentForm } from './PaymentForm';

type Panel = 'renew' | 'freeze' | 'add' | 'payment' | null;

export function MemberProfileScreen() {
  const { id = '' } = useParams();
  const listSearch = (useLocation().state as { listSearch?: string } | null)?.listSearch;
  const strings = useLang();
  const { t, lang } = strings;
  const toast = useToast();
  const { data, error, isPending } = useMember(id);
  const update = useUpdateMember(id);
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<UpisnicaErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  // The hook needs an id before the member has loaded; it is only called once there is a membership.
  const unfreeze = useFreezeMembership(data?.summary.membership?.id ?? '');
  const fallback = { generic: t('error.generic'), offline: t('error.offline') };

  const back = (
    <Link to={listSearch ? `/clanovi?${listSearch}` : '/clanovi'} className={styles.back}>
      ‹ {t('profileScreen.back')}
    </Link>
  );

  if (error) {
    const missing = error instanceof ApiClientError && error.code === 'not_found';
    return (
      <>
        {back}
        {missing ? (
          <Card>
            <EmptyState title={t('profileScreen.notFound.title')}>{t('profileScreen.notFound.body')}</EmptyState>
          </Card>
        ) : (
          <Notice>{errorMessage(error, lang, fallback)}</Notice>
        )}
      </>
    );
  }
  if (isPending) return <div aria-busy="true">{back}</div>;

  const { member, summary, visits, payments, documents } = data;
  const membership = summary.membership;
  const value = memberToUpisnica(member, summary);
  const since = isoToDisplayDate(member.member_since);

  const save = (v: UpisnicaValue) => {
    const found = validateUpisnica(v, strings);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) return;
    update.mutate(upisnicaToPatch(v), {
      onSuccess: () => {
        setEditing(false);
        toast({ message: t('profileScreen.saved') });
      },
      onError: (err) => {
        const rejected = err instanceof ApiClientError && err.code === 'invalid_input' ? fieldErrors(err.fields, strings) : {};
        setErrors(rejected);
        if (!Object.keys(rejected).length) setFailure(errorMessage(err, lang, fallback));
      },
    });
  };

  // Stored files have no public address: fetch with the sign-in token, then show the copy held in the browser.
  const open = async (doc: DocumentRecord) => {
    // Opened before the download so the browser treats it as the click's own window.
    const tab = window.open('', '_blank');
    try {
      const url = URL.createObjectURL(await apiFile(`/documents/${doc.id}/file`));
      if (tab) tab.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      tab?.close();
      setFailure(err instanceof ApiClientError && err.code === 'network' ? t('error.offline') : t('profileScreen.openFailed'));
    }
  };

  return (
    <>
      {back}
      {failure && <Notice>{failure}</Notice>}
      <div className={styles.columns}>
        <div className={styles.column}>
          {editing ? (
            <UpisnicaForm
              mode="edit"
              initial={value}
              place={member.signed_place ?? undefined}
              date={member.signed_date ? isoToDisplayDate(member.signed_date) : since}
              errors={errors}
              busy={update.isPending}
              onSave={save}
              onCancel={() => {
                setEditing(false);
                setErrors({});
              }}
            />
          ) : (
            <MemberProfile
              member={value}
              status={summary.status}
              statusLabel={statusLabel(summary.status, summary.days_left, strings)}
              planLabel={membership ? planLabel(membership.plan_code, strings) : undefined}
              since={since}
              onEdit={() => setEditing(true)}
            />
          )}

          {documents.length > 0 && (
            <section className={styles.card}>
              <h2 className={styles.overline}>{t('profileScreen.form')}</h2>
              {documents.map((doc) => (
                <button key={doc.id} type="button" className={styles.file} onClick={() => void open(doc)}>
                  <span className={styles.fileIcon}>
                    <FileText size={20} strokeWidth={1.5} aria-hidden />
                  </span>
                  <span className={styles.fileText}>
                    <span className={styles.fileName}>{doc.filename ?? t('profileScreen.formFile')}</span>
                    <span className={styles.fileMeta}>{t('profileScreen.imported', { date: formatDate(doc.created_at) })}</span>
                  </span>
                  <span className={styles.fileOpen}>{t('profileScreen.open')}</span>
                </button>
              ))}
            </section>
          )}
        </div>

        <div className={styles.column}>
          <section className={styles.membership}>
            <h2 className={styles.overline}>{t('profileScreen.membership', { month: t(`month.${Number(localDate(new Date()).slice(5, 7))}` as 'month.1') })}</h2>
            {membership ? (
              <MembershipCard
                plan={planLabel(membership.plan_code, strings)}
                used={membership.visits_used}
                total={membership.visits_total ?? 0}
                renewal={isoToDisplayDate(membership.period_end).slice(0, 6)}
                period={`${isoToDisplayDate(membership.period_start).slice(0, 6)}–${isoToDisplayDate(membership.period_end).slice(0, 6)}`}
              />
            ) : (
              <Card padding={20}>
                <EmptyState title={t('profileScreen.noMembership.title')}>{t('profileScreen.noMembership.body')}</EmptyState>
              </Card>
            )}
            {membership && summary.debt_cents > 0 && <Notice title={t('membershipActions.debt.title', { amount: formatMoney(summary.debt_cents) })}>{t('membershipActions.debt.body')}</Notice>}
            <div className={styles.actions}>
              {!membership && <Button onClick={() => setPanel('add')}>{t('membershipActions.add')}</Button>}
              {membership &&
                (membership.renewed_until ? (
                  <span className={styles.renewed}>{t('membershipActions.renewed', { date: isoToDisplayDate(membership.renewed_until) })}</span>
                ) : (
                  <Button onClick={() => setPanel('renew')}>{t('membershipActions.renew')}</Button>
                ))}
              {membership &&
                (summary.status === 'frozen' ? (
                  <Button
                    variant="secondary"
                    disabled={unfreeze.isPending}
                    onClick={() =>
                      unfreeze.mutate(null, {
                        onSuccess: () => toast({ message: t('toast.membershipUnfrozen') }),
                        onError: (err) => setFailure(errorMessage(err, lang, fallback)),
                      })
                    }
                  >
                    {t('membershipActions.unfreeze')}
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => setPanel('freeze')}>
                    {t('membershipActions.freeze')}
                  </Button>
                ))}
            </div>
          </section>

          <section className={styles.listCard}>
            <h2 className={styles.overline}>{t('profileScreen.visits')}</h2>
            {visits.map((v) => (
              <div key={v.id} className={styles.row}>
                <span className={styles.pill} style={{ background: `var(--${v.color_token})` }} />
                <span className={styles.rowMain}>{v.offering_name}</span>
                <span className={styles.rowDate}>
                  {t(`weekday.short.${((new Date(`${localDate(v.starts_at)}T12:00:00Z`).getUTCDay() + 6) % 7) + 1}` as 'weekday.short.1')}, {formatDayMonth(v.starts_at)}
                </span>
              </div>
            ))}
            {visits.length === 0 && <div className={styles.none}>{t('profileScreen.noVisits')}</div>}
          </section>

          <section className={styles.listCard}>
            <div className={styles.listHead}>
              <h2 className={styles.overline}>{t('profileScreen.payments')}</h2>
              <Button variant="secondary" size="sm" onClick={() => setPanel('payment')}>
                {t('payments.record')}
              </Button>
            </div>
            {payments.map((p) => (
              <div key={p.id} className={styles.row}>
                <span className={styles.rowMain}>{[formatDate(p.paid_at), p.plan_name, t(`method.${p.method}`)].filter(Boolean).join(' · ')}</span>
                <strong className={styles.amount}>{formatMoney(p.amount_cents)}</strong>
              </div>
            ))}
            {payments.length === 0 && <div className={styles.none}>{t('profileScreen.noPayments')}</div>}
          </section>
        </div>
      </div>

      {panel === 'add' && (
        <SidePanel title={t('membershipForm.addTitle')} onClose={() => setPanel(null)}>
          <AddMembershipForm memberId={member.id} onDone={() => setPanel(null)} />
        </SidePanel>
      )}
      {panel === 'renew' && membership && (
        <SidePanel title={t('membershipForm.renewTitle')} onClose={() => setPanel(null)}>
          <RenewMembershipForm membership={membership} onDone={() => setPanel(null)} />
        </SidePanel>
      )}
      {panel === 'freeze' && membership && (
        <SidePanel title={t('membershipForm.freezeTitle')} onClose={() => setPanel(null)}>
          <FreezeMembershipForm membership={membership} onDone={() => setPanel(null)} />
        </SidePanel>
      )}
      {panel === 'payment' && (
        <SidePanel title={t('payments.record')} onClose={() => setPanel(null)}>
          <PaymentForm member={summary} onDone={() => setPanel(null)} />
        </SidePanel>
      )}
    </>
  );
}
