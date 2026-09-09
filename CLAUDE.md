# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Estado del proyecto

**Arcade Vault** ya no es un scaffold sin modificar: es una app Next.js (App Router, TypeScript, Tailwind v4) con 9 specs implementadas (`specs/01` a `specs/09`, ver abajo). Rutas reales existentes:

- `/` → Home (hero, features, preview de juegos, actividad/top jugadores, precios, CTA)
- `/biblioteca` → catálogo de juegos (buscador, chips de categoría, grid) — leído de la tabla real `games` en Supabase (`lib/supabase/queries.ts#getGames`)
- `/juegos/[id]` → ficha de un juego — leído de `games` (`getGameById`), muestra "tu mejor marca" si hay sesión autenticada
- `/juegos/[id]/jugar` → reproductor del minijuego con motor real enchufable (ver "Motor de juegos" abajo), requiere autenticación (redirect a `/auth` si no hay sesión), guardado automático de puntaje bajo el nombre del jugador autenticado (`lib/actions/save-score.ts`)
- `/auth` → login/registro real con Supabase Auth (email/password con verificación obligatoria), formularios de "Iniciar sesión" y "Registrarse" con toggle, validación de contraseña (mínimo 8 caracteres, mayúscula, número, símbolo)
- `/salon-de-la-fama` → leaderboard global y por juego — datos reales desde las tablas `players`/`scores` (`getGlobalLeaderboard`, `getGameLeaderboard`, `getBestScoreForGame`, `getPlayerBestForGame`), muestra "tu mejor marca" si hay sesión autenticada
- `/acerca-de` → misión + formulario de contacto (envía correo real vía Resend, `app/acerca-de/actions.ts`)
- `/api/supabase-healthcheck` → ruta de diagnóstico que confirma la conexión al proyecto de Supabase

### Motor de juegos

`lib/games/` define el contrato enchufable de motor real que usa el reproductor (`app/juegos/[id]/jugar`):

- `lib/games/types.ts` → `GameEngineFactory` (firma `(canvas, callbacks) => GameEngineHandle`), `GameEngineCallbacks` (`onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`) y `GameEngineHandle` (`pause`/`resume`/`restart`/`destroy`).
- `lib/games/registry.ts` → mapa `GAME_ENGINES` de `id` de catálogo → factory. Hoy: `asteroides` (`lib/games/asteroids/engine.ts`, spec 05) y `tetris` (`lib/games/tetris/engine.ts`, spec 07). Un `id` sin motor registrado no tiene minijuego jugable todavía.
- Cada motor nuevo se agrega con la skill `/port-game` (ver abajo), que solo genera la spec — la implementación real sigue pasando por `/spec-impl`.

`references/templates/` contiene el prototipo de referencia de la UI (HTML/JSX standalone, sin Next.js — usa `React`/`ReactDOM` globales vía CDN, ruteo por `location.hash` y `localStorage`). **No es código a importar**: es la referencia visual/de interacción a portar al App Router real (Server/Client Components, rutas de archivos, etc.). Antes de construir o tocar una pantalla, revisa el archivo `.jsx` equivalente para la estructura y el copy (en español):

- `app.jsx` → shell de la app y ruteo (`biblioteca`, `detalle`, `player`, `auth`, `salon`)
- `nav.jsx` → navegación
- `biblioteca.jsx` → listado/catálogo de juegos
- `detalle.jsx` → ficha de un juego
- `reproductor.jsx` → pantalla de juego
- `auth.jsx` → login/registro
- `salon.jsx` → salón de la fama (leaderboard)
- `data.jsx` → datos mock (`GAMES`, `CATS`, `PLAYERS`, generador de scores)
- `styles.css` → estilos de referencia (tema neón/arcade)
- `home-about/home.jsx`, `home-about/about.jsx`, `home-about/styles.css` → referencia del Home y de "Acerca de" (specs 02 y 03)

### Pendiente (no implementado todavía)

- **Motores de juego:** solo `asteroides` y `tetris` tienen motor real (`lib/games/registry.ts`). El resto de las filas de `games` en Supabase todavía no tiene minijuego jugable — portarlos es trabajo de futuras specs vía `/port-game`.
- **Recuperación de contraseña:** no hay flujo de "Olvidé mi contraseña" todavía — se dejó para una spec futura.
- **Pantalla de perfil:** no existe ruta `/perfil` para editar nombre de jugador, email, o ver historial — se dejó para una spec futura.

