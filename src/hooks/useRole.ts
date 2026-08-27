import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { switchRole as rpcSwitchRole } from '../lib/rpc';
import { useAuth } from './useAuth';
import type { UserRoleEnum } from '../types/database';

export function useRole() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('active_role, full_name')
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const rolesQuery = useQuery({
    queryKey: ['user_roles', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id);
      if (error) throw error;
      return data.map(({ role }) => role);
    },
  });

  const switchRole = async (newRole: UserRoleEnum) => {
    await rpcSwitchRole({ new_role: newRole });
    await queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
  };

  const activeRole = profileQuery.data?.active_role;
  const isLoading = profileQuery.isLoading || rolesQuery.isLoading;

  return {
    activeRole,
    switchRole,
    heldRoles: rolesQuery.data ?? [],
    fullName: profileQuery.data?.full_name,
    isOwner: activeRole === 'OWNER',
    isSales: activeRole === 'SALES',
    isOperations: activeRole === 'OPERATIONS',
    isLoading,
    loading: isLoading,
  };
}
