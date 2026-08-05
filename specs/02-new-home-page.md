# SPEC 02 — Página de inicio (Home) y reubicación de Biblioteca

> **Status:** Implemented
> **Depends on:** 01-mvp-visual-arcade-vault (Implemented)
> **Date:** 2026-08-05
> **Objective:** Portar la pantalla Home del prototipo (`references/templates/home-about/home.jsx`) como nueva página de inicio en `/`, mover la Biblioteca actual a `/biblioteca` y actualizar el Nav y todos los enlaces internos del Home para que apunten a las rutas reales ya existentes (`/biblioteca`, `/juegos/[id]`, `/auth`, `/salon-de-la-fama`).

## Scope

**In:**

- Ruta `/` — pasa a mostrar la nueva pantalla **Home**, portada desde `home.jsx`: hero con siluetas flotantes decorativas y animación de scroll-reveal, sección "¿Por qué Arcade Vault?" (features), preview de juegos (primeros 6 de `GAMES`), bloque de stats, sección "Actividad en vivo" / "Top jugadores" (contenido estático, igual al prototipo), sección de precios (copy de marketing "$0/siempre" + FAQ) y CTA final.
- Ruta `/biblioteca` — nueva ubicación de la pantalla que hoy vive en `/`. Se mueve el contenido de `app/page.tsx` tal cual (hero, buscador, chips, grid) sin cambios de lógica ni diseño, solo cambia la ruta de archivo.
- `components/nav.tsx` — se agrega el link **"Inicio"** → `/` (antes de "Biblioteca") en el menú de escritorio y en el panel móvil; se actualiza `isActive` para que `/` resalte "Inicio" y `/biblioteca` + `/juegos/*` resalten "Biblioteca".
- Todos los CTAs/enlaces internos del Home apuntan a rutas reales ya existentes:
  - "▶ EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS →", "INSERTAR MONEDA →" → `/biblioteca`
  - "✦ CREAR CUENTA", "EMPEZAR GRATIS →" → `/auth`
  - Click en tarjeta de juego del mini-rail → `/juegos/[id]` (usando el `id` real de `GAMES`)
  - "VER SALÓN →" → `/salon-de-la-fama`
- Componente cliente pequeño para las animaciones decorativas del Home (scroll-reveal vía `IntersectionObserver`, siluetas flotantes), manteniendo el resto del Home como Server Component en la medida de lo posible.
- Clases CSS nuevas del Home (`.home-hero`, `.home-silos`, `.feature-grid`, `.mini-rail`, `.mini-card`, `.home-stats`, `.activity-grid`, `.pricing-grid`, etc.) portadas desde `references/templates/home-about/styles.css` y fusionadas en `app/globals.css`.

**Out of scope (para otra spec):**

- La pantalla **"Acerca de"** (`about.jsx`) — no se porta, no se agrega su ruta ni su link en el Nav en esta spec.
- Cualquier cambio de lógica, diseño o comportamiento interno de Biblioteca, Detalle, Reproductor, Auth o Salón de la Fama — solo reciben/emiten enlaces desde el nuevo Home.
- Conectar la sección "Actividad en vivo" / "Top jugadores" del Home a datos reales de `lib/data.ts` (más allá de tipificarlos) — el contenido sigue siendo el estático de ejemplo del prototipo.
- Backend o lógica real de pagos/planes — la sección "Precios" es copy estático, sin integración.
- Cambios de metadata/SEO más allá de lo ya definido en `app/layout.tsx`.
- Tests automatizados (unitarios o e2e).

## Data model

```ts
// lib/data.ts (se agrega a lo ya existente)

export interface ActivityEntry {
  player: string;   // nombre del jugador, p.ej. "NEONFOX"
  game: string;     // nombre corto del juego, p.ej. "Caída"
  score: number;
  timeAgo: string;  // p.ej. "hace 2 min"
  color: "cyan" | "magenta" | "green" | "yellow";
}

export interface TopPlayerEntry {
  rank: number;
  player: string;
  score: number;
}

export const RECENT_ACTIVITY: ActivityEntry[];   // ticker "Últimas puntuaciones"
export const TOP_PLAYERS_TODAY: TopPlayerEntry[]; // "Top jugadores · hoy"
```

Convenciones:

