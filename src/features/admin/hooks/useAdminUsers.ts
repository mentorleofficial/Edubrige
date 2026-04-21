import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type AdminUserRow,
  type CreateUserInput,
  type FetchUsersParams,
  type FetchUsersResult,
  type RoleFilter,
  createUser,
  fetchAdminUsers,
  toggleMentorActive,
} from "../api/users";

const adminUsersKey = (params: FetchUsersParams) =>
  ["admin", "users", params.page, params.pageSize, params.role] as const;

export function useAdminUsers(params: FetchUsersParams) {
  return useQuery({
    queryKey: adminUsersKey(params),
    queryFn: () => fetchAdminUsers(params),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useToggleMentorActive(params: FetchUsersParams) {
  const qc = useQueryClient();
  const key = adminUsersKey(params);

  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      toggleMentorActive(userId, isActive),
    onMutate: async ({ userId, isActive }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<FetchUsersResult>(key);
      if (prev) {
        qc.setQueryData<FetchUsersResult>(key, {
          ...prev,
          rows: prev.rows.map((u) =>
            u.id === userId
              ? { ...u, mentor_profiles: [{ is_active: isActive }] }
              : u,
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => {
      // Allow trigger to populate users row before refetch.
      setTimeout(() => qc.invalidateQueries({ queryKey: ["admin", "users"] }), 800);
    },
  });
}

export type { AdminUserRow, RoleFilter };
