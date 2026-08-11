# Contrato técnico de motores de juego — referencia para `/port-game`

Este archivo es la referencia que consulta la skill `/port-game` (y quien la lea después)
para calibrar el "Data model" y el "Implementation plan" de una spec de alta de juego.
**No es código a copiar tal cual** — es el contrato que cualquier motor nuevo debe respetar,
extraído y verificado del motor real ya implementado en `lib/games/asteroids/engine.ts`
(specs 05 y 06, ambas `Implemented`).

---

## 1. Tipos del contrato (ya existen, no se reinventan)

`lib/games/types.ts`:

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

`lib/games/registry.ts` — mapa `Partial<Record<string, GameEngineFactory>>` keyed por el `id`
**real de la fila en `games`** (case-sensitive), no por el nombre de carpeta del motor:

```ts
export const GAME_ENGINES: Partial<Record<string, GameEngineFactory>> = {
    asteroides: createAsteroidsEngine,
    // <id-nuevo>: create<Nombre>Engine,
};
```

Una spec de alta de juego siempre agrega **una línea** a este mapa — nunca reescribe el resto.

---

## 2. Reglas duras de implementación de un motor

Archivo: `lib/games/<carpeta-motor>/engine.ts`. La carpeta puede tener un nombre distinto
del `id` de catálogo (ej. carpeta `asteroids`, id real `asteroides`) — son namespaces
independientes, uno técnico (inglés, libre) y otro de producto (slug visible, español).
Factory exportada: `create<Nombre>Engine`.

- **Todo el estado mutable vive en variables locales dentro del closure de la factory.**
  Nada a nivel de módulo — se pierde la garantía de reentrancia entre mounts/unmounts y
  React Strict Mode monta y desmonta dos veces en dev, lo que expondría fugas de inmediato.
- `canvas.getContext('2d')` puede devolver `null`. TypeScript estricto obliga a chequear
  y rebindear a una `const` tipada (`CanvasRenderingContext2D`) antes de usarla en cualquier
  función interna del motor.
- Resolución interna fija seteada en JS al montar (`canvas.width = W; canvas.height = H`).
  El escalado a la pantalla es 100% CSS: el canvas usa la clase `.game-canvas`
  (`position:absolute;inset:0;width:100%;height:100%;display:block`) dentro de `.crt-screen`.
  **Nota de migración:** hoy esa clase se llama `.asteroids-canvas` en `app/globals.css` y
  está hardcodeada así en `components/game-player.tsx`, aunque el componente ya es genérico
  para cualquier motor del registry. La primera spec que porte un segundo motor real debe
  incluir, como paso propio, renombrar esa clase a `.game-canvas` en ambos archivos.
- Cada mutación de score/vidas/nivel pasa por un setter local que también invoca el
  callback correspondiente — nunca mutar sin notificar a React.
- Teclado: listeners en `window` (no en el `canvas`), registrados al crear el handle y
  removidos en `destroy()`. Las funciones deben guardarse como referencias con nombre
  (no anónimas re-declaradas), para poder hacer `removeEventListener` correctamente.
  `preventDefault()` en las teclas usadas, para no scrollear la página.
- Loop de `requestAnimationFrame`: variables locales `rafId`/`lastTime`/`running`.
    - `pause()` cancela el loop de verdad (no solo deja de actualizar el estado).
    - `resume()` reinicia `lastTime = null` para que el primer frame post-pausa use `dt = 0`
      (evita saltos de física).
    - `dt` clamped a un máximo razonable (ej. 50ms) para evitar "tunneling" tras throttling
      de la pestaña en segundo plano.
- Al perder (game over): el motor deja de aceptar input y **no** dibuja su propio overlay
  de "game over" ni reinicia por sí solo con una tecla. Expone `restart()` en el handle;
  la decisión de cuándo llamarlo la toma la UI de React (el modal "JUGAR DE NUEVO"), nunca
  el motor escuchando teclas en estado game-over.
- `pause`/`resume`/`restart`/`destroy` deben ser **idempotentes** (seguro llamarlos más de
  una vez seguidas).
- El motor nunca toca `window`/`document` fuera de los listeners de teclado, ni React state
  directamente. Toda comunicación saliente es vía los 4 callbacks; toda entrada es vía el
  `canvas` recibido + los métodos del handle.

---

## 3. Qué NO generalizar (específico de Asteroids, no imponer a motores nuevos)

Mecánicas de power-up de disparo triple, clases `Bullet`/`Asteroid`/`Ship`/`Particle`,
wrap toroidal de pantalla, invencibilidad tras respawn, resolución 800×600 y el esquema de
controles flechas+espacio son decisiones **del juego Asteroids**, no del contrato de motor.
Cada motor nuevo define su propia física, sus propias clases y su propio esquema de
controles — el contrato solo exige el `GameEngineFactory` + las reglas de la sección 2.

---

## 4. Casos especiales detectados al portar juegos reales (usar como checklist de preguntas)