### Supabase

El proyecto ya está conectado (MCP `supabase` en `.mcp.json`, project ref `kjpvjfhuqrclpblkthpd`). El cliente vive en `lib/supabase/` (`client.ts` para navegador, `server.ts` para Server Components/Actions vía `@supabase/ssr`, `queries.ts` con las lecturas del catálogo/leaderboards). Variables necesarias: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ver sección de entorno abajo).

**Autenticación (spec 08):** usa Supabase Auth con método email/password. `components/session-provider.tsx` maneja la sesión real vía `supabase.auth.getSession()` y `onAuthStateChange()` (ya no usa `localStorage['av_user']` ni cookie mock). Registro requiere email, contraseña (mínimo 8 caracteres + mayúscula + número + símbolo, validado client-side y server-side), y nombre de jugador único. Verificación de email obligatoria antes de permitir login. Server Actions de auth en `lib/actions/auth.ts` (`signUpAction`, `signInAction`, `signOutAction`). `middleware.ts` protege `/juegos/[id]/jugar` para requerir sesión autenticada. Usuarios mock creados para testing/demos: `<nombre_lowercase>@mock.com` (ej. `neonfox@mock.com`) con contraseña `Test-001!`.

**Tablas reales en `public` (specs 06, 08):**

- `games` — catálogo de juegos (reemplaza el mock `GAMES` que existía en `lib/data.ts`).
- `players` — jugadores con `name` único (1-12 caracteres) y `user_id uuid references auth.users(id) unique` (relación 1:1 con usuarios autenticados). Política RLS: `insert` solo si `auth.uid() = user_id` (verificado).
- `scores` — puntajes con `game_id`, `player_id`, `score`, `created_at`. Política RLS: `insert` solo si el `player_id` pertenece a un `player` cuyo `user_id = auth.uid()` (verificado). Políticas de `select` siguen siendo públicas.

`lib/data.ts` hoy solo conserva el tipo `Game` y datos que siguen siendo mock a propósito (`RECENT_ACTIVITY` del Home). El alta de puntajes pasa por la Server Action `lib/actions/save-score.ts#saveScoreAction` (ya NO recibe `name` — obtiene el `user_id` de la sesión del servidor, busca el `player_id` en `players` por `user_id`, inserta en `scores`).

## Agentes

- `game-planner` (`.claude/agents/game-planner.md`) — subagente de invocación solo manual (nunca se auto-dispara) que decide qué juego conviene portar/agregar después a Arcade Vault. Pondera categorías cubiertas vs. faltantes, complejidad estimada del motor y assets disponibles, cruzando `references/started-games/`, `lib/games/registry.ts` y el catálogo documentado en `specs/06-leaderboards-supabase.md` (no tiene acceso a Supabase en vivo). No escribe specs ni código — solo recomienda; el alta real sigue pasando por `/port-game`. Mantiene su propia memoria de sugerencias previas en `references/game-suggestion-todo.md` (checklist versionado: `Pendientes` / `Descartados / en curso` / `Portados`), para no repetir recomendaciones sin nueva justificación.

- `game-jam` (`.claude/agents/game-jam.md`) — generador de specs en batch para múltiples juegos. A partir de un criterio de selección (prioridad, categoría, lista específica) desde `references/game-suggestion-todo.md`, genera 2-6 specs por juego en `specs/game-jam/[game-id]/` (01-mvp + 02+ features), todas en estado `Draft`. No escribe código ni toca Supabase — solo genera archivos `.md` de specs basándose en el formato de las specs 05 y 07. Invocación manual (ej: "game-jam alta prioridad", "game-jam VERSUS", "game-jam bloque-buster + serpentina"). Optimizado para preparar specs de varios juegos a la vez; `/port-game` sigue siendo la opción para un solo juego con flujo interactivo.

## Skills

- Usa siempre `/frontend-design` para diseñar el interfaz de usuario.
- Usa `/port-game <carpeta-en-references/started-games-o-nombre>` para dar de alta un juego nuevo (motor real + leaderboard real en Supabase). Solo genera una spec en `Draft` en `specs/` — nunca escribe código ni toca Supabase. Ver `.claude/skills/port-game/SKILL.md` y `.claude/skills/port-game/game-engine-contract.md` (contrato técnico del motor, casos especiales, checklist de alta en Supabase).

