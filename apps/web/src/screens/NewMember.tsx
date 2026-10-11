import { localDate, type UpisnicaValue } from '@prana/shared';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiClientError, errorMessage } from '../api/client';
import { useCreateMember, useDeleteMember } from '../api/queries';
import { useToast } from '../app/ToastProvider';
import { Notice, PageHeader, UpisnicaForm } from '../components';
import { useLang } from '../i18n';
import { fieldErrors, type UpisnicaErrors, upisnicaToInput, validateUpisnica } from '../lib/member';
import styles from './NewMember.module.css';

/** Manual entry: an empty upisnica on screen. */
export function NewMember() {
  const strings = useLang();
  const { t, lang } = strings;
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateMember();
  const remove = useDeleteMember();
  const [errors, setErrors] = useState<UpisnicaErrors>({});
  const [failure, setFailure] = useState<string | null>(null);

  const save = (v: UpisnicaValue) => {
    const found = validateUpisnica(v, strings);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) return;

    create.mutate(upisnicaToInput(v, { date: localDate(new Date()) }), {
      onSuccess: ({ member }) => {
        navigate(`/clanovi/${member.id}`);
        toast({
          message: t('toast.memberSaved', { name: member.full_name }),
          action: t('toast.undo'),
          onAction: () => remove.mutate(member.id, { onSuccess: () => navigate('/clanovi') }),
        });
      },
      onError: (error) => {
        const rejected = error instanceof ApiClientError && error.code === 'invalid_input' ? fieldErrors(error.fields, strings) : {};
        setErrors(rejected);
        if (!Object.keys(rejected).length) setFailure(errorMessage(error, lang, { generic: t('error.generic'), offline: t('error.offline') }));
      },
    });
  };

  return (
    <div className={styles.page}>
      <Link to="/clanovi/novi" className={styles.back}>
        ‹ {t('review.back')}
      </Link>
      <div className={styles.intro}>
        <PageHeader title={t('newMember.title')} />
        <p>{t('newMember.manualIntro')}</p>
      </div>
      {failure && <Notice>{failure}</Notice>}
      <UpisnicaForm errors={errors} busy={create.isPending} onSave={save} onCancel={() => navigate('/clanovi/novi')} />
    </div>
  );
}
