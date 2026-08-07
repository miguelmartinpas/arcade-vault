# SPEC 05 — Motor real de Asteroids en el reproductor

> **Status:** Implemented
> **Depends on:** 04-supabase-setup-base
> **Date:** 2026-08-07
> **Objective:** Portar el juego de Asteroids ya construido en `references/started-games/02-asteroids` a un motor TypeScript enchufable en el reproductor real de Arcade Vault, vía un registry de motores de juego por id.

## Scope

**In:**

- Portar `references/started-games/02-asteroids/game.js` a un motor TypeScript (`lib/games/asteroids/engine.ts`), sin variables globales ni listeners fuera de ciclo de vida de React.
- Definir una interfaz `GameEngine` genérica (mount/pause/resume/restart/destroy + callbacks de score/lives/level/gameover) y un `registry` que mapea `game.id` → motor.
- `components/game-player.tsx` resuelve por id: si el registry tiene motor real lo usa; si no, sigue mostrando el placeholder mock actual sin cambios (las otras 7 fichas no se tocan).
- Reemplazar la entrada `"rocas"` en `lib/data.ts` por `"asteroides"` (mismo copy/cover/color/stats, título `ASTEROIDES`) apuntando al motor real.
- HUD (puntuación, vidas, nivel) alimentado por callbacks reales del motor, no por el timer aleatorio actual.
- Pausa real: se detiene el loop del motor (cancela el `requestAnimationFrame`) y se retoma sin salto de `dt`.
- Al game over: se suprime el overlay "GAME OVER" que dibuja el propio canvas; solo se muestra el modal de React. El reinicio queda controlado únicamente por el botón "JUGAR DE NUEVO" (se desactiva el atajo interno de Espacio-para-reiniciar del motor).
- Canvas escalado por CSS al 100% de `.crt-screen` (ya 4:3), manteniendo la resolución interna 800×600 sin lógica de resize en el motor.
- Se preserva el gameplay del juego fuente tal cual: movimiento/rotación/propulsión, disparo, asteroides que se dividen, partículas de explosión, power-up de disparo triple, invencibilidad con parpadeo al reaparecer, vidas, niveles y envolvimiento toroidal de bordes.
- Controles solo de teclado (flechas + espacio), igual que el original; los listeners se activan solo mientras la pantalla del reproductor está montada, se limpian al desmontar, y se previene el scroll de página con `preventDefault` en esas teclas.
- Verificación manual en navegador (y/o Playwright) del flujo completo de juego.

**Out of scope (for future specs):**

- Controles táctiles/on-screen para móvil (el tag "TÁCTIL" en la ficha queda como deuda visual pendiente).
- Persistir puntajes reales de este juego en Supabase — sigue usando `saveScore`/localStorage del `session-provider` actual.
- Portar Tetris o Arkanoid (los otros starters en `references/started-games`) al registry — esta spec solo agrega Asteroids.
- Sonido/efectos de audio (el juego fuente no trae audio).
- Tocar el resto del catálogo mock (Caída, Serpentina, Glotón, Invasores, Ranaria, Duelo Píxel, Bloque Buster) — siguen con el placeholder actual intacto.
- Sincronizar el campo `best` de la ficha con puntajes reales — sigue siendo un valor estático como en el resto del catálogo.

## Data model

Interfaz genérica de motor de juego, en `lib/games/types.ts`:

```ts
export interface GameEngineCallbacks {
    onScoreChange: (score: number) => void;
    onLivesChange: (lives: number) => void;
    onLevelChange: (level: number) => void;
    onGameOver: (finalScore: number) => void;
}

export interface GameEngineHandle {
    pause: () => void;
    resume: () => void;
    restart: () => void;
    destroy: () => void;
}

export type GameEngineFactory = (canvas: HTMLCanvasElement, callbacks: GameEngineCallbacks) => GameEngineHandle;
```

Registry en `lib/games/registry.ts`, mapa id → motor:

```ts
export const GAME_ENGINES: Record<string, GameEngineFactory> = {
    asteroides: createAsteroidsEngine,
};
```

`lib/games/asteroids/engine.ts` exporta `createAsteroidsEngine: GameEngineFactory`. Todo el estado del juego (nave, balas, asteroides, partículas, power-ups, score/lives/level, loop de `requestAnimationFrame`) vive en variables locales dentro del closure que crea cada llamada — nada a nivel de módulo — para evitar fugas entre mounts/unmounts.

Nueva entrada en `lib/data.ts` (reemplaza a `"rocas"`, mismo copy/cover/color/stats):

