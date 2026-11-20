import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchProfiles, setProfileRole } from '../lib/api';
import { describeError } from '../lib/errors';
import type { Profile, ProfileRole } from '../types/database';

const roleLabels: Record<ProfileRole, string> = {
  admin: 'Administrador',
  viewer: 'Solo lectura',
  pending: 'Pendiente de revisión',
};

export function UsersPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfiles(await fetchProfiles());
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateRole = async (profile: Profile, role: ProfileRole) => {
    setSavingId(profile.id);
    try {
      await setProfileRole(profile.id, role);
      setProfiles((current) => current.map((item) =>
        item.id === profile.id ? { ...item, role } : item,
      ));
      notify('Permisos actualizados.', 'success');
    } catch (cause) {
      notify(describeError(cause), 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Usuarios"
        subtitle="Todas las cuentas pueden consultar los datos. Los administradores también pueden editarlos."
      />
      <section className="card p-4 sm:p-5">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Spinner className="h-4 w-4" /> Cargando usuarios…
          </p>
        ) : error ? (
          <div>
            <p role="alert" className="text-sm text-red-700">{error}</p>
            <button type="button" className="btn btn-primary mt-3" onClick={() => void load()}>
              Reintentar
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {profiles.map((profile) => (
              <li key={profile.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 break-words">
                  <p className="font-semibold text-navy">{profile.full_name || profile.id}</p>
                  <p className="text-sm text-slate-600">
                    {profile.id === user?.id ? 'Tu cuenta · ' : ''}{roleLabels[profile.role]}
                  </p>
                </div>
                {profile.id !== user?.id ? (
                  <select
                    className="input w-auto max-w-full"
                    aria-label={`Permisos de ${profile.full_name || profile.id}`}
                    value={profile.role}
                    disabled={savingId !== null}
                    onChange={(event) => void updateRole(profile, event.target.value as ProfileRole)}
                  >
                    <option value="pending">{roleLabels.pending}</option>
                    <option value="viewer">{roleLabels.viewer}</option>
                    <option value="admin">{roleLabels.admin}</option>
                  </select>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
