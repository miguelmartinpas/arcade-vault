# SPEC 08 — Autenticación real con Supabase Auth (email/password)

> **Status:** Implemented  
> **Depends on:** 04-supabase-setup-base (Implemented), 06-leaderboards-supabase (Implemented)  
> **Date:** 2026-08-12  
> **Implemented:** 2026-09-07  
> **Objective:** Reemplazar la sesión mock (`localStorage` + cookie) por autenticación real usando Supabase Auth (email/password con verificación de email obligatoria), vincular usuarios autenticados a la tabla `players` mediante una columna `user_id`, proteger la ruta `/juegos/[id]/jugar` para requerir login, y guardar puntajes automáticamente bajo el nombre de jugador del usuario autenticado.

## Scope

**In:**

- Implementar Supabase Auth con método email/password: registro, login, logout, y verificación de email obligatoria (el usuario debe verificar su email antes de poder iniciar sesión).
- Reemplazar completamente el componente `/auth` actual (mock) por uno funcional con dos formularios: "Iniciar sesión" y "Registrarse", con toggle entre ambos.
- Eliminar toda la lógica de sesión mock: `components/session-provider.tsx` pasa a usar `supabase.auth.getSession()`/`onAuthStateChange()` en vez de `localStorage['av_user']` + cookie; se eliminan `USER_KEY`, `setUserCookie`, `clearUserCookie`.
- Agregar columna `user_id uuid references auth.users(id)` a la tabla `players`, con constraint unique para garantizar relación 1:1 (un usuario autenticado = un nombre de jugador).
- Formulario de registro pide: email, contraseña (validación client-side: mínimo 6 caracteres + mayúscula + número + símbolo), y "Nombre de jugador" (1-12 caracteres, validación de unicidad contra `players.name` antes de crear el usuario).
- Validación de nombre único: si el nombre ya existe en `players`, rechazar el registro con error "Nombre ya en uso, elige otro" antes de llamar a `supabase.auth.signUp()`.
- Al registrarse exitosamente, Supabase envía email de verificación; mostrar mensaje "Revisa tu email para verificar tu cuenta" y no permitir login hasta que el email esté verificado.
- Proteger la ruta `/juegos/[id]/jugar`: si no hay sesión autenticada, redirect a `/auth` con query param `?redirect=/juegos/[id]/jugar` para volver después del login.
- Después de login/registro exitoso (y email verificado), redirigir a la página donde estaban antes (leer query param `?redirect=...`; si no existe, redirigir a `/biblioteca`).
- Botón de logout en el Nav: cuando hay sesión, reemplazar "ENTRAR" por "SALIR"; al hacer clic llama `supabase.auth.signOut()` y limpia la sesión.
- Actualizar `saveScoreAction` (`lib/actions/save-score.ts`): en vez de recibir `name` por parámetro, obtiene el `user_id` de la sesión del servidor (`createClient` de `@supabase/ssr`), busca el `player_id` correspondiente en `players` por `user_id`, y guarda el puntaje con ese `player_id` (sin pedir nombre al usuario).
- Actualizar `components/game-player.tsx`: el modal de fin de juego ya no pide nombre (el input desaparece); solo muestra el puntaje y botón "GUARDAR PUNTAJE" que invoca `saveScoreAction` sin parámetro de nombre.
- Permitir jugar sin autenticación hasta terminar la partida: al llegar al modal de fin, si no hay sesión, mostrar mensaje "Regístrate para guardar tu puntaje" con botón que redirige a `/auth?redirect=/juegos/[id]/jugar`.
- Mantener las filas existentes de `players` y `scores` (seed ficticio) al aplicar la migración de `user_id`.
- Crear usuarios en Supabase Auth para cada jugador ficticio del seed usando la Admin API (`supabase.auth.admin.createUser()`): email con formato `<nombre_lowercase>@mock.com` (ej. `neonfox@mock.com`), contraseña `Test-00` para todos (cumple validación: 6+ caracteres, mayúscula, número, símbolo), y `email_confirm: true` para que queden ya verificados y puedan loguearse directamente; vincular el `user_id` generado con la fila correspondiente en `players`.
- Actualizar políticas RLS de `players` y `scores`: `insert` en `players` solo si `auth.uid() = user_id` (verificado), `insert` en `scores` solo si el `player_id` insertado pertenece a un `player` cuyo `user_id = auth.uid()`.
- Mostrar errores de autenticación (email ya registrado, contraseña incorrecta, email inválido, email no verificado) en un bloque de error arriba del formulario correspondiente.
- Actualizar la lógica de "tu mejor marca" en `/juegos/[id]` (Detalle) y `/salon-de-la-fama`: ahora lee el `user_id` de la sesión real en vez de `av_user` de cookie/localStorage.

