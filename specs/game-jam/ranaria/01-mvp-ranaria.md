# SPEC game-jam/ranaria/01 — Motor MVP de Frogger (Ranaria)

> **Status:** Draft
> **Depends on:** 04-supabase-setup-base
> **Date:** 2026-08-12
> **Objective:** Portar la mecánica clásica de Frogger a un motor TypeScript enchufable con carretera, río, metas y sistema de vidas.

## Scope

**In:**

- Motor TypeScript en `lib/games/frogger/engine.ts` exportando `createFroggerEngine: GameEngineFactory`
- Rana que se mueve en grid (14 columnas × 13 filas en canvas 800×600)
- Controles de teclado: flechas arriba/abajo/izquierda/derecha mueven la rana un salto por tecla
- Zona inferior segura (1 fila de pasto)
- Zona de carretera (5 filas) con carriles de autos moviéndose horizontalmente a velocidades distintas
- Zona intermedia segura (1 fila de pasto)
- Zona de río (5 filas) con troncos/plataformas moviéndose horizontalmente
- Zona de metas (1 fila superior) con 5 casillas objetivo
- Colisión con auto = muerte, reinicio desde posición inicial
- Estar en el río sin estar sobre tronco = muerte
- Salir de los bordes laterales del canvas = muerte
- Llegar a una meta vacía: marca la meta como ocupada, rana vuelve al inicio, +50 puntos
- Completar las 5 metas: siguiente nivel (metas se resetean, velocidad aumenta ligeramente)
- Sistema de vidas (3 iniciales)
- Puntuación básica: +10 por cada fila avanzada hacia adelante (solo la primera vez), +50 por llegar a meta
- Alta de juego `ranaria` en tabla `games` vía migración
- Registro en `GAME_ENGINES`
- Verificación manual del flujo completo en `/juegos/ranaria/jugar`

**Out of scope (para specs futuras):**

- Tiempo límite por intento con bonus por tiempo restante (spec 03)
- Animaciones de salto con arco/hop effect (spec 02)
- Partículas al morir o efectos visuales avanzados (spec 02)
- Efectos de sonido (no hay assets de audio disponibles)
- Power-ups (moscas bonus, tiempo extra) (spec 03)
- Obstáculos avanzados (tortugas que se sumergen, cocodrilos que comen) (spec 03)
- Controles táctiles/on-screen para móvil
- Sincronización del campo `best` con puntajes reales

## Data model

Reutiliza la interfaz ya existente de `lib/games/types.ts` (`GameEngineCallbacks`, `GameEngineHandle`, `GameEngineFactory`), sin cambios.

`lib/games/frogger/engine.ts` exporta `createFroggerEngine: GameEngineFactory`. Todo el estado del juego vive en variables locales dentro del closure de la factory:

```typescript
// dentro del closure de createFroggerEngine
let frog: { x: number; y: number }; // posición en grid (0-13 columnas, 0-12 filas)
let cars: Array<{ lane: number; x: number; speed: number; width: number }>; // obstáculos de carretera
let logs: Array<{ lane: number; x: number; speed: number; width: number }>; // plataformas de río
let goals: boolean[]; // 5 metas (true = ocupada)
let score: number;
let lives: number;
let level: number;
let maxRowReached: number; // para otorgar puntos solo la primera vez que avanza
let lastTime: number | null;
let rafId: number | null;
let running: boolean;
```

Alta en tabla `games`:

```sql
insert into public.games (id, title, short, long, cat, cover, color, plays)
values (
  'ranaria',
  'RANARIA',
  'Cruza sin que te aplasten. Sin que te ahogues.',
  'Tu rana debe cruzar carreteras con tráfico implacable y ríos traicioneros. Salta sobre troncos flotantes, esquiva autos y alcanza las 5 metas antes de que sea tarde. Un error y vuelves al inicio.',
  'ARCADE',
  'cover-frog',
  'green',
  '18.2K'
);
```

Conventions:

- Grid lógico: 14 columnas × 13 filas
    - Fila 0 (inferior): zona segura de inicio
    - Filas 1-5: carretera (5 carriles)
    - Fila 6: zona segura intermedia
    - Filas 7-11: río (5 carriles)
    - Fila 12 (superior): metas (5 casillas objetivo en x = 1, 3, 5, 7, 9, 11)
- Canvas: 800×600px (igual que Asteroids/Tetris)
- Tamaño de celda: ~57px horizontal × ~46px vertical
- Coordenadas en unidades de grid (0-13 en x, 0-12 en y)
- Rana inicial: centro inferior (x=7, y=0)
- Carriles de carretera: movimiento horizontal continuo, velocidades distintas (50-120 px/s según carril)
- Carriles de río: movimiento horizontal continuo, velocidades distintas (40-100 px/s según carril)
- La rana se mueve sobre troncos: su posición x se ajusta por la velocidad del tronco que la soporta

## Implementation plan

