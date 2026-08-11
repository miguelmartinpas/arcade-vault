# SPEC 07 — Motor real de Tetris en el reproductor

> **Status:** Implemented
> **Depends on:** 04-supabase-setup-base, 05-asteroids-motor-real, 06-leaderboards-supabase
> **Date:** 2026-08-11
> **Objective:** Portar el Tetris de `references/started-games/03-tetris` a un motor TypeScript enchufable (`lib/games/tetris/engine.ts`) registrado en el registry de motores, reemplazando el mock "CAÍDA" por la ficha real "TETRIS" con id nuevo en Supabase.

## Scope

**In:**

- Portar `references/started-games/03-tetris/game.js` a un motor TypeScript (`lib/games/tetris/engine.ts`), sin variables globales ni listeners fuera del ciclo de vida de React, exportando `createTetrisEngine: GameEngineFactory`.
- Registrar el motor en `lib/games/registry.ts`: `tetris: createTetrisEngine`.
- Portar las 8 piezas del `game.js` original tal cual (las 7 estándar I/O/T/S/Z/J/L más la 8ª pieza no estándar "tuerca"), con su mismo sorteo aleatorio 1–8.
- Mecánica completa del original: tablero 10×20, colisiones, rotación con wall kicks (`[0,-1,1,-2,2]`), soft drop, hard drop, pieza fantasma (ghost piece), limpieza de líneas, puntuación (`LINE_SCORES` × nivel, hard drop +2/celda, soft drop +1/fila), niveles cada 10 líneas con velocidad creciente (`dropInterval = max(100, 1000 - (level-1)*90)`).
- Un único `<canvas>` interno de 800×600 (mismo patrón que Asteroides): el tablero y la vista previa de "siguiente pieza" se dibujan dentro del mismo canvas; los contadores de score/líneas/nivel del original se eliminan del canvas (los muestra el HUD real de React) y el overlay de pausa/game over propio del original se elimina (lo reemplaza el modal/UI de React).
- Controles solo de teclado: flechas izquierda/derecha (mover), flecha arriba o `X` (rotar), flecha abajo (soft drop), Espacio (hard drop, con `preventDefault`). Se quita el shortcut interno de `P` para pausa — la pausa real la dispara únicamente el botón "PAUSA" de React vía `handle.pause()`/`resume()`, igual que Asteroides.
- HUD de vidas: `onLivesChange(1)` constante durante toda la partida (Tetris no tiene vidas reales); el label "Vidas" del HUD no se modifica.
- HUD de nivel real: `onLevelChange` se dispara con el nivel real calculado (`floor(lines/10) + 1`), igual que niveles reales de Asteroides.
- Al perder (pieza nueva colisiona al aparecer): se dispara `onGameOver(score)`; el motor deja de aceptar input y no dibuja overlay propio ni reinicia por sí solo.
- Reemplazar el mock `"caida"` por `"tetris"` en la tabla `games` de Supabase (migración: migrar los `scores` existentes de `caida` a `tetris`, `DELETE` de `caida` + `INSERT` de `tetris`), reusando tal cual `short`/`long`/`cat`/`cover`/`color`/`plays` del mock (`PUZZLE`/`cover-tetro`/`magenta`/`"31.8K"`), con título nuevo `"TETRIS"`.
- Actualizar `RECENT_ACTIVITY` en `lib/data.ts`: la entrada `game: 'Caída'` pasa a `game: 'Tetris'`.
- Renombrar la clase CSS `.asteroids-canvas` → `.game-canvas` en `app/globals.css` y `components/game-player.tsx` (deuda marcada en `game-engine-contract.md` para el primer motor real que se agrega después de Asteroides).
- Verificación manual en navegador (y/o Playwright) del flujo completo de juego.

**Out of scope (para specs futuras):**

- Controles táctiles/on-screen para móvil.
- Sonido/efectos de audio (el original no trae audio).
- Toggle de tema claro/oscuro del prototipo de referencia (`theme-toggle`, `localStorage['tetris-theme']`) — es una feature de la página standalone de referencia, no del contrato de motor; Arcade Vault ya tiene su propio tema.
- Cambiar el significado del stat "Vidas" a otra métrica (ej. líneas completadas) — se resolvió con valor constante `1`.
- Tocar el resto del catálogo (Asteroides, Bloque Buster, Serpentina, Glotón, Invasores, Ranaria, Duelo Píxel) — siguen intactos.
- Portar Arkanoid (el otro starter pendiente en `references/started-games`) — esta spec solo agrega Tetris.
- Sincronizar el campo "Mejor global" o cualquier otro cálculo — ya es real y genérico por `game_id` desde la spec 06, sin cambios necesarios.

