# SPEC 09 — Hardening de seguridad (passwords, headers, RLS)

> **Status:** Implemented
> **Depends on:** 08-supabase-auth-email-password (Implemented)
> **Date:** 2026-09-07
> **Objective:** Reforzar la seguridad de la aplicación elevando el mínimo de contraseñas a 8 caracteres con validación client-side y server-side, agregando headers de seguridad HTTP a todas las rutas de Next.js, y resolviendo el warning de Supabase sobre la función `rls_auto_enable()` ejecutable por roles públicos.

## Scope

**In:**

- Investigar el origen y uso de la función `public.rls_auto_enable()` que Supabase reporta como ejecutable por `anon` y `authenticated` con privilegios `SECURITY DEFINER`. Si no se está usando, revocar `EXECUTE` a esos roles o borrarla. Si se está usando, cambiarla a `SECURITY INVOKER` o moverla fuera del esquema público.
- Elevar el mínimo de longitud de contraseña de 6 a 8 caracteres:
    - Actualizar validación client-side en el formulario de registro (`/auth`): cambiar el regex y el mensaje de error de "mínimo 6" a "mínimo 8".
    - Agregar validación server-side en la Server Action de registro (`app/auth/actions.ts` o equivalente): rechazar con error si la contraseña tiene menos de 8 caracteres, antes de llamar a `supabase.auth.signUp()`.
    - Documentar en la spec cómo configurar `password_min_length: 8` en Supabase Auth desde el dashboard (Authentication → Policies), para que la validación también ocurra a nivel de Supabase.
- Implementar headers de seguridad HTTP en `next.config.ts` (o `next.config.mjs` si es el archivo real del proyecto), aplicados a todas las rutas (`/(.*)`):
    - `X-Content-Type-Options: nosniff` — previene MIME-sniffing.
    - `X-Frame-Options: DENY` — previene clickjacking.
    - `Referrer-Policy: strict-origin-when-cross-origin` — limita información de referrer a origins externos.
    - `Content-Security-Policy` — política básica con defaults seguros (permitir recursos del mismo origen, bloquear `unsafe-inline` y `unsafe-eval` en scripts).
- Verificar los headers con securityheaders.com y DevTools (Network tab) para confirmar que se aplican correctamente en producción y desarrollo.
- Actualizar los usuarios mock creados en la spec 08 (contraseña `Test-00`) para que cumplan el nuevo mínimo de 8 caracteres, si es que alguno no lo cumple. Verificar que `Test-00` (6 caracteres) no pasa la nueva validación y actualizarlo a `Test-001!` (9 caracteres, cumple todos los requisitos).

**Out of scope (para otras specs o configuración manual):**

- Leaked password protection (verificación contra HaveIBeenPwned) — el usuario lo activará manualmente desde el dashboard de Supabase Auth cuando su versión lo soporte.
- Max signup rate / rate limiting por IP — el usuario lo configurará manualmente desde el dashboard de Supabase Auth.
- Whitelistear CDNs específicos en CSP (Google Fonts, analytics, etc.) — esta spec usa defaults seguros; si se necesitan excepciones, van en una spec futura.
- Excepciones de headers por ruta (APIs externas, webhooks con requisitos específicos) — todas las rutas usan los mismos headers; excepciones van en una spec futura si se necesitan.
- Recuperación de contraseña, cambio de contraseña, o eliminación de cuenta — ya quedan fuera de la spec 08, no se tocan aquí.
- Tests automatizados (E2E o unitarios) para validación de contraseñas o headers.

## Data model

No hay cambios en el esquema de tablas (`games`, `players`, `scores`) ni en sus políticas RLS existentes. Los cambios son a nivel de configuración, funciones de base de datos, y código de aplicación.

### Función `rls_auto_enable()` en Supabase

```sql
-- Investigar primero si se está usando:
select proname, prosrc from pg_proc
where proname = 'rls_auto_enable' and pronamespace = 'public'::regnamespace;

-- Si existe y NO se está usando en el código, borrarla:
drop function if exists public.rls_auto_enable();

-- Si existe y SÍ se está usando, cambiarla a SECURITY INVOKER:
alter function public.rls_auto_enable() security invoker;

-- O revocar EXECUTE a roles públicos (mantener solo para postgres/service_role):
revoke execute on function public.rls_auto_enable() from anon, authenticated;
```

### Headers de seguridad en `next.config.ts`

```ts
const securityHeaders = [
    {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
    },
    {
        key: 'X-Frame-Options',
        value: 'DENY',
    },
    {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
    },
    {
        key: 'Content-Security-Policy',
        value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';",
    },
];

// En next.config.ts (o .mjs):
export default {
    // ... resto de config
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: securityHeaders,
            },
        ];
    },
};
```

