# TODO de sugerencias de juegos — game-planner

Lista viva que mantiene el agente `game-planner`. Cada sugerencia es un ítem de checklist;
se marca `[x]` cuando el juego correspondiente ya tiene motor real portado (ver
`lib/games/registry.ts` y `specs/`). No editar manualmente el formato salvo para corregir errores.

## Pendientes

### ALTA PRIORIDAD (1-7)

- [ ] 2026-08-12 — `bloque-buster` (carpeta `04-arkanoid`): **#1 PRIORIDAD MÁXIMA.** Cubre categoría ARCADE (0/4 juegos con motor). Carpeta completa con motor maduro (3 specs implementadas: MVP, animaciones explosión, sonidos + 5 niveles), sprites profesionales, sonidos y selector de nivel. Complejidad media-baja (comparable a Asteroids). Aporta variedad visual espectacular con sprites vs. motores actuales más minimalistas. Esfuerzo: **BAJO** (assets listos).
- [ ] 2026-08-12 — `duelo-pixel`: **#2 Cubrir VERSUS.** Única categoría (1/1 juegos) completamente sin motor real. Mecánica Pong-like simple: 2 palas, pelota, rebotes, puntuación. Sin carpeta (requiere Camino B). Esfuerzo: **BAJO** (motor muy simple, formas geométricas). Menor variedad visual vs. Arkanoid pero llena hueco categórico importante.
- [ ] 2026-08-12 — `serpentina`: **#3 ARCADE simple.** Snake clásico: serpiente crece al comer, game over al chocar. Sin carpeta (Camino B). Esfuerzo: **BAJO** (mecánica sencilla, grid-based). Aporta mecánica única (crecimiento + colisión propia) distinta de Arkanoid.
- [ ] 2026-08-12 — `invasores`: **#4 Variedad SHOOTER.** Space Invaders clásico: oleadas descienden, nave dispara hacia arriba. Sin carpeta (Camino B). Esfuerzo: **MEDIO** (patrón de movimiento de enemigos, múltiples filas). Complementa Asteroids (más estructurado vs. caótico).
- [ ] 2026-08-12 — `gloton`: **#5 ARCADE icónico.** Pac-Man: laberinto, puntos, fantasmas con IA. Sin carpeta (Camino B). Esfuerzo: **ALTO** (IA de fantasmas, pathfinding, laberinto). Valor alto por reconocimiento cultural pero complejidad significativa.
- [ ] 2026-08-12 — `ranaria`: **#6 ARCADE único.** Frogger: rana cruza carretera/río esquivando obstáculos. Sin carpeta (Camino B). Esfuerzo: **MEDIO** (múltiples carriles con velocidades distintas). Mecánica distintiva (timing + posicionamiento).
- [ ] 2026-08-12 — `batalla-tanques`: **#7 VERSUS táctico.** Combat-like: 2 tanques, obstáculos, disparos. Sin carpeta (Camino B). Esfuerzo: **MEDIO** (física de tanque, colisiones con mapa). Aporta VERSUS más táctico vs. Pong reactivo.

### MEDIA PRIORIDAD (8-15)

- [ ] 2026-08-12 — `defensa-laser`: Missile Command: defender ciudades de misiles cayendo. SHOOTER. Sin carpeta (Camino B). Esfuerzo: **MEDIO**. Mecánica única (click to target).
- [ ] 2026-08-12 — `bloques-columnas`: Columns (Sega): 3 bloques caen, alinear 3+ del mismo color. PUZZLE. Sin carpeta (Camino B). Esfuerzo: **MEDIO**. Variedad vs. Tetris (color match vs. formas).
- [ ] 2026-08-12 — `carrera-vertical`: Vertical scrolling racer: esquivar obstáculos, velocidad creciente. ARCADE. Sin carpeta (Camino B). Esfuerzo: **BAJO**. Simple pero adictivo.
- [ ] 2026-08-12 — `conecta-cuatro`: Connect 4: tablero vertical, alinear 4 fichas. VERSUS. Sin carpeta (Camino B). Esfuerzo: **BAJO** (turnos, no tiempo real). Estratégico vs. reflejos.
- [ ] 2026-08-12 — `galaga-clon`: Galaga-like: formación enemiga, dive attacks. SHOOTER. Sin carpeta (Camino B). Esfuerzo: **MEDIO-ALTO** (patrones de ataque, formación).
- [ ] 2026-08-12 — `buscaminas`: Minesweeper clásico: revelar casillas sin tocar minas. PUZZLE. Sin carpeta (Camino B). Esfuerzo: **BAJO-MEDIO** (lógica de adyacencia). Mecánica única (lógica deductiva).
- [ ] 2026-08-12 — `hockey-aire`: Air Hockey: 2 palas, disco, rebotes en bordes. VERSUS. Sin carpeta (Camino B). Esfuerzo: **BAJO-MEDIO** (física de rebotes). Similar a Pong pero con física más rica.
- [ ] 2026-08-12 — `rompe-ladrillos-dx`: Breakout variante con power-ups (pelota rápida, multi-bola, paddle ancho). ARCADE. Sin carpeta (Camino B). Esfuerzo: **MEDIO** (extensión de Arkanoid). Complementa bloque-buster con mecánicas extra.

### BAJA PRIORIDAD (16-20)

- [ ] 2026-08-12 — `laberinto-hunt`: Pac-Man maze runner sin fantasmas IA (solo recolectar). ARCADE. Sin carpeta (Camino B). Esfuerzo: **BAJO** (Pac-Man simplificado). Menor valor vs. gloton completo.
- [ ] 2026-08-12 — `puzzle-deslizante`: Sliding puzzle 3×3 o 4×4. PUZZLE. Sin carpeta (Camino B). Esfuerzo: **BAJO**. Nicho (no arcade tradicional).
- [ ] 2026-08-12 — `tiro-al-platillo`: Duck Hunt-like: patos cruzan pantalla, click to shoot. SHOOTER. Sin carpeta (Camino B). Esfuerzo: **BAJO**. Mecánica simple (timing + click).
- [ ] 2026-08-12 — `pong-circular`: Pong variante: mesa redonda, 4 palas, pelota central. VERSUS. Sin carpeta (Camino B). Esfuerzo: **MEDIO** (física circular). Variación de Pong, menor prioridad.
- [ ] 2026-08-12 — `defensa-torre-mini`: Tower Defense ultra-simplificado: colocar torretas, oleadas. SHOOTER/ARCADE. Sin carpeta (Camino B). Esfuerzo: **ALTO** (pathfinding, múltiples enemigos, colocación). Scope muy grande para MVP arcade.

## Descartados / en curso

- `caida` — Tetris-like mock, reemplazado por `tetris` real (spec 07) con el mismo propósito

## Portados

- [x] `asteroides` — spec `05-asteroids-motor-real` (SHOOTER)
- [x] `tetris` — spec `07-tetris-motor-real` (PUZZLE)

---

## Resumen de balance categórico

| Categoría | Motores portados | Juegos en pendientes | Total propuesto |
| --------- | ---------------- | -------------------- | --------------- |
| ARCADE    | 0                | 8                    | 8               |
| VERSUS    | 0                | 5                    | 5               |
| PUZZLE    | 1 (tetris)       | 3                    | 4               |
| SHOOTER   | 1 (asteroides)   | 3                    | 4               |

**Nota:** El catálogo real en Supabase (`games`) puede diferir de esta lista si se modificó sin pasar por specs. Esta recomendación se basa en `specs/06-leaderboards-supabase.md` (última spec que documenta el catálogo) + `lib/games/registry.ts` + `references/started-games/`.
