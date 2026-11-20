import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FullScreenLoader } from './Spinner';

export function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { session, loading, isAdmin, profileLoading } = useAuth();
  const location = useLocation();

  if (loading || (adminOnly && profileLoading)) {
    return <FullScreenLoader label="Verificando sesión…" />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
