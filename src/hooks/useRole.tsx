import React, { createContext, useContext, useState } from 'react';
import type { UserRole } from '../types/database';

interface RoleContextType {
  activeRole: UserRole;
  switchRole: (role: UserRole) => void;
  isOwner: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRole, setActiveRole] = useState<UserRole>('OWNER');

  const switchRole = (role: UserRole) => {
    setActiveRole(role);
  };

  return (
    <RoleContext.Provider value={{ activeRole, switchRole, isOwner: activeRole === 'OWNER' }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};