## Data model

Reutiliza la interfaz ya existente de `lib/games/types.ts` (`GameEngineCallbacks`, `GameEngineHandle`, `GameEngineFactory`), sin cambios.

`lib/games/registry.ts` — una línea agregada:

```ts
import { createTetrisEngine } from '@/lib/games/tetris/engine';

export const GAME_ENGINES: Partial<Record<string, GameEngineFactory>> = {
    asteroides: createAsteroidsEngine,
    tetris: createTetrisEngine,
};
```

`lib/games/tetris/engine.ts` exporta `createTetrisEngine: GameEngineFactory`. Todo el estado del juego (tablero, pieza actual/siguiente, score/lines/level, loop de `requestAnimationFrame`) vive en variables locales dentro del closure de la factory — nada a nivel de módulo.

Estado interno (mismo modelo que el original, portado a variables de closure):

```ts
// dentro del closure de createTetrisEngine
let board: number[][]; // ROWS×COLS, 0 = vacía, 1-8 = índice de color de pieza
let current: { type: number; shape: number[][]; x: number; y: number };
let next: { type: number; shape: number[][]; x: number; y: number };
let score: number, lines: number, level: number;
let dropInterval: number, dropAccum: number, lastTime: number | null, rafId: number | null;
let running: boolean;
```

Reemplazo de la fila `"caida"` por `"tetris"` en la tabla `games` de Supabase (mismo `short`/`long`/`cat`/`cover`/`color`/`plays` del mock, título nuevo). Los `scores` existentes que apuntaban a `caida` se migran a `tetris` antes de borrar la fila del mock, para no romper la foreign key `scores.game_id → games.id` y para que el leaderboard de Tetris no arranque vacío:

```sql
insert into public.games (id, title, short, long, cat, cover, color, plays)
values (
  'tetris',
  'TETRIS',
  'Encaja las piezas antes de que el techo te aplaste.',
  'Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.',
  'PUZZLE',
  'cover-tetro',
  'magenta',
  '31.8K'
);

update public.scores set game_id = 'tetris' where game_id = 'caida';

delete from public.games where id = 'caida';
```

Actualización en `lib/data.ts` (`RECENT_ACTIVITY`, sin cambios de tipo, solo de valor):

```ts
{ player: 'NEONFOX', game: 'Tetris', score: 184220, timeAgo: 'hace 2 min', color: 'magenta' },
```

Conventions:

- Coordenadas y física internas del motor: mismo modelo lógico que el original (tablero 10×20 celdas, `BLOCK` interno de 30px), pero dibujado dentro de un canvas lógico de 800×600 (no 300×600) — el tablero se centra/posiciona dentro de esa superficie y la vista de "siguiente pieza" se dibuja en un panel fijo a la derecha, dentro del mismo canvas.
- Piezas: mismas 8 matrices (`PIECES`, incluida la "tuerca") y misma paleta `COLORS`, portadas tal cual.
- `dt` en el loop, capado a un máximo razonable (50ms) igual que Asteroides, para evitar saltos tras throttling de pestaña en segundo plano.
- El motor nunca lee ni escribe `window`/`document` fuera del `canvas` recibido, salvo los listeners de teclado (`window.addEventListener('keydown'/'keyup')`), registrados en `mount` y removidos en `destroy`. No hay listener para `KeyP` (pausa queda solo del lado de React).

## Implementation plan

