import React from 'react';
import { useRole } from '../../hooks/useRole';
import type { UserRoleEnum } from '../../types/database';
import { Shield, ShieldAlert, UserCheck } from 'lucide-react';

export const RoleSwitcher: React.FC = () => {
  const { activeRole, heldRoles, switchRole, isOwner, isLoading } = useRole();
  const [busy, setBusy] = React.useState(false);

  if (isLoading || !activeRole) return null;

  const handleRoleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as UserRoleEnum;
    setBusy(true);
    try {
      await switchRole(newRole);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
      {isOwner ? (
        <Shield className="w-4 h-4 text-amber-400" />
      ) : activeRole === 'SALES' ? (
        <UserCheck className="w-4 h-4 text-emerald-400" />
      ) : (
        <ShieldAlert className="w-4 h-4 text-blue-400" />
      )}
      <span className="text-xs text-slate-400 font-medium hidden sm:inline">Role:</span>
      <select
        value={activeRole}
        onChange={handleRoleChange}
        disabled={busy}
        className="bg-transparent text-xs font-semibold text-rafiki-400 focus:outline-none cursor-pointer"
      >
        {heldRoles.map((role) => (
          <option key={role} value={role} className="bg-slate-900 text-slate-100">
            {role === 'OWNER' ? 'OWNER (Keith / Thokozani)' : `${role} Desk`}
          </option>
        ))}
      </select>
    </div>
  );
};