**Out of scope (para otras specs):**

- OAuth (Google/GitHub/etc.) o magic link — solo email/password en esta spec.
- Recuperación de contraseña ("Olvidé mi contraseña") — se deja para una spec futura.
- Pantalla de perfil (`/perfil`) para editar "Nombre de jugador", email, o ver historial — se deja para una spec futura.
- Protección de otras rutas más allá de `/juegos/[id]/jugar` (Biblioteca, Detalle, Salón de la Fama siguen siendo públicas).
- Migración o preservación de jugadores legacy (filas con `user_id = null`) — se limpia todo el seed, no hay legacy.
- Eliminar o deshabilitar usuarios mock después del deploy — se dejan activos para demos/testing.
- Límite de intentos de login, rate limiting, o anti-bot en formularios de auth.
- Cambio de email o eliminación de cuenta.
- Tests automatizados.

## Data model

### Cambios en Supabase (proyecto `kjpvjfhuqrclpblkthpd`, esquema `public`)

**Migración de la tabla `players`:**

```sql
-- Agregar columna user_id con constraint unique (relación 1:1)
alter table public.players
  add column user_id uuid references auth.users(id) unique;

-- Por ahora queda nullable; se llena con los usuarios mock en el paso de seed
```

**Actualización de políticas RLS:**

```sql
-- Reemplazar política de insert público en players por una verificada
drop policy if exists "players_insert_public" on public.players;

create policy "players_insert_authenticated"
  on public.players
  for insert
  with check (auth.uid() = user_id);

-- Reemplazar política de insert público en scores por una verificada
drop policy if exists "scores_insert_public" on public.scores;

create policy "scores_insert_authenticated"
  on public.scores
  for insert
  with check (
    exists (
      select 1 from public.players
      where players.id = scores.player_id
        and players.user_id = auth.uid()
    )
  );

-- Las políticas de select siguen siendo públicas (sin cambios)
```

### Contratos de módulo

**`components/session-provider.tsx` (refactorizado completamente):**

```ts
import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export interface SessionUser {
    id: string; // auth.users.id
    email: string;
    playerName: string; // obtenido de players.name via user_id
}

interface SessionContextValue {
    user: SessionUser | null;
    loading: boolean;
    logout: () => Promise<void>;
}

// Ya no existe login() aquí — se maneja directamente en /auth con supabase.auth.signInWithPassword()
// Ya no existe saveScore() aquí — se llama directamente a saveScoreAction sin parámetro name
```

**`lib/actions/auth.ts` (nuevo archivo, Server Actions para auth):**

```ts
'use server';

import { createClient } from '@/lib/supabase/server';

export async function signUpAction(input: {
    email: string;
    password: string;
    playerName: string;
}): Promise<{ ok: true } | { ok: false; error: string }>;

export async function signInAction(input: {
    email: string;
    password: string;
}): Promise<{ ok: true } | { ok: false; error: string }>;

export async function signOutAction(): Promise<void>;

// signUpAction valida:
// 1. Que playerName sea 1-12 caracteres
// 2. Que playerName no exista ya en players.name (unique)
// 3. Crea usuario con supabase.auth.signUp() (Supabase envía email de verificación)
// 4. Si signUp exitoso, inserta fila en players con user_id + name
```

**`lib/actions/save-score.ts` (actualizado):**

