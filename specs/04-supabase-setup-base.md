# SPEC 04 — Setup base de Supabase (cliente + variables de entorno)

> **Status:** Implemented
> **Depends on:** 03-about-contact-resend (Implemented)
> **Date:** 2026-08-07
> **Objective:** Instalar y configurar el cliente de Supabase (`@supabase/supabase-js` + `@supabase/ssr`) en la app Next.js, usando el proyecto ya existente (`kjpvjfhuqrclpblkthpd`), con variables de entorno reales y una ruta de healthcheck que confirme la conexión — sin conectar todavía ninguna pantalla (Auth, catálogo o puntajes) a datos reales.

## Scope

**In:**

- Instalar las dependencias `@supabase/supabase-js` y `@supabase/ssr`.
- Crear `lib/supabase/client.ts` (cliente de navegador, `createBrowserClient`) y `lib/supabase/server.ts` (cliente de servidor, `createServerClient` con `cookies()` de `next/headers`), siguiendo el patrón oficial de Supabase para Next.js App Router.
- Agregar a `.env.template` los placeholders `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, y a `.env.local` sus valores reales del proyecto ya conectado (URL `https://kjpvjfhuqrclpblkthpd.supabase.co` y la publishable key moderna `sb_publishable_...`, obtenidas vía MCP).
- Crear `app/api/supabase-healthcheck/route.ts` (`GET`): instancia el cliente de servidor, hace un `fetch` real a `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health` con el header `apikey` y responde `{ ok: true }` o `{ ok: false, error }`.

**Out of scope (para otras specs):**

- Reemplazar `SessionProvider`/el mock de `auth.jsx` por Supabase Auth real.
- Migrar `GAMES`/`CATS`/`PLAYERS`/`ScoreRow` de `lib/data.ts` a tablas Postgres.
- Crear cualquier tabla en Supabase — al terminar esta spec el proyecto sigue con 0 tablas en `public`.
- `middleware.ts` de refresco de sesión — solo tiene sentido cuando exista Auth real.
- Inicializar la carpeta `supabase/` (CLI local, migraciones) — se hace en la primera spec que necesite crear una tabla.
- Tests automatizados.

## Data model

Esta spec no introduce datos de negocio nuevos. Introduce contratos de módulo:

```ts
// lib/supabase/client.ts
export function createClient(): SupabaseClient;

// lib/supabase/server.ts
export async function createClient(): Promise<SupabaseClient>;

// app/api/supabase-healthcheck/route.ts
export async function GET(): Promise<Response>; // { ok: true } | { ok: false, error: string }
```

## Implementation plan

1. Instalar `@supabase/supabase-js` y `@supabase/ssr` (`npm install`). Verificación: aparecen en `package.json`/`package-lock.json` y `npm run build` sigue funcionando sin cambios de código todavía.
2. Agregar a `.env.template` los placeholders `NEXT_PUBLIC_SUPABASE_URL=<SUPABASE_PROJECT_URL>` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<SUPABASE_PUBLISHABLE_KEY>`; agregar a `.env.local` los valores reales correspondientes. Verificación: ambos archivos tienen las variables nuevas, `.env.local` sigue ignorado por git.
3. Crear `lib/supabase/client.ts` con `createBrowserClient(url, key)` de `@supabase/ssr`, exportando `createClient()`. Verificación: el módulo compila sin errores de TypeScript.
4. Crear `lib/supabase/server.ts` con `createServerClient` de `@supabase/ssr`, leyendo/escribiendo cookies vía `cookies()` de `next/headers` (async, según la convención de Next 16). Verificación: el módulo compila sin errores de TypeScript.
5. Crear `app/api/supabase-healthcheck/route.ts` (`GET`) usando el cliente del paso 4, y haciendo un `fetch` real a `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health` (con el header `apikey`), devolviendo `{ ok: true }` en éxito o `{ ok: false, error }` en fallo (status 200 y 500 respectivamente). Verificación: `GET /api/supabase-healthcheck` responde `{ ok: true }` en local.
6. Prueba end-to-end manual: correr `npm run dev`, pedir `/api/supabase-healthcheck` y confirmar `ok: true`; recorrer Home, Biblioteca, Auth y Salón de la Fama para confirmar que no cambiaron. Verificación: se cumplen los criterios de aceptación.

## Acceptance criteria

- [x] `@supabase/supabase-js` y `@supabase/ssr` aparecen como dependencias en `package.json`.
- [x] `.env.template` contiene los placeholders `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, sin valores reales.
- [x] `.env.local` contiene los valores reales de esas dos variables, apuntando al proyecto `kjpvjfhuqrclpblkthpd`.
- [x] `lib/supabase/client.ts` y `lib/supabase/server.ts` existen y cada uno exporta una función `createClient()`.
- [x] `GET /api/supabase-healthcheck` responde 200 con `{ ok: true }` cuando las credenciales son válidas.
- [x] Si `NEXT_PUBLIC_SUPABASE_URL` se rompe temporalmente, `/api/supabase-healthcheck` responde `{ ok: false, error }` sin tirar abajo el resto de la app.
- [x] Ninguna pantalla existente (Home, Biblioteca, Detalle, Auth, Salón de la Fama, Acerca de) cambia de comportamiento tras este setup.
- [x] `npm run build` sigue compilando sin errores.
- [x] No se crea ninguna tabla nueva en Supabase (sigue en 0 tablas en el esquema `public`).

