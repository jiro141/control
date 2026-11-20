import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  KeyRound,
  LogOut,
  Mail,
  Save,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { describeError } from '../lib/errors';

interface SettingsForm {
  business_name: string;
  phone_primary: string;
  phone_secondary: string;
  address: string;
  tax_id: string;
  website: string;
}

const EMPTY_FORM: SettingsForm = {
  business_name: '',
  phone_primary: '',
  phone_secondary: '',
  address: '',
  tax_id: '',
  website: '',
};

export function SettingsPage() {
  const { user, isAdmin, profileLoading, signOut, updatePassword } = useAuth();
  const { settings, loading, error, refresh, save } = useSettings();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      business_name: settings.business_name,
      phone_primary: settings.phone_primary,
      phone_secondary: settings.phone_secondary,
      address: settings.address ?? '',
      tax_id: settings.tax_id ?? '',
      website: settings.website ?? '',
    });
  }, [settings]);

  const setField = (field: keyof SettingsForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    if (!form.business_name.trim()) {
      setFormError('Ingresa el nombre del negocio.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await save({
        business_name: form.business_name.trim(),
        phone_primary: form.phone_primary.trim(),
        phone_secondary: form.phone_secondary.trim(),
        address: form.address.trim() || null,
        tax_id: form.tax_id.trim() || null,
        website: form.website.trim() || null,
      });
      notify('Configuración guardada.', 'success');
    } catch (cause) {
      setFormError(describeError(cause));
    } finally {
      setSaving(false);
    }
  };

  const handlePassword = async () => {
    setPasswordError(null);
    if (newPassword.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.');
      return;
    }
    setPasswordSaving(true);
    try {
      await updatePassword(newPassword);
      notify('Contraseña actualizada.', 'success');
      setNewPassword('');
      setConfirmPassword('');
    } catch (cause) {
      setPasswordError(describeError(cause));
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (cause) {
      notify(describeError(cause), 'error');
    }
  };

  if (loading && !settings) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
        <Spinner className="h-6 w-6 text-accent" />
        <p className="text-sm font-medium">Cargando configuración…</p>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div>
        <PageHeader title="Ajustes" />
        <div className="card p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-3 text-sm font-semibold text-navy">{error}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="btn btn-primary mt-4"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Ajustes"
        subtitle="Datos del negocio, moneda y seguridad de la cuenta."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4 sm:p-5 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-bold text-navy">Datos del negocio</h2>
            {!profileLoading && !isAdmin ? (
              <span className="text-xs text-slate-600">Solo lectura</span>
            ) : null}
          </div>

          <fieldset className="mt-4 grid gap-3 sm:grid-cols-2" disabled={!isAdmin}>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="settings-name">
                Nombre del negocio
              </label>
              <input
                id="settings-name"
                type="text"
                value={form.business_name}
                onChange={(event) => setField('business_name', event.target.value)}
                className="input"
                placeholder="Venta de todo tipo de madera para minería"
              />
            </div>
            <div>
              <label className="label" htmlFor="settings-phone-primary">
                Teléfono principal
              </label>
              <input
                id="settings-phone-primary"
                type="tel"
                value={form.phone_primary}
                onChange={(event) => setField('phone_primary', event.target.value)}
                className="input"
                placeholder="+58 424-6270112"
              />
            </div>
            <div>
              <label className="label" htmlFor="settings-phone-secondary">
                Teléfono secundario
              </label>
              <input
                id="settings-phone-secondary"
                type="tel"
                value={form.phone_secondary}
                onChange={(event) => setField('phone_secondary', event.target.value)}
                className="input"
                placeholder="+57 314-2880642"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="settings-address">
                Dirección
              </label>
              <input
                id="settings-address"
                type="text"
                value={form.address}
                onChange={(event) => setField('address', event.target.value)}
                className="input"
                placeholder="Dirección del negocio"
              />
            </div>
            <div>
              <label className="label" htmlFor="settings-tax">
                RIF / Identificación fiscal
              </label>
              <input
                id="settings-tax"
                type="text"
                value={form.tax_id}
                onChange={(event) => setField('tax_id', event.target.value)}
                className="input"
                placeholder="J-00000000-0"
              />
            </div>
            <div>
              <label className="label" htmlFor="settings-website">
                Sitio web
              </label>
              <input
                id="settings-website"
                type="text"
                value={form.website}
                onChange={(event) => setField('website', event.target.value)}
                className="input"
                placeholder="www.ejemplo.com"
              />
            </div>
          </fieldset>

          <div className="mt-4 flex flex-col gap-3 rounded-xl bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Moneda de las facturas nuevas
              </p>
              <p className="text-lg font-extrabold text-navy">
                Peso colombiano (COP)
              </p>
            </div>
          </div>

          {formError ? (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {formError}
            </p>
          ) : null}

          {isAdmin ? <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              Guardar configuración
            </button>
            <Link to="/usuarios" className="btn btn-ghost">Gestionar usuarios</Link>
          </div> : null}
        </section>

        <div className="space-y-4">
          <section className="card p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-bold text-navy">Cuenta y seguridad</h2>
            </div>

            <div className="mt-3 rounded-xl bg-surface px-3 py-2.5">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <Mail className="h-3.5 w-3.5" />
                Correo de acceso
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-navy">
                {user?.email ?? 'Sin correo'}
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="label" htmlFor="settings-new-password">
                  Nueva contraseña
                </label>
                <input
                  id="settings-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="input"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <label className="label" htmlFor="settings-confirm-password">
                  Confirmar contraseña
                </label>
                <input
                  id="settings-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="input"
                  placeholder="Repite la contraseña"
                />
              </div>

              {passwordError ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {passwordError}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void handlePassword()}
                className="btn btn-ghost w-full"
                disabled={passwordSaving}
              >
                {passwordSaving ? <Spinner className="h-4 w-4" /> : null}
                Cambiar contraseña
              </button>
            </div>
          </section>

          <section className="card p-4 sm:p-5">
            <h2 className="text-sm font-bold text-navy">Sesión</h2>
            <p className="mt-1 text-xs text-slate-500">
              Cierra la sesión en este dispositivo.
            </p>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="btn btn-danger mt-3 w-full"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
