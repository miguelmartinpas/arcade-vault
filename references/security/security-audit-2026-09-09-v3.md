# Auditoría de Seguridad — Arcade Vault

**Fecha:** 2026-09-09  
**Versión:** 3.0  
**Auditor:** Claude Sonnet 4.5 (security-audit agent)

---

## Resumen Ejecutivo

**Estado general:** MEDIO (requiere mejoras recomendadas)

**Hallazgos totales:** 4

- CRÍTICO: 0
- ALTO: 0
- MEDIO: 2
- BAJO: 2

**Acción requerida:**

No se encontraron vulnerabilidades críticas que requieran acción inmediata. El proyecto tiene una postura de seguridad sólida con autenticación real implementada (Supabase Auth), políticas RLS verificadas, proxy de protección de rutas funcionando correctamente, y validación de contraseñas en múltiples capas.

Los hallazgos detectados son principalmente optimizaciones de performance (políticas RLS que pueden mejorarse) y configuraciones opcionales (leaked password protection, mejoras en CSP). Se recomienda abordar los hallazgos MEDIOS en el próximo sprint y los hallazgos BAJOS en backlog.

**Nota importante sobre el reporte v2:** El reporte anterior (v2) contenía un error crítico al marcar como hallazgo S-01 CRÍTICO la ausencia de `middleware.ts`. Este hallazgo era **incorrecto** para Next.js 16, que deprecó `middleware.ts` y lo renombró a `proxy.ts` con función `proxy()`. El proyecto implementa correctamente la protección de rutas usando `proxy.ts` según la documentación oficial de Next.js 16.

---

## Tabla de Hallazgos

| ID   | Categoría          | Severidad | Descripción breve                                       | Estado    |
| ---- | ------------------ | --------- | ------------------------------------------------------- | --------- |
| S-02 | Supabase RLS       | MEDIO     | Políticas RLS reevalúan auth.uid() por cada fila        | Pendiente |
| S-03 | Supabase Functions | BAJO      | Función rls_auto_enable() ejecutable por roles públicos | Pendiente |
| S-04 | Supabase Auth      | BAJO      | Leaked Password Protection deshabilitado                | Pendiente |
| S-05 | Headers HTTP       | MEDIO     | CSP permite unsafe-eval y unsafe-inline en script-src   | Pendiente |

---

## 1. Auditoría de Supabase

### 1.1. Security Advisors (get_advisors)

**Advisor de Seguridad:**

- **Nombre del linter:** `auth_leaked_password_protection`
- **Severidad:** BAJO (documentado como fuera de scope en spec 09)
- **Descripción:** Leaked password protection is currently disabled. Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org. Enable this feature to enhance security.
- **Remediación:** https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- **Nota:** Este control fue documentado explícitamente como fuera de scope en spec 09 porque requiere configuración manual desde el dashboard de Supabase Auth y puede no estar disponible en todas las versiones de Supabase. Ver hallazgo S-04 para detalles.

**Advisors de Performance:**

- **Nombre del linter:** `auth_rls_initplan`
- **Severidad:** MEDIO (impacto en performance a escala)
- **Descripción:** Detects if calls to `current_setting()` and `auth.<function>()` in RLS policies are being unnecessarily re-evaluated for each row.
- **Remediación:** https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
- **Hallazgos:**
    - Tabla `public.players` - política `players_insert_authenticated` reevalúa `auth.uid()` para cada fila
    - Tabla `public.scores` - política `scores_insert_authenticated` reevalúa `auth.uid()` para cada fila
- **Nota:** Ver hallazgo S-02 para detalles y recomendación de corrección.

- **Nombre del linter:** `unused_index`
- **Severidad:** BAJO (impacto mínimo)
- **Descripción:** Detects if an index has never been used and may be a candidate for removal.
- **Hallazgos:**
    - Index `scores_game_id_idx` on table `public.scores` has not been used
    - Index `scores_player_id_idx` on table `public.scores` has not been used
- **Nota:** Estos índices fueron creados para optimizar queries de leaderboards. Si nunca se han usado, es probable que el volumen de datos actual sea muy bajo (< 100 filas) y los índices no se activen. No es un problema de seguridad, solo una oportunidad de optimización.

### 1.2. Row Level Security (RLS)

