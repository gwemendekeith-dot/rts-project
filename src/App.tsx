import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AppShell } from './components/layout/AppShell';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { NewSale } from './pages/NewSale';
import { SaleWorkspace } from './pages/SaleWorkspace';
import { Inventory } from './pages/Inventory';
import { Installations } from './pages/Installations';
import { Customers } from './pages/Customers';
import { Warranties } from './pages/Warranties';
import { Documents } from './pages/Documents';
import { Reports } from './pages/Reports';
import { OfflineBanner, ReconnectedToast, InstallPrompt } from './components/ui/InstallPrompt';

const ProtectedLayout: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs font-medium">
        Loading Operational Context...
      </div>
    );
  }

  if (!user && import.meta.env.VITE_SUPABASE_URL !== 'https://mock.supabase.co') {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/new-sale" element={<NewSale />} />
        <Route path="/sales/:saleId" element={<SaleWorkspace />} />
        <Route path="/sales" element={<SaleWorkspace />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/installations" element={<Installations />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/warranties" element={<Warranties />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/receipts" element={<Documents />} />
        <Route path="/enquiries" element={<div className="text-slate-300">Enquiries Workspace</div>} />
        <Route path="/quotes" element={<div className="text-slate-300">Quotes Workspace</div>} />
        <Route path="/payments" element={<div className="text-slate-300">Payments Workspace</div>} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<div className="text-slate-300">System Settings</div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      {/* Global PWA overlays — render on every page */}
      <OfflineBanner />
      <ReconnectedToast />
      <InstallPrompt />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