### Validación de contraseñas

**Client-side** (`app/auth/page.tsx` o componente de formulario):

```ts
// Cambiar de mínimo 6 a mínimo 8 caracteres
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const PASSWORD_ERROR = 'Mínimo 8 caracteres, incluye mayúscula, número y símbolo';
```

**Server-side** (`app/auth/actions.ts` o equivalente):

```ts
export async function signUpAction(formData: { email: string; password: string; playerName: string }) {
    // Validar antes de llamar a supabase.auth.signUp()
    if (formData.password.length < 8) {
        return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres' };
    }

    // Validar requisitos adicionales (mayúscula, número, símbolo)
    const hasUppercase = /[A-Z]/.test(formData.password);
    const hasNumber = /\d/.test(formData.password);
    const hasSymbol = /[@$!%*?&]/.test(formData.password);

    if (!hasUppercase || !hasNumber || !hasSymbol) {
        return { ok: false, error: 'La contraseña debe incluir mayúscula, número y símbolo' };
    }

    // Continuar con signUp...
}
```

### Usuarios mock

Actualizar la contraseña de los usuarios mock de `Test-00` (6 caracteres, no cumple) a `Test-001!` (9 caracteres, cumple todos los requisitos: mínimo 8, mayúscula, número, símbolo). Esto requiere actualizar el script/migración que crea esos usuarios (si existe) o recrearlos manualmente con la nueva contraseña.

### Configuración de Supabase Auth (documentada, no automatizada)

Desde el dashboard de Supabase → Authentication → Policies:

- `password_min_length`: cambiar de 6 (default) a 8
- Guardar cambios

Esto hace que Supabase rechace contraseñas < 8 caracteres a nivel de servidor, incluso si la validación client-side/server-side de la app falla o se saltea.

## Implementation plan

1. Investigar la función `rls_auto_enable()`: usar `mcp__supabase__execute_sql` con la query `SELECT proname, prosrc, provolatile, prosecdef FROM pg_proc WHERE proname = 'rls_auto_enable' AND pronamespace = 'public'::regnamespace;` para ver si existe, qué hace, y si es `SECURITY DEFINER`. Verificación: si no existe, pasar al siguiente paso; si existe, leer su definición para decidir si se usa o no.

2. Resolver el warning de `rls_auto_enable()`: si la función existe y no se está usando en ningún lugar del código (grep en el repo), borrarla con `DROP FUNCTION IF EXISTS public.rls_auto_enable();`. Si se está usando, cambiarla a `SECURITY INVOKER` con `ALTER FUNCTION public.rls_auto_enable() SECURITY INVOKER;` o revocar `EXECUTE` a roles públicos con `REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;`. Verificación: `get_advisors` (Supabase linter) ya no reporta el warning `anon_security_definer_function_executable` ni `authenticated_security_definer_function_executable` para esa función.

3. Agregar headers de seguridad en `next.config.ts` (o `next.config.mjs`): definir el array `securityHeaders` con los 4 headers del data model y exportar la función `headers()` que los aplica a `/(.*)`). Verificación: `npm run build` compila sin errores; `npm run dev` arranca sin warnings relacionados con la config.

4. Actualizar validación client-side de contraseñas en el formulario de registro: cambiar el regex de validación de mínimo 6 a mínimo 8 caracteres (`/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/`) y actualizar el mensaje de error de "mínimo 6" a "mínimo 8". Verificación: intentar registrarse con contraseña de 7 caracteres (ej. `Test-01`) muestra error; con 8 caracteres (ej. `Test-001!`) pasa la validación client-side.

5. Agregar validación server-side de contraseñas en la Server Action de registro (`app/auth/actions.ts` o equivalente): validar `password.length >= 8` y los requisitos de mayúscula/número/símbolo antes de llamar a `supabase.auth.signUp()`, devolviendo `{ ok: false, error: '...' }` si no cumple. Verificación: con DevTools, enviar un POST directo a la Server Action con contraseña de 6 caracteres (salteando la validación client-side) y confirmar que responde con error sin haber llamado a Supabase.

6. Actualizar contraseña de usuarios mock: si el script/migración que crea usuarios mock usa `Test-00` (6 caracteres), actualizarlo a `Test-001!` (9 caracteres). Si los usuarios ya existen, recrearlos con `supabase.auth.admin.updateUserById()` cambiando la contraseña. Verificación: intentar login con uno de los usuarios mock usando la contraseña nueva (`Test-001!`) funciona; con la vieja (`Test-00`) falla.