1. Crear `lib/games/tetris/engine.ts` exportando `createTetrisEngine: GameEngineFactory`: portar tablero, las 8 piezas, colisiones, rotación con wall kicks, soft drop, hard drop, ghost piece, limpieza de líneas, puntuación y niveles del `game.js` original, encapsulado en el closure de la factory (sin estado a nivel de módulo). Dibujar el tablero y la vista de "siguiente pieza" dentro del único canvas de 800×600. Disparar `onScoreChange`/`onLevelChange`/`onGameOver` en los mismos puntos donde el original mutaba `score`/`level`/entraba a game over, y `onLivesChange(1)` una sola vez al iniciar. Sin overlay propio de pausa/game over ni shortcut de `KeyP`. Verificación: el módulo compila con TypeScript en modo `strict`; aún no está conectado a ninguna pantalla.
2. Agregar `tetris: createTetrisEngine` a `lib/games/registry.ts`. Verificación: `next build` compila; `GamePlayer` no cambia de comportamiento todavía (no hay fila `tetris` en `games` aún).
3. Renombrar la clase CSS `.asteroids-canvas` → `.game-canvas` en `app/globals.css` y en el `className` del `<canvas>` de `components/game-player.tsx`. Verificación: `/juegos/asteroides/jugar` se ve y funciona exactamente igual que antes del renombre (regresión visual manual).
4. Migración SQL (`mcp__supabase__apply_migration`): `insert` de la fila `tetris` primero, luego `update public.scores set game_id = 'tetris' where game_id = 'caida'`, luego `delete from public.games where id = 'caida'` (el `insert` va primero porque la foreign key `scores.game_id → games.id` exige que `tetris` ya exista en `games` antes de que cualquier `scores.game_id` pueda apuntarle). Verificación: `execute_sql SELECT` confirma que `caida` ya no existe en `games`, que `tetris` sí, y que las 10 filas de `scores` que antes apuntaban a `caida` ahora apuntan a `tetris`; `get_advisors` no reporta hallazgos de seguridad nuevos.
5. Actualizar `RECENT_ACTIVITY` en `lib/data.ts`: la entrada `game: 'Caída'` pasa a `game: 'Tetris'`. Verificación: `npm run build` y `npm run lint` sin errores.
6. Verificación manual (y/o con Playwright) del flujo completo en `/juegos/tetris/jugar`: movimiento/rotación/soft drop/hard drop/ghost piece/limpieza de líneas, HUD de score/nivel real y vidas constante en 1, pausa/reanudar sin saltos, game over → modal → guardar puntaje real en Supabase → reiniciar; y confirmar que `/juegos/tetris` muestra la ficha "TETRIS" y que el resto del catálogo (incluido Asteroides tras el renombre de clase) sigue intacto.

## Acceptance criteria

- [x] La ruta `/juegos/tetris` muestra la ficha "TETRIS" con copy/cover/color/plays heredados del mock "CAÍDA".
- [x] La entrada `"caida"` ya no existe en la tabla `games` de Supabase.
- [x] En `/juegos/tetris/jugar` se renderiza un único `<canvas>` con el motor real de Tetris (tablero, pieza actual, ghost piece y vista de "siguiente pieza" visibles).
- [x] Las flechas izquierda/derecha mueven la pieza, flecha arriba o `X` rota (con wall kicks), flecha abajo hace soft drop y Espacio hace hard drop.
- [x] El HUD de puntuación y nivel refleja los valores reales emitidos por el motor; el HUD de vidas muestra `1` de forma constante durante toda la partida.
- [x] Al completar una o más líneas, el puntaje sube según la tabla `[0,100,300,500,800]` multiplicada por el nivel actual, y las líneas completas se eliminan del tablero.
- [x] Cada 10 líneas el nivel sube y la velocidad de caída aumenta (`dropInterval` menor).
- [x] Clic en "PAUSA" detiene el juego por completo (incluye el loop de caída automática) y clic en "REANUDAR" lo retoma sin saltos bruscos.
- [x] La tecla `P` no tiene ningún efecto dentro del reproductor (la pausa depende únicamente del botón de React).
- [x] Cuando una pieza nueva colisiona al aparecer, aparece el modal "FIN DEL JUEGO" de React con el puntaje final correcto, sin overlay dibujado en el canvas.
- [x] Clic en "JUGAR DE NUEVO" reinicia el motor (score/nivel/tablero vuelven a su estado inicial) y el juego vuelve a ser jugable.
- [x] Guardar el puntaje desde el modal inserta una fila real en `scores` (y en `players` si el nombre es nuevo) para `game_id = 'tetris'`.
- [x] Salir del reproductor detiene el loop del motor y remueve los listeners de teclado, sin errores en consola.
- [x] `/juegos/asteroides/jugar` sigue funcionando exactamente igual después del renombre de `.asteroids-canvas` a `.game-canvas`.
- [x] El resto del catálogo (Bloque Buster, Serpentina, Glotón, Invasores, Ranaria, Duelo Píxel) sigue mostrando su comportamiento actual sin cambios.
- [x] `RECENT_ACTIVITY` en el Home muestra `"Tetris"` en vez de `"Caída"`.
- [x] Las 10 filas de `scores` que originalmente apuntaban a `game_id = 'caida'` ahora apuntan a `game_id = 'tetris'`, y el leaderboard de `/juegos/tetris` no arranca vacío.
- [x] `npm run lint` y `next build` pasan sin errores nuevos.
- [x] `get_advisors` (Supabase) no reporta hallazgos de seguridad nuevos.

