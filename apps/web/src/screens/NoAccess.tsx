import { EmptyState } from '../components';
import { useLang } from '../i18n';

/** For someone on the staff list who can't open any section yet (teachers, for now). */
export function NoAccess() {
  const { t } = useLang();
  return <EmptyState title={t('noAccess.title')}>{t('noAccess.body')}</EmptyState>;
}
