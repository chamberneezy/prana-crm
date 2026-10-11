/** Member status as shown on a chip. The API derives it; apps only display it. */
export type MemberStatus = 'active' | 'expiring' | 'unpaid' | 'frozen' | 'trial';

/** Plans a member can pick on the upisnica. */
export type UpisnicaPlan = '1x' | '2x' | '3x' | 'unl';

/** The studio's paper enrolment form, field for field. */
export interface UpisnicaValue {
  name: string;
  email: string;
  phone: string;
  /** dd.mm.yyyy. */
  dob: string;
  student: boolean;
  plan: UpisnicaPlan;
  health: boolean;
  healthText: string;
  /** Accuracy consent. Required to save. */
  consent: boolean;
  /** E-mail opt-in, separate from the accuracy consent. */
  news: boolean;
}
