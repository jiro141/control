import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FullScreenLoader } from './Spinner';

export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullScreenLoader label="Verificando sesión…" />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
