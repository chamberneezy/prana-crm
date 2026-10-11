import {
  type ApiMemberStatus,
  displayToIsoDate,
  formatDayMonth,
  isoToDisplayDate,
  type Member,
  type MemberInput,
  type MemberPatch,
  type MemberSummary,
  type PlanCode,
  type UpisnicaValue,
} from '@prana/shared';
import type { useLang } from '../i18n';

type Strings = Pick<ReturnType<typeof useLang>, 't' | 'tn'>;

/** "2× tjedno", or "Proba" for a trial. */
export function planLabel(code: PlanCode, { t }: Strings): string {
  return code === 'trial' ? t('status.trial') : t(`plan.${code}`);
}

/** The chip label: the status word, or "Ističe za N dana" for an expiring membership. */
export function statusLabel(status: ApiMemberStatus, daysLeft: number | null, { t, tn }: Strings): string {
  if (status === 'expiring' && daysLeft !== null) return daysLeft <= 0 ? t('status.expiresToday') : tn('status.expiresIn', daysLeft);
  return t(`status.${status}`);
}

/** The line under a member's name: "2× tjedno · 6/8 dolazaka · zadnji dolazak 07.10." */
export function memberSubline(summary: MemberSummary, strings: Strings): string {
  const { t, tn } = strings;
  const m = summary.membership;
  const lastVisit = summary.last_visit_at ? t('member.sub.lastVisit', { date: formatDayMonth(summary.last_visit_at) }) : null;
  if (!m) return [t('member.sub.none'), lastVisit].filter(Boolean).join(' · ');

  const plan = planLabel(m.plan_code, strings);
  if (summary.status === 'frozen' && m.frozen_until) {
    return `${plan} · ${t('member.sub.frozenUntil', { date: isoToDisplayDate(m.frozen_until).slice(0, 6) })}`;
  }
  // The noun agrees with the number next to it: "2/4 dolaska", "6/8 dolazaka", "11 dolazaka".
  const visits = m.visits_total === null ? `${m.visits_used} ${tn('visits', m.visits_used)}` : `${m.visits_used}/${m.visits_total} ${tn('visits', m.visits_total)}`;
  return [plan, visits, lastVisit].filter(Boolean).join(' · ');
}

/** A stored member in the shape the upisnica components use. */
export function memberToUpisnica(member: Member, summary: MemberSummary): UpisnicaValue {
  const code = summary.membership?.plan_code;
  return {
    name: member.full_name,
    email: member.email ?? '',
    phone: member.phone ?? '',
    dob: member.dob ? isoToDisplayDate(member.dob) : '',
    student: member.is_student_or_retired,
    plan: code && code !== 'trial' ? code : '2x',
    health: member.health_flag,
    healthText: member.health_text ?? '',
    consent: member.consent_accuracy,
    news: member.consent_news,
  };
}

export type UpisnicaErrors = Partial<Record<'name' | 'email' | 'phone' | 'dob' | 'healthText', string>>;

/** Checks what can be checked before sending: the date and the e-mail. */
export function validateUpisnica(v: UpisnicaValue, { t }: Strings): UpisnicaErrors {
  const errors: UpisnicaErrors = {};
  if (v.dob.trim() && !displayToIsoDate(v.dob)) errors.dob = t('upisnica.dobInvalid');
  if (v.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) errors.email = t('upisnica.emailInvalid');
  return errors;
}

/** Maps the API's rejected field names back onto the form. */
export function fieldErrors(fields: string[], { t }: Strings): UpisnicaErrors {
  const errors: UpisnicaErrors = {};
  if (fields.includes('email')) errors.email = t('upisnica.emailInvalid');
  if (fields.includes('dob')) errors.dob = t('upisnica.dobInvalid');
  if (fields.includes('phone')) errors.phone = t('upisnica.phoneInvalid');
  if (fields.includes('full_name')) errors.name = t('upisnica.nameRequired');
  return errors;
}

/** The member fields of the form, as the API takes them. */
export function upisnicaToPatch(v: UpisnicaValue): MemberPatch & { full_name: string } {
  return {
    full_name: v.name.trim(),
    email: v.email.trim() || null,
    phone: v.phone.trim() || null,
    dob: v.dob.trim() ? displayToIsoDate(v.dob) : null,
    is_student_or_retired: v.student,
    health_flag: v.health,
    // A note left behind after switching to "Ne" is not kept.
    health_text: v.health ? v.healthText.trim() || null : null,
    consent_news: v.news,
  };
}

/** A new member from the form, with the chosen plan as the first membership. */
export function upisnicaToInput(v: UpisnicaValue, signed: { place?: string; date: string }): MemberInput {
  return {
    ...upisnicaToPatch(v),
    consent_accuracy: v.consent,
    signed_place: signed.place?.trim() || null,
    signed_date: signed.date,
    plan_code: v.plan,
  };
}
