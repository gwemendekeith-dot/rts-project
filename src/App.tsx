import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AppShell } from './components/layout/AppShell';
import { OfflineBanner, ReconnectedToast, InstallPrompt } from './components/ui/InstallPrompt';

const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const NewSale = lazy(() => import('./pages/NewSale').then(module => ({ default: module.NewSale })));
const SaleWorkspace = lazy(() => import('./pages/SaleWorkspace').then(module => ({ default: module.SaleWorkspace })));
const Sales = lazy(() => import('./pages/Sales').then(module => ({ default: module.Sales })));
const Inventory = lazy(() => import('./pages/Inventory').then(module => ({ default: module.Inventory })));
const Installations = lazy(() => import('./pages/Installations').then(module => ({ default: module.Installations })));
const InstallationDetail = lazy(() => import('./pages/InstallationDetail').then(module => ({ default: module.InstallationDetail })));
const Customers = lazy(() => import('./pages/Customers').then(module => ({ default: module.Customers })));
const Customer360 = lazy(() => import('./pages/Customer360').then(module => ({ default: module.Customer360 })));
const Warranties = lazy(() => import('./pages/Warranties').then(module => ({ default: module.Warranties })));
const Documents = lazy(() => import('./pages/Documents').then(module => ({ default: module.Documents })));
const Reports = lazy(() => import('./pages/Reports').then(module => ({ default: module.Reports })));
const DataWorkspace = lazy(() => import('./pages/Workspaces').then(module => ({ default: module.DataWorkspace })));

function PageLoading() {
  return <div className="p-10 text-center text-slate-400">Loading page...</div>;
}

const ProtectedLayout: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs font-medium">
        Loading Operational Context...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/new-sale" element={<NewSale />} />
        <Route path="/sales/new" element={<NewSale />} />
        <Route path="/sales/:saleId" element={<SaleWorkspace />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/installations" element={<Installations />} />
        <Route path="/installations/:jobId" element={<InstallationDetail />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:customerId" element={<Customer360 />} />
        <Route path="/warranties" element={<Warranties />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/receipts" element={<Documents />} />
        <Route path="/enquiries" element={<DataWorkspace kind="enquiries" />} />
        <Route path="/quotes" element={<DataWorkspace kind="quotes" />} />
        <Route path="/payments" element={<DataWorkspace kind="payments" />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<DataWorkspace kind="settings" />} />
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
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
