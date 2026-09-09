# SPEC 10 — Middleware de protección de rutas autenticadas

> **Status:** Implemented
> **Depends on:** 08-supabase-auth-email-password (Implemented), 09-security-hardening (Implemented)
> **Date:** 2026-09-09
> **Objective:** Implementar middleware de Next.js que proteja la ruta `/juegos/[id]/jugar` redirigiendo a `/auth?redirect=...` cuando no hay sesión autenticada, resolviendo la vulnerabilidad crítica S-01 detectada en la auditoría de seguridad.

## Scope

**In:**

- Crear archivo `middleware.ts` en la raíz del proyecto para interceptar requests a rutas protegidas.
- Proteger la ruta `/juegos/[id]/jugar` (reproductor de juegos): verificar sesión autenticada antes de permitir acceso.
- Si no hay sesión autenticada (`supabase.auth.getUser()` falla o devuelve `user = null`), redirigir a `/auth?redirect=/juegos/[id]/jugar` para que el usuario vuelva a la partida después del login.
- Si `supabase.auth.getUser()` falla con error (timeout, red, etc.), aplicar estrategia fail-closed: redirigir a `/auth` por seguridad.
- Usar `createServerClient` de `@supabase/ssr` en el middleware (Edge Runtime) para verificar la sesión del servidor.
- Configurar matcher de Next.js para que el middleware solo se ejecute en rutas que lo requieren (performance).
- Testing manual: probar acceso con sesión activa (debe pasar), sin sesión (debe redirigir), y después de login con redirect (debe volver a la ruta original).
- Re-auditar con el agente `security-audit` después de implementar para confirmar que el hallazgo S-01 se resuelve.

**Out of scope (para otras specs o configuración futura):**

- Proteger rutas adicionales más allá de `/juegos/[id]/jugar` (Biblioteca, Detalle, Salón de la Fama siguen siendo públicas según spec 08).
- Proteger rutas de API (`/api/*`) o Server Actions (ya están protegidas por validación de sesión en el código de cada action).
- Tests automatizados E2E con Playwright — se deja para una spec futura de testing si se requiere.
- Notificaciones o toasts antes de redirigir (redirect directo por simplicidad).
- Logging o analytics de intentos de acceso no autorizados.
- Rate limiting en el middleware para prevenir abuso (si se necesita, va en una spec futura).
- Protección de rutas de perfil o configuración (no existen todavía, se protegerán cuando se implementen).

## Data model

No hay cambios en el esquema de base de datos. El middleware lee la sesión existente gestionada por Supabase Auth (implementada en spec 08), sin modificar tablas, columnas, ni políticas RLS.

### Estructuras existentes que se usan

**Sesión de Supabase Auth:**

- El middleware llama `supabase.auth.getUser()` para obtener el usuario autenticado actual.
- La sesión persiste en cookies gestionadas por `@supabase/ssr` (configurado en spec 04).
- Si `user` existe → sesión válida, permitir acceso.
- Si `user` es `null` o la llamada falla → sin sesión, redirigir.

### Archivo nuevo creado

