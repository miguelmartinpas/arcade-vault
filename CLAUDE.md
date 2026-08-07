# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Estado del proyecto

**Arcade Vault** ya no es un scaffold sin modificar: es una app Next.js (App Router, TypeScript, Tailwind v4) con 4 specs implementadas (`specs/01` a `specs/04`, ver abajo). Rutas reales existentes:

- `/` → Home (hero, features, preview de juegos, actividad/top jugadores, precios, CTA)
- `/biblioteca` → catálogo de juegos (buscador, chips de categoría, grid)
- `/juegos/[id]` → ficha de un juego
- `/juegos/[id]/jugar` → reproductor del minijuego
- `/auth` → login/registro (hoy: mock en `localStorage` vía `components/session-provider.tsx`, sin backend real todavía — ver "Pendiente")
- `/salon-de-la-fama` → leaderboard (hoy: datos mock generados con `seededScores`, sin conectar a puntajes reales — ver "Pendiente")
- `/acerca-de` → misión + formulario de contacto (envía correo real vía Resend, `app/acerca-de/actions.ts`)
- `/api/supabase-healthcheck` → ruta de diagnóstico que confirma la conexión al proyecto de Supabase

`references/templates/` contiene el prototipo de referencia de la UI (HTML/JSX standalone, sin Next.js — usa `React`/`ReactDOM` globales vía CDN, ruteo por `location.hash` y `localStorage`). **No es código a importar**: es la referencia visual/de interacción a portar al App Router real (Server/Client Components, rutas de archivos, etc.). Antes de construir o tocar una pantalla, revisa el archivo `.jsx` equivalente para la estructura y el copy (en español):

- `app.jsx` → shell de la app y ruteo (`biblioteca`, `detalle`, `player`, `auth`, `salon`)
- `nav.jsx` → navegación
- `biblioteca.jsx` → listado/catálogo de juegos
- `detalle.jsx` → ficha de un juego
- `reproductor.jsx` → pantalla de juego
- `auth.jsx` → login/registro
- `salon.jsx` → salón de la fama (leaderboard)
- `data.jsx` → datos mock (`GAMES`, `CATS`, `PLAYERS`, generador de scores)
- `styles.css` → estilos de referencia (tema neón/arcade)
- `home-about/home.jsx`, `home-about/about.jsx`, `home-about/styles.css` → referencia del Home y de "Acerca de" (specs 02 y 03)

### Pendiente (no implementado todavía)

- **Auth real:** `/auth` sigue siendo un mock (`components/session-provider.tsx`, `localStorage`, sin password check). El cliente de Supabase ya está listo (`lib/supabase/client.ts`/`server.ts`, spec 04) para cuando se aborde en una spec futura.
- **Catálogo y puntajes reales:** `GAMES`/`PLAYERS`/`ScoreRow` en `lib/data.ts` siguen siendo mock; el proyecto de Supabase conectado hoy tiene **0 tablas** en `public`. Migrar esto es trabajo de una spec futura.

### Supabase

El proyecto ya está conectado (MCP `supabase` en `.mcp.json`, project ref `kjpvjfhuqrclpblkthpd`). El cliente vive en `lib/supabase/` (`client.ts` para navegador, `server.ts` para Server Components/Actions vía `@supabase/ssr`). Variables necesarias: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ver sección de entorno abajo).

## Skill

Usa siempre /frontend-design para diseñar el interfaz de usuario

## ⚠️ Esta NO es la versión de Next.js que conoces

El proyecto usa **Next.js 16.2.12** (`package.json`), una versión con cambios de ruptura respecto a lo que conoces por entrenamiento. **Antes de escribir código que use una API de Next.js, consulta la doc empaquetada en `node_modules/next/dist/docs/`** (organizada en `01-app/`, `02-pages/`, `03-architecture/`, `04-community/`) en vez de asumir el comportamiento de versiones anteriores. Presta atención a los avisos de deprecación.

## Flujo de trabajo: Spec Driven Design

Este repo sigue un flujo basado en specs (ver README.md, skills instaladas desde `Klerith/fernando-skills`). El trabajo de features no triviales pasa por dos comandos, no se escribe código directamente sin spec:

1. **`/spec <descripción>`** — diseña la spec de forma guiada (aclara alcance, datos, plan de implementación, criterios de aceptación) y la guarda en `specs/NN-slug.md` con estado `Draft`. No escribe código.
2. **`/spec-impl <NN-slug>`** — solo avanza si el estado de la spec es `Approved` (o equivalente). Crea/cambia a la rama `spec-NN-slug` (controlado por `AutoCreateBranch` en `specs/.spec-config.yml`, default `true`) e implementa el plan paso a paso, pausando para revisión de diff entre pasos.

`specs/` ya existe con 4 specs, todas `Implemented`:

- `01-mvp-visual-arcade-vault.md` — MVP visual (Biblioteca, Detalle, Reproductor, Auth mock, Salón de la Fama).
- `02-new-home-page.md` — Home en `/` y reubicación de Biblioteca a `/biblioteca`.
- `03-about-contact-resend.md` — página "Acerca de" con formulario de contacto real (Resend).
- `04-supabase-setup-base.md` — cliente de Supabase (`@supabase/supabase-js` + `@supabase/ssr`) y ruta de healthcheck, sin Auth ni tablas todavía.

## Variables de entorno

Convención del repo: `.env.template` (versionado, solo placeholders) documenta qué variables existen; `.env.local` (no versionado, real) tiene los valores reales para desarrollo. Copiá `.env.template` a `.env.local` y completá:

- `RESEND_API_KEY`, `CONTACT_TO_EMAIL` — envío de correo del formulario de contacto (spec 03).
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — cliente de Supabase (spec 04). Se obtienen del proyecto ya conectado vía el MCP de Supabase (`get_project_url`, `get_publishable_keys`) en vez de copiarlas del dashboard.
