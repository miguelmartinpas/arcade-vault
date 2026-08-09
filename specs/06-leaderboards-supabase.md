# SPEC 06 — Leaderboards reales en Supabase (global y por juego)

> **Status:** Implemented
> **Depends on:** 04-supabase-setup-base (Implemented), 05-asteroids-motor-real (Implemented)
> **Date:** 2026-08-09
> **Objective:** Migrar el catálogo de juegos y los puntajes a tablas reales de Supabase (`games`, `players`, `scores`), reemplazando los generadores mock (`GAMES`, `PLAYERS`, `seededScores`, `TOP_PLAYERS_TODAY`) por lectura real desde la base, para mostrar un leaderboard global (widget del Home y pestaña "GLOBAL" del Salón de la Fama) y un leaderboard por juego (cada pestaña del Salón de la Fama y el Detalle de cada juego) que muestran siempre los mismos datos para un mismo juego o jugador.

## Scope

**In:**

- Crear en Supabase (proyecto `kjpvjfhuqrclpblkthpd`, vía migración con `mcp__supabase__apply_migration`) tres tablas nuevas: `games`, `players`, `scores`, con RLS habilitado y políticas de `select` públicas (para leer catálogo y leaderboards desde el navegador/servidor) e `insert` públicas restringidas a lo mínimo necesario (sin `update`/`delete` — los puntajes son inmutables).
- Sembrar `games` con los 8 juegos actuales de `lib/data.ts` (mismo `id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `plays`; sin columna `best` — pasa a calcularse en vivo).
- Sembrar `players` y `scores` con datos ficticios iniciales equivalentes a los que hoy genera `seededScores`/`PLAYERS`, para que ningún leaderboard se vea vacío el día 1.
- Crear funciones de lectura server-side (`lib/supabase/queries.ts` o similar) usando `lib/supabase/server.ts`: `getGames()`, `getGameById(id)`, `getGlobalLeaderboard(limit)`, `getGameLeaderboard(gameId, limit)`, `getPlayerBestForGame(playerName, gameId)`.
- Crear una Server Action (`saveScoreAction`) que valida (`name` 1–12 caracteres no vacío, `score` numérico entero positivo dentro de un rango razonable, `gameId` debe existir en `games`), hace upsert de `players` por `name` único, e inserta la fila en `scores`.
- Reemplazar `saveScore` de `components/session-provider.tsx` para que invoque `saveScoreAction` en vez de escribir en `localStorage`; se elimina la clave `av_scores` (deja de usarse). `login`/`logout`/`av_user` (sesión mock por nombre) no cambian.
- Actualizar `components/game-player.tsx` para manejar el guardado como operación async (estado de "guardando" y de error si la Server Action falla), en vez de una escritura síncrona a `localStorage`.
- Migrar a lectura real de Supabase las pantallas que hoy usan `GAMES`/`seededScores`/`TOP_PLAYERS_TODAY`: `app/page.tsx` (Home: preview de juegos + widget "Top jugadores" ahora es el top 5 del leaderboard global real), `app/biblioteca/page.tsx`, `app/juegos/[id]/page.tsx` (Detalle: catálogo + leaderboard del juego top 10 + "Mejor global" calculado como `MAX(score)` real + fila "tu mejor marca" con el score real del usuario logueado para ese juego, si jugó), `app/juegos/[id]/jugar/page.tsx`.
- Convertir `app/salon-de-la-fama/page.tsx` en Server Component async que obtiene el catálogo, el leaderboard global (top 10) y el leaderboard de cada juego (top 10 cada uno, con la fila "tu mejor marca" real si hay sesión), pasando todo como props a `components/hall-of-fame.tsx` (que deja de importar `lib/data.ts` directamente).
- Agregar una pestaña "GLOBAL" (primera, antes de las pestañas por juego) en `components/hall-of-fame.tsx`, reutilizando el mismo diseño de podio + tabla.
- Quitar de `lib/data.ts`: `GAMES`, `PLAYERS`, `ScoreRow`, `seededScores`, `TOP_PLAYERS_TODAY`. La interfaz `Game` se conserva (tipa las filas de la tabla `games`) pero sin la constante. `CATS` y `RECENT_ACTIVITY`/`ActivityEntry` (feed de actividad del Home) quedan sin tocar.

**Out of scope (para otras specs):**

- Auth real de Supabase (login/password/OAuth) — la sesión sigue siendo el mock por nombre en `localStorage`; `players` se identifica solo por nombre único, sin ninguna verificación de identidad.
- Rate limiting, anti-cheat o cualquier control más allá de la validación básica de rango/longitud en la Server Action.
- Editar o borrar puntajes ya guardados (no hay políticas de `update`/`delete`).
- Migrar o tocar `RECENT_ACTIVITY` (feed de "actividad reciente" del Home) — sigue mock.
- Perfil de jugador (avatar, email, historial de partidas, estadísticas agregadas más allá del leaderboard).
- CLI local de Supabase / carpeta `supabase/` con migraciones versionadas en el repo — se sigue aplicando la migración directamente al proyecto remoto vía MCP, como en la spec 04.
- Tests automatizados.

## Data model

### Tablas en Supabase (proyecto `kjpvjfhuqrclpblkthpd`, esquema `public`)

```sql
create table public.games (
  id text primary key,              -- mismo slug que hoy (ej. "asteroides")
  title text not null,
  short text not null,
  long text not null,
  cat text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover text not null,              -- clase CSS del fondo (sin cambios de convención)
  color text not null check (color in ('cyan', 'magenta', 'green', 'yellow')),
  plays text not null,              -- sigue siendo estático (ej. "12.4K"), no se calcula en vivo
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,        -- apodo, sin verificación de identidad
  created_at timestamptz not null default now()
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games(id),
  player_id uuid not null references public.players(id),
  score integer not null check (score >= 0 and score <= 10000000),
  created_at timestamptz not null default now()
);

create index scores_game_id_idx on public.scores(game_id);
create index scores_player_id_idx on public.scores(player_id);

alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.scores enable row level security;

create policy "games_select_public" on public.games for select using (true);
create policy "players_select_public" on public.players for select using (true);
create policy "players_insert_public" on public.players for insert with check (true);
create policy "scores_select_public" on public.scores for select using (true);
create policy "scores_insert_public" on public.scores for insert with check (true);
-- Sin políticas de update/delete: los puntajes son inmutables.
```

### Contratos de módulo

```ts
// lib/data.ts (se conserva solo el tipo, sin la constante GAMES)
export interface Game {
    id: string;
    title: string;
    short: string;
    long: string;
    cat: 'ARCADE' | 'PUZZLE' | 'SHOOTER' | 'VERSUS';
    cover: string;
    color: 'cyan' | 'magenta' | 'green' | 'yellow';
    plays: string;
}

export const CATS = ['TODOS', 'ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS'] as const;
// RECENT_ACTIVITY / ActivityEntry: sin cambios.

// lib/supabase/queries.ts
export interface LeaderboardRow {
    rank: number;
    name: string;
    score: number;
    date: string; // formateada desde created_at, mismo formato "DD/MM/AAAA"
}

export async function getGames(): Promise<Game[]>;
export async function getGameById(id: string): Promise<Game | null>;
export async function getGlobalLeaderboard(limit: number): Promise<LeaderboardRow[]>;
export async function getGameLeaderboard(gameId: string, limit: number): Promise<LeaderboardRow[]>;
export async function getBestScoreForGame(gameId: string): Promise<number | null>; // usado como "Mejor global"
export async function getPlayerBestForGame(
    playerName: string,
    gameId: string,
): Promise<{ score: number; date: string } | null>;

// lib/actions/save-score.ts ("use server")
export async function saveScoreAction(input: {
    gameId: string;
    name: string;
    score: number;
}): Promise<{ ok: true } | { ok: false; error: string }>;
```

Convenciones:

- El ranking global (`getGlobalLeaderboard`) toma, por jugador (`name` único), su `MAX(score)` entre **todos** los juegos que jugó, ordenado descendente. Dado el volumen chico de un catálogo arcade, se calcula trayendo las filas de `scores`+`players` y reduciendo en TypeScript (no se usa `DISTINCT ON` ni funciones SQL avanzadas).
- `getBestScoreForGame` reemplaza al campo estático `best` que tenía `Game` — se usa en el stat "Mejor global" del Detalle y en las tarjetas del catálogo.
- `saveScoreAction` hace upsert de `players` por `name` (`on conflict (name) do nothing`, luego `select` del `id`) antes de insertar en `scores`.
- Nombres duplicados entre el seed ficticio y jugadores reales son un riesgo aceptado (ver sección de riesgos) — no hay Auth real que garantice unicidad de identidad, solo de la fila en `players`.

## Implementation plan

1. Migración SQL (`mcp__supabase__apply_migration`): crear `games`, `players`, `scores` con RLS habilitado y las políticas de `select`/`insert` del data model. Verificación: `list_tables` muestra las 3 tablas nuevas con RLS activo.
2. Migración de seed: insertar los 8 juegos actuales (mismo `id`/copy/cover/color/plays que hoy en `lib/data.ts`, sin `best`) en `games`, y datos ficticios de `players`+`scores` equivalentes al `PLAYERS`/`seededScores` actual, para poblar los leaderboards desde el día 1. Verificación: `execute_sql` con `select count(*)` en cada tabla devuelve > 0; `get_advisors` no marca problemas de seguridad nuevos.
3. Crear `lib/supabase/queries.ts` con `getGames`, `getGameById`, `getGlobalLeaderboard`, `getGameLeaderboard`, `getBestScoreForGame`, `getPlayerBestForGame`, usando el cliente de `lib/supabase/server.ts`. Verificación: el módulo compila en TypeScript estricto; todavía no está conectado a ninguna pantalla.
4. Crear `lib/actions/save-score.ts` (`"use server"`) con `saveScoreAction`: valida `gameId`/`name`/`score`, hace upsert de `players` por `name` y luego `insert` en `scores`. Verificación: compila; revisión manual del código de validación (rangos y longitud de `name`).
5. Actualizar `components/session-provider.tsx`: `saveScore` invoca `saveScoreAction` en vez de escribir `av_scores` en `localStorage`; se elimina esa clave. `login`/`logout`/`av_user` no cambian. Verificación: `npm run build` sin errores; el Nav sigue reflejando sesión igual que antes.
6. Actualizar `components/game-player.tsx` para tratar el guardado como async (estado de "guardando" y de error si `saveScoreAction` falla). Verificación manual: terminar una partida, guardar el puntaje, y confirmar con `execute_sql` que apareció la fila nueva en `scores` (y en `players` si el nombre era nuevo).
7. Migrar `app/biblioteca/page.tsx` y `app/juegos/[id]/jugar/page.tsx` de `GAMES` (import estático) a `getGames()`/`getGameById()` (fetch async). Verificación: ambas rutas se ven y funcionan igual que antes.
8. Migrar `app/juegos/[id]/page.tsx`: `getGameById`, `getGameLeaderboard(id, 10)`, `getBestScoreForGame(id)` para el stat "Mejor global", y `getPlayerBestForGame` para la fila "tu mejor marca" si hay sesión. Verificación: el Detalle muestra el leaderboard real del juego y el mejor puntaje real.
9. Migrar `app/page.tsx`: `getGames()` para el preview de juegos y `getGlobalLeaderboard(5)` para el widget "Top jugadores" (reemplaza `TOP_PLAYERS_TODAY`). Verificación: el Home muestra el top 5 real, consistente con la pestaña GLOBAL del Salón.
10. Convertir `app/salon-de-la-fama/page.tsx` en Server Component async: obtiene `getGames()`, `getGlobalLeaderboard(10)`, `getGameLeaderboard(id, 10)` de cada juego y la mejor marca real del usuario por juego (si hay sesión), y pasa todo como props a `HallOfFame`. Verificación: compila; la pantalla aún no se ve actualizada (paso siguiente).
11. Refactorizar `components/hall-of-fame.tsx` para recibir esos datos por props (sin importar `lib/data.ts`), agregando una pestaña "GLOBAL" primero (mismo diseño de podio + tabla) y usando la mejor marca real recibida por props. Verificación: cambiar de pestaña (GLOBAL y cada juego) muestra los datos reales correspondientes; la fila "tu mejor marca" solo aparece si el usuario jugó ese juego.
12. Quitar de `lib/data.ts`: `GAMES`, `PLAYERS`, `ScoreRow`, `seededScores`, `TOP_PLAYERS_TODAY` (se conserva `Game`, `CATS`, `RECENT_ACTIVITY`, `ActivityEntry`). Verificación: `npm run build` y `npm run lint` sin errores de importación rota.
13. Recorrido end-to-end manual (y/o Playwright): Home → Biblioteca → Detalle → Reproductor (jugar y guardar puntaje real) → Salón de la Fama (pestaña GLOBAL y por juego), confirmando que el puntaje recién guardado aparece donde corresponde y que los tres lugares muestran datos consistentes para un mismo juego/jugador. Verificación: se cumplen los criterios de aceptación; `get_advisors` sin hallazgos nuevos de seguridad.

## Acceptance criteria

- [x] Existen en Supabase las tablas `games`, `players` y `scores`, con RLS habilitado y políticas de `select` públicas para las tres, e `insert` públicas solo para `players` y `scores` (sin `update`/`delete` en ninguna).
- [x] `games` contiene los 8 juegos actuales con el mismo `id`/copy/cover/color/plays que tenía `lib/data.ts`.
- [x] `players` y `scores` arrancan sembradas con datos ficticios, de forma que ningún leaderboard se ve vacío al desplegar.
- [x] `/` (Home) muestra el preview de juegos y el widget de top jugadores leyendo `games`/`scores` reales de Supabase, no `TOP_PLAYERS_TODAY`.
- [x] `/biblioteca` lista los juegos leyendo `getGames()`, con el mismo comportamiento de búsqueda/filtro por categoría que hoy.
- [x] `/juegos/[id]` muestra el leaderboard real del juego (top 10), el "Mejor global" calculado como el puntaje máximo real de ese juego, y la fila "tu mejor marca" con el puntaje real del usuario logueado si jugó ese juego (no aparece si nunca jugó).
- [x] `/juegos/[id]/jugar` sigue funcionando igual que hoy (HUD, pausa, modal de fin), y al guardar el puntaje en el modal se inserta una fila real en `scores` (y en `players` si el nombre es nuevo) en vez de escribir en `localStorage`.
- [x] `/salon-de-la-fama` tiene una pestaña "GLOBAL" (primera) que muestra el top 10 de mejor puntaje por jugador entre todos los juegos, y una pestaña por cada juego con su top 10 real — ambas con el mismo diseño de podio + tabla que ya existe.
- [x] Los datos de una misma pestaña de juego en el Salón de la Fama y del Detalle de ese mismo juego son consistentes entre sí (mismo top 10, misma fuente de datos).
- [x] Guardar un puntaje desde el Reproductor y volver a entrar al Detalle/Salón de ese juego muestra el puntaje recién guardado reflejado en el leaderboard correspondiente.
- [x] La Server Action de guardado rechaza (sin insertar) un `name` vacío o de más de 12 caracteres, un `score` negativo o fuera de rango, o un `gameId` que no existe en `games`.
- [x] `lib/data.ts` ya no exporta `GAMES`, `PLAYERS`, `ScoreRow`, `seededScores` ni `TOP_PLAYERS_TODAY`; `Game`, `CATS`, `RECENT_ACTIVITY` y `ActivityEntry` siguen existiendo sin cambios.
- [x] La clave `av_scores` de `localStorage` ya no se escribe ni se lee en ningún componente.
- [x] La sesión mock (`av_user`, login/logout por nombre) sigue funcionando exactamente igual que antes de esta spec.
- [x] `npm run build` y `npm run lint` pasan sin errores nuevos.
- [x] `get_advisors` (Supabase) no reporta hallazgos de seguridad nuevos más allá del riesgo ya documentado de `insert` público sin Auth.

## Decisions

- **Sí:** migrar `games`, `players` y `scores` a Supabase en esta misma spec, en vez de dejarlo para después. **No:** posponer la migración del catálogo — es justo lo que la spec 04 dejó marcado como trabajo futuro, y separarlo del leaderboard hubiera obligado a mezclar IDs de dos fuentes distintas (mock + real) durante una etapa intermedia.
- **Sí:** sesión mock por nombre (`localStorage`, sin password) y tabla `players` identificada solo por nombre único, sin Auth real. **No:** implementar Supabase Auth en esta spec — es un cambio grande y ortogonal (login/registro real, sesiones de servidor) que `CLAUDE.md` ya marca como pendiente para una spec propia; mezclarlo aquí hubiera duplicado el alcance.
- **Sí:** sembrar `players`/`scores` con datos ficticios iniciales. **No:** arrancar las tablas vacías — un leaderboard vacío el día 1 se ve roto y no aporta nada para revisar la feature.
- **Sí:** escribir puntajes vía Server Action (`saveScoreAction`) con validación server-side. **No:** insertar directamente desde el cliente con el browser client de Supabase — la Server Action permite validar rango/longitud antes de tocar la base, aun sin Auth real.
- **Sí:** validación básica en la Server Action (nombre 1–12 caracteres, score en rango razonable, `gameId` existente). **No:** rate limiting o anti-cheat — no fue pedido y expande el alcance sin necesidad para un MVP de leaderboard.
- **Sí:** ranking global = mejor puntaje absoluto por jugador entre todos los juegos (`MAX(score)` agrupado por `name`). **No:** sumar los mejores puntajes por juego — mezclaría escalas de puntaje muy distintas entre juegos (ej. Duelo Pixel llega a 24, Caída a 180000+), dando un ranking sin sentido.
- **Sí:** calcular el ranking global reduciendo en TypeScript sobre las filas de `scores`+`players` (dataset chico tipo arcade). **No:** usar `DISTINCT ON` u otras funciones SQL avanzadas — no hace falta la complejidad extra para el volumen de datos esperado en este proyecto.
- **Sí:** eliminar `av_scores` de `localStorage`, dejando Supabase como única fuente de verdad de puntajes. **No:** mantenerlo como fallback — tener dos fuentes de datos de puntajes (local y remota) reintroduce exactamente la inconsistencia que esta spec busca eliminar.
- **Sí:** el campo `best`/"Mejor global" se calcula en vivo (`MAX(score)` real) en vez de guardarse como columna estática. **No:** mantenerlo como valor sembrado en `games` — quedaría desactualizado apenas alguien supere ese puntaje jugando de verdad.
- **Sí:** el campo `plays` (partidas jugadas) sigue siendo un valor estático sembrado en `games`. **No:** calcularlo en vivo contando filas de `scores` — no fue pedido (el pedido es sobre puntajes, no sobre conteo de partidas) y ampliaría el alcance sin necesidad.
- **Sí:** agregar una pestaña "GLOBAL" (primera) en el Salón de la Fama, reutilizando el diseño de podio + tabla existente. **No:** una pantalla o ruta separada para el ranking global — reutilizar el componente ya construido es más simple y consistente visualmente.
- **Sí:** Top 10 en Salón de la Fama (global y por juego) y en Detalle, Top 5 en el widget del Home — mismos números que ya usaba el prototipo mock. **No:** cambiar esas cantidades — no había pedido de cambiarlas y mantiene la fidelidad visual actual.
- **Sí:** `players` solo con `name` único como identificador, sin campos adicionales. **No:** agregar avatar/email/perfil ahora — es trabajo de una spec futura de perfil de usuario, no relacionado con leaderboards.
- **Sí:** mantener `RECENT_ACTIVITY`/`ActivityEntry` (feed de actividad del Home) sin tocar. **No:** migrarlo también a Supabase — no fue parte del pedido (que es específicamente sobre leaderboards/tablas de puntajes) y hubiera ampliado el alcance sin necesidad.
- **Sí:** aplicar la migración directamente al proyecto remoto vía `mcp__supabase__apply_migration`, sin CLI local ni carpeta `supabase/` versionada. **No:** inicializar `supabase/` con migraciones en el repo — sigue el mismo patrón que la spec 04, que dejó esa decisión para cuando realmente se necesite desarrollo local.

## Identified risks

| Risk                                                                                                                                                                                                                                                       | Mitigation                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sin Auth real, cualquiera puede llamar a `saveScoreAction` con un `name` que coincide con un jugador ya sembrado (o real), "robando" o mezclando su historial de puntajes bajo ese nombre.                                                                 | Riesgo aceptado explícitamente en esta spec (documentado en Decisions): `players` identifica solo un apodo, no una identidad verificada. Auth real queda para una spec futura.                                                                                                     |
| La política de `insert` pública en `players`/`scores` permite que cualquiera con la publishable key inserte filas directamente (sin pasar por la Server Action), evitando la validación de rango/longitud.                                                 | Se documenta como limitación conocida: la publishable key ya es pública por diseño (viaja al navegador). Los `check` constraints de la tabla (`score` entre 0 y 10000000) actúan como última barrera aunque se salteen la Server Action; no hay mitigación adicional en esta spec. |
| Calcular el leaderboard global reduciendo en TypeScript sobre todas las filas de `scores` puede volverse lento si el volumen de puntajes crece mucho.                                                                                                      | Aceptable para el volumen esperado de un proyecto arcade de este tamaño; si crece, una spec futura puede migrar el cálculo a una vista o función SQL.                                                                                                                              |
| Migrar `GAMES` de un import estático a un fetch async toca muchos archivos (`app/page.tsx`, `app/biblioteca/page.tsx`, `app/juegos/[id]/page.tsx`, `app/juegos/[id]/jugar/page.tsx`, `app/salon-de-la-fama/page.tsx`) — un error en alguno rompe esa ruta. | El plan de implementación migra archivo por archivo con verificación manual en cada paso (pasos 7 a 11), en vez de un cambio masivo de una sola vez.                                                                                                                               |
| `components/hall-of-fame.tsx` deja de manejar su propio estado de datos (hoy genera `seededScores` localmente) y pasa a depender de props calculadas en el Server Component padre — un cambio de forma en esos props rompe el tab-switching.               | El componente se refactoriza en un solo paso (11) inmediatamente después de que el Server Component padre (paso 10) ya provee los datos, minimizando la ventana con una interfaz a medio migrar.                                                                                   |

## What is **not** in this spec

- Auth real de Supabase (login/password/OAuth).
- Rate limiting o anti-cheat.
- Edición o borrado de puntajes ya guardados.
- Migración de `RECENT_ACTIVITY` a Supabase.
- Perfil de jugador (avatar, email, estadísticas agregadas).
- CLI local de Supabase / carpeta `supabase/` con migraciones versionadas.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propia spec.

## Implementation notes

Decisiones tomadas durante la implementación para resolver ambigüedades que la spec no cubría explícitamente (consultadas y aprobadas por el usuario en cada caso):

- **Sesión mock espejada en cookie:** `login`/`logout` en `session-provider.tsx` ahora también escriben/borran una cookie simple `av_user` (no-httpOnly), además de `localStorage`. Necesario porque `/juegos/[id]` y `/salon-de-la-fama` son Server Components y necesitan saber "si hay sesión" para resolver `getPlayerBestForGame`, y `localStorage` no es legible desde el servidor. `localStorage` sigue siendo la fuente de verdad para el hook `useSession()` del cliente; la cookie es solo un espejo de lectura.
- **`lib/supabase/server.ts` tolera la falta de `cookies()`:** `generateStaticParams` corre en build time sin contexto de request, donde `cookies()` no está disponible. Se agregó un fallback (cliente sin cookie store) para que `getGames()`/`getGameById()` sigan funcionando ahí; las políticas de `select` públicas no dependen de sesión, así que el fallback no pierde funcionalidad.
- **Tipo `Game` temporalmente duplicado en `lib/supabase/queries.ts` (pasos 3–11), luego unificado (paso 12):** para no adelantar la limpieza de `lib/data.ts` prevista para el paso 12, `queries.ts` definió su propio tipo `Game` (idéntico en forma al contrato final, sin `best`) durante los pasos intermedios. En el paso 12, al quitar `best` de `Game` en `lib/data.ts`, `queries.ts` pasó a importar y re-exportar ese tipo en vez de mantener una copia local.
