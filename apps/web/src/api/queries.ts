import type { ApiMemberStatus, MemberDetailResponse, MemberInput, MemberPatch, MemberResponse, MembersResponse } from '@prana/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export interface MembersFilter {
  q?: string;
  status?: ApiMemberStatus;
}

export function useMembers(filter: MembersFilter) {
  const params = new URLSearchParams();
  if (filter.q) params.set('q', filter.q);
  if (filter.status) params.set('status', filter.status);
  const query = params.toString();
  return useQuery({
    queryKey: ['members', 'list', filter.q ?? '', filter.status ?? ''],
    queryFn: () => api<MembersResponse>('GET', `/members${query ? `?${query}` : ''}`),
    // Keep the old rows on screen while a search or filter loads.
    placeholderData: keepPreviousData,
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