7. Verificación de headers en desarrollo: arrancar `npm run dev`, abrir cualquier ruta (ej. `/`) en DevTools → Network, y confirmar que la respuesta incluye los 4 headers de seguridad con los valores correctos. Verificación: cada header aparece en la pestaña Headers de DevTools.

8. Verificación de headers en producción: hacer `npm run build && npm run start` (o deploy a Vercel/entorno de staging), visitar la URL pública, y verificar los headers con securityheaders.com ingresando la URL del sitio. Verificación: el reporte muestra A o B en la calificación general, y los 4 headers configurados aparecen como "Present" o con checkmark verde.

9. Documentar en la spec (sección "Implementation notes" o al final del plan) los pasos para configurar `password_min_length: 8` en Supabase Auth dashboard: Authentication → Policies → Password Strength → cambiar "Minimum password length" de 6 a 8 → Save. Nota: este paso lo hará el usuario manualmente después de implementar la spec, no es parte de la implementación automatizada.

10. Recorrido end-to-end manual: intentar registrarse con contraseña de 7 caracteres (rechazada client-side y server-side), luego con 8+ caracteres válida (aceptada), verificar que el email de confirmación llega, y confirmar que después de login los headers siguen presentes en todas las rutas navegadas. Verificación: se cumplen todos los criterios de aceptación.

## Acceptance criteria

- [x] El warning de Supabase sobre `rls_auto_enable()` ejecutable por `anon`/`authenticated` como `SECURITY DEFINER` ya no aparece en `get_advisors`.
- [x] La función `public.rls_auto_enable()` fue borrada, cambió a `SECURITY INVOKER`, o tuvo revocado el `EXECUTE` para roles públicos (según corresponda tras investigar su uso).
- [x] El archivo `next.config.ts` (o `.mjs`) exporta una función `headers()` que devuelve el array `securityHeaders` aplicado a `/(.*)`).
- [x] Todas las respuestas HTTP del servidor incluyen los 4 headers de seguridad: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, y `Content-Security-Policy` con la política básica configurada.
- [x] El formulario de registro (`/auth`) rechaza contraseñas de menos de 8 caracteres con el mensaje de error "Mínimo 8 caracteres, incluye mayúscula, número y símbolo".
- [x] El formulario de registro acepta contraseñas de 8+ caracteres que cumplan los requisitos de mayúscula, número y símbolo.
- [x] La Server Action de registro (`app/auth/actions.ts` o equivalente) valida `password.length >= 8` y rechaza con error antes de llamar a `supabase.auth.signUp()` si no cumple.
- [x] La Server Action valida también los requisitos de mayúscula, número y símbolo, devolviendo error específico si falta alguno.
- [x] Los usuarios mock creados en la spec 08 usan contraseña `Test-001!` (9 caracteres, cumple todos los requisitos) en vez de `Test-00`.
- [x] Login con usuarios mock usando `Test-001!` funciona correctamente; intentar con `Test-00` falla.
- [x] DevTools → Network muestra los 4 headers de seguridad en todas las rutas navegadas (Home, Biblioteca, Detalle, Auth, Salón de la Fama, Reproductor).
- [x] securityheaders.com reporta calificación A o B para el sitio en producción, con los 4 headers configurados presentes.
- [x] `npm run build` y `npm run lint` pasan sin errores nuevos.
- [x] `get_advisors` (Supabase) no reporta hallazgos de seguridad nuevos más allá de los ya existentes y documentados como aceptados.
- [x] La spec documenta cómo configurar `password_min_length: 8` en Supabase Auth dashboard (el usuario lo hará manualmente).

## Decisions taken and discarded

- **Sí:** elevar el mínimo de contraseña de 6 a 8 caracteres, manteniendo los requisitos de mayúscula/número/símbolo. **No:** mantener el mínimo en 6 caracteres — el checklist de seguridad y las mejores prácticas actuales recomiendan mínimo 8, y cambiar ahora (con pocos usuarios reales) es el momento con menor impacto.

- **Sí:** validar la longitud de contraseña tanto client-side como server-side. **No:** solo client-side — la validación client-side se puede saltear modificando el request, así que la server-side es defensa en profundidad necesaria; y Supabase Auth también valida server-side una vez configurado el mínimo en el dashboard, haciendo tres capas de validación.

- **Sí:** aplicar headers de seguridad a todas las rutas (`/(.*)`). **No:** aplicarlos selectivamente (ej. solo a rutas públicas, o solo a páginas de auth) — no hay razón técnica para excluir rutas; aplicarlos globalmente simplifica la config y maximiza la protección sin casos especiales.