1. Crear `lib/games/frogger/engine.ts` exportando `createFroggerEngine: GameEngineFactory`: implementar grid 14×13, rana con movimiento discreto (un salto por tecla presionada, no hold), 5 carriles de carretera con autos moviéndose horizontal a velocidades distintas, 5 carriles de río con troncos, detección de colisión con autos, detección de caída al agua (no estar sobre tronco), 5 metas en fila superior. Disparar `onScoreChange`/`onLivesChange`/`onLevelChange`/`onGameOver` en los puntos apropiados. Verificación: el módulo compila con TypeScript en modo strict.

2. Implementar controles de teclado: listeners de `keydown` para flechas que mueven la rana un salto discreto en la dirección correspondiente (arriba: y++, abajo: y--, izquierda: x--, derecha: x++), con validación de bordes (no salir de 0-13 en x, 0-12 en y). No permitir movimiento continuo por hold — solo un salto por keydown. Verificación: presionar flechas mueve la rana exactamente una celda.

3. Implementar carriles de carretera: array de autos con `lane` (fila 1-5), posición `x` (en píxeles, no grid), `speed` (px/s, alternar dirección según carril) y `width` (en celdas). Loop de `requestAnimationFrame` actualiza posición de cada auto; cuando sale del canvas por un lado, reaparece por el otro (wrap). Verificación: autos se mueven continuamente en sus carriles.

4. Implementar detección de colisión con autos: en cada frame, si la rana está en filas 1-5 (carretera) y su bounding box de grid intersecta con algún auto, decrementar vidas (-1), disparar `onLivesChange`, resetear rana a posición inicial (x=7, y=0) y `maxRowReached=0`. Si `lives` llega a 0, disparar `onGameOver(score)` y detener loop. Verificación: chocar con auto resta vida y reinicia la rana.

5. Implementar carriles de río: array de troncos con `lane` (fila 7-11), posición `x`, `speed` y `width`. Loop actualiza posición igual que autos (wrap en bordes). Si la rana está en filas 7-11, buscar si está sobre algún tronco (bounding box intersecta); si está sobre un tronco, ajustar la posición x de la rana por `tronco.speed * dt` (la rana se mueve con el tronco); si no está sobre ningún tronco, es muerte (caída al agua). Verificación: rana se mueve con troncos, caer al agua mata.

6. Implementar sistema de metas: 5 posiciones fijas en fila 12 (x = 1, 3, 5, 7, 9, 11). Al llegar la rana a y=12, verificar si está en una posición de meta; si sí y esa meta está vacía (`goals[i] === false`), marcarla como ocupada (`goals[i] = true`), sumar +50 al score, resetear rana a inicio. Si las 5 metas están ocupadas, incrementar nivel (+1), resetear metas a vacías, incrementar ligeramente las velocidades de autos/troncos (~10%), disparar `onLevelChange`. Verificación: llegar a meta suma puntos, completar 5 metas sube nivel.

7. Implementar puntuación por avanzar filas: mantener `maxRowReached` (máxima fila y alcanzada en el intento actual). Cada vez que la rana avanza a una fila superior nueva (y > maxRowReached), sumar +10 al score y actualizar `maxRowReached`. Al morir o llegar a meta, resetear `maxRowReached = 0`. Verificación: avanzar suma puntos, retroceder no suma.

8. Registrar en `lib/games/registry.ts`: `ranaria: createFroggerEngine`. Verificación: `GamePlayer` resuelve el motor para `game.id === 'ranaria'`.

9. Migración SQL (`mcp__supabase__apply_migration`): `INSERT` de la fila `ranaria` en `games` con los valores documentados arriba. Verificación: `execute_sql SELECT * FROM games WHERE id = 'ranaria'` devuelve la fila.

10. Verificación manual en `/juegos/ranaria/jugar`: jugar completo (mover, cruzar carretera, subir a troncos, llegar a metas, morir → game over → modal → guardar puntaje → reiniciar). Verificar que otros juegos del catálogo siguen funcionando sin cambios.

## Acceptance criteria