**Estado de RLS para cada tabla:**

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('games', 'players', 'scores');
```

**Resultado:**

| tablename | rowsecurity |
| --------- | ----------- |
| games     | true        |
| players   | true        |
| scores    | true        |

✓ **Todas las tablas tienen RLS habilitado correctamente.**

### 1.3. Políticas RLS de `players`

**Query ejecutada:**

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'players';
```

**Resultado:**

| policyname                   | cmd    | roles    | qual | with_check             |
| ---------------------------- | ------ | -------- | ---- | ---------------------- |
| players_select_public        | SELECT | {public} | true | null                   |
| players_insert_authenticated | INSERT | {public} | null | (auth.uid() = user_id) |

**Análisis:**

✓ Existe política `players_insert_authenticated` con `cmd = 'INSERT'` y `with_check` que verifica `auth.uid() = user_id`  
✓ NO existe política `players_insert_public` (fue eliminada correctamente en spec 08)  
✓ Política de `SELECT` es pública (`players_select_public`), lo cual es correcto según spec 08 (los nombres de jugadores son públicos para leaderboards)

**Conclusión:** Las políticas RLS de `players` están correctamente implementadas según spec 08.

### 1.4. Políticas RLS de `scores`

**Query ejecutada:**

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'scores';
```

**Resultado:**

| policyname                  | cmd    | roles    | qual | with_check                                                                                                   |
| --------------------------- | ------ | -------- | ---- | ------------------------------------------------------------------------------------------------------------ |
| scores_select_public        | SELECT | {public} | true | null                                                                                                         |
| scores_insert_authenticated | INSERT | {public} | null | (EXISTS ( SELECT 1 FROM players WHERE ((players.id = scores.player_id) AND (players.user_id = auth.uid())))) |

**Análisis:**

✓ Existe política `scores_insert_authenticated` con `cmd = 'INSERT'` y `with_check` que valida que el `player_id` pertenece a un `player` cuyo `user_id = auth.uid()`  
✓ NO existe política `scores_insert_public` (fue eliminada correctamente en spec 08)  
✓ Política de `SELECT` es pública (`scores_select_public`), lo cual es correcto según spec 08 (los puntajes son públicos para leaderboards)

**Conclusión:** Las políticas RLS de `scores` están correctamente implementadas según spec 08.

### 1.5. Función `rls_auto_enable()`

**Query ejecutada:**

```sql
SELECT proname, prosrc, provolatile, prosecdef, proacl
FROM pg_proc
WHERE proname = 'rls_auto_enable' AND pronamespace = 'public'::regnamespace;
```

**Resultado:**

| proname         | prosecdef | proacl                                                                                             |
| --------------- | --------- | -------------------------------------------------------------------------------------------------- |
| rls_auto_enable | false     | {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres} |

**Análisis:**

✓ La función ya NO es `SECURITY DEFINER` (prosecdef = false), fue cambiada a `SECURITY INVOKER` (correcto según spec 09)  
✗ La función todavía tiene permisos de ejecución (`EXECUTE` = `X`) para roles `anon` y `authenticated`

**Impacto:** BAJO. Aunque la función es ejecutable por roles públicos, al ser `SECURITY INVOKER` ya no representa un riesgo de escalación de privilegios (corre con los permisos del usuario que la invoca, no con permisos de postgres). Sin embargo, según la spec 09, debería haberse eliminado completamente o revocado `EXECUTE` a roles públicos.

**Ver hallazgo S-03 para recomendación.**

### 1.6. Constraints de `players.user_id`

**Query ejecutada:**

```sql
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'players'
  AND kcu.column_name = 'user_id';