```ts
'use server';

export async function saveScoreAction(input: {
    gameId: string;
    score: number;
    // Ya NO recibe 'name' — lo obtiene de la sesión
}): Promise<{ ok: true } | { ok: false; error: string }>;

// Flujo interno:
// 1. Obtiene user_id de la sesión del servidor (createClient de @supabase/ssr)
// 2. Si no hay sesión → error "Debes iniciar sesión"
// 3. Busca player_id en players donde user_id = auth.uid()
// 4. Si no existe player → error "Perfil de jugador no encontrado"
// 5. Valida gameId/score (mismo rango que antes)
// 6. Insert en scores con player_id obtenido
```

**`app/auth/page.tsx` (reemplazo completo del mock actual):**

Formularios:

- Toggle entre "Iniciar sesión" y "Registrarse"
- **Registro:** campos `email`, `password`, `confirmPassword`, `playerName`; validación client-side de contraseña (mín 6 chars + mayúscula + número + símbolo); al submit llama `signUpAction` y muestra mensaje "Revisa tu email para verificar tu cuenta"
- **Login:** campos `email`, `password`; al submit llama `signInAction`; si el email no está verificado, muestra error "Debes verificar tu email antes de iniciar sesión"
- Bloque de error arriba del formulario activo para mostrar errores de autenticación

**Validación de contraseña (client-side):**

```ts
function validatePassword(password: string): string | null {
    if (password.length < 6) return 'Mínimo 6 caracteres';
    if (!/[A-Z]/.test(password)) return 'Debe contener una mayúscula';
    if (!/[0-9]/.test(password)) return 'Debe contener un número';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Debe contener un símbolo';
    return null; // válida
}
```

**Creación de usuarios mock (script de migración o función PostgreSQL):**

Dado que no se puede insertar directamente en `auth.users` desde SQL normal, se necesita un script TypeScript separado que use la Admin API:

```ts
// scripts/seed-mock-users.ts (ejecutar después de la migración SQL)
import { createClient } from '@supabase/supabase-js';

const MOCK_PLAYERS = ['NEONFOX', 'CYBERGHOST', 'PIXELKID' /* ... resto del seed actual */];

async function seedMockUsers() {
    const supabase = createClient(url, serviceRoleKey); // Admin API

    for (const name of MOCK_PLAYERS) {
        const email = `${name.toLowerCase()}@mock.com`;
        const {
            data: { user },
            error,
        } = await supabase.auth.admin.createUser({
            email,
            password: 'Test-00',
            email_confirm: true, // ya verificado
        });

        if (user) {
            // Actualizar players.user_id donde name = name
            await supabase.from('players').update({ user_id: user.id }).eq('name', name);
        }
    }
}
```

### Convenciones

- La sesión persiste en `localStorage` (comportamiento default de Supabase Auth).
- `SessionProvider` usa `supabase.auth.onAuthStateChange()` para sincronizar el estado de sesión en tiempo real.
- El `playerName` se carga una vez al iniciar sesión (join de `auth.users` con `players` por `user_id`) y se cachea en el estado del contexto.
- Redirect después de login/registro: lee query param `?redirect=...`; si no existe, va a `/biblioteca`.
- Middleware en `middleware.ts` (nuevo archivo) protege `/juegos/[id]/jugar`: si no hay sesión, redirect a `/auth?redirect=...`.

## Implementation plan

1. Migración SQL (`mcp__supabase__apply_migration`): agregar columna `user_id uuid references auth.users(id) unique` a `players`, actualizar políticas RLS de `players` y `scores` (drop de políticas públicas, create de políticas autenticadas que verifican `auth.uid()`). Verificación: `list_tables` muestra la columna nueva; `execute_sql` con `SELECT` de las políticas confirma que las nuevas existen y las viejas no.

2. Script de seed de usuarios mock (`scripts/seed-mock-users.ts`): leer los nombres actuales de `players` (antes de que tengan `user_id`), crear un usuario en Supabase Auth para cada uno usando Admin API (`supabase.auth.admin.createUser()` con email `<nombre_lowercase>@mock.com`, password `Test-00`, `email_confirm: true`), y actualizar `players.user_id` con el `user.id` generado. Verificación: `execute_sql SELECT name, user_id FROM players` muestra que todas las filas tienen `user_id` poblado; intentar login manual con `neonfox@mock.com` / `Test-00` en Supabase Auth UI funciona.