## ⚠️ Esta NO es la versión de Next.js que conoces

El proyecto usa **Next.js 16.2.12** (`package.json`), una versión con cambios de ruptura respecto a lo que conoces por entrenamiento. **Antes de escribir código que use una API de Next.js, consulta la doc empaquetada en `node_modules/next/dist/docs/`** (organizada en `01-app/`, `02-pages/`, `03-architecture/`, `04-community/`) en vez de asumir el comportamiento de versiones anteriores. Presta atención a los avisos de deprecación.

## Flujo de trabajo: Spec Driven Design

Este repo sigue un flujo basado en specs (ver README.md, skills instaladas desde `Klerith/fernando-skills`). El trabajo de features no triviales pasa por dos comandos, no se escribe código directamente sin spec:

1. **`/spec <descripción>`** — diseña la spec de forma guiada (aclara alcance, datos, plan de implementación, criterios de aceptación) y la guarda en `specs/NN-slug.md` con estado `Draft`. No escribe código.
2. **`/spec-impl <NN-slug>`** — solo avanza si el estado de la spec es `Approved` (o equivalente). Crea/cambia a la rama `spec-NN-slug` (controlado por `AutoCreateBranch` en `specs/.spec-config.yml`, default `true`) e implementa el plan paso a paso, pausando para revisión de diff entre pasos.

`specs/` ya existe con 9 specs, todas `Implemented`:

- `01-mvp-visual-arcade-vault.md` — MVP visual (Biblioteca, Detalle, Reproductor, Auth mock, Salón de la Fama).
- `02-new-home-page.md` — Home en `/` y reubicación de Biblioteca a `/biblioteca`.
- `03-about-contact-resend.md` — página "Acerca de" con formulario de contacto real (Resend).
- `04-supabase-setup-base.md` — cliente de Supabase (`@supabase/supabase-js` + `@supabase/ssr`) y ruta de healthcheck, sin Auth ni tablas todavía.
- `05-asteroids-motor-real.md` — motor real de Asteroids (`lib/games/asteroids/engine.ts`) enchufado al reproductor vía el contrato de `lib/games/types.ts`.
- `06-leaderboards-supabase.md` — migra catálogo (`games`) y leaderboards (`players`/`scores`) de mock a tablas reales de Supabase; agrega `saveScoreAction`.
- `07-tetris-motor-real.md` — motor real de Tetris (`lib/games/tetris/engine.ts`), segundo motor registrado en `lib/games/registry.ts`.
- `08-supabase-auth-email-password.md` — autenticación real con Supabase Auth (email/password con verificación obligatoria), reemplaza el mock de sesión por `supabase.auth`, agrega columna `user_id` a `players`, protege `/juegos/[id]/jugar` con middleware, guardado automático de puntajes bajo el jugador autenticado, políticas RLS verificadas para `insert` en `players`/`scores`.
- `09-security-hardening.md` — hardening de seguridad: eleva mínimo de contraseña de 6 a 8 caracteres (validación client-side y server-side), agrega headers HTTP de seguridad (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy`) en `next.config.ts`, resuelve warning de `rls_auto_enable()` en Supabase.

## Variables de entorno

Convención del repo: `.env.template` (versionado, solo placeholders) documenta qué variables existen; `.env.local` (no versionado, real) tiene los valores reales para desarrollo. Copiá `.env.template` a `.env.local` y completá:

- `RESEND_API_KEY`, `CONTACT_TO_EMAIL` — envío de correo del formulario de contacto (spec 03).
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — cliente de Supabase (spec 04). Se obtienen del proyecto ya conectado vía el MCP de Supabase (`get_project_url`, `get_publishable_keys`) en vez de copiarlas del dashboard.
- `SUPABASE_SERVICE_ROLE_KEY` — ⚠️ **ALTAMENTE SENSIBLE**: acceso admin total a Supabase (spec 08). Solo necesaria para ejecutar el script de seed de usuarios mock (`scripts/seed-mock-users.ts`) una vez después de la migración SQL de la spec 08. Se puede borrar del `.env.local` después de ejecutarlo. **NUNCA** comitearla al repo ni compartirla. Se obtiene vía MCP de Supabase o desde el dashboard (Settings → API → service_role key).