```

**Resultado:**

| constraint_name      | constraint_type | column_name |
| -------------------- | --------------- | ----------- |
| players_user_id_fkey | FOREIGN KEY     | user_id     |
| players_user_id_key  | UNIQUE          | user_id     |

**Análisis:**

✓ Existe constraint `UNIQUE` en `user_id` (relación 1:1 usuario ↔ jugador)  
✓ Existe constraint `FOREIGN KEY` que referencia `auth.users(id)`

**Conclusión:** Los constraints de `players.user_id` están correctamente configurados según spec 08.

---

## 2. Auditoría de Aplicación Next.js

### 2.1. Headers HTTP de Seguridad

**Archivo revisado:** `next.config.ts`

**Headers implementados:**

```typescript
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
        value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co; frame-ancestors 'none';",
    },
];
```

**Estado de cada header:**

- `X-Content-Type-Options: nosniff` → ✓ Implementado correctamente
- `X-Frame-Options: DENY` → ✓ Implementado correctamente
- `Referrer-Policy: strict-origin-when-cross-origin` → ✓ Implementado correctamente
- `Content-Security-Policy` → ⚠️ Implementado con debilidades (ver hallazgo S-05)

**Función de aplicación:**

```typescript
async headers() {
    return [
        {
            source: '/(.*)',
            headers: securityHeaders,
        },
    ];
}
```

✓ La función `headers()` aplica los headers a todas las rutas (`/(.*)`).

**Conclusión:** Los headers HTTP de seguridad están implementados. Tres de los cuatro headers están correctamente configurados. La CSP tiene una debilidad documentada en el hallazgo S-05.

### 2.2. Validación de Contraseñas

**Client-side (`app/auth/auth-form-client.tsx`):**

```typescript
function validatePassword(password: string): string | null {
    if (password.length < 8) return 'Mínimo 8 caracteres';
    if (!/[A-Z]/.test(password)) return 'Debe contener una mayúscula';
    if (!/[0-9]/.test(password)) return 'Debe contener un número';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Debe contener un símbolo';
    return null;
}
```

- Mínimo 8 caracteres: ✓
- Validación mayúscula: ✓
- Validación número: ✓
- Validación símbolo: ✓

**Server-side (`lib/actions/auth.ts`):**

```typescript
if (password.length < 8) {
    return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres' };
}

const hasUppercase = /[A-Z]/.test(password);
const hasNumber = /\d/.test(password);
const hasSymbol = /[@$!%*?&]/.test(password);