3. Crear `lib/actions/auth.ts` (`"use server"`) con tres Server Actions: `signUpAction` (valida playerName único, crea usuario con `supabase.auth.signUp()`, inserta en `players`), `signInAction` (llama `supabase.auth.signInWithPassword()`, verifica que email esté confirmado), `signOutAction` (llama `supabase.auth.signOut()`). Verificación: el módulo compila; todavía no está conectado a ninguna UI.

4. Refactorizar `components/session-provider.tsx`: eliminar toda la lógica de `localStorage['av_user']` + cookie, reemplazar por `supabase.auth.getSession()` + `onAuthStateChange()`, cargar `playerName` haciendo join de `auth.users.id` con `players.user_id`, exponer `{ user: SessionUser | null, loading: boolean, logout: () => Promise<void> }` (sin `login` ni `saveScore`). Verificación: `npm run build` compila; el Nav todavía muestra "ENTRAR" (no hay sesión real todavía).

5. Crear `middleware.ts` en la raíz del proyecto para proteger `/juegos/[id]/jugar`: si no hay sesión (`supabase.auth.getUser()` falla), redirect a `/auth?redirect=/juegos/[id]/jugar`. Verificación: navegar manualmente a `/juegos/asteroides/jugar` sin sesión redirige a `/auth`; con sesión mock de usuarios creados en paso 2 (login manual en UI de Supabase) deja pasar.

6. Reemplazar `app/auth/page.tsx` completamente: dos formularios con toggle ("Iniciar sesión" / "Registrarse"), validación client-side de contraseña (función `validatePassword`), bloque de error arriba del formulario activo, submit llama a `signUpAction`/`signInAction` según corresponda, maneja redirect con query param `?redirect=...` (default `/biblioteca`). Verificación: la ruta `/auth` muestra los formularios nuevos; todavía no funciona el submit (falta conectar las Actions).

7. Conectar los formularios de `/auth` a las Server Actions: al hacer submit de registro llama `signUpAction` y muestra mensaje "Revisa tu email para verificar tu cuenta" si ok, o error si falla (ej. nombre duplicado); submit de login llama `signInAction` y redirige si ok, o muestra error si email no verificado / credenciales incorrectas. Verificación manual: registrar un usuario nuevo con email real, verificar el email, hacer login, confirmar que redirige correctamente y que `useSession()` devuelve el usuario autenticado.

8. Actualizar `lib/actions/save-score.ts`: eliminar parámetro `name` de `saveScoreAction`, obtener `user_id` de la sesión del servidor (`createClient` de `@supabase/ssr`), buscar `player_id` en `players` por `user_id`, insertar en `scores` con ese `player_id`. Verificación: el módulo compila; todavía no se puede probar end-to-end hasta el paso siguiente.

9. Actualizar `components/game-player.tsx`: eliminar el input de nombre del modal de fin de juego, el botón "GUARDAR PUNTAJE" llama `saveScoreAction({ gameId, score })` sin parámetro de nombre; si no hay sesión (`!user`), mostrar mensaje "Regístrate para guardar tu puntaje" con botón que redirige a `/auth?redirect=/juegos/[id]/jugar`. Verificación manual: terminar una partida logueado → guarda el puntaje sin pedir nombre; terminar sin sesión → muestra el mensaje de registro.

10. Actualizar el Nav (`components/nav.tsx` o donde esté el botón "ENTRAR"): cuando `user` existe (de `useSession()`), mostrar "SALIR" en vez de "ENTRAR"; al hacer clic llama `logout()` del contexto (que internamente llama `signOutAction`). Verificación: con sesión activa el Nav muestra "SALIR"; al hacer clic cierra sesión y vuelve a mostrar "ENTRAR".

