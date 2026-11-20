import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider } from './context/ToastContext';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SetupScreen } from './components/SetupScreen';
import { Spinner } from './components/Spinner';
import { isSupabaseConfigured } from './lib/supabase';

const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const InvoicesPage = lazy(() =>
  import('./pages/InvoicesPage').then((module) => ({ default: module.InvoicesPage })),
);
const InvoiceFormPage = lazy(() =>
  import('./pages/InvoiceFormPage').then((module) => ({ default: module.InvoiceFormPage })),
);
const InvoiceDetailPage = lazy(() =>
  import('./pages/InvoiceDetailPage').then((module) => ({
    default: module.InvoiceDetailPage,
  })),
);
const CustomersPage = lazy(() =>
  import('./pages/CustomersPage').then((module) => ({ default: module.CustomersPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
);
const UsersPage = lazy(() =>
  import('./pages/UsersPage').then((module) => ({ default: module.UsersPage })),
);

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
      <Spinner className="h-6 w-6 text-accent" />
      <p className="text-sm font-medium">Cargando…</p>
    </div>
  );
}

export default function App() {
  if (!isSupabaseConfigured) {
    return <SetupScreen />;
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <SettingsProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppShell />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="facturas" element={<InvoicesPage />} />
                    <Route path="facturas/:id" element={<InvoiceDetailPage />} />
                    <Route path="clientes" element={<CustomersPage />} />
                    <Route path="ajustes" element={<SettingsPage />} />
                    <Route element={<ProtectedRoute adminOnly />}>
                      <Route path="facturas/nueva" element={<InvoiceFormPage />} />
                      <Route path="facturas/:id/editar" element={<InvoiceFormPage />} />
                      <Route path="usuarios" element={<UsersPage />} />
                    </Route>
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </SettingsProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
