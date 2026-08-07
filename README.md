## Arcade Vault

Es una plataforma para jugar online y competir por la mayor cantidad de puntos.

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **Tailwind v4**
- **Resend** — envío de correo del formulario de contacto (`/acerca-de`)
- **Supabase** (`@supabase/supabase-js` + `@supabase/ssr`) — base para Auth y datos; hoy solo el cliente está configurado, sin tablas ni Auth real todavía

## Variables de entorno

Copiá `.env.template` a `.env.local` y completá los valores reales (no versionado):

| Variable                               | Para qué                                    |
| -------------------------------------- | ------------------------------------------- |
| `RESEND_API_KEY`                       | Enviar el correo del formulario de contacto |
| `CONTACT_TO_EMAIL`                     | Destinatario de ese correo                  |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL del proyecto de Supabase                |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key del proyecto de Supabase    |

## Rutas

| Ruta                        | Contenido                                         |
| --------------------------- | ------------------------------------------------- |
| `/`                         | Home                                              |
| `/biblioteca`               | Catálogo de juegos                                |
| `/juegos/[id]`              | Ficha de un juego                                 |
| `/juegos/[id]/jugar`        | Reproductor del minijuego                         |
| `/auth`                     | Login / registro (mock, sin backend real todavía) |
| `/salon-de-la-fama`         | Leaderboard (mock, sin puntajes reales todavía)   |
| `/acerca-de`                | Misión + formulario de contacto                   |
| `/api/supabase-healthcheck` | Diagnóstico de conexión a Supabase                |

## Usa Spec Driven Design

Basado en /spec y /spec-impl

Specs implementadas hasta ahora en `specs/`: `01-mvp-visual-arcade-vault`, `02-new-home-page`, `03-about-contact-resend`, `04-supabase-setup-base`.

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```
