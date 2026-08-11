---
name: port-game
description: Genera una spec en estado Draft para dar de alta un juego nuevo en Arcade Vault (motor TypeScript real + leaderboard real en Supabase), a partir de una carpeta en references/started-games/ o de un juego original. No escribe código ni toca Supabase — solo produce el .md de la spec.
disable-model-invocation: true
argument-hint: <carpeta-en-started-games-o-nombre-del-juego-nuevo>
---

# /port-game — Generador de specs para dar de alta un juego nuevo

Esta skill ayuda a producir una spec lista para el flujo `/spec` → `Draft` → `Approved` →
`/spec-impl` del repo, especializada en el caso recurrente de "portar o diseñar un juego
nuevo con motor real y leaderboard real en Supabase". **No escribís código acá.** Tu trabajo
es reunir contexto (de una carpeta de referencia, si existe, o de las respuestas del
usuario), hacer las preguntas específicas del juego, y desarrollar la spec sección por
sección hasta guardarla en `specs/`.

## Filosofía

El patrón completo ya se resolvió dos veces (spec 05: motor enchufable; spec 06: leaderboard
en Supabase). Repetir ese análisis desde cero por cada juego nuevo es desperdiciar el
trabajo ya hecho. Esta skill existe para que el "Data model" y el "Implementation plan" de
cada spec nueva partan de ese patrón ya validado, y las preguntas se concentren en lo que
realmente varía de un juego a otro.

Lee `game-engine-contract.md` (en la misma carpeta que esta skill) antes de escribir
cualquier sección técnica — ahí está el contrato completo de motor, los casos especiales
conocidos (juegos sin vidas, HUD propio, assets binarios) y el checklist de alta en
Supabase. No dupliques ese contenido en la spec; referencialo y llena solo las variables
del juego concreto.

## Reglas duras

- **Nunca escribas código real ni edites archivos de `lib/games/`, `app/`, `components/` o
  `public/`.** El único artefacto que produce esta skill es el `.md` de la spec en `specs/`.
- **Nunca ejecutes una escritura en Supabase** (`mcp__supabase__apply_migration`, o
  `execute_sql` con `INSERT`/`UPDATE`/`DELETE`). Las únicas llamadas permitidas a Supabase
  son de solo lectura (`list_tables`, `execute_sql` con `SELECT`, `get_advisors`), y sirven
  únicamente para detectar colisiones de `id`/`cover` o mocks temáticamente equivalentes.
- **Una invocación = una spec = un juego.** Si el usuario pide portar dos juegos a la vez,
  recordale que cada uno necesita su propia spec y ofrecé correr la skill de nuevo para el
  segundo.
- **No reabras la decisión ya tomada** de que motor + alta en Supabase van en una sola spec
  combinada (a diferencia del caso histórico de Asteroids, que fue spec 05 + spec 06
  separadas — ya no hace falta separarlas porque el alta en Supabase quedó genérica).
- **Nunca asumas un valor sin confirmación explícita del usuario**, aunque la carpeta de
  referencia lo sugiera con fuerza (id, resolución del canvas, si se portan assets, etc.).
  Presentalo como propuesta a confirmar, no como hecho consumado.
- Tus respuestas van en el mismo idioma del prompt inicial. Por defecto, en este repo, en
  español.

## Command flow

### Fase 0 — Contexto

Antes de identificar el juego, reuní el contexto del repo:

