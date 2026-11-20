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

## 3. Ejecutar el esquema

1. En el proyecto de Supabase abre **SQL Editor**.
2. Crea una consulta nueva, copia el contenido completo de
   `supabase/schema.sql` y ejecútalo una sola vez.
3. Verifica en **Table Editor** que existan las tablas `settings`, `customers`,
   `invoices`, `invoice_items`, `payments` y la vista `invoice_balances`.

El esquema crea la secuencia de numeración de facturas, los disparadores que
recalculan totales, la vista con pagos/saldo/estado y las políticas RLS.

## 4. Crear el primer usuario

La aplicación no tiene registro público. El primer usuario se crea desde
Supabase:

1. Ve a **Authentication → Users**.
2. Pulsa **Add user**.
3. Ingresa correo y contraseña.
4. Marca la opción para confirmar el correo automáticamente (Auto Confirm).

Con ese usuario podrás iniciar sesión en la aplicación. Los usuarios siguientes
se crean de la misma forma.

## 5. Configurar las variables de entorno

1. En la raíz del proyecto copia `.env.example` como `.env`.
2. En Supabase ve a **Settings → API** y copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

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
├─ supabase/schema.sql        Esquema completo de base de datos
├─ netlify.toml               Configuración de despliegue y SPA
└─ vite.config.ts             Configuración de Vite y PWA
```

## Solución de problemas

### "No se encontró el esquema. Ejecuta supabase/schema.sql en Supabase."

El proyecto no tiene las tablas o la vista. Ejecuta el archivo
`supabase/schema.sql` completo en el SQL Editor de Supabase y recarga la página.

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

### Necesito cambiar la moneda

Ve a **Ajustes → Datos del negocio** y actualiza el código y el símbolo de la
moneda. El formato se aplica a toda la aplicación, al PDF y al Excel.