```ts
{
  id: "asteroides",
  title: "ASTEROIDES",
  short: "Pulveriza asteroides en gravedad cero.",
  long: "Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.",
  cat: "SHOOTER",
  cover: "cover-rocas",
  color: "yellow",
  best: 41200,
  plays: "15.6K",
},
```

Conventions:

- Coordenadas y física internas del motor: idénticas al original (canvas lógico 800×600, velocidades en px/s, `dt` en segundos capado a 50ms).
- El motor nunca lee ni escribe `window`/`document` fuera del `canvas` recibido, salvo los listeners de teclado (`window.addEventListener('keydown'/'keyup')`), que se registran en `mount` y se remueven en `destroy`.

## Implementation plan

1. Crear `lib/games/types.ts` con `GameEngineCallbacks`, `GameEngineHandle` y `GameEngineFactory`. Solo tipos, sin efecto en runtime.
2. Portar el motor a `lib/games/asteroids/engine.ts` exportando `createAsteroidsEngine: GameEngineFactory`: mismas clases y loop del `game.js` original, pero encapsuladas dentro del closure de la función (sin estado a nivel de módulo), disparando `onScoreChange`/`onLivesChange`/`onLevelChange`/`onGameOver` en los mismos puntos donde el original mutaba `score`/`lives`/`level`/entraba a `'gameover'`. Se quita el dibujo del overlay "GAME OVER" en canvas y el reinicio automático por Espacio en ese estado (el reinicio pasa a ser solo `handle.restart()`). Verificación: el módulo compila con TypeScript en modo `strict`; aún no está conectado a ninguna pantalla.
3. Crear `lib/games/registry.ts` con `GAME_ENGINES: Record<string, GameEngineFactory> = { asteroides: createAsteroidsEngine }`.
4. Modificar `components/game-player.tsx`: si `GAME_ENGINES[game.id]` existe, renderizar un `<canvas>`, montar el motor en un `useEffect`, conectar sus callbacks al estado de React (`score`, `lives`, `level`, `over`) y cablear pausa (`handle.pause()`/`resume()`), reinicio (`handle.restart()` en "JUGAR DE NUEVO") y limpieza (`handle.destroy()` al desmontar o salir). Si no existe motor para ese id, se conserva el placeholder mock actual sin ningún cambio.
5. Ajustar estilos para que el `<canvas>` llene `.crt-screen` (100% ancho/alto, `display:block`) cuando se usa el motor real, sustituyendo ahí al `.game-arena` decorativo.
6. Reemplazar en `lib/data.ts` la entrada `"rocas"` por `"asteroides"` (mismo copy/cover/color/stats, según la sección de datos) y actualizar la referencia `game: "Rocas"` en `RECENT_ACTIVITY` a `"Asteroides"`.
7. Verificación manual (y/o con Playwright) del flujo completo en `/juegos/asteroides/jugar`: movimiento/disparo/colisiones/power-up/vidas/niveles, pausa, game over → modal → guardar puntaje → reiniciar; y confirmar que las otras 7 fichas siguen mostrando el placeholder mock sin cambios.

## Acceptance criteria

- [ ] La ruta `/juegos/asteroides` muestra la ficha "ASTEROIDES" con el copy/cover/color/stats heredados de "rocas".
- [ ] La entrada `"rocas"` ya no existe en `lib/data.ts` ni en el catálogo.
- [ ] En `/juegos/asteroides/jugar` se renderiza un `<canvas>` con el motor real de Asteroids (nave, asteroides y disparo funcionando con teclado).
- [ ] Las flechas izquierda/derecha rotan la nave, la flecha arriba propulsa y espacio dispara.
- [ ] El HUD de puntuación, vidas y nivel refleja los valores reales emitidos por el motor (no el timer aleatorio anterior).
- [ ] Al destruir un asteroide, el puntaje sube según su tamaño (20/50/100 como en el original) y, si corresponde, se divide en fragmentos más chicos.
- [ ] Clic en "PAUSA" detiene el juego por completo y clic en "REANUDAR" lo retoma sin saltos bruscos de física.
- [ ] Al perder las 3 vidas aparece el modal "FIN DEL JUEGO" de React con el puntaje final correcto, y no se ve el overlay "GAME OVER" dibujado en el canvas.
- [ ] Presionar Espacio mientras el modal de game over está abierto no reinicia el juego por sí solo.
- [ ] Clic en "JUGAR DE NUEVO" reinicia el motor (score/lives/level vuelven a su estado inicial) y el juego vuelve a ser jugable.
- [ ] Guardar el puntaje desde el modal invoca `saveScore` igual que hoy, sin cambios en `session-provider`.
- [ ] Salir del reproductor (botón "SALIR" o navegación) detiene el loop del motor y remueve los listeners de teclado, sin errores en consola.
- [ ] El resto de las fichas del catálogo (Bloque Buster, Caída, Serpentina, Glotón, Invasores, Ranaria, Duelo Píxel) siguen mostrando el placeholder mock actual, sin cambios visuales ni de comportamiento.
- [ ] `npm run lint` y `next build` pasan sin errores nuevos.