- [ ] La ruta `/juegos/ranaria` muestra la ficha "RANARIA" con el copy/color/stats documentados
- [ ] En `/juegos/ranaria/jugar` se renderiza un `<canvas>` con el motor real de Frogger
- [ ] La rana aparece en la posición inicial (centro inferior) al arrancar
- [ ] Las flechas mueven la rana exactamente una celda por tecla presionada (no hold continuo)
- [ ] Los autos se mueven continuamente en sus carriles de carretera con velocidades distintas
- [ ] Al chocar con un auto, la rana muere, vuelve al inicio y el contador de vidas baja en 1
- [ ] Los troncos se mueven continuamente en sus carriles de río
- [ ] La rana se mueve horizontalmente junto con el tronco sobre el que está parada
- [ ] Si la rana está en el río sin estar sobre un tronco, muere y vuelve al inicio
- [ ] Al llegar a una meta vacía, se marca como ocupada, suma +50 puntos y la rana vuelve al inicio
- [ ] Al completar las 5 metas, el nivel sube y las metas se resetean
- [ ] Avanzar a una fila nueva suma +10 puntos (solo la primera vez en ese intento)
- [ ] El HUD de puntuación, vidas y nivel refleja los valores reales del motor
- [ ] Al perder las 3 vidas aparece el modal "FIN DEL JUEGO" con el puntaje final
- [ ] Clic en "PAUSA" detiene el juego y "REANUDAR" lo retoma
- [ ] Clic en "JUGAR DE NUEVO" reinicia el motor (score/lives/level vuelven a su estado inicial)
- [ ] Guardar puntaje desde el modal invoca `saveScoreAction`
- [ ] Salir del reproductor detiene el loop y remueve listeners, sin errores en consola
- [ ] El resto del catálogo sigue funcionando sin cambios
- [ ] `npm run lint` y `next build` pasan sin errores

## Decisions

- **Sí:** Grid-based movement discreto (un salto por keydown). **No:** Movimiento continuo pixel a pixel — Frogger es inherentemente grid-based con saltos discretos, facilita detección de colisiones y posicionamiento en troncos.
- **Sí:** Grid 14×13 (14 columnas × 13 filas) en canvas 800×600. **No:** Otras resoluciones — mantiene consistencia con Asteroids/Tetris y permite celdas razonablemente cuadradas (~57×46px).
- **Sí:** 5 carriles de carretera + 5 de río (distribución equilibrada). **No:** Más carriles — aumenta complejidad sin necesidad para el MVP.
- **Sí:** Rana se mueve con el tronco que la soporta (ajuste de x por velocidad del tronco). **No:** Rana estática en troncos — no sería fiel a la mecánica original de Frogger.
- **Sí:** 5 metas fijas en posiciones específicas de fila superior. **No:** Metas ocupando toda la fila — el original tiene 5 huecos específicos, no un continuo.
- **Sí:** Puntuación solo por avanzar filas nuevas (+10 primera vez) y llegar a metas (+50). **No:** Puntos por tiempo o distancia recorrida — se reserva para spec de timer/polish.
- **Sí:** Sistema de niveles con velocidad creciente al completar 5 metas. **No:** Niveles con layouts distintos — se deja para spec de polish.
- **Sí:** Canvas escalado por CSS al 100% de `.crt-screen`. **No:** Resize dinámico real — se mantiene la convención establecida por Asteroids y Tetris.
- **Sí:** Controles solo de teclado. **No:** Controles táctiles en el MVP — se deja para spec futura dedicada.
- **Sí:** Solo el modal de React en game over, sin overlay propio del canvas. **No:** Mostrar ambos — evita duplicación y dos caminos de reinicio.
- **Sí:** Pausa real controlada por botón de React (`handle.pause()`/`resume()`). **No:** Shortcut interno de tecla P — evita desincronización de estado.

## Risks

| Risk                                                                                                      | Mitigation                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detección de "estar sobre tronco" puede fallar en bordes si la rana está parcialmente fuera               | Usar bounding box intersection generosa (solapamiento de al menos 50% de la celda de la rana con el tronco)                                                               |
| Rana puede salirse de los bordes laterales del canvas al moverse con un tronco muy rápido                 | Validar posición x de la rana después de ajustarla por velocidad del tronco; si x < 0 o x >= 14, es muerte (caída fuera del mapa)                                         |
| Input buffering: múltiples teclas presionadas rápidamente pueden causar saltos múltiples no intencionales | Implementar cooldown breve (ej. 100-150ms) entre saltos, ignorando inputs de teclado durante ese período                                                                  |
| Pausar/reanudar puede causar salto de tiempo acumulado en movimiento de autos/troncos                     | Al hacer `resume()`, resetear `lastTime = null` para que el primer frame use `dt = 0`                                                                                     |
| React Strict Mode (dev) monta/desmonta efectos dos veces al arrancar                                      | `destroy()` debe cancelar el `requestAnimationFrame` y remover los listeners de forma idempotente; verificar manualmente que no queden dos loops corriendo en paralelo    |
| Validar meta ocupada puede fallar si la rana no está exactamente en una posición de meta                  | Redondear posición x de la rana al grid más cercano antes de comparar con posiciones de metas (x = 1, 3, 5, 7, 9, 11), con tolerancia de ±0.5 celdas por ajuste de tronco |

## What is NOT in this spec

- Tiempo límite por intento con bonus por tiempo restante
- Animaciones de salto con arco/hop effect
- Partículas al morir o efectos visuales avanzados
- Efectos de sonido
- Power-ups (moscas bonus, tiempo extra)
- Obstáculos avanzados (tortugas que se sumergen, cocodrilos)
- Controles táctiles
- Cambios al resto del catálogo

Cada uno de estos, si se aborda, va en su propia spec.
