import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { switchRole as rpcSwitchRole } from '../lib/rpc';
import { useAuth } from './useAuth';
import type { UserRoleEnum } from '../types/database';

export function useRole() {
  const { user } = useAuth();
  const [activeRole, setActiveRole] = useState<UserRoleEnum>('OWNER');
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfileRole = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('active_role')
        .eq('id', user.id)
        .single();

      if (!error && data?.active_role) {
        setActiveRole(data.active_role as UserRoleEnum);
      }
    } catch {
      // Fall back to default role
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfileRole();
  }, [fetchProfileRole]);

  const switchRole = async (newRole: UserRoleEnum) => {
    setActiveRole(newRole);
    if (user?.id) {
      try {
        await rpcSwitchRole({ user_id: user.id, new_role: newRole });
      } catch (err) {
        console.error('Failed to persist active role in profile', err);
      }
    }
  };

  return {
    activeRole,
    switchRole,
    isOwner: activeRole === 'OWNER',
    isSales: activeRole === 'SALES',
    isOperations: activeRole === 'OPERATIONS',
    loading,
  };
}
