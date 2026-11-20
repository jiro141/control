interface SupabaseErrorShape {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

export function describeError(error: unknown): string {
  if (!error) return 'Ocurrió un error inesperado. Intenta de nuevo.';
  if (typeof error === 'string') return error;
  if (error instanceof Error && !('code' in error)) {
    return error.message || 'Ocurrió un error inesperado. Intenta de nuevo.';
  }

  const shape = error as SupabaseErrorShape;
  const message = shape.message ?? '';
  const lower = message.toLowerCase();
  const code = shape.code ?? '';

  if (
    code === '42P01' ||
    (lower.includes('relation') && lower.includes('does not exist')) ||
    lower.includes('could not find the table')
  ) {
    return 'No se encontró el esquema. Ejecuta supabase/schema.sql en Supabase.';
  }

  if (code === 'PGRST116') {
    return 'No se encontró el registro solicitado.';
  }

  if (code === 'PGRST205' || lower.includes('schema cache')) {
    return 'La tabla no está disponible todavía. Recarga el esquema en Supabase y espera unos segundos.';
  }

  if (lower.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.';
  }

  if (lower.includes('email not confirmed')) {
    return 'El correo no está confirmado. Confirma el usuario en Supabase (Authentication → Users).';
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed')
  ) {
    return 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.';
  }

  if (code === '42501' || lower.includes('row-level security')) {
    return 'No tienes permisos para realizar esta acción. Revisa las políticas RLS del esquema.';
  }

  if (lower.includes('duplicate key')) {
    return 'Ya existe un registro con esos datos.';
  }

  if (lower.includes('violates check constraint')) {
    return 'Alguno de los datos no cumple las validaciones. Revisa los valores e intenta de nuevo.';
  }

  if (lower.includes('password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }

  if (lower.includes('user not found')) {
    return 'No se encontró el usuario.';
  }

  if (message) return message;

  return 'Ocurrió un error inesperado. Intenta de nuevo.';
}