**`middleware.ts` (raíz del proyecto):**

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Proteger /juegos/[id]/jugar
    if (pathname.match(/^\/juegos\/[^\/]+\/jugar$/)) {
        let response = NextResponse.next({ request });

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                        response = NextResponse.next({ request });
                        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
                    },
                },
            },
        );

        const {
            data: { user },
            error,
        } = await supabase.auth.getUser();

        // Fail-closed: si hay error o no hay usuario, redirigir
        if (error || !user) {
            const redirectUrl = new URL('/auth', request.url);
            redirectUrl.searchParams.set('redirect', pathname);
            return NextResponse.redirect(redirectUrl);
        }

        return response;
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/juegos/:path*/jugar'],
};
```

## Implementation plan

1. **Crear `middleware.ts` en la raíz del proyecto** con el código del data model: verificar sesión con `createServerClient` de `@supabase/ssr`, proteger `/juegos/[id]/jugar` con matcher, redirigir a `/auth?redirect=...` si no hay sesión o hay error (fail-closed). **Verificación:** El archivo existe en la raíz con el código completo del contrato.

2. **Compilar el proyecto** con `npm run build` para verificar que el middleware no introduce errores de TypeScript o configuración de Next.js. **Verificación:** El build completa exitosamente sin errores relacionados con `middleware.ts`.

3. **Arrancar servidor de desarrollo** con `npm run dev` y verificar que no hay warnings relacionados con el middleware en la consola. **Verificación:** El servidor arranca limpiamente, sin errores ni warnings del middleware.

4. **Testing manual - acceso sin sesión:** Cerrar sesión (si hay una activa), navegar directamente a `/juegos/asteroides/jugar` desde la barra de direcciones. **Verificación:** Redirige automáticamente a `/auth?redirect=/juegos/asteroides/jugar` sin mostrar el reproductor.

5. **Testing manual - acceso con sesión:** Hacer login con un usuario válido (ej: `neonfox@mock.com` / `Test-001!`), luego navegar a `/juegos/asteroides/jugar`. **Verificación:** El reproductor carga correctamente sin redirección, la partida es jugable.

6. **Testing manual - flujo de redirect completo:** Sin sesión, intentar acceder a `/juegos/tetris/jugar` (redirige a `/auth?redirect=/juegos/tetris/jugar`), completar login en `/auth`, **Verificación:** Después del login, redirige automáticamente de vuelta a `/juegos/tetris/jugar` (no a `/biblioteca` ni otra ruta).

7. **Verificar rutas no protegidas:** Con y sin sesión, navegar a `/` (Home), `/biblioteca` (Biblioteca), `/juegos/asteroides` (Detalle), `/salon-de-la-fama` (Salón). **Verificación:** Todas estas rutas siguen siendo accesibles sin autenticación (públicas según spec 08), el middleware no las intercepta.

8. **Re-auditar con `security-audit`:** Ejecutar `audita seguridad` para generar un nuevo reporte de auditoría. **Verificación:** El nuevo reporte en `references/security/security-audit-YYYY-MM-DD.md` NO lista el hallazgo S-01 (middleware ausente), o lo lista como resuelto; la calificación general mejora de CRÍTICO a MEDIO o BAJO.

9. **Actualizar estado de la spec 08 (opcional):** Si se desea documentar explícitamente, agregar nota en `specs/08-supabase-auth-email-password.md` indicando que el control de middleware fue implementado en spec 10. **Verificación:** La nota aparece en la sección de "Implementation notes" o al final de la spec 08 (este paso es cosmético, no bloquea el acceptance de la spec 10).

10. **Actualizar `CLAUDE.md` con la nueva feature:** Agregar entrada en la sección de "Supabase" → "Autenticación (spec 08)" documentando que el `middleware.ts` protege la ruta `/juegos/[id]/jugar` redirigiendo a `/auth?redirect=...` cuando no hay sesión (spec 10). **Verificación:** El CLAUDE.md menciona explícitamente el middleware como parte del sistema de autenticación.

11. **Verificación final end-to-end:** Sin sesión → intentar jugar → redirige a auth → registrarse o login → vuelve a la partida → jugar → guardar puntaje → confirmar que el puntaje aparece en leaderboard bajo el nombre correcto. **Verificación:** Flujo completo funciona de punta a punta sin errores ni comportamientos inesperados.

## Acceptance criteria

- [ ] Existe el archivo `middleware.ts` en la raíz del proyecto con el código del data model.
- [ ] El middleware usa `createServerClient` de `@supabase/ssr` para verificar la sesión en Edge Runtime.
- [ ] El middleware protege la ruta `/juegos/[id]/jugar` mediante matcher `/juegos/:path*/jugar`.
- [ ] Navegar a `/juegos/asteroides/jugar` sin sesión autenticada redirige a `/auth?redirect=/juegos/asteroides/jugar`.
- [ ] Navegar a `/juegos/tetris/jugar` sin sesión autenticada redirige a `/auth?redirect=/juegos/tetris/jugar`.
- [ ] Con sesión autenticada, navegar a `/juegos/[id]/jugar` carga el reproductor correctamente sin redirección.
- [ ] Después de hacer login desde `/auth?redirect=/juegos/[id]/jugar`, redirige automáticamente de vuelta a `/juegos/[id]/jugar` (no a `/biblioteca`).
- [ ] Las rutas públicas (`/`, `/biblioteca`, `/juegos/[id]`, `/salon-de-la-fama`, `/acerca-de`) son accesibles sin autenticación (el middleware no las intercepta).
- [ ] Si `supabase.auth.getUser()` falla con error (simulado o real), el middleware redirige a `/auth` (fail-closed, no deja pasar).
- [ ] `npm run build` compila exitosamente sin errores relacionados con `middleware.ts`.
- [ ] `npm run dev` arranca sin warnings relacionados con el middleware.
- [ ] `npm run lint` pasa sin errores nuevos introducidos por el middleware.
- [ ] Ejecutar `audita seguridad` genera un nuevo reporte que NO lista el hallazgo S-01 como pendiente, o lo marca como resuelto.
- [ ] El nuevo reporte de auditoría mejora la calificación general (de CRÍTICO pasa a MEDIO o BAJO, dependiendo de otros hallazgos).
- [ ] `CLAUDE.md` documenta explícitamente que `middleware.ts` protege `/juegos/[id]/jugar` en la sección de autenticación.
- [ ] Flujo end-to-end completo: sin sesión → intentar jugar → redirige a auth → login → vuelve a partida → jugar → guardar puntaje → aparece en leaderboard con el nombre correcto.

## Decisions taken and discarded

- **Sí:** proteger solo `/juegos/[id]/jugar` en esta spec. **No:** proteger todas las rutas por defecto con allowlist de rutas públicas — las specs 08 y 09 establecieron explícitamente que Biblioteca, Detalle y Salón de la Fama son públicas; proteger solo la ruta de juego es suficiente para resolver S-01 y cumple el scope original de la spec 08.

- **Sí:** implementar protección con middleware de Next.js en la raíz. **No:** protección a nivel de componente (verificar sesión en `page.tsx` de `/juegos/[id]/jugar`) — el middleware intercepta antes de renderizar la página, es más eficiente (corre en Edge), más seguro (no depende de que el componente haga la verificación), y es el patrón recomendado de Next.js + Supabase SSR para proteger rutas.

- **Sí:** redirect directo a `/auth?redirect=...` sin notificación intermedia. **No:** mostrar toast o modal explicando por qué redirige — la redirección es clara por contexto (el usuario intentó acceder a contenido protegido), y agregar un paso intermedio complica la UX sin aportar información útil; la spec 08 ya estableció este comportamiento.

- **Sí:** estrategia fail-closed cuando `supabase.auth.getUser()` falla con error. **No:** fail-open (dejar pasar si hay error) — en seguridad es mejor ser conservador; un error transitorio de red no debería permitir acceso a contenido protegido; el usuario puede reintentar después de que se resuelva el error.

- **Sí:** testing manual en esta spec. **No:** tests E2E automatizados con Playwright — el proyecto no tiene suite de tests E2E todavía, y escribirla excede el scope de esta spec (que es resolver S-01); los tests automatizados pueden agregarse en una spec futura dedicada a testing si se considera necesario.

- **Sí:** usar `createServerClient` de `@supabase/ssr` en el middleware. **No:** usar `createClient` del browser — el middleware corre en Edge Runtime (servidor), no tiene acceso a `window` ni `localStorage`; `createServerClient` es la única opción compatible con middleware de Next.js según la documentación de Supabase SSR.

- **Sí:** configurar matcher de Next.js (`matcher: ['/juegos/:path*/jugar']`) para que el middleware solo corra en rutas protegidas. **No:** ejecutar el middleware en todas las rutas y filtrar internamente — el matcher optimiza performance al evitar ejecutar lógica de verificación de sesión en rutas públicas que no lo necesitan.

- **Sí:** incluir re-auditoría con `security-audit` como paso del plan de implementación. **No:** considerar la spec terminada sin verificar que S-01 se resuelve — el hallazgo S-01 fue el motivo de esta spec, así que la verificación de su resolución es parte integral del acceptance; la re-auditoría también confirma que no se introducen nuevas vulnerabilidades.

- **Sí:** mantener el query param `redirect` con el pathname completo. **No:** solo guardar el `id` del juego y reconstruir la ruta — preservar el pathname completo es más robusto (funciona si en el futuro hay más rutas protegidas con estructura diferente) y es el patrón estándar de "return to intended destination" en autenticación web.

- **No:** agregar logging de intentos de acceso no autorizados en esta spec. **Sí:** dejarlo para una spec futura de observability/analytics si se requiere — loggear intentos de acceso excede el scope de resolver S-01; primero hay que proteger la ruta, luego (opcionalmente) agregar observability.

- **No:** implementar rate limiting en el middleware. **Sí:** dejarlo fuera de esta spec — el rate limiting es una capa de defensa adicional contra abuso, no es requisito para resolver S-01 (que es sobre autenticación, no sobre DoS); si se necesita, va en una spec futura dedicada a rate limiting.

## Identified risks

| Risk                                                                                                                                                                                                                                                  | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El middleware usa `createServerClient` de `@supabase/ssr` con configuración incorrecta de cookies, rompiendo la verificación de sesión (siempre devuelve `user = null` aunque haya sesión válida).                                                    | Copiar el código exacto del data model (ya validado contra docs de Supabase SSR), verificar en paso 5 del plan que con sesión activa el acceso funciona; si falla, revisar que `getAll()` y `setAll()` estén implementados correctamente.                                                                                                                                                                                                                                           |
| Race condition: usuario tiene sesión válida pero las cookies no se han sincronizado todavía entre cliente y servidor, causando redirect inesperado en la primera carga.                                                                               | Mitigación parcial: `setAll()` en el middleware actualiza las cookies en la respuesta; si ocurre, el usuario hace refresh y la segunda carga funciona (las cookies ya están sincronizadas); impacto bajo porque es transitorio y auto-corrige.                                                                                                                                                                                                                                      |
| El middleware degrada performance al ejecutarse en cada request a `/juegos/[id]/jugar`, especialmente si `supabase.auth.getUser()` es lento.                                                                                                          | El matcher limita ejecución solo a rutas protegidas (no corre en `/`, `/biblioteca`, etc.); Edge Runtime es rápido; `getUser()` cachea la sesión; en el peor caso (100ms de latencia) es imperceptible para el usuario; si se vuelve problema a escala, considerar cachear sesión en memoria del middleware (spec futura).                                                                                                                                                          |
| Redirect loop: si `/auth` también está protegido por el middleware, redirige a sí misma infinitamente.                                                                                                                                                | El código del middleware solo protege rutas que matchean `/juegos/:path*/jugar` (matcher explícito); `/auth` nunca matchea ese patrón, así que nunca se protege; verificar en paso 4 del plan que el redirect a `/auth` funciona sin loop.                                                                                                                                                                                                                                          |
| Usuario con sesión caducada (token expirado pero cookie todavía presente) accede a `/juegos/[id]/jugar` — `getUser()` falla, redirige a `/auth`, pero al llegar a `/auth` la sesión sigue caducada y el formulario de login no muestra mensaje claro. | El redirect limpia el estado de sesión caducada (Supabase SSR maneja esto automáticamente); cuando llega a `/auth`, el usuario ve el formulario limpio y puede hacer login normal; si persiste, la spec 08 ya maneja sesiones caducadas en `signInAction`; no requiere cambios en esta spec.                                                                                                                                                                                        |
| El matcher `/juegos/:path*/jugar` no coincide con rutas edge case (ej: `/juegos/asteroides/jugar?foo=bar`, `/juegos/asteroides/jugar/`, `/juegos/ASTEROIDES/jugar`).                                                                                  | Query params (`?foo=bar`) no afectan el pathname, así que matchea correctamente; trailing slash (`/jugar/`) es edge case — Next.js normaliza automáticamente rutas con/sin trailing slash según config; case sensitivity (`ASTEROIDES` vs `asteroides`) — Next.js rutas son case-sensitive por defecto, así que `/juegos/ASTEROIDES/jugar` NO matchea y no está protegida (comportamiento correcto: esa ruta devuelve 404 de todas formas porque los `id` de juegos son lowercase). |
| Después de implementar el middleware, la re-auditoría sigue reportando S-01 porque el agente no detecta el archivo o hay un falso negativo.                                                                                                           | Si `audita seguridad` sigue reportando S-01 después del paso 8, verificar manualmente que `middleware.ts` existe y funciona (pasos 4-7 confirman funcionalidad); si el agente tiene un bug de detección, reportar el issue pero considerar la spec cumplida si los acceptance criteria manuales pasan; el hallazgo S-01 se basa en ausencia de archivo, no en comportamiento, así que su presencia debería resolverlo.                                                              |
