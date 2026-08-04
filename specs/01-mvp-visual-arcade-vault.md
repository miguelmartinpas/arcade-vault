# SPEC 01 — MVP visual de Arcade Vault

> **Status:** Implemented
> **Depends on:** Ninguna (primera spec del proyecto)
> **Date:** 2026-08-04
> **Objective:** Portar al App Router de Next.js 16 las 5 pantallas visuales del prototipo de Arcade Vault (biblioteca, detalle, reproductor simulado, auth y salón de la fama) con navegación, tema neón y persistencia en localStorage, sin implementar ningún juego real.

## Scope

**In:**

- Layout raíz (`app/layout.tsx`) con fuentes vía `next/font/google` (Press Start 2P, Courier Prime, JetBrains Mono) y el tema neón portado desde `styles.css` a `app/globals.css`.
- Ruta `/` — pantalla **Biblioteca**: hero, buscador, filtro por categoría (chips) y grid de tarjetas de juego (`GameCard`) con efecto tilt al hover.
- Ruta `/juegos/[id]` — pantalla **Detalle**: portada, tags, descripción, stat strip, leaderboard del juego y botones "Jugar ahora" / "Volver al Vault".
- Ruta `/juegos/[id]/jugar` — pantalla **Reproductor**: HUD simulado (score autoincremental, vidas, nivel, pausa), marco CRT decorativo y modal de "fin del juego" con guardado de puntuación — todo portado tal cual el comportamiento simulado del prototipo, sin lógica de juego real.
- Ruta `/auth` — pantalla **Auth**: tabs "Iniciar sesión" / "Crear cuenta", formulario sin validación (acepta cualquier valor), y botón "Jugar como invitado".
- Ruta `/salon-de-la-fama` — pantalla **Salón de la Fama**: tabs por juego, podio (top 3) y tabla de puntuaciones, con fila destacada del usuario si hay sesión.
- Componente **Nav** compartido (desktop + menú móvil), con estado de sesión y contador de créditos decorativo.
- Datos mock tipados en `lib/data.ts` (`GAMES`, `CATS`, `PLAYERS`, `seededScores`), portados desde `data.jsx`.
- Persistencia en `localStorage` de sesión de usuario (`av_user`) y puntuaciones guardadas (`av_scores`), igual que el prototipo.
- Componentes Server por defecto; `"use client"` solo en Nav, Auth, Library (buscador/filtros), GameCard (tilt), GamePlayer y HallOfFame/GameDetail donde haya estado de usuario vía localStorage.

**Out of scope (for future specs):**

- Lógica real de cualquier minijuego (Bloque Buster, Caída, Serpentina, etc.) — el Reproductor solo simula un HUD.
- Autenticación real (backend, hashing de contraseñas, OAuth con Google/GitHub, sesiones de servidor). Los botones sociales del prototipo se ocultan.
- Persistencia real de puntuaciones en servidor/base de datos — hoy es solo `localStorage`.
- Validación de formularios (campos requeridos, formato de email, etc.).
- Pantalla de perfil/cuenta de usuario más allá del nombre en el Nav.
- Tests automatizados (unitarios o e2e) de las pantallas.
- Responsive/mobile más allá de lo que ya cubre el prototipo (menú hamburguesa incluido).

## Data model

```ts
// lib/data.ts

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string; // clase CSS del fondo, p.ej. "cover-bricks"
  color: "cyan" | "magenta" | "green" | "yellow";
  best: number;
  plays: string; // p.ej. "12.4K"
}

export const GAMES: Game[];
export const CATS: readonly ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];
export const PLAYERS: string[];

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // "DD/MM/AAAA"
}

// PRNG determinista (mismo algoritmo que el prototipo) para generar leaderboards mock
export function seededScores(seed: number, count?: number): ScoreRow[];
```

```ts
// Persistencia en localStorage (misma clave y forma que el prototipo)

// Clave: "av_user"
interface StoredUser {
  name: string;
}

// Clave: "av_scores"
interface StoredScoreEntry {
  game: string;   // id del juego
  score: number;
  name: string;   // iniciales ingresadas al terminar la partida
  at: number;     // Date.now() al momento de guardar
}
// Valor almacenado: StoredScoreEntry[]
```

Convenciones:

- `Game.cover` y `Game.color` son nombres de clase CSS ya existentes en el tema portado (`app/globals.css`), no assets de imagen.
- `seededScores` reutiliza el mismo algoritmo pseudoaleatorio con semilla del prototipo para que los leaderboards sean reproducibles sin necesitar backend.

## Implementation plan

