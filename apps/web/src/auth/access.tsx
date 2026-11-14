import { type Area, AREAS, canEdit, canView, hasFullAccess } from '@prana/shared';
import { type ReactNode, useMemo } from 'react';
import { Navigate } from 'react-router';
import { useMe } from './AuthProvider';

/** What the signed-in person may see and change (ROLE_ACCESS in @prana/shared; the API enforces the same). */
export function useAccess() {
  const { staff } = useMe();
  return useMemo(
    () => ({
      role: staff.role,
      canView: (area: Area) => canView(staff.role, area),
      canEdit: (area: Area) => canEdit(staff.role, area),
      /** The studio's owners: everything, feedback included. */
      full: hasFullAccess(staff.role),
      /** The sections this person can open, in sidebar order. */
      areas: AREAS.filter((area) => canView(staff.role, area)),
    }),
    [staff.role],
  );
}

/** Shows its children only to someone who may change things in `area`; view-only users don't see the control at all. */
export function CanEdit({ area, children }: { area: Area; children: ReactNode }) {
  return useAccess().canEdit(area) ? <>{children}</> : null;
}

/**
 * A page that belongs to `area`: opened only with view access (or edit, for pages that only change things,
 * like adding a member). Anyone else is sent to the first section they can open.
 */
export function AreaRoute({ area, edit = false, home, children }: { area: Area; edit?: boolean; home: string; children: ReactNode }) {
  const access = useAccess();
  const allowed = edit ? access.canEdit(area) : access.canView(area);
  return allowed ? <>{children}</> : <Navigate to={home} replace />;
}
