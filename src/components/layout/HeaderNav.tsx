import React from 'react';
import { NavLink } from 'react-router-dom';
import { useRole } from '../../hooks/useRole';
import type { UserRoleEnum } from '../../types/database';
import { 
  Flame, 
  LayoutDashboard, 
  PlusCircle, 
  ShoppingCart, 
  Package, 
  Wrench, 
  ShieldCheck, 
  Users, 
  FileText, 
  BarChart3, 
  Settings 
} from 'lucide-react';

export const HeaderNav: React.FC = () => {
  const { activeRole, switchRole } = useRole();

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    switchRole(e.target.value as UserRoleEnum);
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="bg-rafiki-500 p-2 rounded-xl text-white shadow-lg shadow-rafiki-500/30">
              <Flame className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white block leading-none">Rafiki Operations</span>
              <span className="text-xs text-slate-400">Hot Water on The Go, Smart Living</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="bg-slate-850 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center space-x-2">
              <span className="text-xs font-medium text-slate-400">Active Role:</span>
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
          </div>
        </div>

        {/* Navigation Bar */}
        <nav className="flex space-x-1 overflow-x-auto py-2 border-t border-slate-800 text-sm">
          <NavLink to="/" end className={({ isActive }) => `flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/new-sale" className={({ isActive }) => `flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
            <PlusCircle className="w-4 h-4" />
            <span>New Sale / Quote</span>
          </NavLink>
          <NavLink to="/sales" className={({ isActive }) => `flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
            <ShoppingCart className="w-4 h-4" />
            <span>Sales</span>
          </NavLink>
          <NavLink to="/inventory" className={({ isActive }) => `flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
            <Package className="w-4 h-4" />
            <span>Inventory (Serials)</span>
          </NavLink>
          <NavLink to="/installations" className={({ isActive }) => `flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
            <Wrench className="w-4 h-4" />
            <span>Installations</span>
          </NavLink>
          <NavLink to="/warranties" className={({ isActive }) => `flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
            <ShieldCheck className="w-4 h-4" />
            <span>Warranties</span>
          </NavLink>
          <NavLink to="/customers" className={({ isActive }) => `flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
            <Users className="w-4 h-4" />
            <span>Customers</span>
          </NavLink>
          <NavLink to="/documents" className={({ isActive }) => `flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
            <FileText className="w-4 h-4" />
            <span>Documents</span>
          </NavLink>
          {activeRole === 'OWNER' && (
            <>
              <NavLink to="/reports" className={({ isActive }) => `flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                <BarChart3 className="w-4 h-4" />
                <span>Reports</span>
              </NavLink>
              <NavLink to="/settings" className={({ isActive }) => `flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};
