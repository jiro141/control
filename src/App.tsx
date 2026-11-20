import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider } from './context/ToastContext';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SetupScreen } from './components/SetupScreen';
import { isSupabaseConfigured } from './lib/supabase';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { InvoiceFormPage } from './pages/InvoiceFormPage';
import { InvoiceDetailPage } from './pages/InvoiceDetailPage';
import { CustomersPage } from './pages/CustomersPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  if (!isSupabaseConfigured) {
    return <SetupScreen />;
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <SettingsProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="facturas" element={<InvoicesPage />} />
                  <Route path="facturas/nueva" element={<InvoiceFormPage />} />
                  <Route path="facturas/:id" element={<InvoiceDetailPage />} />
                  <Route path="facturas/:id/editar" element={<InvoiceFormPage />} />
                  <Route path="clientes" element={<CustomersPage />} />
                  <Route path="ajustes" element={<SettingsPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </SettingsProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