- Se agregan a `lib/data.ts` junto a `GAMES`/`PLAYERS`, siguiendo el mismo patrón tipado que `ScoreRow`.
- Contenido estático de ejemplo (los mismos valores del prototipo `home.jsx`), sin conexión a `seededScores` ni a puntuaciones reales — solo se les da forma tipada y un lugar central en vez de vivir como literales inline en el componente.

## Implementation plan

1. Agregar a `lib/data.ts` las interfaces `ActivityEntry` y `TopPlayerEntry`, y los arrays `RECENT_ACTIVITY` y `TOP_PLAYERS_TODAY` con los datos estáticos de ejemplo portados de `home.jsx`. Verificación: el módulo compila sin errores de TypeScript.

2. Crear `app/biblioteca/page.tsx` moviendo el contenido íntegro y sin cambios de `app/page.tsx` (mismo uso de `GAMES` y `LibraryFilters`). Verificación: `/biblioteca` muestra la Biblioteca completa y funcional (hero, buscador, chips, grid), igual que antes en `/`.

3. Fusionar en `app/globals.css` las clases nuevas del Home portadas desde `references/templates/home-about/styles.css` (`.home-hero`, `.home-silos`, `.feature-grid`, `.ft-icon`, `.mini-rail`, `.mini-card`, `.home-stats`, `.stat-block`, `.activity-grid`, `.tick-row`, `.top-list`, `.pricing-grid`, `.price-card`, `.home-final`, etc.), revisando que no colisionen con clases ya usadas en el tema base. Verificación: el CSS compila y ninguna pantalla existente pierde estilos.

4. Crear `components/home-reveal.tsx` (`"use client"`) portando de `home.jsx` el hook de scroll-reveal (`IntersectionObserver`) y las `FloatingSilhouettes` decorativas, sin lógica de negocio. Verificación: el componente compila de forma aislada.

5. Reescribir `app/page.tsx` como la nueva pantalla **Home** (Server Component), portando desde `home.jsx` el hero, la sección de features, el mini-rail de juegos (primeros 6 de `GAMES`, cada tarjeta enlazando a `/juegos/[id]`), el bloque de stats, la sección de actividad (usando `RECENT_ACTIVITY`/`TOP_PLAYERS_TODAY`), la sección de precios y el CTA final — usando `next/link` para `/biblioteca`, `/auth` y `/salon-de-la-fama`, y montando el componente cliente del paso 4 para las partes animadas. Verificación: `/` muestra el Home completo con todas sus secciones, y `/biblioteca` sigue funcionando de forma independiente.

6. Actualizar `components/nav.tsx`: agregar el link "Inicio" → `/` antes de "Biblioteca" (menú de escritorio y panel móvil), y ajustar `isActive` para que `/` resalte "Inicio" y `/biblioteca` + `/juegos/*` resalten "Biblioteca". Verificación: el Nav muestra ambos links y resalta el correcto según la ruta activa, en todas las pantallas.

7. Recorrido de navegación cruzada: verificar que todos los enlaces del Home (CTAs del hero, mini-rail de juegos, "Ver salón", CTA de precios, CTA final) y del Nav llevan a la ruta correcta, sin 404 ni estilos rotos. Verificación: se puede navegar el flujo completo Home ↔ Biblioteca ↔ Detalle ↔ Salón de la Fama ↔ Auth sin rutas rotas.

## Acceptance criteria