11. Actualizar las páginas que leen "tu mejor marca" (`app/juegos/[id]/page.tsx`, `app/salon-de-la-fama/page.tsx`): en vez de leer `av_user` de cookie, obtener el `user_id` de la sesión real del servidor (`createClient` de `@supabase/ssr`), y pasar ese `user_id` a `getPlayerBestForGame` (que internamente hace join de `players` por `user_id` en vez de buscar por `name`). Actualizar `lib/supabase/queries.ts#getPlayerBestForGame` para aceptar `userId: string` en vez de `playerName: string`. Verificación: con sesión activa, el Detalle y el Salón muestran "tu mejor marca" correctamente; sin sesión, no aparece la fila.

12. Recorrido end-to-end manual (y/o Playwright): (a) sin sesión → intentar jugar → redirect a `/auth`, (b) registrarse con email/password/nombre único → mensaje de verificación, (c) verificar email (click en link del email real o simular con Admin UI), (d) login → redirect a `/biblioteca` o a la partida pendiente, (e) jugar y terminar → guardar puntaje sin pedir nombre → confirmar con `execute_sql` que la fila aparece en `scores` vinculada al `player_id` correcto, (f) ver el puntaje en Detalle y Salón bajo "tu mejor marca", (g) logout → Nav vuelve a "ENTRAR". Verificación: se cumplen todos los criterios de aceptación; `get_advisors` no reporta hallazgos nuevos de seguridad.

## Acceptance criteria

- [ ] La tabla `players` tiene la columna `user_id uuid references auth.users(id) unique`.
- [ ] Todas las filas existentes en `players` (jugadores del seed ficticio) tienen `user_id` poblado, vinculadas a usuarios creados en Supabase Auth con email `<nombre_lowercase>@mock.com`, contraseña `Test-00`, y email ya verificado (`email_confirm: true`).
- [ ] Las políticas RLS de `players` solo permiten `insert` si `auth.uid() = user_id` (no existe política de insert público).
- [ ] Las políticas RLS de `scores` solo permiten `insert` si el `player_id` insertado pertenece a un `player` cuyo `user_id = auth.uid()` (no existe política de insert público).
- [ ] La ruta `/auth` muestra dos formularios con toggle: "Iniciar sesión" (email + password) y "Registrarse" (email + password + confirmPassword + playerName).
- [ ] El formulario de registro valida client-side que la contraseña tenga mínimo 6 caracteres, una mayúscula, un número y un símbolo; muestra error inline si no cumple.
- [ ] Al registrarse con un nombre de jugador que ya existe en `players`, muestra error "Nombre ya en uso, elige otro" sin crear el usuario en Auth.
- [ ] Al registrarse exitosamente, muestra mensaje "Revisa tu email para verificar tu cuenta" y Supabase envía el email de verificación.
- [ ] Intentar hacer login con un email no verificado muestra error "Debes verificar tu email antes de iniciar sesión" y no deja pasar.
- [ ] Después de verificar el email y hacer login exitoso, redirige a la URL en `?redirect=...` si existe, o a `/biblioteca` si no existe.
- [ ] Navegar a `/juegos/[id]/jugar` sin sesión autenticada redirige a `/auth?redirect=/juegos/[id]/jugar`.
- [ ] Con sesión autenticada, `/juegos/[id]/jugar` carga el reproductor normalmente sin pedir login.
- [ ] El modal de fin de juego NO muestra input de nombre; solo muestra el puntaje y botón "GUARDAR PUNTAJE".
- [ ] Al guardar el puntaje estando logueado, inserta una fila en `scores` vinculada al `player_id` del usuario autenticado, sin pedir nombre.
- [ ] Al terminar una partida SIN sesión, el modal muestra mensaje "Regístrate para guardar tu puntaje" con botón que redirige a `/auth?redirect=/juegos/[id]/jugar`.
- [ ] El Nav muestra "ENTRAR" cuando no hay sesión; muestra "SALIR" cuando hay sesión autenticada.
- [ ] Al hacer clic en "SALIR", cierra la sesión (llama `supabase.auth.signOut()`) y vuelve a mostrar "ENTRAR".
- [ ] La página de Detalle (`/juegos/[id]`) muestra "tu mejor marca" solo si hay sesión autenticada y el usuario jugó ese juego, leyendo el `user_id` de la sesión real (no de `localStorage` ni cookie `av_user`).
- [ ] El Salón de la Fama (`/salon-de-la-fama`) muestra "tu mejor marca" en cada pestaña de juego solo si hay sesión autenticada, leyendo el `user_id` de la sesión real.
- [ ] `components/session-provider.tsx` ya no lee ni escribe `localStorage['av_user']` ni cookie `av_user`; usa únicamente `supabase.auth.getSession()` y `onAuthStateChange()`.
- [ ] `lib/actions/save-score.ts` NO recibe parámetro `name`; obtiene el `user_id` de la sesión del servidor y busca el `player_id` correspondiente en `players`.
- [ ] Hacer login con uno de los usuarios mock (ej. `neonfox@mock.com` / `Test-00`) funciona y permite jugar/guardar puntajes bajo ese nombre.
- [ ] Los puntajes históricos del seed (tabla `scores`) siguen apareciendo en los leaderboards vinculados a los nombres correctos de `players` (no se perdieron al migrar).
- [ ] Errores de autenticación (email ya registrado, contraseña incorrecta, email inválido) se muestran en un bloque de error arriba del formulario correspondiente.
- [ ] `npm run build` y `npm run lint` pasan sin errores nuevos.
- [ ] `get_advisors` (Supabase) no reporta hallazgos de seguridad nuevos más allá de los riesgos documentados en esta spec.

