import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useRole } from '../../hooks/useRole';
import { useAuth } from '../../hooks/useAuth';
import { RoleSwitcher } from './RoleSwitcher';
import { 
  Flame, 
  Search, 
  PlusCircle, 
  LayoutDashboard, 
  MessageSquare, 
  FileCheck, 
  ShoppingCart, 
  Users, 
  CreditCard, 
  Receipt, 
  FileText, 
  Package, 
  Wrench, 
  ShieldCheck, 
  BarChart3, 
  Settings,
  Menu,
  X
} from 'lucide-react';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isOwner, fullName } = useRole();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/sales?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center space-x-2">
          <Flame className="w-6 h-6 text-rafiki-500" />
          <span className="font-bold text-white text-base">Rafiki Ops</span>
        </div>
        <div className="flex items-center space-x-2">
          <RoleSwitcher />
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`${mobileMenuOpen ? 'block' : 'hidden'} md:block w-full md:w-64 bg-slate-900 border-r border-slate-800 flex-shrink-0 sticky top-0 h-auto md:h-screen overflow-y-auto z-40`}>
        <div className="p-5 border-b border-slate-800 hidden md:flex items-center space-x-3">
          <div className="bg-rafiki-500 p-2 rounded-xl text-white shadow-lg shadow-rafiki-500/30">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-base text-white tracking-tight leading-none">Rafiki Operations</h1>
            <span className="text-xs text-slate-400">Harare Desk Source of Truth</span>
          </div>
        </div>

        <nav className="p-4 space-y-6 text-xs">
          {/* Command Centre */}
          <div>
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Command Centre</span>
            <div className="mt-2 space-y-1">
              <NavLink to="/" end className={({ isActive }) => `flex items-center space-x-2.5 px-3 py-2 rounded-lg font-medium transition-colors ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </NavLink>
            </div>
          </div>

          {/* Commercial */}
          <div>
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Commercial</span>
            <div className="mt-2 space-y-1">
              <NavLink to="/enquiries" className={({ isActive }) => `flex items-center space-x-2.5 px-3 py-2 rounded-lg font-medium transition-colors ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                <MessageSquare className="w-4 h-4" />
                <span>Enquiries</span>
              </NavLink>
              <NavLink to="/quotes" className={({ isActive }) => `flex items-center space-x-2.5 px-3 py-2 rounded-lg font-medium transition-colors ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                <FileCheck className="w-4 h-4" />
                <span>Quotes</span>
              </NavLink>
              <NavLink to="/sales" className={({ isActive }) => `flex items-center space-x-2.5 px-3 py-2 rounded-lg font-medium transition-colors ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                <ShoppingCart className="w-4 h-4" />
                <span>Sales</span>
              </NavLink>
              <NavLink to="/customers" className={({ isActive }) => `flex items-center space-x-2.5 px-3 py-2 rounded-lg font-medium transition-colors ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                <Users className="w-4 h-4" />
                <span>Customers</span>
              </NavLink>
            </div>
          </div>

          {/* Finance */}
          <div>
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Finance</span>
            <div className="mt-2 space-y-1">
              <NavLink to="/payments" className={({ isActive }) => `flex items-center space-x-2.5 px-3 py-2 rounded-lg font-medium transition-colors ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                <CreditCard className="w-4 h-4" />
                <span>Payments</span>
              </NavLink>
              <NavLink to="/receipts" className={({ isActive }) => `flex items-center space-x-2.5 px-3 py-2 rounded-lg font-medium transition-colors ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                <Receipt className="w-4 h-4" />
                <span>Receipts</span>
              </NavLink>
              <NavLink to="/documents" className={({ isActive }) => `flex items-center space-x-2.5 px-3 py-2 rounded-lg font-medium transition-colors ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                <FileText className="w-4 h-4" />
                <span>Documents</span>
              </NavLink>
            </div>
          </div>

          {/* Operations */}
          <div>
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Operations</span>
            <div className="mt-2 space-y-1">
              <NavLink to="/inventory" className={({ isActive }) => `flex items-center space-x-2.5 px-3 py-2 rounded-lg font-medium transition-colors ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                <Package className="w-4 h-4" />
                <span>Inventory (Serials)</span>
              </NavLink>
              <NavLink to="/installations" className={({ isActive }) => `flex items-center space-x-2.5 px-3 py-2 rounded-lg font-medium transition-colors ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                <Wrench className="w-4 h-4" />
                <span>Installations</span>
              </NavLink>
              <NavLink to="/warranties" className={({ isActive }) => `flex items-center space-x-2.5 px-3 py-2 rounded-lg font-medium transition-colors ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                <ShieldCheck className="w-4 h-4" />
                <span>Warranties</span>
              </NavLink>
            </div>
          </div>

          {/* Reporting & Admin (Owner Only Gated) */}
          {isOwner && (
            <div>
              <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Admin & Intelligence</span>
              <div className="mt-2 space-y-1">
                <NavLink to="/reports" className={({ isActive }) => `flex items-center space-x-2.5 px-3 py-2 rounded-lg font-medium transition-colors ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                  <BarChart3 className="w-4 h-4 text-amber-400" />
                  <span>Reports & Margins</span>
                </NavLink>
                <NavLink to="/settings" className={({ isActive }) => `flex items-center space-x-2.5 px-3 py-2 rounded-lg font-medium transition-colors ${isActive ? 'bg-rafiki-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                  <Settings className="w-4 h-4 text-amber-400" />
                  <span>System Settings</span>
                </NavLink>
              </div>
            </div>
          )}
        </nav>
      </aside>

      {/* Main Content View Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="bg-slate-900 border-b border-slate-800 h-16 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
          <form onSubmit={handleSearchSubmit} className="relative w-64 sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search serial, quote, sale, phone, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rafiki-500"
            />
          </form>

          <div className="flex items-center space-x-3">
            <div className="hidden md:block">
              <RoleSwitcher />
            </div>
            <button
              onClick={() => navigate('/new-sale')}
              className="bg-rafiki-500 hover:bg-rafiki-600 text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition-colors shadow-lg shadow-rafiki-500/20"
            >
              <PlusCircle className="w-4 h-4" />
              <span>＋ New Sale</span>
            </button>
            <span className="hidden text-xs text-slate-400 lg:inline">{fullName}</span>
            <button
              onClick={() => signOut()}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Dynamic Workspace */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