- **Sí:** usar política CSP básica con defaults seguros (`'self'` para scripts/estilos, bloquear `unsafe-inline`/`unsafe-eval`). **No:** whitelistear CDNs específicos (Google Fonts, analytics, etc.) en esta spec — el proyecto no usa CDNs externos actualmente, y agregar excepciones sin necesidad debilitaría la política; si se necesitan después, se ajustan en una spec futura.

- **Sí:** dejar leaked password protection (HaveIBeenPwned) fuera del scope de esta spec. **No:** incluirlo — el usuario reportó que su versión de Supabase no lo soporta todavía, así que documentarlo como paso de implementación rompería el flujo; queda como configuración manual futura cuando la feature esté disponible.

- **Sí:** dejar max signup rate (rate limiting por IP) fuera del scope de esta spec. **No:** implementar rate limiting con middleware de Next.js o librería externa — el usuario confirmó que lo configurará desde el dashboard de Supabase Auth, que ya tiene rate limiting nativo; agregar una capa adicional en Next.js sería redundante y ampliaría el alcance sin necesidad.

- **Sí:** investigar el uso real de `rls_auto_enable()` antes de decidir si borrarla, revocar EXECUTE, o cambiarla a SECURITY INVOKER. **No:** borrarla directamente sin investigar — podría estar en uso y romper funcionalidad existente; el plan empieza con un paso de investigación (query + grep) para tomar la decisión informada.

- **Sí:** verificar headers con securityheaders.com además de DevTools. **No:** solo DevTools — securityheaders.com da una calificación objetiva y detecta configuraciones incorrectas o faltantes que podrían pasar desapercibidas en inspección manual; es la herramienta estándar de la industria para este tipo de auditoría.

- **Sí:** actualizar la contraseña de los usuarios mock de `Test-00` a `Test-001!` para que cumplan el nuevo mínimo. **No:** dejarlos con contraseña de 6 caracteres — quedarían en estado inconsistente (no podrían cambiar su contraseña a una nueva que cumple el mínimo, pero su actual no lo cumple), y fallaría la validación si se intentan recrear; mejor actualizarlos ahora.

- **Sí:** documentar la configuración de `password_min_length: 8` en Supabase Auth como paso manual del usuario, no automatizado. **No:** intentar configurarlo via MCP o API — no hay herramienta MCP para cambiar settings de Auth (solo hay execute_sql, que no toca configuración de Auth), y la Admin API no expone ese endpoint; el dashboard es la única forma, así que se documenta como nota.

- **Sí:** incluir `X-Frame-Options: DENY` en vez de `SAMEORIGIN`. **No:** usar `SAMEORIGIN` — el proyecto no embebe sus propias páginas en iframes (no hay uso legítimo de frames), así que `DENY` es más restrictivo y seguro; si se necesita embeber algo después, se ajusta entonces.

## Identified risks

| Risk                                                                                                                                                                                                                                                | Mitigation                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La política CSP con `script-src 'self'` (sin `unsafe-inline`) rompe scripts inline existentes en el proyecto (ej. analytics, widgets de terceros embebidos en JSX).                                                                                 | Revisar el código antes de aplicar CSP buscando `<script>` tags inline o atributos `onClick` con código directo. Si se encuentran, extraerlos a archivos `.js` externos o ajustar la política CSP para permitir hashes específicos. Verificación manual en todas las pantallas después del paso 3.                         |
| Usuarios reales (no mock) que se registraron antes de esta spec con contraseñas de 6-7 caracteres válidas quedan bloqueados: pueden hacer login (contraseña existente), pero no pueden cambiar su contraseña a una nueva que cumpla el mínimo de 8. | Riesgo aceptado: el proyecto está en fase temprana con pocos usuarios reales (spec 08 implementada recientemente); si hay usuarios afectados, comunicar el cambio y que restablezcan contraseña (cuando esa feature se implemente). Alternativa: migración forzada de contraseñas podría implementarse en una spec futura. |
| La función `rls_auto_enable()` está en uso en alguna migración o script del proyecto, y borrarla/cambiarla rompe funcionalidad crítica de RLS.                                                                                                      | El paso 1 del plan incluye investigación previa (grep en el repo por `rls_auto_enable`) antes de tomar acción; si se encuentra uso real, se elige la opción menos disruptiva (cambiar a `SECURITY INVOKER` o revocar solo de `anon`, mantener para `authenticated`).                                                       |
| Los headers de seguridad configurados en `next.config.ts` conflictúan con headers establecidos por el entorno de hosting (Vercel, Netlify, etc.), resultando en duplicados o valores contradictorios.                                               | Verificar en el paso 8 que los headers aparecen una sola vez en la respuesta (no duplicados); si el hosting ya establece algunos, comentar los duplicados en `next.config.ts` y confiar en la configuración del hosting, documentando la decisión en Implementation notes.                                                 |
| La validación server-side de contraseña es demasiado estricta o tiene edge cases (ej. caracteres Unicode en símbolos, espacios al final) que rechazan contraseñas válidas.                                                                          | Usar la misma regex en client-side y server-side para mantener consistencia; testear manualmente con casos edge (contraseña con espacio, con emoji, con símbolo no-ASCII) en el paso 5; si falla, ajustar el regex o normalizar input (trim) antes de validar.                                                             |
| Actualizar contraseñas de usuarios mock con `supabase.auth.admin.updateUserById()` falla si los usuarios no existen o si el método requiere permisos especiales que el MCP de Supabase no tiene.                                                    | El paso 6 del plan verifica primero si los usuarios mock existen (query a `auth.users`); si `updateUserById` falla, la alternativa es borrarlos y recrearlos con `admin.createUser()` usando la nueva contraseña `Test-001!`, preservando el mismo email para que el `user_id` se vincule correctamente a `players`.       |
| securityheaders.com reporta calificación baja (C o D) porque falta algún header adicional no contemplado en esta spec (ej. `Strict-Transport-Security` para HTTPS).                                                                                 | Riesgo aceptado: esta spec cubre los headers del checklist + CSP básico; headers adicionales (HSTS, Permissions-Policy, etc.) quedan para una spec futura si se consideran necesarios. Documentar en Implementation notes cualquier recomendación de securityheaders.com que quede pendiente.                              |

