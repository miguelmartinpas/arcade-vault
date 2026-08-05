# SPEC 03 — Página "Acerca de" y formulario de contacto con Resend

> **Status:** Implemented
> **Depends on:** 02-new-home-page (Implemented)
> **Date:** 2026-08-05
> **Objective:** Portar la pantalla "Acerca de" del prototipo (`references/templates/home-about/about.jsx`) a la ruta `/acerca-de`, agregar su link al Nav, y conectar el formulario de contacto a un envío de correo real mediante el servicio Resend.

## Scope

**In:**

- Ruta `/acerca-de` — nueva pantalla **Acerca de**, portada desde `references/templates/home-about/about.jsx`: hero de misión ("Acerca de Arcade Vault" + highlights), divisor decorativo animado y sección de contacto con formulario (nombre, correo, mensaje).
- `components/nav.tsx` — se agrega el link **"Acerca de"** → `/acerca-de` (menú de escritorio y panel móvil), con su correspondiente ajuste en `isActive`.
- Formulario de contacto funcional: al enviarse, dispara un **Server Action** que envía un correo real vía **Resend** a `CONTACT_TO_EMAIL` (variable de entorno), con el nombre/correo/mensaje ingresados.
- Estados del formulario: envío en curso, éxito (reutilizando la animación "terminal" del prototipo) y error (mensaje inline sin perder los datos ingresados, permitiendo reintentar).
- Validación server-side básica: nombre y mensaje no vacíos (trim), correo con formato válido, límite de longitud en el mensaje (2000 caracteres). Sin librerías nuevas de validación.
- Campo honeypot oculto (anti-spam simple): si llega con contenido, se descarta el envío silenciosamente sin llamar a Resend, respondiendo como si hubiese tenido éxito.
- Nueva dependencia `resend` (paquete npm oficial) y variables de entorno `RESEND_API_KEY` y `CONTACT_TO_EMAIL` en `.env.local` (ya creado, no versionado).
- Reutilización de `HomeReveal` (`components/home-reveal.tsx`) para las animaciones de scroll-reveal del divisor y la sección de contacto, igual que en Home — sin duplicar el hook de `IntersectionObserver`.
- Clases CSS del About (`.about`, `.about-hero`, `.about-title`, `.about-mission`, `.highlight-row`, `.about-divider`, `.about-contact`, `.contact-grid`, `.contact-form`, `.terminal-success`, etc.) portadas desde `references/templates/home-about/styles.css` y fusionadas en `app/globals.css`.

**Out of scope (para otra spec):**

- Persistencia de los mensajes de contacto en alguna base de datos o archivo — el mensaje solo se envía por correo, no se guarda en el proyecto.
- Verificar un dominio propio en Resend — se usa el remitente sandbox `onboarding@resend.dev`, que solo permite enviar al correo registrado en la cuenta de Resend (`CONTACT_TO_EMAIL`).
- Rate limiting real (por IP/usuario) más allá del honeypot — no hay infraestructura de rate limiting en el proyecto todavía.
- Panel de administración o listado de mensajes recibidos.
- Internacionalización — el copy queda en español, igual que el resto de la app.
- Tests automatizados (unitarios o e2e).

## Data model

```ts
// app/acerca-de/actions.ts ("use server")

export interface ContactFormState {
  status: "idle" | "success" | "error";
  message?: string; // mensaje de error a mostrar, o nombre en el mensaje de éxito
}

export async function sendContactMessage(
  prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState>;
```

Convenciones:

- `sendContactMessage` es la Server Action invocada desde el formulario cliente vía `useActionState` (React 19 / Next 16), reemplazando el `onSubmit` simulado del prototipo.
- El formulario cliente (`components/contact-form.tsx`, `"use client"`) porta el JSX y los estados visuales de `about.jsx` (campos, shake en error de validación, animación "terminal" de éxito), pero delega el envío real a `sendContactMessage`.
- `FormData` trae los campos `name`, `email`, `message` y el campo honeypot oculto (p.ej. `company`); si `company` llega no vacío, la acción retorna `{ status: "success" }` sin llamar a Resend.
- No se introduce ningún tipo nuevo en `lib/data.ts` — este modelo vive junto a la ruta `/acerca-de`, no es un dato del catálogo de juegos.

## Implementation plan