1. Leé el archivo de memoria del proyecto, en orden, deteniéndote en el primer hit:
   `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `README.md`.
2. Listá `specs/` para saber el próximo número secuencial disponible.
3. Leé completas `specs/05-asteroids-motor-real.md` y `specs/06-leaderboards-supabase.md`
   — no te quedes con un resumen. Son la calibración de nivel de detalle, extensión de
   Scope/Decisions/Risks y formato de verificación por paso que la spec nueva debe igualar.
4. Leé `.claude/skills/spec/template.md` (estructura de secciones) y
   `.claude/skills/port-game/game-engine-contract.md` (contrato técnico de esta skill).
5. Listá `references/started-games/` y compará contra las carpetas ya existentes en
   `lib/games/` (hoy solo `asteroids/`) para saber qué juegos quedan por portar.
6. Hacé una lectura de solo verificación en Supabase (`mcp__supabase__list_tables` o
   `execute_sql` con `SELECT id, title, cat, color, cover FROM games`) para tener la lista
   real de `id`/`cover` ya usados y detectar mocks temáticamente equivalentes al juego que
   se va a dar de alta. Recordá la regla dura: esta lectura nunca escribe nada.

### Fase 1 — Identificar el origen

El argumento recibido es `$ARGUMENTS`.

**Camino A — hay carpeta de referencia:**

- Si `$ARGUMENTS` matchea (exacto o parcial, sin distinguir mayúsculas) una carpeta bajo
  `references/started-games/` (ej. `tetris`, `03-tetris`, `arkanoid`), confirmá cuál es y
  leé:
    - Su `README`/`CLAUDE.md` si existe (suelen documentar mecánica, controles y arquitectura).
    - `index.html` (canvas, resolución, ids de DOM, overlays/HUD propio fuera del canvas).
    - `game.js` (constantes ajustables, estructura del estado, loop, clases, si carga assets
      vía `new Audio()`/`new Image()`).
    - `style.css`, si existe.
    - El directorio `assets/`, si existe (alcanza con listar el contenido, no hace falta leer
      binarios).
    - Si esa carpeta tiene su propia `specs/` interna (proyecto standalone), es solo contexto
      adicional de mecánica — nunca la cites ni la copies en la spec de Arcade Vault.
- Si la carpeta indicada ya tiene motor portado (hoy: `02-asteroids` → `lib/games/asteroids/`),
  avisá que ya existe motor y specs (05/06) para ese juego, y preguntá si de verdad se quiere
  continuar (caso raro: rehacer o ampliar) antes de seguir.
- Si `$ARGUMENTS` no matchea ninguna carpeta, pasá al Camino B.

**Camino B — juego original, sin carpeta:**

- No hay nada que leer del filesystem. Saltá directo al Bloque A de la Fase 2 preguntando la
  mecánica desde cero.

En ambos caminos, con los resultados de la Fase 0 ya en mano, marcá si el tema del juego
(por título o nombre de carpeta) coincide con un `id` mock ya sembrado en `games` — hoy
`caida` (temática Tetris/piezas que caen) y `bloque-buster` (temática Arkanoid/breakout) son
los dos casos conocidos. Esa coincidencia dispara el Bloque E de la Fase 2.

### Fase 2 — Preguntas en bloques de 3 a 5

Mismo estilo que `/spec`: preguntás en bloques, no una por una, esperás respuesta antes de
seguir, y cuando ofrecés opciones marcás cuál es tu recomendación y por qué.

**Diferencia clave con `/spec`:** cuando hay carpeta de referencia, cada pregunta se
presenta con el valor inferido como propuesta a confirmar o corregir, no como pregunta
abierta ("Entiendo que el original usa canvas de 240×400 con piezas de 20px, ¿mantenemos esa
resolución?"). Sin carpeta, se pregunta desde cero.

Bloques (los marcados como condicionales solo aplican si la Fase 0/1 los disparó):

- **Bloque A — Mecánica y controles.** Con carpeta: resumen inferido de `game.js`/`index.html`
  a confirmar. Sin carpeta: preguntar qué tipo de juego es, objetivo, condición de derrota,
  condición de progreso de nivel, y esquema de controles (recordando que el contrato solo
  soporta teclado vía listeners en `window`).
- **Bloque B — Resolución y contrato del canvas.** Proponer o preguntar la resolución interna
  (recomendación por defecto: reusar 800×600 como Asteroids, para encajar directo en
  `.crt-screen` 4:3 sin tocar CSS). Si el original usa **más de un** `<canvas>` o elementos
  DOM propios de HUD, marcarlo para resolver en el Bloque D.
- **Bloque C — Identidad de catálogo.** `id` (slug; advertir si coincide con un mock — ver
  Bloque E), `title`, `short`, `long` (copy en español, mismo tono que el resto del
  catálogo), `cat` (`ARCADE`/`PUZZLE`/`SHOOTER`/`VERSUS`), `color` (`cyan`/`magenta`/`green`/
  `yellow`), `cover` (clase CSS existente a reusar o nueva a crear), `plays` inicial (string
  estático tipo `"1.2K"`).
- **Bloque D — Mapeo de HUD/callbacks.** ¿Tiene vidas reales? Si no (como Tetris), resolver
  con el usuario cuál de las 3 opciones de `game-engine-contract.md` §4 aplica. ¿Tiene
  niveles reales que deban emitir `onLevelChange`? Si el original tiene HUD/canvas
  secundario propio (detectado en Bloque B), resolver acá qué se dibuja dentro del único
  `<canvas>` del contrato y qué lo reemplaza el HUD real de React.
- **Bloque E — condicional, solo si la Fase 1 detectó un id mock temáticamente equivalente.**
  ¿Reusar el id mock existente o crear uno nuevo y retirar la fila mock (patrón
  `rocas`→`asteroides` de la spec 05)? Recomendación por defecto: seguir el precedente (id
  nuevo, retirar el mock), salvo que el usuario prefiera continuidad de URL/estadísticas.
- **Bloque F — condicional, solo si la carpeta de referencia trae `assets/` con imágenes o
  audio.** ¿Portar los assets reales o simplificar a formas vectoriales dibujadas en canvas
  (como Asteroids)? Si se portan: confirmar la convención `public/games/<id>/...` y que la
  carga ocurre dentro del closure del motor, nunca a nivel de módulo. Si hay audio, decidir
  explícitamente si entra en el alcance de esta spec.
- **Bloque G — nombre técnico del motor.** Carpeta `lib/games/<carpeta-motor>/engine.ts`
  (libre, en inglés por convención existente — puede diferir del `id` de catálogo en
  español, como `asteroids`/`asteroides`) y nombre de la factory `create<Nombre>Engine`.

**Cuándo dejar de preguntar:** cuando puedas responder sin asumir nada (1) qué archivos van
a aparecer o cambiar, (2) cuál es el primer y el último paso ejecutable, (3) cómo se verifica
que la spec quedó completa, y (4) qué `id` exacto va a la tabla `games` y si colisiona con
algo existente. Si falta alguno, seguí preguntando.

### Fase 3 — Construcción de la spec sección por sección

Igual que `/spec` Fase 3: una sección a la vez, mostrada en markdown, con la pregunta
"¿Esta sección queda así o querés ajustar algo?" antes de pasar a la siguiente. No generes
la spec completa de una sola vez.

Orden y contenido esperado (estructura de `.claude/skills/spec/template.md`):

1. **Header** — `Status: Draft`. `Depends on`: normalmente `04-supabase-setup-base`; si el
   `id` colisiona con un mock existente, agregar también la spec que lo sembró (hoy: `06`).
   Objetivo en una sola frase.
2. **Scope** — In: portar o diseñar `lib/games/<carpeta-motor>/engine.ts`, registrar en
   `lib/games/registry.ts`, alta (o reemplazo) de la fila en `games` vía migración, y —solo
   si es el primer motor real después de Asteroids— el paso de renombrar
   `.asteroids-canvas` → `.game-canvas`. Out: calcar como base las exclusiones estándar de
   `game-engine-contract.md` (controles táctiles, sonido si no se decidió explícitamente
   incluirlo, edición/borrado de scores) y ajustar solo si el usuario pidió incluir algo.
3. **Data model** — Referenciar los tipos ya existentes de `lib/games/types.ts` (no
   reinventarlos: "reutiliza la interfaz ya existente, sin cambios"), la fila nueva/actualizada
   de `games` con columnas reales, y las decisiones concretas de los Bloques D/E/F/G.
   Usar como base los fragmentos de `game-engine-contract.md` §6.
4. **Implementation plan** — Pasos numerados calcando la forma de la spec 05: tipos →
   motor → registry → ajustes en `game-player.tsx`/CSS si aplica → alta en Supabase vía
   migración (casi el mismo texto en cualquier spec, ver `game-engine-contract.md` §5) →
   verificación manual/Playwright del flujo completo.
5. **Acceptance criteria** — Checklist booleano, calcando el estilo de la spec 05: por
   control, por evento del motor (score/vidas/nivel/game over), por persistencia real del
   score, y por lo resuelto en cada bloque condicional que haya aplicado.
6. **Decisions** — Obligatorio documentar explícitamente lo resuelto en los Bloques D/E/F/G
   (formato Sí/No + razón, igual que las specs 05/06) — son las decisiones que más se van a
   revisitar.
7. **Risks** — Solo si aplica. Base: los riesgos genéricos ya identificados en la spec 05
   (Strict Mode doble mount, SSR/canvas, salto de `dt` tras pausa) más los específicos del
   juego si los hay (ej. tiempo de carga de assets antes del primer frame).

### Fase 4 — Guardar

1. Determiná el próximo número secuencial mirando `specs/` (de la Fase 0).
2. Generá un slug corto a partir del objetivo.
3. Confirmá el nombre de archivo propuesto con el usuario antes de escribirlo.
4. Creá el archivo en `specs/NN-slug.md` con todas las secciones aprobadas y `Status: Draft`.
5. No toques `specs/.spec-config.yml` — ya existe en este repo, se deja intacto.
6. Confirmá al usuario:
    - Ruta del archivo creado.
    - Recordatorio: la spec está en `Draft`. Cambiala a `Approved` una vez que la releas.
    - Próximo paso: `/spec-impl NN-slug` para implementarla.
    - **Detenete acá.** No propongas implementar la spec vos mismo ni tocar código.

## Resumen de comportamiento esperado

```
/port-game 03-tetris

  Fase 0  →  Lee CLAUDE.md, specs/05 y specs/06, template.md, game-engine-contract.md,
             lista references/started-games/ vs lib/games/, detecta el mock "caida" en games
  Fase 1  →  Camino A: lee references/started-games/03-tetris (game.js, index.html, README)
  Fase 2  →  Bloques A-D siempre; Bloque E se dispara por el mock "caida"; Bloque D marca
             que Tetris no tiene vidas; Bloque F no se dispara (Tetris no trae assets binarios)
  Fase 3  →  Header, Scope, Data model, Implementation plan, Acceptance criteria, Decisions,
             Risks — uno por uno, con confirmación
  Fase 4  →  Guarda specs/07-....md en estado Draft, recuerda aprobarla y correr /spec-impl

/port-game (juego original, sin carpeta)

  Fase 0  →  Igual que arriba
  Fase 1  →  Camino B: no hay nada que leer, se salta directo a preguntar
  Fase 2  →  Bloque A pregunta la mecánica desde cero; Bloques E/F normalmente no se disparan
  Fase 3-4 →  Igual que arriba
```