1. Portar el tema visual: copiar `styles.css` a `app/globals.css` (variables neón, animaciones, clases `.btn`, `.card`, `.crt`, etc.), configurar `next/font/google` en `app/layout.tsx` para Press Start 2P, Courier Prime y JetBrains Mono, y agregar el fondo (`.av-bg`, `.av-noise`) y el footer en el layout raíz. Verificación: la app arranca y se ve el fondo/tema neón aplicado sobre la página placeholder.

2. Crear `lib/data.ts` con las interfaces `Game` y `ScoreRow`, y los datos `GAMES`, `CATS`, `PLAYERS` y la función `seededScores`, portados desde `data.jsx`. Verificación: el módulo compila y exporta los tipos sin errores de TypeScript.

3. Crear `components/session-provider.tsx` (`"use client"`) con un Context que expone `user`, `login(name)`, `logout()` y `saveScore(entry)`, leyendo/escribiendo `av_user` y `av_scores` en `localStorage`; envolver `children` con este provider en `app/layout.tsx`. Verificación: no rompe el render del layout (sin consumidores todavía).

4. Crear `components/nav.tsx` (`"use client"`) portando `nav.jsx`: links de escritorio, menú móvil, botón de sesión y contador de créditos, consumiendo `session-provider`. Insertarlo en `app/layout.tsx`. Verificación: el Nav se ve en todas las rutas y el botón cambia entre "Iniciar Sesión" / nombre de usuario.

5. Crear `app/page.tsx` (Server) + `components/game-card.tsx` y `components/library-filters.tsx` (Client, para buscador/chips/tilt), portando `biblioteca.jsx`. Verificación: la Biblioteca lista las 8 tarjetas, filtra por categoría y por búsqueda.

6. Crear `app/juegos/[id]/page.tsx` (Server) portando `detalle.jsx`, usando `GAMES` y `seededScores` de `lib/data.ts`. Verificación: al hacer clic en una tarjeta se llega al detalle correcto con su leaderboard.

7. Crear `app/auth/page.tsx` + `components/auth-form.tsx` (Client) portando `auth.jsx` sin botones sociales, usando `login()` del contexto y redirigiendo a `/` tras enviar. Verificación: enviar el formulario o pulsar "Jugar como invitado" navega a la Biblioteca y el Nav refleja la sesión.

8. Crear `app/juegos/[id]/jugar/page.tsx` (Server) + `components/game-player.tsx` (Client) portando `reproductor.jsx` (HUD simulado, pausa, botón fin, modal de guardado usando `saveScore()`). Verificación: el score sube solo, pausa detiene el incremento, y "Fin" abre el modal que guarda el puntaje en `localStorage`.

9. Crear `app/salon-de-la-fama/page.tsx` + `components/hall-of-fame.tsx` (Client, por uso de `user`) portando `salon.jsx` (tabs por juego, podio, tabla, fila destacada del usuario). Verificación: cambiar de tab actualiza podio/tabla y la fila "tu mejor marca" aparece solo con sesión iniciada.

10. Recorrido de navegación cruzada: verificar todos los enlaces entre las 5 pantallas (Nav ↔ Biblioteca ↔ Detalle ↔ Reproductor, Salón ↔ Biblioteca) y ajustar cualquier detalle visual pendiente contra el prototipo original. Verificación: se puede navegar el flujo completo sin rutas rotas ni estilos faltantes.

## Acceptance criteria

- [ ] La ruta `/` muestra la Biblioteca con hero, buscador, chips de categoría y grid de tarjetas de juego.
- [ ] Buscar por nombre y filtrar por categoría en la Biblioteca actualiza el grid sin recargar la página.
- [ ] Al hacer clic en una tarjeta o en "JUGAR" se navega a `/juegos/[id]` con la información correcta del juego.
- [ ] `/juegos/[id]` muestra portada, tags, descripción, stat strip y el leaderboard del juego.
- [ ] "▶ JUGAR AHORA" en el detalle navega a `/juegos/[id]/jugar`.
- [ ] En `/juegos/[id]/jugar` el puntaje sube automáticamente cada ~220ms mientras no está en pausa.
- [ ] Pulsar "PAUSA" detiene el incremento de puntaje y muestra el overlay "EN PAUSA"; "REANUDAR" lo retoma.
- [ ] Pulsar "FIN" abre el modal de fin de partida con el puntaje final.
- [ ] Guardar la puntuación en el modal la persiste en `localStorage` bajo la clave `av_scores` y muestra el mensaje de confirmación.
- [ ] `/auth` permite enviar el formulario con cualquier valor (o vacío) y redirige a `/` con sesión iniciada.
- [ ] "JUGAR COMO INVITADO" en `/auth` navega a `/` sin iniciar sesión.
- [ ] El Nav muestra "Iniciar Sesión" sin sesión y el nombre de usuario cuando hay sesión iniciada, en todas las rutas.
- [ ] Recargar la página (`F5`) conserva la sesión de usuario si había una iniciada.
- [ ] `/salon-de-la-fama` muestra tabs por juego, podio (top 3) y tabla de puntuaciones que cambian al seleccionar otro juego.
- [ ] Con sesión iniciada, `/salon-de-la-fama` muestra la fila destacada "tu mejor marca" para el juego seleccionado.
- [ ] Ningún archivo de este MVP implementa lógica de juego real (colisiones, físicas, input de juego) — solo el HUD simulado del prototipo.
- [ ] El menú móvil (hamburguesa) del Nav abre y cierra correctamente en ancho de pantalla reducido.