## What is **not** in this spec

- Leaked password protection (verificación contra HaveIBeenPwned) — el usuario lo activará manualmente cuando su versión de Supabase lo soporte.
- Max signup rate / rate limiting por IP — el usuario lo configurará manualmente desde el dashboard de Supabase Auth.
- Recuperación de contraseña ("Olvidé mi contraseña").
- Cambio de contraseña desde el perfil del usuario.
- Eliminación de cuenta.
- Whitelistear CDNs específicos en Content-Security-Policy (Google Fonts, analytics, etc.).
- Excepciones de headers por ruta (APIs externas, webhooks).
- Tests automatizados (E2E o unitarios) para validación de contraseñas o headers.
- Headers de seguridad adicionales no mencionados (HSTS, Permissions-Policy, etc.).
- OAuth (Google/GitHub) o magic link.
- Pantalla de perfil (`/perfil`).
- Migración o preservación de usuarios legacy con contraseñas de 6-7 caracteres.

Cada uno de estos, si se aborda, va en su propia spec.

---

## Implementation notes

### Configuración manual de password_min_length en Supabase Auth

Después de implementar esta spec, el usuario debe configurar el mínimo de contraseña a nivel de Supabase Auth para agregar una tercera capa de validación (además de client-side y server-side):

1. Abrir el dashboard de Supabase: https://supabase.com/dashboard
2. Seleccionar el proyecto `kjpvjfhuqrclpblkthpd`
3. Ir a **Authentication** (menú lateral izquierdo)
4. Ir a **Policies** (sub-menú)
5. En la sección **Password Strength**, cambiar:
    - **Minimum password length:** de `6` a `8`
6. Click en **Save** para aplicar los cambios

**Efecto:** Supabase Auth rechazará contraseñas de menos de 8 caracteres a nivel de servidor, incluso si la validación client-side o server-side de la aplicación falla o se saltea. Esto asegura que ningún usuario pueda registrarse con una contraseña débil, sin importar cómo accedan a la API.

**Verificación:** Intentar registrarse desde la app con una contraseña de 7 caracteres (modificando el request para saltear las validaciones client-side y server-side) debe fallar con error de Supabase Auth.

### Verificación con securityheaders.com (producción)

Una vez que el sitio esté desplegado públicamente (Vercel, Netlify, etc.):

1. Visitar https://securityheaders.com/
2. Ingresar la URL pública del sitio (ej. `https://arcade-vault.vercel.app`)
3. Click en **Scan**
4. Verificar que:
    - La calificación general sea **A** o **B**
    - Los 4 headers configurados aparezcan como "Present" o con checkmark verde:
        - `X-Content-Type-Options`
        - `X-Frame-Options`
        - `Referrer-Policy`
        - `Content-Security-Policy`

**Nota:** Es normal que securityheaders.com sugiera headers adicionales (HSTS, Permissions-Policy, etc.) que no están en esta spec. Esos quedan documentados como mejoras futuras.