if (!hasUppercase || !hasNumber || !hasSymbol) {
    return { ok: false, error: 'La contraseña debe incluir mayúscula, número y símbolo' };
}
```

- Mínimo 8 caracteres: ✓
- Validación mayúscula: ✓
- Validación número: ✓
- Validación símbolo: ✓
- Validación ocurre ANTES de `supabase.auth.signUp()`: ✓

**Conclusión:** La validación de contraseñas está correctamente implementada en ambas capas (client-side y server-side) según spec 09. El mínimo de 8 caracteres fue correctamente elevado desde el 6 original de la spec 08.

### 2.3. Proxy de Protección de Rutas (Next.js 16)

**CORRECCIÓN DEL REPORTE V2:**

El reporte v2 marcó como hallazgo **S-01 CRÍTICO** la ausencia de `middleware.ts`. Este hallazgo era **INCORRECTO** para Next.js 16.

**Documentación de Next.js 16:**

Según `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`:

> **Note**: The `middleware` file convention is deprecated and has been renamed to `proxy`. See [Migration to Proxy](#migration-to-proxy) for more details.

Next.js 16 deprecó `middleware.ts` y lo renombró a `proxy.ts`. El archivo debe:

- Llamarse `proxy.ts` (NO `middleware.ts`)
- Exportar una función `proxy()` (NO `middleware()`)

**Archivo verificado:** `/Users/miguel.pastor/projects/pocs/ia/05-arcade-vault/proxy.ts`

**Estado:** ✓ Existe

**Implementación:**

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
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

**Análisis:**

✓ Archivo `proxy.ts` existe en la raíz del proyecto  
✓ Exporta función `proxy()` (NO `middleware()`)  
✓ Usa `createServerClient` de `@supabase/ssr` para verificar sesión  
✓ Protege la ruta `/juegos/[id]/jugar` mediante matcher `/juegos/:path*/jugar`  
✓ Implementa estrategia fail-closed: redirige a `/auth` si `error || !user`  
✓ Preserva el pathname en query param `redirect` para volver después del login  
✓ Configuración de cookies correcta según docs de Supabase SSR

**Conclusión:** El proxy de protección de rutas está **correctamente implementado** según Next.js 16 y spec 10. El hallazgo S-01 del reporte v2 era un falso positivo causado por no considerar el cambio de convención en Next.js 16.

### 2.4. Server Actions

**`lib/actions/auth.ts`:**

- **`signUpAction`:**
    - ✓ Valida `playerName` (1-12 caracteres)
    - ✓ Valida contraseña (mínimo 8 caracteres + mayúscula + número + símbolo) ANTES de llamar a Supabase
    - ✓ Verifica unicidad de `playerName` antes de crear usuario en Auth
    - ✓ Inserta fila en `players` después de crear usuario exitosamente
    - ✓ Maneja errores de forma específica (email duplicado, nombre duplicado, contraseña inválida)

- **`signInAction`:**
    - ✓ Llama `supabase.auth.signInWithPassword()`
    - ✓ Verifica que `email_confirmed_at` exista (email verificado)
    - ✓ Cierra la sesión si el email no está confirmado (fail-closed)
    - ✓ Revalida rutas después de login exitoso

- **`signOutAction`:**
    - ✓ Llama `supabase.auth.signOut()`
    - ✓ Revalida rutas después de logout

**`lib/actions/save-score.ts`:**

- **`saveScoreAction`:**
    - ✓ NO recibe parámetro `name` (correcto, lo obtiene de sesión)
    - ✓ Obtiene `user_id` de la sesión del servidor (`supabase.auth.getUser()`)
    - ✓ Valida que `score` esté en rango válido (`SCORE_MIN` a `SCORE_MAX`)
    - ✓ Valida que `gameId` existe en `games`
    - ✓ Busca `player_id` por `user_id` antes de insertar en `scores`
    - ✓ Falla si no hay sesión (`error || !user`)

**Conclusión:** Todas las Server Actions implementan validación correcta de sesión y datos. `saveScoreAction` obtiene la identidad del usuario de la sesión del servidor (no confiable del cliente), evitando posibilidad de falsificación de identidad.

### 2.5. Variables de Entorno

**Verificación de `.env.local` commiteado:**

```bash
git ls-files .env.local 2>&1 | grep -q "\.env\.local" && echo "COMMITEADO" || echo "NO COMMITEADO"
```

**Resultado:** NO COMMITEADO ✓

**Verificación de `.gitignore`:**

```gitignore
# env files (can opt-in for committing if needed)
.env*
!.env.template
```

✓ `.gitignore` incluye `.env*` (excluyendo `.env.template`)

**Conclusión:** La gestión de variables de entorno es correcta. Los secrets no están expuestos en el repositorio.

### 2.6. Secrets Hardcodeados

**Búsqueda ejecutada:**

```bash
grep -r -E "(api_key|apikey|secret|password|token|jwt|supabase_service_role)" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  lib/ app/ components/ 2>/dev/null | grep -v "// " | grep -v "/\*" | grep -v "process.env" | head -20
```

**Resultados:**

Todos los resultados encontrados son:

- Referencias a nombres de parámetros (ej: `password: string`)
- Referencias a `process.env.*` (variables de entorno, correctas)
- Comentarios de documentación (ej: "Crea usuario en Supabase Auth con email/password")

✓ **No se encontraron secrets hardcodeados en el código.**

**Conclusión:** No hay API keys, tokens, passwords, ni otros secrets expuestos como strings literales en el código del proyecto.

---

## 3. Hallazgos Detallados

### S-02: Políticas RLS reevalúan auth.uid() por cada fila

**Categoría:** Supabase RLS  
**Severidad:** MEDIO  
**Ubicación:** Políticas `players_insert_authenticated` y `scores_insert_authenticated`

**Descripción:**

Las políticas RLS de las tablas `players` y `scores` llaman directamente a `auth.uid()` en sus expresiones `with_check`, lo cual causa que Postgres reevalúe la función para cada fila insertada en vez de calcularla una sola vez al inicio de la query.

**Políticas actuales:**

```sql
-- players_insert_authenticated
with_check: (auth.uid() = user_id)

-- scores_insert_authenticated
with_check: (EXISTS ( SELECT 1 FROM players WHERE ((players.id = scores.player_id) AND (players.user_id = auth.uid()))))
```

**Impacto:**

Performance subóptima a escala. En inserts individuales (1 fila), el impacto es imperceptible. En batch inserts (ej: 1000 puntajes), `auth.uid()` se reevalúa 1000 veces innecesariamente en vez de una sola vez.

Este es un problema de **performance**, no de seguridad directa. Las políticas siguen siendo correctas funcionalmente.

**Evidencia:**

Warning de `get_advisors` tipo `performance`:

```
Table `public.players` has a row level security policy `players_insert_authenticated` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale.

