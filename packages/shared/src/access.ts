import type { StaffRole } from './schemas';

/**
 * Who may see and change what. The one place this is decided: the API enforces it on every request,
 * and the web app uses it to show only the sections (and buttons) a role can use.
 */

/** The parts of the app, one per sidebar section. */
export const AREAS = ['overview', 'schedule', 'planner', 'offerings', 'teachers', 'members', 'plans', 'payments', 'analytics'] as const;
export type Area = (typeof AREAS)[number];

/** none: hidden; view: can open it, can't change anything; edit: everything. */
export type Access = 'none' | 'view' | 'edit';

const everything = (access: Access): Record<Area, Access> => Object.fromEntries(AREAS.map((a) => [a, access])) as Record<Area, Access>;

/**
 * Owners (the studio's owners) can do everything.
 * Teachers will be able to look at part of the app, view-only; which part isn't decided yet, so for now they
 * see none of it. To open a section to them, set it here, e.g. `schedule: 'view'`; the API and the app follow.
 */
export const ROLE_ACCESS: Record<StaffRole, Record<Area, Access>> = {
  owner: everything('edit'),
  teacher: { ...everything('none') },
  front_desk: { ...everything('none') },
};

export function accessTo(role: StaffRole, area: Area): Access {
  return ROLE_ACCESS[role][area];
}

export function canView(role: StaffRole, area: Area): boolean {
  return accessTo(role, area) !== 'none';
}

export function canEdit(role: StaffRole, area: Area): boolean {
  return accessTo(role, area) === 'edit';
}

/** Whether the role can do everything: the studio's owners. Needed for whole-database work such as the iOS sync. */
export function hasFullAccess(role: StaffRole): boolean {
  return AREAS.every((a) => canEdit(role, a));
}
