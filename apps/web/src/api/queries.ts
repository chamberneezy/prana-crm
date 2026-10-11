import type {
  ApiMemberStatus,
  DashboardResponse,
  MembershipInput,
  MembershipResponse,
  PaymentInput,
  PaymentResponse,
  PaymentsResponse,
  PlanPatch,
  PlanResponse,
  PlansResponse,
  MemberDetailResponse,
  MemberInput,
  MemberPatch,
  MemberResponse,
  MembersResponse,
  OfferingGroupInput,
  OfferingGroupResponse,
  OfferingGroupsResponse,
  OfferingInput,
  OfferingResponse,
  OfferingsResponse,
  SessionDetailResponse,
  SessionInput,
  SessionResponse,
  SessionsResponse,
  StaffListResponse,
  VisitResponse,
} from '@prana/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export interface MembersFilter {
  q?: string;
  status?: ApiMemberStatus;
}

export function useMembers(filter: MembersFilter, enabled = true) {
  const params = new URLSearchParams();
  if (filter.q) params.set('q', filter.q);
  if (filter.status) params.set('status', filter.status);
  const query = params.toString();
  return useQuery({
    queryKey: ['members', 'list', filter.q ?? '', filter.status ?? ''],
    queryFn: () => api<MembersResponse>('GET', `/members${query ? `?${query}` : ''}`),
    // Keep the old rows on screen while a search or filter loads.
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useMember(id: string) {
  return useQuery({
    queryKey: ['members', 'detail', id],
    queryFn: () => api<MemberDetailResponse>('GET', `/members/${id}`),
  });
}

export function useCreateMember() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: MemberInput) => api<MemberResponse>('POST', '/members', input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['members'] }),
  });
}

export function useUpdateMember(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: MemberPatch) => api<MemberResponse>('PATCH', `/members/${id}`, patch),
    onSuccess: () => client.invalidateQueries({ queryKey: ['members'] }),
  });
}

export function useDeleteMember() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>('DELETE', `/members/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ['members'] }),
  });
}

// ── Class types ───────────────────────────────────────────────────────────────

export function useOfferingGroups() {
  return useQuery({ queryKey: ['offering-groups'], queryFn: () => api<OfferingGroupsResponse>('GET', '/offering-groups') });
}

export function useOfferings() {
  return useQuery({ queryKey: ['offerings'], queryFn: () => api<OfferingsResponse>('GET', '/offerings') });
}

export function useCreateOfferingGroup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: OfferingGroupInput) => api<OfferingGroupResponse>('POST', '/offering-groups', input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['offering-groups'] }),
  });
}

/** Creates a class type, or changes one when `id` is given. */
export function useSaveOffering(id?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: OfferingInput) => (id ? api<OfferingResponse>('PATCH', `/offerings/${id}`, input) : api<OfferingResponse>('POST', '/offerings', input)),
    // Sessions show the class name and colour, so they are stale too.
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: ['offerings'] }), client.invalidateQueries({ queryKey: ['sessions'] })]),
  });
}

// ── Schedule ──────────────────────────────────────────────────────────────────

export function useStaff() {
  return useQuery({ queryKey: ['staff'], queryFn: () => api<StaffListResponse>('GET', '/staff'), staleTime: 5 * 60_000 });
}

export function useSessions(from: string, to: string) {
  return useQuery({
    queryKey: ['sessions', 'range', from, to],
    queryFn: () => api<SessionsResponse>('GET', `/sessions?from=${from}&to=${to}`),
    placeholderData: keepPreviousData,
  });
}

export function useSession(id: string) {
  return useQuery({ queryKey: ['sessions', 'detail', id], queryFn: () => api<SessionDetailResponse>('GET', `/sessions/${id}`) });
}

function useSessionsChanged() {
  const client = useQueryClient();
  // "Termina ovaj tjedan" on the class types page counts sessions.
  return () => Promise.all([client.invalidateQueries({ queryKey: ['sessions'] }), client.invalidateQueries({ queryKey: ['offerings'] })]);
}

/** Schedules a session, or changes one when `id` is given. */
export function useSaveSession(id?: string) {
  const onSuccess = useSessionsChanged();
  return useMutation({
    mutationFn: (input: SessionInput) => (id ? api<SessionResponse>('PATCH', `/sessions/${id}`, input) : api<SessionResponse>('POST', '/sessions', input)),
    onSuccess,
  });
}

export function useDeleteSession() {
  const client = useQueryClient();
  const sessionsChanged = useSessionsChanged();
  return useMutation({
    mutationFn: (id: string) => api<void>('DELETE', `/sessions/${id}`),
    // Its check-ins go with it, which changes members' visit counts.
    onSuccess: () => Promise.all([sessionsChanged(), client.invalidateQueries({ queryKey: ['members'] })]),
  });
}

function useVisitsChanged() {
  const client = useQueryClient();
  return () => Promise.all([client.invalidateQueries({ queryKey: ['sessions'] }), client.invalidateQueries({ queryKey: ['members'] })]);
}

export function useCheckIn(sessionId: string) {
  const onSuccess = useVisitsChanged();
  return useMutation({
    mutationFn: (memberId: string) => api<VisitResponse>('POST', `/sessions/${sessionId}/visits`, { member_id: memberId }),
    onSuccess,
  });
}

export function useRemoveVisit() {
  const onSuccess = useVisitsChanged();
  return useMutation({ mutationFn: (visitId: string) => api<void>('DELETE', `/visits/${visitId}`), onSuccess });
}

// ── Overview, plans, memberships, payments ────────────────────────────────────

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardResponse>('GET', '/dashboard'),
    // Almost everything changes these numbers, so they are fetched fresh every time the page opens.
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function usePlans() {
  return useQuery({ queryKey: ['plans'], queryFn: () => api<PlansResponse>('GET', '/plans') });
}

export function useSavePlan(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: PlanPatch) => api<PlanResponse>('PATCH', `/plans/${id}`, patch),
    // A price change can make members unpaid, or clear it.
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: ['plans'] }), client.invalidateQueries({ queryKey: ['members'] })]),
  });
}

export function usePayments(from: string, to: string) {
  return useQuery({
    queryKey: ['payments', from, to],
    queryFn: () => api<PaymentsResponse>('GET', `/payments?from=${from}&to=${to}`),
    placeholderData: keepPreviousData,
  });
}

function useMoneyChanged() {
  const client = useQueryClient();
  return () => Promise.all([client.invalidateQueries({ queryKey: ['members'] }), client.invalidateQueries({ queryKey: ['payments'] })]);
}

export function useRecordPayment() {
  const onSuccess = useMoneyChanged();
  return useMutation({ mutationFn: (input: PaymentInput) => api<PaymentResponse>('POST', '/payments', input), onSuccess });
}

export function useAddMembership() {
  const onSuccess = useMoneyChanged();
  return useMutation({ mutationFn: (input: MembershipInput) => api<MembershipResponse>('POST', '/memberships', input), onSuccess });
}

export function useRenewMembership(id: string) {
  const onSuccess = useMoneyChanged();
  return useMutation({ mutationFn: (planId: string | undefined) => api<MembershipResponse>('POST', `/memberships/${id}/renew`, { plan_id: planId }), onSuccess });
}

export function useFreezeMembership(id: string) {
  const onSuccess = useMoneyChanged();
  return useMutation({ mutationFn: (until: string | null) => api<MembershipResponse>('POST', `/memberships/${id}/freeze`, { until }), onSuccess });
}