- [ ] La ruta `/` muestra la nueva pantalla Home con hero, sección "¿Por qué Arcade Vault?", preview de juegos, stats, actividad en vivo, precios y CTA final.
- [ ] La ruta `/` ya no muestra el contenido de Biblioteca.
- [ ] La ruta `/biblioteca` muestra la pantalla de Biblioteca completa (hero, buscador, chips de categoría, grid de juegos), igual que antes vivía en `/`.
- [ ] El botón "▶ EXPLORAR JUEGOS" del hero de Home navega a `/biblioteca`.
- [ ] El botón "VER TODOS LOS JUEGOS →" navega a `/biblioteca`.
- [ ] El botón "INSERTAR MONEDA →" del CTA final navega a `/biblioteca`.
- [ ] Los botones "✦ CREAR CUENTA" y "EMPEZAR GRATIS →" navegan a `/auth`.
- [ ] Hacer clic en una tarjeta del mini-rail de juegos navega a `/juegos/[id]` del juego correspondiente.
- [ ] El botón "VER SALÓN →" navega a `/salon-de-la-fama`.
- [ ] El Nav muestra el link "Inicio" apuntando a `/`, tanto en el menú de escritorio como en el menú móvil.
- [ ] El Nav resalta "Inicio" como activo en `/`, y resalta "Biblioteca" como activo en `/biblioteca` y en `/juegos/*`.
- [ ] Las animaciones de scroll-reveal y las siluetas flotantes decorativas del Home funcionan igual que en el prototipo.
- [ ] La sección "Actividad en vivo" / "Top jugadores" del Home muestra los datos de `RECENT_ACTIVITY` y `TOP_PLAYERS_TODAY` definidos en `lib/data.ts`.
- [ ] Ningún estilo existente de Biblioteca, Detalle, Auth o Salón de la Fama se ve afectado tras fusionar las clases nuevas del Home en `app/globals.css`.
- [ ] No hay enlaces rotos (404) al recorrer el flujo Home ↔ Biblioteca ↔ Detalle ↔ Salón de la Fama ↔ Auth.

## Decisions

- **Sí:** portar solo el Home en esta spec, dejando "Acerca de" (`about.jsx`) para una spec futura. **No:** portar About ahora — habría ampliado el alcance a una segunda pantalla nueva con su propia ruta, formulario de contacto y link de Nav, sin que el pedido original lo requiriera.
- **Sí:** mover Biblioteca a `/biblioteca`, porque coincide con el label "Biblioteca" ya usado en el Nav. **No:** `/juegos` — habría generado una inconsistencia entre el nombre de la URL y el texto del link en el Nav.
- **Sí:** fusionar las clases CSS nuevas del Home directamente en `app/globals.css`, igual que se hizo con el tema base en la spec 01. **No:** un archivo CSS aparte — habría fragmentado el tema sin necesidad, ya que `globals.css` ya concentra todo el tema neón de la app.
- **Sí:** dejar "Actividad en vivo" / "Top jugadores" como datos estáticos tipados (`RECENT_ACTIVITY`, `TOP_PLAYERS_TODAY` en `lib/data.ts`), sin conectarlos a `seededScores` reales. **No:** generarlos dinámicamente desde datos reales — el objetivo de esta spec es visual y de navegación, no analítica de puntuaciones reales.
- **Sí:** incluir la sección de precios tal cual (copy de marketing "$0/siempre" + FAQ), como refuerzo del mensaje "100% gratis" ya presente en el resto de la app. **No:** omitirla — no hay riesgo de confundir con un sistema de pagos real, ya que no incluye checkout ni botones de pago funcionales.
- **Sí:** agregar el link "Inicio" al Nav en esta spec — es obligatorio, dado que `/` deja de ser Biblioteca y pasa a ser una pantalla distinta.
- **Sí:** mantener el Home mayormente como Server Component, aislando las animaciones (scroll-reveal, siluetas flotantes) en un client component pequeño (`components/home-reveal.tsx`). **No:** todo el Home como Client Component — habría renunciado a las ventajas de Server Components sin necesidad, ya que solo las animaciones requieren estado/efectos de navegador.

## Identified risks

- **Colisión de clases CSS:** algunas clases de `home-about/styles.css` podrían coincidir en nombre pero no en propósito con clases ya definidas en `app/globals.css` (portadas de otro archivo del prototipo). Mitigación: revisar cada clase nueva antes de fusionarla y renombrar si hay conflicto real.
- **Lógica de `isActive` en el Nav:** al introducir "Inicio" como ruta distinta de "Biblioteca", existe riesgo de romper el resaltado activo en `/juegos/[id]` o `/juegos/[id]/jugar` si no se ajusta la condición correctamente. Mitigación: cubierto explícitamente en el paso 6 del plan y en los criterios de aceptación.
- **Enlaces externos a `/` que esperaban Biblioteca:** cualquier bookmark o referencia externa a `/` mostrará ahora Home en vez de Biblioteca. No hay mitigación técnica posible (es el cambio buscado por esta spec); se acepta como consecuencia esperada del cambio de alcance.
