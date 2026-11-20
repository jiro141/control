# Control de Ventas – Madera para Minería

Aplicación web tipo PWA para controlar facturas, pagos y saldos de un negocio de
venta de todo tipo de madera para minería.

Incluye autenticación con Supabase, panel de resumen, gestión de facturas y
clientes, registro de abonos, exportación real a PDF y Excel, e impresión de la
factura comercial en A4.

## Requisitos

- Node.js 18 o superior (recomendado Node 20+).
- npm.
- Una cuenta en [Supabase](https://supabase.com).
- Opcional para publicar: una cuenta en [Netlify](https://netlify.com).

## 1. Instalar dependencias

```bash
npm install
```

En Windows, si PowerShell bloquea `npm.ps1` por la política de ejecución, usa:

```powershell
cmd /c npm install
```

## 2. Crear el proyecto en Supabase

1. Entra a [supabase.com/dashboard](https://supabase.com/dashboard) y crea un
   proyecto nuevo.
2. Espera a que termine la preparación de la base de datos.

## 3. Instalar o actualizar el esquema

Antes de ejecutar la migración, verificá que el registro público esté
desactivado según el paso 4. Toda cuenta con sesión puede leer los datos.

1. Si la base ya tiene datos, verificá que haya una copia restaurable y revisá
   qué cuentas tienen acceso. El esquema original asignaba rol administrador
   por defecto y la actualización conserva los roles existentes. La
   configuración de moneda previa se registra en las facturas históricas
   como referencia. Si se usaron distintas monedas a lo largo del tiempo,
   verificá las facturas contra sus comprobantes.
2. Para un proyecto que se administra desde **SQL Editor**, creá una consulta y
   ejecutá completo `supabase/migrations/20261119000000_control_hardening.sql`.
   Para un proyecto gestionado con migraciones, aplicá ese archivo con el flujo
   de migraciones del proyecto. El mismo archivo sirve para una base nueva y
   para actualizar el esquema anterior.
3. Verificá que existan las tablas `profiles`, `settings`, `customers`,
   `invoices`, `invoice_items`, `payments` y la vista `invoice_balances`.
   Publicá la versión del frontend junto con la migración para usar las nuevas
   operaciones de anulación.

## 4. Seguridad: desactivar el registro público y crear el primer usuario

> **Importante:** desactivá el registro público antes de crear el primer usuario
> y antes de publicar la aplicación. Toda cuenta con sesión puede leer los
> datos del negocio.

1. En Supabase ve a **Authentication → Providers → Email** y **desactiva**
   **Allow new users to sign up**.
2. Luego ve a **Authentication → Users** y pulsa **Add user**.
3. Ingresa correo y contraseña.
4. Marca la opción para confirmar el correo automáticamente (**Auto Confirm**).

En una base nueva, el **primer** usuario creado se convierte automáticamente
en administrador. Las siguientes cuentas nacen pendientes y tienen acceso de
lectura, al igual que el rol lector. Un administrador puede cambiar su rol en
**Ajustes**. Solo los administradores pueden registrar y modificar datos del
negocio. Creá las cuentas desde el panel de Supabase.

Si todas las cuentas existían antes de instalar el esquema y ninguna tiene rol
de administrador, usá una sesión de propietario en **SQL Editor** para
asignar el rol `admin` al perfil cuyo identificador hayas verificado en
**Authentication → Users**. Los perfiles faltantes se completan como
pendientes durante la migración.

## 5. Configurar las variables de entorno

1. En la raíz del proyecto copia `.env.example` como `.env`.
2. En Supabase ve a **Project Settings → API** y copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

   La **anon public key** es el JWT largo que empieza con `eyJ…`. **No** es la
   contraseña de la base de datos ni la `service_role` key.

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anonima-publica
```

3. Reinicia el servidor de desarrollo cada vez que cambies el archivo `.env`.

Si las variables faltan, la aplicación muestra una pantalla de configuración con
las instrucciones en lugar de fallar.

## 6. Ejecutar en local

```bash
npm run dev
```

Abre la dirección que muestra Vite (por defecto `http://localhost:5173`).

Comandos disponibles:

- `npm run dev`: servidor de desarrollo.
- `npm run typecheck`: verificación de TypeScript.
- `npm run build`: compilación de producción (genera `dist`).
- `npm run preview`: sirve la compilación de producción.

## 7. Desplegar en Netlify

### Opción A: desde un repositorio Git

1. Sube el proyecto a GitHub, GitLab o Bitbucket.
2. En Netlify elige **Add new site → Import an existing project** y selecciona el
   repositorio.
3. Netlify toma la configuración de `netlify.toml`:
   - Comando de compilación: `npm run build`
   - Directorio publicado: `dist`
4. En **Site configuration → Environment variables** agrega:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `NODE_VERSION` = `20`
5. Ejecuta el despliegue.

### Opción B: despliegue manual

1. Ejecuta `npm run build` en tu equipo.
2. Arrastra la carpeta `dist` a [app.netlify.com/drop](https://app.netlify.com/drop).

### Configurar Supabase para el dominio publicado

En Supabase ve a **Authentication → URL Configuration**:

- **Site URL**: la URL de tu sitio en Netlify (por ejemplo
  `https://tu-sitio.netlify.app`).
- **Redirect URLs**: agrega la misma URL de Netlify y, si usas desarrollo local,
  `http://localhost:5173`.

## 8. Instalar como PWA

- **Android (Chrome)**: abre el sitio y usa el menú → **Instalar aplicación** o
  **Agregar a pantalla principal**.
- **iOS (Safari)**: abre el sitio, pulsa **Compartir** → **Agregar a inicio**.

La aplicación funciona con caché para los archivos, pero los datos siempre se
leen y escriben en Supabase, por lo que requiere conexión.

## Estructura del proyecto

```text
control/
├─ assets/                    Imágenes originales de referencia
├─ public/
│  ├─ assets/                 Banner y logotipo usados por la app
│  └─ icons/                  Iconos PWA generados
├─ src/
│  ├─ components/             Componentes reutilizables de interfaz
│  ├─ context/                Autenticación, configuración y notificaciones
│  ├─ lib/
│  │  ├─ api.ts               Operaciones de datos con Supabase
│  │  ├─ excel/               Exportación a Excel (exceljs)
│  │  └─ pdf/                 Factura PDF (react-pdf)
│  ├─ pages/                  Pantallas de la aplicación
│  └─ types/database.ts       Tipos del esquema
├─ supabase/migrations/       Esquema versionado de la base de datos
├─ netlify.toml               Configuración de despliegue y SPA
└─ vite.config.ts             Configuración de Vite y PWA
```

## Solución de problemas

### No se encontró el esquema de Supabase

Verificá que se haya aplicado la migración del paso 3 y recargá la página.

### El inicio de sesión falla

- Verifica que el usuario exista en **Authentication → Users**.
- Confirma que el correo esté confirmado.
- Revisa que la contraseña sea correcta.
- Asegúrate de que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` correspondan al
  mismo proyecto.

### Pantalla en blanco

- Revisa que exista el archivo `.env` con las dos variables.
- Reinicia el servidor (`Ctrl + C` y luego `npm run dev`).
- Abre la consola del navegador para ver el error.
- Si el sitio ya estaba instalado como PWA, fuerza una recarga o desinstala y
  vuelve a abrir.

### No se descarga el PDF o el Excel

- Confirma que `public/assets/header-banner.png` exista.
- Permite las descargas en el navegador.
- En móviles, si no está disponible la hoja de compartir, la aplicación descarga
  el PDF automáticamente.

### Los cambios no se ven después de desplegar

El service worker de la PWA puede mantener archivos en caché. Recarga la página
con `Ctrl + F5` o cierra y vuelve a abrir la aplicación instalada. Los nuevos
despliegues se activan automáticamente al recargar.

### Moneda de facturación

Las facturas nuevas se registran en pesos colombianos (COP). La migración
conserva los importes de las facturas y abonos previos, y usa la configuración
de moneda de la base previa para presentar las facturas históricas.

## Pruebas de base de datos

Usá PostgreSQL 17 en una instancia local o descartable con un usuario que
pueda crear bases y roles. Los comandos prueban una instalación nueva y una
actualización desde el esquema original en dos bases vacías.

```bash
createdb control_test_fresh
psql -X -d control_test_fresh -f supabase/tests/control_hardening.sql

git show c78b4d8:supabase/schema.sql > control_test_legacy.sql
createdb control_test_upgrade
psql -X -d control_test_upgrade -v legacy_schema=control_test_legacy.sql -f supabase/tests/control_hardening.sql
```
