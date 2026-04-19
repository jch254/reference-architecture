import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api-client';

interface Session {
  email: string;
  tenantSlug: string;
}

interface Example {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

const SESSION_KEY = ['session'] as const;
const EXAMPLES_KEY = ['examples'] as const;

export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: () => api.get<Session>('/api/auth/session'),
  });
}

export function useExamples() {
  return useQuery({
    queryKey: EXAMPLES_KEY,
    queryFn: () => api.get<Example[]>('/api/example'),
  });
}

export function useExample(id: string) {
  return useQuery({
    queryKey: [...EXAMPLES_KEY, id],
    queryFn: () => api.get<Example[]>('/api/example'),
    select: (data) => data.find((item) => item.id === id),
  });
}

export function useCreateExample() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<Example>('/api/example', { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EXAMPLES_KEY }),
  });
}

export function useUpdateExample() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch<Example>(`/api/example/${id}`, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EXAMPLES_KEY }),
  });
}

export function useDeleteExample() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/api/example/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EXAMPLES_KEY }),
  });
}