## Decisions

- **Sí:** Supabase Auth en vez de un sistema de autenticación propio. **No:** implementar auth desde cero — Supabase Auth ya está disponible desde la spec 04, maneja tokens/refresh/seguridad automáticamente, y permite agregar OAuth en el futuro sin refactorizar.

- **Sí:** solo email/password en esta spec. **No:** OAuth (Google/GitHub), magic link, o SMS — son métodos ortogonales que pueden agregarse después sin tocar la arquitectura base; email/password cubre el caso de uso principal.

- **Sí:** verificación de email obligatoria antes de permitir login. **No:** permitir login sin verificar — aunque frena la experiencia arcade por ~30 segundos, evita registro con emails falsos y es el comportamiento default/recomendado de Supabase Auth.

- **Sí:** relación 1:1 usuario autenticado ↔ nombre de jugador (`user_id unique` en `players`). **No:** permitir que un usuario tenga múltiples nombres — simplifica el modelo, evita monopolización del top 10, y hace que "tu mejor marca" sea inequívoca.

- **Sí:** rechazar registro si el nombre de jugador ya existe (`players.name` sigue siendo `unique`). **No:** permitir nombres duplicados distinguidos por `user_id` — los leaderboards mostrarían el mismo nombre repetido, rompiendo la experiencia visual/competitiva.

- **Sí:** validación de contraseña estricta: mínimo 6 caracteres + mayúscula + número + símbolo. **No:** aceptar el mínimo default de Supabase (6 caracteres sin otros requisitos) — agrega una capa mínima de seguridad sin complejidad excesiva.

- **Sí:** proteger solo `/juegos/[id]/jugar` con middleware. **No:** proteger Biblioteca, Detalle, o Salón de la Fama — mantiene la experiencia arcade abierta/explorable; solo el guardado de puntaje (que es la "recompensa") requiere cuenta.

- **Sí:** guardar puntaje automáticamente bajo el nombre del usuario autenticado, sin pedir nombre en el modal. **No:** seguir pidiendo nombre — ahora que hay identidad verificada, pedir el nombre sería redundante y confuso ("¿puedo usar otro nombre?").

- **Sí:** permitir jugar sin autenticación hasta terminar la partida, mostrando mensaje "Regístrate para guardar tu puntaje" en el modal si no hay sesión. **No:** bloquear el acceso al reproductor desde el inicio — maximiza conversión (el usuario ve el juego funcionando antes de decidir si registrarse).

- **Sí:** botón de logout en el Nav (reemplaza "ENTRAR" por "SALIR" cuando hay sesión). **No:** poner logout solo en una pantalla de perfil que no existe todavía — el Nav es el lugar más accesible y consistente con el mock actual.