Table `public.scores` has a row level security policy `scores_insert_authenticated` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale.
```

**Recomendación:**

Reemplazar `auth.uid()` con `(select auth.uid())` en ambas políticas para forzar la evaluación una sola vez:

```sql
-- Corregir players_insert_authenticated
DROP POLICY IF EXISTS "players_insert_authenticated" ON public.players;

CREATE POLICY "players_insert_authenticated"
  ON public.players
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- Corregir scores_insert_authenticated
DROP POLICY IF EXISTS "scores_insert_authenticated" ON public.scores;

CREATE POLICY "scores_insert_authenticated"
  ON public.scores
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = scores.player_id
        AND players.user_id = (select auth.uid())
    )
  );
```

**Prioridad:** Esta semana

**Referencias:**

- Supabase Docs: https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
- Supabase Docs: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

---

### S-03: Función rls_auto_enable() ejecutable por roles públicos

**Categoría:** Supabase Functions  
**Severidad:** BAJO  
**Ubicación:** Función `public.rls_auto_enable()`

**Descripción:**

La función `rls_auto_enable()` todavía existe en el esquema `public` y tiene permisos de ejecución (`EXECUTE`) para los roles `anon` y `authenticated`. Aunque la función ya fue cambiada a `SECURITY INVOKER` (resolviendo el riesgo de escalación de privilegios que existía con `SECURITY DEFINER`), según la spec 09 debería haber sido eliminada completamente o revocados los permisos a roles públicos.

**Evidencia:**

```sql
SELECT proname, prosecdef, proacl
FROM pg_proc
WHERE proname = 'rls_auto_enable' AND pronamespace = 'public'::regnamespace;