1. Instalar la dependencia `resend` (`npm install resend`). Verificación: aparece en `package.json`/`package-lock.json` y `npm run build` sigue funcionando sin cambios de código todavía.

2. Fusionar en `app/globals.css` las clases nuevas del About portadas desde `references/templates/home-about/styles.css` (`.about`, `.about-hero`, `.about-title`, `.about-mission`, `.highlight-row`, `.about-divider`, `.about-contact`, `.contact-grid`, `.contact-form`, `.terminal-success`, etc.), revisando que no colisionen con clases ya usadas en el tema base. Verificación: el CSS compila y ninguna pantalla existente pierde estilos.

3. Crear `app/acerca-de/actions.ts` con la Server Action `sendContactMessage` (`"use server"`): valida `name`/`email`/`message` (requeridos, formato de email, límite de 2000 caracteres en el mensaje), revisa el campo honeypot (si viene lleno, retorna éxito sin enviar nada), y si pasa validación llama a la API de Resend (`RESEND_API_KEY`) enviando desde `onboarding@resend.dev` a `CONTACT_TO_EMAIL`. Retorna `ContactFormState` con `status: "success" | "error"` según el resultado. Verificación: el módulo compila sin errores de TypeScript.

4. Crear `components/contact-form.tsx` (`"use client"`) portando el formulario de `about.jsx`: campos nombre/correo/mensaje, campo honeypot oculto, animación de "shake" en error de validación, estado de envío en curso (deshabilitando el botón), estado de éxito (animación "terminal" ya existente en el prototipo) y estado de error (mensaje inline, formulario conservado con los datos ingresados) — todo usando `useActionState` con `sendContactMessage` del paso 3. Verificación: el componente compila de forma aislada.

5. Crear `app/acerca-de/page.tsx` (Server Component) portando desde `about.jsx` el hero de misión con highlights, el divisor decorativo y la sección de contacto — montando `HomeReveal` (de `components/home-reveal.tsx`) para las animaciones de scroll-reveal y `ContactForm` del paso 4 para el formulario. Verificación: `/acerca-de` muestra la pantalla completa, con el divisor y la sección de contacto animándose al hacer scroll.

6. Actualizar `components/nav.tsx`: agregar el link **"Acerca de"** → `/acerca-de` (menú de escritorio y panel móvil), y ajustar `isActive` para que se resalte correctamente sin afectar el resaltado de "Inicio", "Biblioteca" o "Salón de la Fama". Verificación: el Nav muestra el nuevo link y resalta el correcto según la ruta activa, en todas las pantallas.

7. Prueba end-to-end manual del envío real: completar el formulario en `/acerca-de` y confirmar que el correo llega a `CONTACT_TO_EMAIL` vía Resend; provocar un error (p. ej. `RESEND_API_KEY` temporalmente inválida) y confirmar que se muestra el mensaje de error inline sin perder los datos; confirmar que llenar el campo honeypot (vía devtools) no dispara ningún correo mientras el formulario reporta éxito. Verificación: los tres casos (éxito, error, honeypot) se comportan como lo define esta spec.

## Acceptance criteria

- [ ] La ruta `/acerca-de` muestra la pantalla "Acerca de" completa: hero de misión con highlights, divisor decorativo animado y sección de contacto con formulario.
- [ ] El Nav muestra el link "Acerca de" apuntando a `/acerca-de`, tanto en el menú de escritorio como en el menú móvil.
- [ ] El Nav resalta "Acerca de" como activo en `/acerca-de`, sin afectar el resaltado de "Inicio", "Biblioteca" ni "Salón de la Fama" en sus respectivas rutas.
- [ ] Las animaciones de scroll-reveal del divisor y la sección de contacto funcionan igual que en el prototipo (usando `HomeReveal`).
- [ ] Enviar el formulario con nombre, correo y mensaje válidos dispara un correo real a través de Resend, que llega a `CONTACT_TO_EMAIL`.
- [ ] Enviar el formulario con algún campo vacío o correo con formato inválido muestra la animación de "shake" y no dispara ningún envío.
- [ ] Tras un envío exitoso, se muestra la animación "terminal" de éxito con el nombre ingresado, igual que en el prototipo.
- [ ] Si Resend falla al enviar (p. ej. API key inválida), se muestra un mensaje de error inline dentro del formulario, y los datos ingresados no se pierden — el usuario puede reintentar.
- [ ] Si el campo honeypot llega con contenido, el formulario reporta éxito pero no se envía ningún correo a través de Resend.
- [ ] Ningún estilo existente de Home, Biblioteca, Detalle, Auth o Salón de la Fama se ve afectado tras fusionar las clases nuevas del About en `app/globals.css`.
- [ ] No hay enlaces rotos (404) al recorrer el flujo Inicio ↔ Biblioteca ↔ Salón de la Fama ↔ Acerca de ↔ Auth.