## Decisions

- **Sí:** acotar esta spec a "setup base" (paquetes, clientes, variables de entorno, healthcheck), sin tocar Auth ni tablas. **No:** resolverlo todo junto — Auth real y persistencia de puntajes son decisiones de datos/UX independientes que merecen su propia spec, siguiendo el mismo patrón incremental de 01→02→03.
- **Sí:** instalar `@supabase/ssr` además de `@supabase/supabase-js` desde ya. **No:** solo `supabase-js` — `@supabase/ssr` es el patrón oficial de Supabase para Next.js App Router (maneja cookies para Server Components/Actions) y evita reescribir el cliente cuando llegue la spec de Auth.
- **Sí:** separar `lib/supabase/client.ts` (browser) y `lib/supabase/server.ts` (server), la convención oficial. **No:** un único archivo — mezclar ambos clientes rompe el boundary server/client de Next y es la causa más común de bugs al usar Supabase con Server Components.
- **Sí:** usar la publishable key moderna (`sb_publishable_...`) en vez de la legacy anon key (JWT). **No:** la legacy anon key — sigue funcionando pero Supabase la marca como legacy y recomienda la publishable key para proyectos nuevos.
- **Sí:** verificar la conexión con una ruta temporal `/api/supabase-healthcheck`. **No:** una query a una tabla — hoy no existe ninguna tabla en el proyecto, así que la verificación debe depender solo de Auth/URL.
- **Sí:** implementar el healthcheck con un `fetch` real a `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`. **No:** `supabase.auth.getSession()` (la elección original de esta spec) — se probó durante la implementación (Paso 6) que, sin una cookie de sesión guardada, `getSession()` resuelve localmente sin red y nunca detecta una URL/key inválida, lo cual no cumple el criterio de aceptación de detectar una URL rota. Se confirmó con `curl` que el fetch directo a `/auth/v1/health` sí distingue una URL inválida (falla de DNS) de una válida (`200`).
- **Nota (fuera del plan de esta spec):** durante la implementación, el usuario renombró `.env.base` a `.env.template` (ajustando `.gitignore` en consecuencia) y quitó el placeholder `SUPABASE_DB_PASSWORD` de `.env.template`/`.env.local`, cambio hecho en paralelo y no parte del plan original. Esta spec nunca usó esa variable (el cliente `supabase-js`/`@supabase/ssr` no la necesita), así que su remoción no afecta ningún criterio de aceptación.
- **Sí:** obtener los valores reales de URL y publishable key vía las herramientas MCP (`get_project_url`, `get_publishable_keys`) durante la implementación. **No:** pedirle al usuario que los copie del dashboard — ya están disponibles vía el MCP ya conectado.

## Identified risks

- **Exposición de la publishable key:** es pública por diseño (viaja al navegador vía `NEXT_PUBLIC_*`), pero si alguna vez se confunde con la `service_role` key y esa se comitea por error, se filtraría acceso admin. Mitigación: esta spec solo usa variables `NEXT_PUBLIC_*` con la publishable/anon key; la `service_role` key no se toca ni se pide en este alcance.
- **RLS pendiente:** hoy no hay tablas, así que no hay nada que proteger; pero cuando specs futuras agreguen tablas, habrá que definir políticas RLS antes de exponerlas vía el cliente de navegador. Mitigación: queda documentado como precondición para la spec que cree la primera tabla.

## What is **not** in this spec

- Autenticación real (reemplazo de `SessionProvider`).
- Migración de `GAMES`/`PLAYERS`/`ScoreRow` a tablas Postgres.
- Cualquier tabla nueva en Supabase.
- CLI local de Supabase / carpeta `supabase/` con migraciones.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propia spec.
