import React from 'react';
import { useRole } from '../../hooks/useRole';
import type { UserRoleEnum } from '../../types/database';
import { Shield, ShieldAlert, UserCheck } from 'lucide-react';

export const RoleSwitcher: React.FC = () => {
  const { activeRole, switchRole, isOwner } = useRole();

  const handleRoleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as UserRoleEnum;
    await switchRole(newRole);
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
        className="bg-transparent text-xs font-semibold text-rafiki-400 focus:outline-none cursor-pointer"
      >
        <option value="OWNER" className="bg-slate-900 text-slate-100">OWNER (Keith / Thokozani)</option>
        <option value="SALES" className="bg-slate-900 text-slate-100">SALES Desk</option>
        <option value="OPERATIONS" className="bg-slate-900 text-slate-100">OPERATIONS Desk</option>
      </select>
    </div>
  );
};