## Decisions

- **Sí:** ruta `/acerca-de`, consistente con el patrón en español ya usado en `/biblioteca` y `/salon-de-la-fama`. **No:** `/about` — habría roto la consistencia del resto de rutas de la app.
- **Sí:** agregar el link "Acerca de" al Nav en esta misma spec, a diferencia de la spec 02 que lo dejó fuera. **No:** dejarlo sin link — la pantalla quedaría inalcanzable desde la navegación normal.
- **Sí:** implementar el envío como **Server Action** (`app/acerca-de/actions.ts`) invocada con `useActionState`. **No:** un Route Handler (`app/api/contacto/route.ts`) — habría requerido más código (fetch manual desde el cliente) sin ninguna ventaja para un formulario que solo se usa desde esta misma página.
- **Sí:** usar el remitente sandbox `onboarding@resend.dev` de Resend, enviando únicamente a `CONTACT_TO_EMAIL` (el correo de la cuenta de Resend del usuario). **No:** verificar un dominio propio ahora — requiere acceso a DNS del dominio, fuera del alcance de esta spec. Queda documentado como riesgo/limitación conocida.
- **Sí:** dejar `RESEND_API_KEY` y `CONTACT_TO_EMAIL` en `.env.local` (ya creado, no versionado, cubierto por `.env*` en `.gitignore`). **No:** hardcodear la key en el código — expondría el secreto en el repositorio.
- **Sí:** validación básica manual (campos requeridos, formato de email con regex/`URL`-style check, límite de longitud), sin agregar `zod` u otra librería. **No:** una librería de validación — habría sido una dependencia nueva para un formulario de tres campos con reglas simples.
- **Sí:** honeypot simple como única protección anti-spam. **No:** rate limiting por IP — no hay infraestructura (KV, Redis, middleware) en el proyecto para soportarlo sin ampliar el alcance.
- **Sí:** reutilizar `HomeReveal` (`components/home-reveal.tsx`) tal cual para el scroll-reveal del About, ya que el componente ya está desacoplado de `FloatingSilhouettes` y no requiere extracción a un util compartido. **No:** duplicar el hook en un componente nuevo — habría sido código repetido innecesario.
- **Sí:** mensaje de error inline que conserva los datos del formulario ante fallos de Resend. **No:** mostrar igualmente el estado de éxito ante un fallo real — engañaría al usuario haciéndole creer que su mensaje llegó cuando no fue así.

## Identified risks

- **Límite del remitente sandbox de Resend:** `onboarding@resend.dev` solo permite enviar al correo registrado en la cuenta de Resend (`CONTACT_TO_EMAIL`). Cualquier intento de generalizar el destino (p. ej. un buzón de equipo distinto) requerirá verificar un dominio propio en Resend — fuera del alcance de esta spec. Mitigación: aceptado explícitamente como limitación conocida (ver Decisions).
- **Colisión de clases CSS:** algunas clases de `home-about/styles.css` (`.about-*`, `.contact-*`) podrían coincidir en nombre con clases ya definidas en `app/globals.css` portadas de otro archivo del prototipo. Mitigación: revisar cada clase nueva antes de fusionarla y renombrar si hay conflicto real (cubierto en el paso 2 del plan).
- **Rotación de API key de Resend:** si la key en `.env.local` se invalida o rota externamente, el formulario entrará en el estado de error de forma consistente hasta que se actualice la variable de entorno. Mitigación: el mensaje de error inline (paso 4 del plan) hace visible el fallo en vez de fallar silenciosamente.
- **Server Action como endpoint público:** como cualquier Server Action, `sendContactMessage` es alcanzable por cualquiera que replique el POST, no solo desde el formulario. Mitigación: la validación server-side (paso 3) y el honeypot tratan la entrada como no confiable, sin asumir que solo llega desde la UI.