## Decisions

- **Yes:** crear id nuevo `"asteroides"` para el juego real, en vez de reusar `"rocas"`. Deja claro que es una implementación distinta del mock previo.
- **No:** mantener `"rocas"` en paralelo a un id nuevo. Habría dos fichas casi idénticas de asteroides en la grilla — se quitó `"rocas"` para no duplicar tema.
- **Yes:** registry genérico de motores (`GameEngineFactory`) desde ahora, aunque hoy solo haya un motor real. Tetris y Arkanoid ya están en `references/started-games` esperando spec propia, y el costo de la interfaz es bajo.
- **No:** hardcodear el motor de Asteroids con un `if (game.id === 'asteroides')` directo en `GamePlayer`. No escala limpio cuando llegue el segundo motor real.
- **Yes:** portar `game.js` a TypeScript estricto, encapsulado en un closure por cada `mount`. El proyecto es TS estricto y el original no es reentrante (variables de módulo top-level, se auto-inicia al cargar el script).
- **No:** cargar `game.js` original tal cual vía `<script>`/iframe. Rompe las convenciones TS del repo y complica limpiar listeners al pausar/desmontar desde React.
- **Yes:** solo el modal de React en game over, suprimiendo el overlay nativo del canvas y el reinicio interno por Espacio. Evita dos "game over" superpuestos y dos caminos de reinicio.
- **No:** mostrar ambos overlays (canvas + modal). Redundante y visualmente ruidoso.
- **Yes:** canvas escalado por CSS al 100% de `.crt-screen` (ya 4:3), resolución interna 800×600 intacta. Cero cambios en la lógica de coordenadas del motor.
- **No:** resize dinámico real del canvas recalculando `W`/`H`. Amplía el alcance sin necesidad — el contenedor ya calza en esa proporción.
- **Yes:** controles solo de teclado; lo táctil queda fuera de esta spec. El motor fuente no soporta táctil y agregarlo (botones on-screen, hit-testing) es trabajo aparte.
- **No:** agregar controles táctiles ahora solo para no dejar "roto" el tag "TÁCTIL" de la ficha. Se prefiere una spec dedicada.
- **Yes:** `GamePlayer` cae al placeholder mock actual para cualquier id sin motor real. No se tocan ni se bloquean las otras 7 fichas por no tener motor todavía.
- **No:** deshabilitar o forzar un estado distinto para juegos sin motor real. No fue pedido y rompería las fichas existentes.

## Risks

| Risk                                                                                                                               | Mitigation                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Strict Mode (dev) monta/desmonta efectos dos veces al arrancar                                                               | `destroy()` debe cancelar el `requestAnimationFrame` y remover los listeners de forma idempotente; verificar manualmente que no queden dos loops corriendo en paralelo.                                                      |
| Los listeners de teclado están en `window` y capturan Espacio/flechas aunque el foco esté en el input de "TUS INICIALES" del modal | El motor solo debe reaccionar a esas teclas mientras está en estado `playing`/`dead` (no en `gameover`), y el modal ya aparece recién al llegar a `gameover` — verificar que escribir el nombre no mueva la nave ni dispare. |
| `<canvas>` accede a APIs de navegador (`getContext`, `requestAnimationFrame`) que no existen en SSR                                | `GamePlayer` y el motor se usan solo dentro de `"use client"`, y el `mount()` se llama desde un `useEffect` (nunca durante el render del servidor).                                                                          |
| Cancelar y reanudar el loop sin resetear el reloj interno puede producir un salto grande de `dt` al despausar                      | Al implementar `resume()`, reiniciar la referencia de `lastTime` a `null` para que el primer frame post-pausa use `dt = 0`, igual que al arrancar.                                                                           |
| `RECENT_ACTIVITY` en `lib/data.ts` referencia `game: "Rocas"` en el feed de actividad del Home                                     | Actualizar esa entrada a `"Asteroides"` como parte del mismo paso que reemplaza la ficha en `GAMES` (paso 6 del plan).                                                                                                       |

## What is **not** in this spec

- Controles táctiles/on-screen para móvil.
- Persistencia de puntajes reales en Supabase.
- Portar Tetris o Arkanoid al registry de motores.
- Sonido/efectos de audio.
- Cambios al resto del catálogo mock (7 fichas restantes).
- Sincronizar el campo `best` con puntajes reales.

Cada uno de estos, si se aborda, va en su propia spec.