- **El juego no tiene "vidas"** (ej. Tetris: pierde con un solo game over, sin contador de
  vidas). El HUD de React siempre muestra un stat "Vidas". Opciones a decidir explícitamente
  en la spec (sección Decisions), nunca improvisar durante la implementación:
    1. Llamar `onLivesChange` con un valor constante (ej. `1`) y dejar el label "Vidas" tal cual.
    2. Reutilizar el mismo callback para otra métrica del juego (ej. líneas completadas),
       documentando el cambio de significado del stat en el HUD para ese juego.
    3. Modificar `components/game-player.tsx` para ocultar/renombrar ese stat cuando el juego
       no lo usa (cambio en un archivo hoy "genérico" — debe quedar explícito en el plan si se
       elige esta opción, con su propio paso y su propio criterio de aceptación).
- **El original usa un canvas secundario o elementos DOM propios de HUD** (ej. Tetris:
  `#next-canvas`, `#score`, `#lines`, `#level`, `#overlay` en `index.html`). El contrato solo
  admite **un** `<canvas>` recibido por la factory. La spec debe decidir explícitamente cómo
  se resuelve cada elemento del HUD original:
    - Piezas o previsualizaciones (ej. "siguiente pieza"): se dibujan dentro del mismo canvas,
      en un panel/región fija del layout interno del motor.
    - Contadores (score/líneas/nivel): se eliminan del canvas — ya los muestra el HUD real de
      React vía los callbacks del contrato.
    - Overlays de pausa/game over propios del original: se eliminan siempre (ver sección 2,
      regla de game over) — los reemplaza el modal/overlay de React.
- **El original carga assets binarios** (imágenes/audio, ej. Arkanoid: `spritesheet.png`,
  `*.mp3`). Convención a seguir si se decide portarlos:
    - Copiar a `public/games/<id>/...` (convención nueva, no existe precedente en el repo —
      esta es la primera vez que se necesita).
    - Cargar con `new Image()`/`new Audio()` **dentro del closure de la factory**, nunca a
      nivel de módulo (mismo motivo que el resto del estado: evitar fugas entre mounts).
    - Decidir explícitamente si el audio entra en el alcance de la spec. El precedente de
      Asteroids (sin audio) fue porque el original no traía sonido, **no** una regla general.
    - Si no se portan los assets reales, la alternativa es redibujar el juego con formas
      vectoriales en canvas (como Asteroids), documentando esa simplificación en Decisions.

---

## 5. Checklist de alta en Supabase (reusar casi textual en cada spec)

Tablas reales verificadas (proyecto `kjpvjfhuqrclpblkthpd`, esquema `public`):

- `games` — `id text PK`, `title/short/long/cover/plays text`, `cat text CHECK IN
('ARCADE','PUZZLE','SHOOTER','VERSUS')`, `color text CHECK IN
('cyan','magenta','green','yellow')`, `created_at`. RLS habilitado, única policy es
  `select` pública. **No hay policy de insert pública** — el alta requiere migración con
  `mcp__supabase__apply_migration` (rol privilegiado), nunca desde el cliente.
- `players`/`scores` — ya soportan insert público y son 100% genéricas por `game_id`.
  **No requieren ningún cambio** para un juego nuevo.

Pasos estándar (calcar en el Implementation plan de la spec, ajustando solo el contenido
de la fila):

1. Verificar (solo lectura, `list_tables`/`execute_sql SELECT`) si ya existe una fila en
   `games` temáticamente equivalente (mock legado sembrado en la spec 06). Hoy: `caida`
   (Tetris) y `bloque-buster` (Arkanoid) son los dos casos pendientes.
2. Si existe un mock equivalente: la spec debe registrar explícitamente en Decisions si se
   reusa ese `id` o se reemplaza por uno nuevo, retirando la fila vieja (patrón
   `rocas` → `asteroides` de la spec 05). Si se reemplaza, agregar también el paso de
   actualizar la referencia correspondiente en `RECENT_ACTIVITY` (`lib/data.ts`).
3. Migración SQL única (`mcp__supabase__apply_migration`) que hace el INSERT (o
   DELETE + INSERT si se reemplaza un mock) de la fila nueva/actualizada de `games`.
4. Verificación: `list_tables`/`execute_sql SELECT` confirma la fila; `get_advisors` no
   reporta hallazgos de seguridad nuevos.
5. Sin cambios en `lib/supabase/queries.ts`, `lib/actions/save-score.ts`,
   `app/juegos/[id]/page.tsx`, `app/salon-de-la-fama/page.tsx` ni `components/hall-of-fame.tsx`
   — todos ya son genéricos por `game_id`/`getGames()`. El único código nuevo por juego es
   el motor (`lib/games/<carpeta>/engine.ts`) y la línea en `lib/games/registry.ts`.

---

## 6. Fragmento reusable de "Data model" para la spec generada

```ts
// lib/games/<carpeta-motor>/engine.ts
export const create<Nombre>Engine: GameEngineFactory = (canvas, callbacks) => { /* ... */ };

// lib/games/registry.ts (una línea agregada)
export const GAME_ENGINES: Partial<Record<string, GameEngineFactory>> = {
    asteroides: createAsteroidsEngine,
    <id>: create<Nombre>Engine,
};
```

```sql
insert into public.games (id, title, short, long, cat, cover, color, plays)
values ('<id>', '<TITLE>', '<short>', '<long>', '<CAT>', '<cover-class>', '<color>', '<plays>');
-- Si reemplaza un mock: delete from public.games where id = '<id-mock-viejo>'; antes del insert.
```