- **Sí:** redirigir a la página anterior después de login/registro (query param `?redirect=...`). **No:** redirigir siempre a una página fija — si alguien estaba por jugar una partida, volver a esa partida es mejor UX que mandarlo a Biblioteca.

- **Sí:** mantener jugadores ficticios del seed creando usuarios mock en Supabase Auth (`<nombre>@mock.com` / `Test-00`, email ya verificado). **No:** limpiar el seed y arrancar con tablas vacías — preservar datos históricos permite demostrar la feature funcionando desde el día 1 y facilita testing sin tener que jugar 50 partidas manualmente.

- **Sí:** crear usuarios mock con email ya confirmado usando Admin API (`email_confirm: true`). **No:** dejarlos sin confirmar — si quedan bloqueados, nadie puede loguearse con esos usuarios para testing/demos, y los puntajes históricos quedan "huérfanos" de sesión.

- **Sí:** actualizar políticas RLS a `insert` verificado (`auth.uid()` debe coincidir con `user_id`). **No:** mantener `insert` público temporalmente — ahora que hay Auth real, no tiene sentido seguir permitiendo inserts sin verificación; es el momento de cerrar ese vector de riesgo documentado en la spec 06.

- **Sí:** `saveScoreAction` obtiene `user_id` de la sesión del servidor (`@supabase/ssr`). **No:** confiar en un `user_id` enviado desde el cliente — sería trivial falsificar el parámetro y guardar puntajes bajo otra cuenta; la sesión del servidor es la única fuente confiable.

- **Sí:** mostrar errores de autenticación en un bloque arriba del formulario activo. **No:** mensajes inline bajo cada campo o toast global — el bloque es más visible que inline (que puede quedar fuera de viewport si el formulario es largo) y más persistente que un toast (que desaparece automáticamente).

- **Sí:** persistir sesión al cerrar el navegador (comportamiento default de Supabase Auth con `localStorage`). **No:** sesión solo mientras dura la pestaña — consistente con la expectativa del mock actual y con la mayoría de apps web modernas.

- **No:** implementar recuperación de contraseña ("Olvidé mi contraseña") en esta spec. **Sí:** dejarlo para una spec futura — es una feature ortogonal (ruta nueva `/auth/reset`, email de reset, formulario de nueva contraseña) que no bloquea el flujo principal de registro/login; se puede agregar después sin refactorizar lo ya hecho.

- **No:** implementar pantalla de perfil (`/perfil`) para editar nombre de jugador, email, o ver historial. **Sí:** dejarlo para una spec futura — el alcance de esta spec es reemplazar el mock por Auth funcional; perfil es un módulo separado que puede construirse después sobre la base de Auth ya funcionando.

- **No:** migrar o sincronizar `RECENT_ACTIVITY` (feed de actividad del Home) con datos reales de `scores`. **Sí:** dejarlo mock — no fue parte del pedido (que es específicamente sobre autenticación) y ya estaba fuera de scope en la spec 06; sigue siendo válido para UX aunque no sea real.

## Identified risks