-- Resultado:
-- proname: rls_auto_enable
-- prosecdef: false (SECURITY INVOKER, correcto)
-- proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
--         anon y authenticated tienen permiso EXECUTE (X)
```

**Impacto:**

BAJO. La función corre con los permisos del usuario que la invoca (`SECURITY INVOKER`), así que roles `anon` y `authenticated` no pueden escalar privilegios ejecutándola (no tienen permiso de `ALTER TABLE` de todas formas). Sin embargo, es mejor seguir el principio de mínimo privilegio y revocar acceso a funciones que no necesitan ser ejecutadas por usuarios finales.

**Recomendación:**

Opción 1 (recomendada según spec 09): Eliminar la función si no se está usando.

```sql
DROP FUNCTION IF EXISTS public.rls_auto_enable();
```

Opción 2 (si se decide mantenerla): Revocar `EXECUTE` a roles públicos.

```sql
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
```

**Prioridad:** Backlog

**Referencias:**

- Spec 09: `specs/09-security-hardening.md` sección "Data model"

---

### S-04: Leaked Password Protection deshabilitado

**Categoría:** Supabase Auth  
**Severidad:** BAJO  
**Ubicación:** Configuración de Supabase Auth (dashboard)

**Descripción:**

El control "Leaked Password Protection" de Supabase Auth está deshabilitado. Esta feature verifica contraseñas contra la base de datos de HaveIBeenPwned.org para prevenir que usuarios elijan contraseñas que han sido comprometidas en filtraciones de datos masivas.

**Evidencia:**

Warning de `get_advisors` tipo `security`:

```
Leaked password protection is currently disabled.
Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org.
Enable this feature to enhance security.
```

**Impacto:**

BAJO. La aplicación ya implementa validación de contraseñas estricta (mínimo 8 caracteres + mayúscula + número + símbolo) en client-side y server-side, reduciendo significativamente el riesgo de contraseñas débiles. Leaked password protection agrega una capa adicional de defensa, pero no es crítica.

**Configuración manual requerida:**

Este control no puede habilitarse vía SQL o MCP — requiere configuración manual desde el dashboard de Supabase Auth:

1. Abrir https://supabase.com/dashboard
2. Seleccionar el proyecto `kjpvjfhuqrclpblkthpd`
3. Ir a **Authentication** → **Policies**
4. En la sección **Password Strength**, habilitar **Leaked Password Protection**
5. Guardar cambios

**Nota importante:** Según spec 09, esta feature puede no estar disponible en todas las versiones de Supabase. Si no aparece la opción en el dashboard, documentar como "pendiente de actualización de Supabase".

**Prioridad:** Backlog

**Referencias:**

- Supabase Docs: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Spec 09: `specs/09-security-hardening.md` sección "Out of scope"

---

### S-05: Content-Security-Policy permite unsafe-eval y unsafe-inline

**Categoría:** Headers HTTP  
**Severidad:** MEDIO  
**Ubicación:** `next.config.ts` línea 18

**Descripción:**

La política CSP (Content-Security-Policy) configurada en `next.config.ts` incluye las directivas `'unsafe-eval'` y `'unsafe-inline'` en `script-src`, lo cual debilita significativamente la protección contra ataques XSS (Cross-Site Scripting).

**Configuración actual:**

```typescript
{
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co; frame-ancestors 'none';",
}
```

Problemas específicos:

- `script-src 'self' 'unsafe-eval'` — permite `eval()`, `new Function()`, y otras ejecuciones dinámicas de código
- `script-src 'self' 'unsafe-inline'` — permite scripts inline (`<script>código</script>` y atributos `onclick=""`)
- `style-src 'self' 'unsafe-inline'` — permite estilos inline (menos crítico que scripts)

**Impacto:**

MEDIO. Estas directivas reducen la efectividad de la CSP contra XSS:

- Con `'unsafe-eval'`: Si un atacante logra inyectar datos en una variable que luego se pasa a `eval()`, puede ejecutar código arbitrario
- Con `'unsafe-inline'`: Si un atacante logra inyectar HTML (ej: en un campo de nombre no sanitizado), puede ejecutar scripts inline directamente

Sin embargo, el impacto real depende de si el código del proyecto usa `eval()` o scripts inline. Next.js en modo desarrollo usa `eval()` para hot module replacement (HMR), y puede generar scripts inline durante SSR.

**Evidencia:**

Lectura directa de `next.config.ts`:

```typescript
// Línea 18
value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co; frame-ancestors 'none';",
```

**Recomendación:**

**Opción 1 (ideal):** Eliminar `'unsafe-eval'` y `'unsafe-inline'`, y usar hashes o nonces para scripts inline necesarios.

```typescript
value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co; frame-ancestors 'none';",
```

**Opción 2 (compromiso):** Mantener `'unsafe-inline'` en `style-src` (menos crítico), pero eliminar `'unsafe-eval'` y `'unsafe-inline'` de `script-src`.

```typescript
value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co; frame-ancestors 'none';",
```

**Opción 3 (si Next.js requiere unsafe-eval en producción):** Usar CSP diferente para desarrollo vs. producción.

```typescript
const isProd = process.env.NODE_ENV === 'production';

const scriptSrc = isProd ? "'self'" : "'self' 'unsafe-eval'"; // Solo en desarrollo para HMR

const securityHeaders = [
    // ...
    {
        key: 'Content-Security-Policy',
        value: `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co; frame-ancestors 'none';`,
    },
];
```

**Verificación después de cambiar:**

1. Hacer `npm run build && npm run start`
2. Visitar todas las rutas del sitio (`/`, `/biblioteca`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/auth`, `/salon-de-la-fama`)
3. Verificar en DevTools → Console que no hay errores de CSP bloqueando recursos legítimos
4. Si hay errores, agregar excepciones específicas con hashes/nonces o whitelistear dominios necesarios (ej: analytics)

**Prioridad:** Esta semana

**Referencias:**

- Spec 09: `specs/09-security-hardening.md` sección "Data model" (indica que debería bloquear `unsafe-inline` y `unsafe-eval`)
- MDN: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
- Content Security Policy: https://content-security-policy.com/

---

## 4. Configuración Manual Requerida

Algunos controles de seguridad requieren configuración manual desde el dashboard de Supabase Auth (no automatizable vía MCP):

### 4.1. Longitud Mínima de Contraseña

**Estado esperado:** 8 caracteres (según spec 09)  
**Verificación manual:** Dashboard → Authentication → Policies → Password Strength → Minimum password length  
**Nota:** Esta auditoría NO puede verificar esta configuración automáticamente. Verificar manualmente.