## Decisions

- **Sí:** rutas de archivos reales del App Router (`/`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/auth`, `/salon-de-la-fama`) en vez de hash-routing. Es lo idiomático en Next.js 16 y da URLs limpias/compartibles.
- **No:** mantener el hash-routing del prototipo. Habría renunciado a las ventajas de rutas reales sin ganar nada a cambio.
- **Sí:** persistencia en `localStorage` (`av_user`, `av_scores`), igual que el prototipo. Es un MVP solo visual sin backend; alcanza para simular sesión y puntuaciones guardadas.
- **No:** estado solo en memoria. Perdería la sensación de "sesión persistente" que sí tiene el prototipo.
- **Sí:** portar el HUD simulado del Reproductor tal cual (score autoincremental, pausa, modal de fin). Sirve como placeholder visual fiel al prototipo mientras no exista un juego real.
- **No:** dejar el Reproductor como imagen estática sin ninguna interacción. Perdería fidelidad con la experiencia del prototipo.
- **Sí:** Server Components por defecto, `"use client"` solo donde hay estado/interactividad (Nav, Auth, filtros de Biblioteca, GameCard con tilt, GamePlayer, HallOfFame). Aprovecha el modelo de Next.js 16 sin sacrificar comportamiento.
- **No:** todo como Client Component. Habría sido más simple de portar 1:1 pero renuncia a las ventajas de Server Components del framework.
- **Sí:** datos mock tipados en `lib/data.ts` (interfaces `Game`, `ScoreRow`). Da seguridad de tipos sin costo extra relevante.
- **No:** copiar `data.jsx` sin tipos. Se perdería la verificación de TypeScript en el resto de los componentes que consumen estos datos.
- **Sí:** portar `styles.css` casi tal cual a `app/globals.css`, conviviendo con Tailwind v4. Preserva la fidelidad visual exacta del prototipo con el menor esfuerzo.
- **No:** reescribir el tema como utilidades/tokens de Tailwind v4. Mucho más trabajo y riesgo de perder fidelidad visual sin necesidad real en este MVP.
- **Sí:** formulario de Auth sin validación, aceptando cualquier valor (incluso vacío), igual que el prototipo. No hay backend real que verificar; añadir validación sería trabajo sin propósito en este MVP.
- **No:** validación mínima de campos requeridos. Se descarta por la misma razón — no hay credenciales reales que proteger.
- **Sí:** ocultar los botones sociales (GOOGLE, GITHUB) de Auth. No hay integración OAuth real y mostrarlos sin función sería engañoso.
- **No:** dejarlos como decorativos sin acción. Se prefirió quitarlos directamente antes que simular un login social.
- **Sí:** fuentes vía `next/font/google` (Press Start 2P, Courier Prime, JetBrains Mono) en vez de `<link>` a Google Fonts. Mejor performance y sin dependencia de red en cada carga, mismo resultado visual.
- **No:** `<link>` directo a Google Fonts como en el prototipo. Next.js 16 ya resuelve esto de forma nativa y más eficiente.

## Qué **no** está en esta spec

- Lógica real de cualquier minijuego (Bloque Buster, Caída, Serpentina, Glotón, Invasores, Rocas, Ranaria, Duelo Pixel).
- Autenticación real: backend, hashing de contraseñas, OAuth con Google/GitHub, sesiones de servidor.
- Persistencia real en servidor/base de datos — todo vive en `localStorage` del navegador.
- Validación de formularios (campos requeridos, formato de email, etc.).
- Pantalla de perfil/cuenta más allá del nombre mostrado en el Nav.
- Tests automatizados (unitarios o end-to-end).

Cada uno de estos, si se necesita, va en su propia spec.