## Decisions

- **Sí:** portar las 8 piezas del `game.js` original tal cual (7 estándar + la 8ª pieza "tuerca"), fiel al código real en vez del README. **No:** recortar a solo 7 piezas — hubiera sido una simplificación no pedida y distinta del comportamiento real del juego fuente.
- **Sí:** quitar el shortcut interno de `KeyP` para pausa; la pausa real la dispara únicamente el botón "PAUSA" de React vía `handle.pause()`/`resume()`. **No:** mantener el atajo interno además del botón — desincronizaría el label/estado del botón de React con el estado real del motor, el mismo problema que motivó suprimir el reinicio interno por Espacio en Asteroides.
- **Sí:** un único canvas interno de 800×600 (mismo patrón que Asteroides), con el tablero y la vista de "siguiente pieza" dibujados dentro de ese mismo canvas. **No:** dos `<canvas>` (uno por tablero, otro por preview) — el contrato de motor (`GameEngineFactory`) solo recibe un `HTMLCanvasElement`.
- **Sí:** eliminar del canvas los contadores propios (`#score`/`#lines`/`#level`) y el overlay de pausa/game over del original. **No:** conservarlos dibujados en el canvas — quedarían duplicados con el HUD y el modal reales de React.
- **Sí:** HUD de "Vidas" con valor constante `1` (`onLivesChange(1)` una sola vez al iniciar), sin tocar `components/game-player.tsx`. **No:** reusar ese callback para otra métrica (ej. líneas completadas) o modificar `game-player.tsx` para ocultar el stat — ambas opciones amplían el alcance sin necesidad para esta spec; el nivel real ya se refleja en su propio stat.
- **Sí:** crear id nuevo `"tetris"` para el juego real, retirando el mock `"caida"` (mismo patrón `rocas`→`asteroides` de la spec 05). **No:** reusar el id `"caida"` tal cual — se prefiere seguir el precedente ya establecido de nombrar la ficha real con el nombre real del juego.
- **Sí:** título nuevo "TETRIS" (reemplaza a "CAÍDA"), reusando tal cual `short`/`long`/`cat`/`cover`/`color`/`plays` del mock. **No:** conservar el título "CAÍDA" o inventar copy nuevo — no fue pedido y el copy existente ya describe correctamente la mecánica real.
- **Sí:** carpeta técnica `lib/games/tetris/engine.ts` y factory `createTetrisEngine`, mismo patrón que `asteroids`/`createAsteroidsEngine`. **No:** nombrar la carpeta `caida` o cualquier otro nombre — el namespace técnico (inglés, libre) sigue la convención ya establecida, independiente del id de catálogo.
- **Sí:** renombrar `.asteroids-canvas` → `.game-canvas` en `app/globals.css` y `components/game-player.tsx` como paso propio de esta spec. **No:** dejar el nombre `.asteroids-canvas` — ya no describe la realidad al ser una clase compartida por dos motores reales; esta es la primera spec que agrega un segundo motor, momento marcado en `game-engine-contract.md` para hacer el renombre.
- **Sí:** sonido/tema claro-oscuro del prototipo de referencia quedan fuera de esta spec. **No:** portarlos — el original no trae audio real más allá de silencio, y el toggle de tema es una feature de la página standalone, no del juego ni del contrato de motor.
- **Sí:** migrar los `scores` que apuntaban a `caida` hacia `tetris` antes de borrar la fila del mock. **No:** borrar esos `scores` junto con el mock — el leaderboard de Tetris arrancaría vacío el día 1, contradiciendo el criterio ya establecido en la spec 06 de sembrar datos ficticios para que ningún leaderboard se vea roto.

