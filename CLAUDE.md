# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Estado del proyecto

Es un scaffold de `create-next-app` (App Router, TypeScript, Tailwind v4) sin modificar todavía. La app real a construir es **Arcade Vault**, una plataforma para jugar minijuegos online y competir por puntaje (ver README.md).

`resources/templates/` contiene el prototipo de referencia de la UI (HTML/JSX standalone, sin Next.js — usa `React`/`ReactDOM` globales vía CDN, ruteo por `location.hash` y `localStorage`). **No es código a importar**: es la referencia visual/de interacción a portar al App Router real (Server/Client Components, rutas de archivos, etc.). Antes de construir una pantalla, revisa el archivo `.jsx` equivalente en `resources/templates/` para la estructura y el copy (en español):

- `app.jsx` → shell de la app y ruteo (`biblioteca`, `detalle`, `player`, `auth`, `salon`)
- `nav.jsx` → navegación
- `biblioteca.jsx` → listado/catálogo de juegos
- `detalle.jsx` → ficha de un juego
- `reproductor.jsx` → pantalla de juego
- `auth.jsx` → login/registro
- `salon.jsx` → salón de la fama (leaderboard)
- `data.jsx` → datos mock (`GAMES`, `CATS`, `PLAYERS`, generador de scores)
- `styles.css` → estilos de referencia (tema neón/arcade)

## Skill
Usa siempre /frontend-design para diseñar el interfaz de usuario

## ⚠️ Esta NO es la versión de Next.js que conoces

El proyecto usa **Next.js 16.2.12** (`package.json`), una versión con cambios de ruptura respecto a lo que conoces por entrenamiento. **Antes de escribir código que use una API de Next.js, consulta la doc empaquetada en `node_modules/next/dist/docs/`** (organizada en `01-app/`, `02-pages/`, `03-architecture/`, `04-community/`) en vez de asumir el comportamiento de versiones anteriores. Presta atención a los avisos de deprecación.

## Flujo de trabajo: Spec Driven Design

Este repo sigue un flujo basado en specs (ver README.md, skills instaladas desde `Klerith/fernando-skills`). El trabajo de features no triviales pasa por dos comandos, no se escribe código directamente sin spec:

1. **`/spec <descripción>`** — diseña la spec de forma guiada (aclara alcance, datos, plan de implementación, criterios de aceptación) y la guarda en `specs/NN-slug.md` con estado `Draft`. No escribe código.
2. **`/spec-impl <NN-slug>`** — solo avanza si el estado de la spec es `Approved` (o equivalente). Crea/cambia a la rama `spec-NN-slug` (controlado por `AutoCreateBranch` en `specs/.spec-config.yml`, default `true`) e implementa el plan paso a paso, pausando para revisión de diff entre pasos.

La carpeta `specs/` todavía no existe — la crea `/spec` al guardar la primera spec.
