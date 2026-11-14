/** Member status as shown on a chip. The API derives it; apps only display it. */
export type MemberStatus = 'active' | 'expiring' | 'unpaid' | 'frozen' | 'trial';

/** Plans a member can pick on the upisnica. */
export type UpisnicaPlan = '1x' | '2x' | '3x' | 'unl';

/** The studio's paper enrolment form, field for field. */
export interface UpisnicaValue {
  /** As on the paper form: first and last name on one line. Kept as firstName + lastName once those are set. */
  name: string;
  /** Not on the paper form: the screen asks for them apart. Left out: split from `name` at the first space. */
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  /** dd.mm.yyyy. */
  dob: string;
  student: boolean;
  plan: UpisnicaPlan;
  /** Not on the paper form: one of the studio's own plans, chosen instead of `plan`. */
  planId?: string;
  health: boolean;
  healthText: string;
  /** Accuracy consent. Required to save. */
  consent: boolean;
  /** E-mail opt-in, separate from the accuracy consent. */
  news: boolean;
  /** Not on the paper form: how the chosen plan was paid at sign-up, or `later`. Unset until the owner answers. */
  paid?: 'cash' | 'card' | 'transfer' | 'later';
}