## Risks

| Risk                                                                                                                                                                                          | Mitigation                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Strict Mode (dev) monta/desmonta efectos dos veces al arrancar                                                                                                                          | `destroy()` debe cancelar el `requestAnimationFrame` y remover los listeners de forma idempotente; verificar manualmente que no queden dos loops de caída corriendo en paralelo.                                                                  |
| `<canvas>` accede a APIs de navegador (`getContext`, `requestAnimationFrame`) que no existen en SSR                                                                                           | El motor y `GamePlayer` se usan solo dentro de `"use client"`, y `mount()` se llama desde un `useEffect` (nunca durante el render del servidor).                                                                                                  |
| Cancelar y reanudar el loop sin resetear el reloj interno puede producir un salto grande de `dt` al despausar                                                                                 | Al implementar `resume()`, reiniciar `lastTime = null` para que el primer frame post-pausa use `dt = 0`, igual que Asteroides.                                                                                                                    |
| El `update` de `scores` o el `delete` de `caida` antes de que exista la fila `tetris` rompe la migración por la foreign key `scores.game_id → games.id`                                       | El plan de implementación (paso 4) ordena explícitamente: `insert` de `tetris` primero, `update scores` después, `delete games` al final, dentro de la misma migración.                                                                           |
| El canvas interno de 800×600 es mucho más ancho que el tablero real (300×600 lógico) — dibujar el panel de "siguiente pieza" mal posicionado puede superponerse al tablero o quedar recortado | Definir explícitamente en el motor una región fija para el tablero (ej. alineado a la izquierda) y otra para el preview (ej. panel a la derecha), sin recalcular dinámicamente por resize — mismo criterio "sin lógica de resize" que Asteroides. |
| El renombre de `.asteroids-canvas` → `.game-canvas` (paso 3) toca un archivo compartido (`components/game-player.tsx`) usado también por el motor de Asteroides ya en producción              | El paso se ejecuta y verifica de forma aislada (regresión manual en `/juegos/asteroides/jugar`) antes de tocar nada relacionado a Tetris, para aislar cualquier regresión visual.                                                                 |

## What is **not** in this spec

- Controles táctiles/on-screen para móvil.
- Sonido/efectos de audio.
- Toggle de tema claro/oscuro del prototipo de referencia.
- Cambiar el significado del stat "Vidas" a otra métrica.
- Cambios al resto del catálogo (Asteroides, Bloque Buster, Serpentina, Glotón, Invasores, Ranaria, Duelo Píxel).
- Portar Arkanoid al registry de motores.
- Cambios en `lib/supabase/queries.ts`, `lib/actions/save-score.ts` u otras pantallas ya genéricas por `game_id`.

Cada uno de estos, si se aborda, va en su propia spec.

## Implementation notes

Decisiones tomadas durante la implementación para resolver ambigüedades que la spec no cubría explícitamente:

- **Orden real de la migración SQL:** el orden documentado originalmente en Data model/paso 4 (`update scores` → `delete games` → `insert games`) viola la foreign key `scores.game_id → games.id`, porque `tetris` todavía no existe en `games` en el momento del `update`. El orden que efectivamente se aplicó y quedó documentado es `insert games` → `update scores` → `delete games`. Corregido en ambas secciones antes de ejecutar la migración real.
- **Verificación de limpieza de líneas y subida de nivel (criterios 6 y 7):** intentar forzar una línea completa jugando "a ciegas" vía Playwright no fue confiable — el tiempo de ida y vuelta entre llamadas de herramienta supera el `dropInterval` de 1000ms, así que varias piezas caían y se bloqueaban solas entre cada lectura de estado. Se verificó en su lugar ejecutando la función `clearLines` (copiada carácter por carácter desde `lib/games/tetris/engine.ts`) en un script Node aislado, confirmando: 1 línea a nivel 1 → score 100; 2 líneas → 300; 10 líneas acumuladas → nivel 2 y `dropInterval` 910; la línea que dispara la subida de nivel puntúa todavía con el nivel viejo (igual que el `game.js` original).