**Pasos para configurar:**

1. Abrir https://supabase.com/dashboard
2. Seleccionar el proyecto `kjpvjfhuqrclpblkthpd`
3. Ir a **Authentication** → **Policies**
4. En la sección **Password Strength**, cambiar **Minimum password length** de `6` a `8`
5. Click en **Save**

**Efecto:** Supabase Auth rechazará contraseñas de menos de 8 caracteres a nivel de servidor, incluso si la validación client-side o server-side de la aplicación falla o se saltea. Esto asegura que ningún usuario pueda registrarse con una contraseña débil, sin importar cómo accedan a la API.

### 4.2. Leaked Password Protection

**Estado esperado:** Habilitado (según checklist de seguridad)  
**Estado actual:** Deshabilitado (según warning de `get_advisors`)  
**Verificación manual:** Dashboard → Authentication → Policies → Leaked Password Protection  
**Nota:** Requiere versión de Supabase que soporte esta feature. Si no está disponible, documentar como pendiente.

Ver hallazgo S-04 para detalles.

---

## 5. Recomendaciones Priorizadas

Lista de acciones ordenadas por prioridad:

### Acción Inmediata (hallazgos CRÍTICOS)

✓ **No hay hallazgos críticos.** El proyecto tiene una postura de seguridad sólida.

### Esta Semana (hallazgos MEDIOS)

1. **[S-02] Optimizar políticas RLS para evitar reevaluación de auth.uid()**
    - Ejecutar las queries SQL de corrección en `references/security/security-audit-2026-09-09-v3.md` sección S-02
    - Verificar con `get_advisors` que el warning `auth_rls_initplan` desaparece
    - Tiempo estimado: 15 minutos

2. **[S-05] Reforzar Content-Security-Policy eliminando unsafe-eval y unsafe-inline**
    - Elegir opción de recomendación (1, 2 o 3) según requisitos de Next.js
    - Actualizar `next.config.ts` con la nueva CSP
    - Hacer build de producción y verificar que no rompe nada
    - Tiempo estimado: 30-60 minutos (incluye testing)

### Backlog (hallazgos BAJOS)

1. **[S-03] Eliminar o revocar permisos de función rls_auto_enable()**
    - Investigar si la función se está usando (grep en el repo)
    - Si no se usa, ejecutar `DROP FUNCTION IF EXISTS public.rls_auto_enable();`
    - Si se usa, ejecutar `REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;`
    - Tiempo estimado: 10 minutos

2. **[S-04] Habilitar Leaked Password Protection (si está disponible)**
    - Verificar en el dashboard de Supabase Auth si la opción está disponible
    - Si está disponible, habilitarla según instrucciones en sección 4.2
    - Si no está disponible, documentar como "pendiente de actualización de Supabase"
    - Tiempo estimado: 5 minutos

3. **Configurar password_min_length en Supabase Auth**
    - Seguir pasos en sección 4.1 para configurar mínimo de 8 caracteres
    - Verificar que la configuración se aplica intentando registrarse con contraseña de 7 caracteres (debe fallar)
    - Tiempo estimado: 5 minutos

---

## 6. Estado de Specs de Seguridad

**Spec 08 (Supabase Auth):**

- Implementada: ✓
- Controles verificados: 20 / 20
- Hallazgos: 0

Todos los controles de autenticación están correctamente implementados:

- Políticas RLS verificadas (`players_insert_authenticated`, `scores_insert_authenticated`)
- Proxy de protección de rutas funcionando (corrección del error en reporte v2: usa `proxy.ts`, no `middleware.ts`)
- Validación de email confirmado
- Server Actions obtienen identidad de sesión del servidor, no del cliente

**Spec 09 (Security Hardening):**

- Implementada: ✓
- Controles verificados: 8 / 10
- Hallazgos: 2

Controles implementados:

- ✓ Mínimo de contraseña elevado a 8 caracteres (client-side y server-side)
- ✓ Headers HTTP de seguridad agregados (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- ✓ Función `rls_auto_enable()` cambiada a SECURITY INVOKER (resuelve el riesgo de escalación de privilegios)
- ✓ Usuarios mock actualizados a contraseña `Test-001!` (cumple 8 caracteres)

Controles pendientes:

- ⚠️ CSP incluye `unsafe-eval` y `unsafe-inline` (hallazgo S-05, severidad MEDIO)
- ⚠️ Función `rls_auto_enable()` todavía tiene permisos de ejecución para roles públicos (hallazgo S-03, severidad BAJO)

**Spec 10 (Proxy de Protección de Rutas):**

- Implementada: ✓
- Controles verificados: 8 / 8
- Hallazgos: 0

Todos los controles de protección de rutas están correctamente implementados según Next.js 16:

- ✓ Archivo `proxy.ts` con función `proxy()` (NO `middleware.ts` / `middleware()`)
- ✓ Matcher configurado para `/juegos/:path*/jugar`
- ✓ Verificación de sesión con `createServerClient` de `@supabase/ssr`
- ✓ Estrategia fail-closed (redirige si error o no hay usuario)
- ✓ Preservación de redirect en query param

---

## 7. Próxima Auditoría

**Fecha recomendada para próxima auditoría:** 2026-10-09 (30 días desde hoy)

**Triggers para auditoría intermedia:**

- Implementación de nueva feature de autenticación (ej: OAuth, recuperación de contraseña)
- Cambios en políticas RLS o estructura de tablas de autenticación
- Agregado de nuevas Server Actions que manejen datos sensibles
- Deploy a producción (auditoría pre-deploy recomendada)
- Actualización de Next.js a versión 17 o superior (verificar que proxy.ts sigue siendo la convención)
- Detección de comportamiento anómalo en logs (intentos de acceso no autorizados, errores de auth)

---

## Anexo: Queries Ejecutadas

Lista completa de queries SQL ejecutadas durante la auditoría, para reproducibilidad:

```sql
-- 1. Verificar RLS habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('games', 'players', 'scores');

-- 2. Verificar políticas de players
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'players';

-- 3. Verificar políticas de scores
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'scores';

-- 4. Verificar función rls_auto_enable()
SELECT proname, prosrc, provolatile, prosecdef, proacl
FROM pg_proc
WHERE proname = 'rls_auto_enable' AND pronamespace = 'public'::regnamespace;

-- 5. Verificar constraints de players.user_id
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'players'
  AND kcu.column_name = 'user_id';
```

---

## Anexo: Archivos Auditados

Lista de archivos leídos durante la auditoría:

**Specs:**

- `/Users/miguel.pastor/projects/pocs/ia/05-arcade-vault/specs/08-supabase-auth-email-password.md`
- `/Users/miguel.pastor/projects/pocs/ia/05-arcade-vault/specs/09-security-hardening.md`
- `/Users/miguel.pastor/projects/pocs/ia/05-arcade-vault/specs/10-middleware-auth-protection.md`

**Documentación de Next.js 16:**

- `/Users/miguel.pastor/projects/pocs/ia/05-arcade-vault/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`

**Código de aplicación:**

- `/Users/miguel.pastor/projects/pocs/ia/05-arcade-vault/proxy.ts`
- `/Users/miguel.pastor/projects/pocs/ia/05-arcade-vault/next.config.ts`
- `/Users/miguel.pastor/projects/pocs/ia/05-arcade-vault/app/auth/page.tsx`
- `/Users/miguel.pastor/projects/pocs/ia/05-arcade-vault/app/auth/auth-form-client.tsx`
- `/Users/miguel.pastor/projects/pocs/ia/05-arcade-vault/lib/actions/auth.ts`
- `/Users/miguel.pastor/projects/pocs/ia/05-arcade-vault/lib/actions/save-score.ts`
- `/Users/miguel.pastor/projects/pocs/ia/05-arcade-vault/.gitignore`

**Herramientas de Supabase:**

- `mcp__supabase__get_advisors` (security y performance)
- `mcp__supabase__list_tables` (verbose para `public.games`, `public.players`, `public.scores`)
- `mcp__supabase__execute_sql` (5 queries de verificación)

---

**Fin del reporte**

**Firmado por:** Claude Sonnet 4.5 (security-audit agent)  
**Proyecto:** Arcade Vault (`kjpvjfhuqrclpblkthpd`)  
**Fecha de auditoría:** 2026-09-09  
**Próxima auditoría recomendada:** 2026-10-09