| Risk                                                                                                                                                                                                                                                                                                                      | Mitigation                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El script de seed de usuarios mock (`scripts/seed-mock-users.ts`) necesita la `service_role_key` (muy sensible, acceso admin total a Supabase) para usar `supabase.auth.admin.createUser()`. Si se comitea al repo o se expone, compromete todo el proyecto.                                                              | El script lee la key de una variable de entorno (`SUPABASE_SERVICE_ROLE_KEY`, nunca commiteada); se ejecuta una sola vez manualmente después de la migración SQL, no en build/deploy automático; se documenta en `.env.template` con warning de no compartir; se puede borrar del `.env.local` después de ejecutarlo.                                                       |
| Race condition entre crear usuario en Auth (`signUpAction` → `supabase.auth.signUp()`) e insertar en `players`: si `signUp` tiene éxito pero el `insert` en `players` falla (ej. nombre duplicado detectado tarde, error de red), queda un usuario en Auth sin fila en `players`, rompiendo el join de `SessionProvider`. | `signUpAction` valida que el nombre no exista (`SELECT` de `players.name`) **antes** de llamar a `signUp`; si el `insert` en `players` falla después de `signUp` exitoso, la Server Action devuelve `{ ok: false }` pero el usuario queda huérfano — se documenta como caso edge conocido; una spec futura puede agregar limpieza de usuarios huérfanos o retry del insert. |
| Verificación de email puede fallar si Supabase no está configurado con SMTP propio (usa el SMTP default de Supabase que tiene rate limiting estricto en proyectos free tier).                                                                                                                                             | Se verifica en paso 7 del plan de implementación con un registro real; si falla, se configura SMTP propio en Supabase dashboard antes de continuar; alternativamente, se deshabilita verificación obligatoria temporalmente (`email_confirm: false`) solo durante testing, y se vuelve a habilitar antes de marcar la spec como `Implemented`.                              |
| `SessionProvider` usa `onAuthStateChange()` en un `useEffect`; React Strict Mode (dev) monta/desmonta efectos dos veces, potencialmente registrando el listener duplicado o dejando uno "zombie" después del desmontaje.                                                                                                  | El `useEffect` debe retornar la función de cleanup que `onAuthStateChange()` devuelve (`const { data: { subscription } } = supabase.auth.onAuthStateChange(...); return () => subscription.unsubscribe()`); verificar manualmente en dev que no quedan listeners duplicados inspeccionando estado de Supabase client.                                                       |
| Middleware (`middleware.ts`) corre en Edge Runtime y hace fetch a Supabase para verificar sesión en cada request a `/juegos/[id]/jugar` — si Supabase está lento o caído, todas esas rutas quedan inaccesibles.                                                                                                           | El middleware usa `createServerClient` de `@supabase/ssr` que cachea la sesión; además, el proyecto ya depende de Supabase para leaderboards (spec 06), así que este riesgo no es nuevo — si Supabase cae, la app ya estaba degradada; no hay mitigación adicional en esta spec.                                                                                            |
| Redirect loop si el middleware redirige a `/auth?redirect=/juegos/[id]/jugar` y luego `/auth` también está protegido, o si después de login vuelve a `/juegos/[id]/jugar` pero la sesión no se propagó todavía.                                                                                                           | El middleware **no** protege `/auth` (solo `/juegos/[id]/jugar`); después de login, `signInAction` redirige del lado del servidor (Server Action) donde la sesión ya está seteada, no del cliente; se verifica manualmente en paso 12 que no hay loop.                                                                                                                      |
| El constraint `user_id unique` en `players`: si el script de seed falla a medio camino (ej. un nombre de jugador tiene caracteres inválidos en el email), algunas filas quedan con `user_id = null` y otras con `user_id` poblado — estado inconsistente.                                                                 | El script valida todos los nombres antes de empezar a crear usuarios (dry-run o lista hardcodeada); si un usuario falla, loguea el error pero continúa con los demás (no es transaccional); después de ejecutar, se verifica con `SELECT` que todas las filas tienen `user_id` poblado; si alguna quedó null, se ejecuta manualmente `createUser` + `UPDATE` para esa fila. |
| Migración de políticas RLS (`drop policy` → `create policy`): si alguien está jugando durante el deploy y termina la partida justo en el momento entre drop y create, el `insert` en `scores` puede fallar por "policy not found" o "permission denied".                                                                  | La migración SQL agrupa `drop` y `create` en una sola transacción (Supabase aplica migraciones dentro de un `BEGIN...COMMIT`); el tiempo entre drop y create es < 1ms; la probabilidad de colisión es extremadamente baja; si ocurre, el jugador ve error "No se pudo guardar el puntaje" (ya manejado en `game-player.tsx`) y puede reintentar.                            |
| Usuario registra cuenta con email real, nunca verifica el email, e intenta loguearse repetidamente — queda "bloqueado" indefinidamente con error "Debes verificar tu email".                                                                                                                                              | El formulario de login muestra el error con instrucción "Revisa tu email o solicita un nuevo link de verificación" (aunque no se implemente `resendVerificationEmail` en esta spec); una spec futura puede agregar botón "Reenviar email" en `/auth` que llama `supabase.auth.resend()`.                                                                                    |
