# Auditoría de Seguridad — Arcade Vault

**Fecha:** 2026-09-09  
**Versión:** 1.0  
**Auditor:** Claude Sonnet 4.5 (security-audit agent)

---

## Resumen Ejecutivo

**Estado general:** CRÍTICO

**Hallazgos totales:** 4

- CRÍTICO: 1
- ALTO: 0
- MEDIO: 2
- BAJO: 1

**Acción requerida:**

Se detectó **1 hallazgo crítico** que requiere acción inmediata: el middleware de protección de rutas autenticadas no existe, dejando la ruta `/juegos/[id]/jugar` completamente desprotegida. Esto permite que cualquier usuario sin autenticación acceda al reproductor de juegos, bypasseando el flujo de login implementado en la spec 08.

Adicionalmente, se identificaron 2 hallazgos de severidad media relacionados con optimización de políticas RLS (performance, no seguridad crítica) y configuración pendiente de leaked password protection en Supabase Auth (requiere configuración manual desde el dashboard).

El resto de controles de seguridad implementados en las specs 08 y 09 están funcionando correctamente: RLS habilitado, políticas verificadas, validación de contraseñas (8+ caracteres), headers HTTP de seguridad, y gestión segura de variables de entorno.

---

## Tabla de Hallazgos

| ID   | Categoría            | Severidad | Descripción breve                                         | Estado    |
| ---- | -------------------- | --------- | --------------------------------------------------------- | --------- |
| S-01 | Middleware           | CRÍTICO   | Middleware de protección de rutas no existe               | Pendiente |
| S-02 | Supabase RLS         | MEDIO     | Políticas RLS no usan `(select auth.uid())` (performance) | Pendiente |
| S-03 | Supabase Auth        | MEDIO     | Leaked password protection deshabilitado                  | Pendiente |
| S-04 | Supabase Performance | BAJO      | Índices no usados en tabla `scores`                       | Pendiente |

---

## 1. Auditoría de Supabase

### 1.1. Security Advisors (get_advisors)

#### Warning 1: Leaked Password Protection Disabled

- **Nombre del linter:** `auth_leaked_password_protection`
- **Severidad:** MEDIO
- **Descripción:** Leaked password protection is currently disabled. Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org. Enable this feature to enhance security.
- **Remediación:** [Password Security - Supabase Docs](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

**Nota:** Este warning fue documentado como fuera de scope en la spec 09 (configuración manual pendiente, no disponible en todas las versiones de Supabase Auth). Ver hallazgo S-03.

#### Warnings resueltos

Los siguientes warnings reportados en el checklist previo (`references/security/checklist.md`) **ya NO aparecen** en `get_advisors`, confirmando que la spec 09 los resolvió correctamente:

- ✓ `anon_security_definer_function_executable` (función `rls_auto_enable()`) — RESUELTO
- ✓ `authenticated_security_definer_function_executable` (función `rls_auto_enable()`) — RESUELTO

### 1.2. Row Level Security (RLS)

**Estado de RLS para tablas principales:**

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

✓ RLS habilitado en las tres tablas principales.

**Tabla: `games`**

- RLS habilitado: ✓
- Sin políticas de insert (tabla de solo lectura para la aplicación): ✓

**Tabla: `players`**

- RLS habilitado: ✓
- Política de insert autenticada: ✓
- Política de insert pública (debe estar eliminada): ✓ eliminada
- Evidencia:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'players';
```

**Políticas encontradas:**

| policyname                   | cmd    | with_check             |
| ---------------------------- | ------ | ---------------------- |
| players_insert_authenticated | INSERT | `auth.uid() = user_id` |
| players_select_public        | SELECT | `true`                 |

✓ La política `players_insert_authenticated` verifica que `auth.uid() = user_id` antes de permitir insert.  
✓ La política `players_insert_public` fue eliminada correctamente (no aparece en el resultado).  
✓ La política `players_select_public` permite lectura pública (correcto según spec 08).

**Tabla: `scores`**

- RLS habilitado: ✓
- Política de insert autenticada: ✓
- Política de insert pública (debe estar eliminada): ✓ eliminada
- Evidencia:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'scores';
```

**Políticas encontradas:**

| policyname                  | cmd    | with_check                                                                                            |
| --------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| scores_insert_authenticated | INSERT | `EXISTS (SELECT 1 FROM players WHERE players.id = scores.player_id AND players.user_id = auth.uid())` |
| scores_select_public        | SELECT | `true`                                                                                                |

✓ La política `scores_insert_authenticated` valida que el `player_id` pertenece a un `player` cuyo `user_id = auth.uid()`.  
✓ La política `scores_insert_public` fue eliminada correctamente (no aparece en el resultado).  
✓ La política `scores_select_public` permite lectura pública (correcto según spec 08).

### 1.3. Función `rls_auto_enable()`

```sql
SELECT proname, prosrc, provolatile, prosecdef, proacl
FROM pg_proc
WHERE proname = 'rls_auto_enable' AND pronamespace = 'public'::regnamespace;
```

**Resultado:**

| proname         | prosecdef | proacl                                                                                               |
| --------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| rls_auto_enable | false     | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` |

✓ La función existe como trigger de evento para auto-habilitar RLS en nuevas tablas del esquema `public`.  
✓ `prosecdef = false` → la función es `SECURITY INVOKER` (NO es `SECURITY DEFINER`).  
✓ Los warnings `anon_security_definer_function_executable` y `authenticated_security_definer_function_executable` ya NO aparecen en `get_advisors`.  
✓ El hallazgo reportado en el checklist previo fue resuelto correctamente en la spec 09.

### 1.4. Constraints de `players.user_id`

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

| constraint_name      | constraint_type |
| -------------------- | --------------- |
| players_user_id_fkey | FOREIGN KEY     |
| players_user_id_key  | UNIQUE          |

✓ Existe constraint `FOREIGN KEY` que referencia `auth.users(id)`.  
✓ Existe constraint `UNIQUE` (relación 1:1 usuario ↔ jugador).

---

## 2. Auditoría de Aplicación Next.js

### 2.1. Headers HTTP de Seguridad

**Archivo revisado:** `next.config.ts`

**Headers implementados:**

- `X-Content-Type-Options: nosniff` ✓
- `X-Frame-Options: DENY` ✓
- `Referrer-Policy: strict-origin-when-cross-origin` ✓
- `Content-Security-Policy` (política básica con `default-src 'self'`) ✓

**Evidencia:**

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
        value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';",
    },
];

const nextConfig: NextConfig = {
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

✓ Los 4 headers de seguridad requeridos por la spec 09 están implementados correctamente.  
✓ La función `headers()` los aplica a todas las rutas (`/(.*)`).

### 2.2. Validación de Contraseñas

**Client-side (`app/auth/auth-form-client.tsx`):**

- Mínimo 8 caracteres: ✓
- Validación mayúscula: ✓
- Validación número: ✓
- Validación símbolo: ✓

**Evidencia:**

```typescript
function validatePassword(password: string): string | null {
    if (password.length < 8) return 'Mínimo 8 caracteres';
    if (!/[A-Z]/.test(password)) return 'Debe contener una mayúscula';
    if (!/[0-9]/.test(password)) return 'Debe contener un número';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Debe contener un símbolo';
    return null;
}
```

✓ La validación client-side cumple todos los requisitos de la spec 09 (mínimo 8 caracteres, no 6).

**Server-side (`lib/actions/auth.ts`):**

- Mínimo 8 caracteres: ✓
- Validación mayúscula: ✓
- Validación número: ✓
- Validación símbolo: ✓
- Validación de longitud de `playerName` (1-12 caracteres): ✓
- Verificación de unicidad de `playerName`: ✓

**Evidencia:**

```typescript
export async function signUpAction(input: {
    email: string;
    password: string;
    playerName: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
    const { email, password, playerName } = input;

    // Validar longitud del nombre de jugador
    if (!playerName || playerName.length < 1 || playerName.length > 12) {
        return { ok: false, error: 'El nombre de jugador debe tener entre 1 y 12 caracteres' };
    }

    // Validar contraseña server-side (defensa en profundidad)
    if (password.length < 8) {
        return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres' };
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[@$!%*?&]/.test(password);

    if (!hasUppercase || !hasNumber || !hasSymbol) {
        return { ok: false, error: 'La contraseña debe incluir mayúscula, número y símbolo' };
    }

    // ... continúa con verificación de nombre único y creación de usuario
}
```

✓ La validación server-side cumple todos los requisitos de la spec 09.  
✓ La validación server-side previene bypass de la validación client-side (defensa en profundidad).

**`signInAction` (verificación de email confirmado):**

```typescript
export async function signInAction(input: {
    email: string;
    password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
    // ... código de login

    // Verificar que el email esté confirmado
    if (data.user && !data.user.email_confirmed_at) {
        // Cerrar la sesión recién creada
        await supabase.auth.signOut();
        return { ok: false, error: 'Debes verificar tu email antes de iniciar sesión' };
    }

    // ...
}
```

✓ `signInAction` verifica que el email esté confirmado antes de permitir login.

### 2.3. Middleware de Protección de Rutas

**Archivo:** `middleware.ts` **NO EXISTE**

❌ **HALLAZGO CRÍTICO (S-01):** No existe el archivo `middleware.ts` en la raíz del proyecto.

**Rutas que deberían estar protegidas según spec 08:**

- `/juegos/[id]/jugar` → requiere autenticación (redirect a `/auth?redirect=...` si no hay sesión)

**Estado actual:** La ruta `/juegos/[id]/jugar` NO está protegida. Cualquier usuario sin autenticación puede acceder al reproductor de juegos directamente, bypasseando el flujo de login.

**Impacto:** Bypass completo del sistema de autenticación para la funcionalidad principal de la aplicación (jugar juegos). Aunque el guardado de puntajes sí requiere autenticación (protegido por `saveScoreAction`), el acceso al reproductor no está restringido, contradiciendo el objetivo de la spec 08 de "proteger la ruta `/juegos/[id]/jugar` para requerir login".

Ver hallazgo detallado S-01 en la sección 3.

### 2.4. Server Actions

**`lib/actions/auth.ts`:**

- `signUpAction`: ✓ Valida contraseña (8+ caracteres, mayúscula, número, símbolo), valida longitud de `playerName` (1-12), verifica unicidad de `playerName`, crea usuario en Auth, inserta en `players`.
- `signInAction`: ✓ Verifica que el email esté confirmado antes de permitir login.
- `signOutAction`: ✓ Llama `supabase.auth.signOut()` y revalida rutas.

**`lib/actions/save-score.ts`:**

- `saveScoreAction`: ✓ NO recibe `name` como parámetro (obtiene `user_id` de sesión del servidor), valida rango de `score` (0-10,000,000), valida que `gameId` existe, busca `player_id` por `user_id`, inserta en `scores`.

**Evidencia:**

```typescript
export async function saveScoreAction(input: SaveScoreInput): Promise<SaveScoreResult> {
    // 1. Validar el puntaje
    if (!Number.isInteger(input.score) || input.score < SCORE_MIN || input.score > SCORE_MAX) {
        return { ok: false, error: 'El puntaje no es válido.' };
    }

    const supabase = await createClient();

    // 2. Obtener user_id de la sesión del servidor
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { ok: false, error: 'Debes iniciar sesión para guardar tu puntaje.' };
    }

    // 3. Validar que el juego existe
    const { data: game, error: gameError } = await supabase
        .from('games')
        .select('id')
        .eq('id', input.gameId)
        .maybeSingle();
    // ...

    // 4. Buscar player_id en players donde user_id = auth.uid()
    const { data: player, error: playerError } = await supabase
        .from('players')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
    // ...

    // 5. Insertar el puntaje con el player_id obtenido
    const { error: scoreError } = await supabase.from('scores').insert({
        game_id: input.gameId,
        player_id: player.id,
        score: input.score,
    });
    // ...
}
```

✓ `saveScoreAction` NO confía en datos del cliente para el nombre de jugador (obtiene `user_id` de la sesión del servidor).  
✓ Todas las Server Actions siguen el patrón seguro de validación server-side y autenticación basada en sesión del servidor.

### 2.5. Variables de Entorno

**`.env.local` commiteado:** ✗ no commiteado (correcto)  
**`.gitignore` incluye `.env.local`:** ✓ (patrón `.env*` en línea 34)

**Evidencia:**

```bash
# Verificación de .env.local en git
$ git ls-files .env.local 2>&1 | grep -q "\.env\.local"
# Resultado: NO COMMITEADO

# Verificación de .gitignore
$ grep "\.env" .gitignore
.env*
!.env.template
```

✓ `.env.local` NO está commiteado al repositorio (correcto).  
✓ `.env.local` está cubierto por el patrón `.env*` en `.gitignore` (correcto).  
✓ `.env.template` está excluido del ignore para permitir su versionado (correcto).

### 2.6. Secrets Hardcodeados

**Búsqueda ejecutada:**

```bash
grep -r -E "(api_key|apikey|secret|password|token|jwt|supabase_service_role)" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  lib/ app/ components/ | grep -v "// " | grep -v "/\*" | grep -v "process.env"
```

**Resultados:**

Todos los matches encontrados son referencias legítimas a nombres de variables, parámetros de funciones, o comentarios de documentación (ej: `password: string`, `function validatePassword`, etc.).

✓ No se encontraron secrets hardcodeados en el código de la aplicación.  
✓ Todas las referencias a API keys y secrets se hacen a través de variables de entorno (`process.env.*`).

---

## 3. Hallazgos Detallados

### S-01: Middleware de protección de rutas no existe

**Categoría:** Middleware  
**Severidad:** CRÍTICO  
**Ubicación:** raíz del proyecto (archivo `middleware.ts` ausente)

**Descripción:**

El archivo `middleware.ts` requerido por la spec 08 para proteger rutas autenticadas no existe en la raíz del proyecto. Según la spec 08, sección "Scope" y "Implementation plan" paso 5:

> "Proteger la ruta `/juegos/[id]/jugar`: si no hay sesión autenticada, redirect a `/auth` con query param `?redirect=/juegos/[id]/jugar` para volver después del login."

> "Crear `middleware.ts` en la raíz del proyecto para proteger `/juegos/[id]/jugar`: si no hay sesión (`supabase.auth.getUser()` falla), redirect a `/auth?redirect=/juegos/[id]/jugar`."

La búsqueda de archivos `middleware.*` en la raíz del proyecto no devolvió resultados:

```bash
$ find /Users/miguel.pastor/projects/pocs/ia/05-arcade-vault -maxdepth 1 -name "middleware.*" -type f
# (sin resultados)
```

**Impacto:**

Cualquier usuario sin autenticación puede acceder directamente a la ruta `/juegos/[id]/jugar` (reproductor de juegos) sin pasar por el flujo de login. Esto bypasea el sistema de autenticación implementado en la spec 08 y contradice uno de los objetivos principales de esa spec: requerir autenticación para jugar.

Aunque el guardado de puntajes sí está protegido por `saveScoreAction` (que verifica la sesión del servidor), el acceso al reproductor en sí no está restringido. Un usuario malicioso podría:

1. Jugar sin registrarse, ver el modal de "Regístrate para guardar tu puntaje" al terminar
2. Pero la experiencia de juego completa está disponible sin autenticación, lo cual no era el comportamiento esperado según la spec 08

**Evidencia:**

```bash
# Búsqueda de middleware.ts
$ find /Users/miguel.pastor/projects/pocs/ia/05-arcade-vault -maxdepth 1 -name "middleware.ts" -type f
# (sin resultados)

# Búsqueda de middleware con cualquier extensión
$ find /Users/miguel.pastor/projects/pocs/ia/05-arcade-vault -maxdepth 1 -name "middleware.*" -type f
# (sin resultados)
```

**Recomendación:**

Crear el archivo `middleware.ts` en la raíz del proyecto con el siguiente contenido:

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Proteger /juegos/[id]/jugar
    if (pathname.match(/^\/juegos\/[^\/]+\/jugar$/)) {
        let response = NextResponse.next({
            request,
        });

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
                        response = NextResponse.next({
                            request,
                        });
                        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
                    },
                },
            },
        );

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            // No hay sesión, redirect a /auth con query param redirect
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

**Prioridad:** Acción inmediata

**Referencias:**

- Spec 08: sección "Scope", punto "Proteger la ruta `/juegos/[id]/jugar`"
- Spec 08: sección "Implementation plan", paso 5
- Spec 08: sección "Acceptance criteria", punto "Navegar a `/juegos/[id]/jugar` sin sesión autenticada redirige a `/auth?redirect=...`"
- Supabase SSR Docs: [Using Middleware](https://supabase.com/docs/guides/auth/server-side/nextjs)

---

### S-02: Políticas RLS no usan `(select auth.uid())` (optimización de performance)

**Categoría:** Supabase RLS  
**Severidad:** MEDIO  
**Ubicación:** Políticas `players_insert_authenticated` y `scores_insert_authenticated` en Supabase

**Descripción:**

Supabase Performance Advisors detectó que las políticas RLS de `players` y `scores` llaman a `auth.uid()` directamente en sus cláusulas `with_check`, lo que causa re-evaluación de la función para cada fila insertada. Según el warning `auth_rls_initplan`:

> "Table `public.players` has a row level security policy `players_insert_authenticated` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing `auth.<function>()` with `(select auth.<function>())`."

> "Table `public.scores` has a row level security policy `scores_insert_authenticated` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing `auth.<function>()` with `(select auth.<function>())`."

**Impacto:**

Este es un hallazgo de **optimización de performance**, no de seguridad crítica. Las políticas RLS están funcionando correctamente y protegiendo los datos como se espera. Sin embargo, en escenarios de alta carga (inserts en batch o múltiples usuarios registrándose/guardando puntajes simultáneamente), el rendimiento podría degradarse.

En el contexto actual de Arcade Vault (aplicación arcade con inserts de una fila a la vez, baja concurrencia esperada), el impacto es mínimo. Este hallazgo se clasifica como MEDIO por ser una mejora recomendada por Supabase, no una vulnerabilidad.

**Evidencia:**

```json
{
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": ["PERFORMANCE"],
    "findings": [
        {
            "detail": "Table `public.players` has a row level security policy `players_insert_authenticated` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing `auth.<function>()` with `(select auth.<function>())`.",
            "metadata": { "name": "players", "type": "table", "schema": "public" }
        },
        {
            "detail": "Table `public.scores` has a row level security policy `scores_insert_authenticated` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing `auth.<function>()` with `(select auth.<function>())`.",
            "metadata": { "name": "scores", "type": "table", "schema": "public" }
        }
    ]
}
```

**Políticas actuales:**

```sql
-- players_insert_authenticated
with_check: auth.uid() = user_id

-- scores_insert_authenticated
with_check: EXISTS (SELECT 1 FROM players WHERE players.id = scores.player_id AND players.user_id = auth.uid())
```

**Recomendación:**

Actualizar las políticas RLS para usar `(select auth.uid())` en vez de `auth.uid()`:

```sql
-- Reemplazar política de players
DROP POLICY IF EXISTS "players_insert_authenticated" ON public.players;

CREATE POLICY "players_insert_authenticated"
  ON public.players
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- Reemplazar política de scores
DROP POLICY IF EXISTS "scores_insert_authenticated" ON public.scores;

CREATE POLICY "scores_insert_authenticated"
  ON public.scores
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.id = scores.player_id
        AND players.user_id = (select auth.uid())
    )
  );
```

Ejecutar estas queries en Supabase SQL Editor o aplicarlas como migración con `mcp__supabase__apply_migration`.

**Prioridad:** Backlog (optimización, no crítico)

**Referencias:**

- [Supabase Database Linter - auth_rls_initplan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)
- [Supabase RLS - Call functions with select](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)

---

### S-03: Leaked password protection deshabilitado

**Categoría:** Supabase Auth  
**Severidad:** MEDIO  
**Ubicación:** Configuración de Supabase Auth (dashboard manual)

**Descripción:**

Supabase Security Advisors reportó que leaked password protection está deshabilitado:

> "Leaked password protection is currently disabled. Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org. Enable this feature to enhance security."

Este warning ya fue documentado en la spec 09 como **fuera de scope** (configuración manual pendiente, no disponible en todas las versiones de Supabase Auth). Según la spec 09, sección "Out of scope":

> "Leaked password protection (verificación contra HaveIBeenPwned) — el usuario lo activará manualmente desde el dashboard de Supabase Auth cuando su versión lo soporte."

**Impacto:**

Los usuarios pueden registrarse con contraseñas que han sido expuestas en brechas de seguridad conocidas (ej: "Password123!", "Qwerty123!", etc.), incluso si cumplen los requisitos de longitud y complejidad. Esto aumenta el riesgo de compromiso de cuentas por ataques de diccionario o credential stuffing.

Sin embargo, la validación actual (mínimo 8 caracteres + mayúscula + número + símbolo) ya mitiga parcialmente este riesgo al rechazar contraseñas débiles obvias. El impacto se limita a contraseñas que cumplen los requisitos de complejidad pero están en listas de compromiso conocidas.

**Evidencia:**

```json
{
    "name": "auth_leaked_password_protection",
    "title": "Leaked Password Protection Disabled",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": ["SECURITY"],
    "description": "Leaked password protection is currently disabled.",
    "remediation": "https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection",
    "findings": [
        {
            "detail": "Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org. Enable this feature to enhance security.",
            "metadata": { "type": "auth", "entity": "Auth" }
        }
    ]
}
```

**Recomendación:**

Habilitar leaked password protection desde el dashboard de Supabase Auth:

1. Abrir el dashboard de Supabase: https://supabase.com/dashboard
2. Seleccionar el proyecto `kjpvjfhuqrclpblkthpd`
3. Ir a **Authentication** → **Policies**
4. En la sección **Password Strength**, habilitar:
    - **Leaked Password Protection:** ON
5. Guardar cambios

**Nota:** Esta configuración solo está disponible en versiones recientes de Supabase Auth. Si la opción no aparece en el dashboard, verificar la versión de Supabase del proyecto o contactar con soporte de Supabase.

**Prioridad:** Esta semana (cuando la feature esté disponible en la versión de Supabase del proyecto)

**Referencias:**

- [Supabase Password Security - Leaked Password Protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- Spec 09: sección "Out of scope"

---

### S-04: Índices no usados en tabla `scores`

**Categoría:** Supabase Performance  
**Severidad:** BAJO  
**Ubicación:** Índices `scores_game_id_idx` y `scores_player_id_idx` en tabla `public.scores`

**Descripción:**

Supabase Performance Advisors detectó que dos índices en la tabla `scores` nunca han sido usados:

> "Index `scores_game_id_idx` on table `public.scores` has not been used"
> "Index `scores_player_id_idx` on table `public.scores` has not been used"

**Impacto:**

Este es un hallazgo de **optimización de recursos**, no de seguridad. Los índices no usados consumen espacio en disco y pueden ralentizar operaciones de escritura (`INSERT`/`UPDATE`/`DELETE`) sin aportar beneficio en lecturas. Sin embargo, en el contexto actual:

- La tabla `scores` tiene solo 2 filas según `list_tables` (volumen muy bajo)
- Los índices podrían volverse útiles a medida que crezca el volumen de datos
- El impacto en performance es insignificante con el volumen actual

Este hallazgo se clasifica como BAJO porque es cosmético en el estado actual del proyecto. Sería relevante revisarlo si la tabla `scores` crece a miles/millones de filas.

**Evidencia:**

```json
{
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": ["PERFORMANCE"],
    "findings": [
        {
            "detail": "Index `scores_game_id_idx` on table `public.scores` has not been used",
            "metadata": { "name": "scores", "type": "table", "schema": "public" }
        },
        {
            "detail": "Index `scores_player_id_idx` on table `public.scores` has not been used",
            "metadata": { "name": "scores", "type": "table", "schema": "public" }
        }
    ]
}
```

**Recomendación:**

Opción 1 (conservadora, recomendada): **Mantener los índices** porque serán útiles cuando la tabla crezca. Las queries comunes de leaderboards (`getGlobalLeaderboard`, `getGameLeaderboard`) probablemente filtran/ordenan por `game_id` y hacen joins por `player_id`, así que estos índices se volverán relevantes con más datos.

Opción 2 (si se confirma que no se usan): Eliminar los índices:

```sql
DROP INDEX IF EXISTS public.scores_game_id_idx;
DROP INDEX IF EXISTS public.scores_player_id_idx;
```

Antes de eliminarlos, verificar con `EXPLAIN ANALYZE` en las queries de `lib/supabase/queries.ts` (`getGlobalLeaderboard`, `getGameLeaderboard`) para confirmar que no se están usando.

**Prioridad:** Backlog (optimización menor)

**Referencias:**

- [Supabase Database Linter - unused_index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
- PostgreSQL: [EXPLAIN](https://www.postgresql.org/docs/current/sql-explain.html)

---

## 4. Configuración Manual Requerida

Algunos controles de seguridad requieren configuración manual desde el dashboard de Supabase Auth (no automatizable vía MCP):

### 4.1. Longitud Mínima de Contraseña

**Estado esperado:** 8 caracteres (según spec 09)  
**Verificación manual:** Dashboard → Authentication → Policies → Password Strength → Minimum password length  
**Nota:** Esta auditoría NO puede verificar esta configuración automáticamente. Verificar manualmente que esté en 8.

### 4.2. Leaked Password Protection

**Estado esperado:** Habilitado (según checklist de seguridad)  
**Estado actual:** Deshabilitado (según warning de `get_advisors`)  
**Verificación manual:** Dashboard → Authentication → Policies → Leaked Password Protection  
**Nota:** Requiere versión de Supabase que soporte esta feature. Si no está disponible, documentar como pendiente. Ver hallazgo S-03.

### 4.3. Max Signup Rate (Rate Limiting)

**Estado esperado:** Configurado (según checklist de seguridad)  
**Verificación manual:** Dashboard → Authentication → Policies → Rate Limiting  
**Nota:** Configuración opcional recomendada para prevenir abuso de registro. No auditado en esta revisión (fuera de scope de las specs 08 y 09).

---

## 5. Recomendaciones Priorizadas

Lista de acciones ordenadas por prioridad:

### Acción Inmediata (hallazgos CRÍTICOS)

1. **[S-01] Crear `middleware.ts` en la raíz del proyecto** para proteger `/juegos/[id]/jugar`. Sin este middleware, la ruta está completamente desprotegida y cualquier usuario puede acceder sin autenticación. Ver sección 3, hallazgo S-01 para el código de referencia.

### Esta Semana (hallazgos MEDIOS)

1. **[S-03] Habilitar leaked password protection** en Supabase Auth dashboard (Authentication → Policies → Leaked Password Protection → ON). Verificar primero que la feature esté disponible en la versión actual de Supabase del proyecto.

2. **[S-02] Optimizar políticas RLS** para usar `(select auth.uid())` en vez de `auth.uid()` en las políticas `players_insert_authenticated` y `scores_insert_authenticated`. Ver sección 3, hallazgo S-02 para las queries SQL.

### Backlog (hallazgos BAJOS)

1. **[S-04] Evaluar índices no usados** en tabla `scores`. Si después de análisis con `EXPLAIN` se confirma que no aportan, eliminarlos. Opción conservadora: mantenerlos porque serán útiles cuando crezca el volumen de datos.

---

## 6. Estado de Specs de Seguridad

**Spec 08 (Supabase Auth):**

- Implementada: ✓
- Controles verificados: 11 / 12
- Hallazgos: 1 (CRÍTICO: middleware ausente)

**Detalle:**

- ✓ Autenticación real con Supabase Auth (email/password)
- ✓ Columna `user_id` en `players` con constraint unique y foreign key
- ✓ Políticas RLS verificadas para `insert` en `players`/`scores`
- ✓ Validación de contraseñas (mayúscula, número, símbolo)
- ✓ Verificación de email obligatoria
- ✓ Server Actions de auth (`signUpAction`, `signInAction`, `signOutAction`)
- ✓ `saveScoreAction` NO recibe `name` (obtiene `user_id` de sesión)
- ✓ Verificación de unicidad de `playerName`
- ✓ Formularios de login/registro con toggle
- ✓ Botón de logout en Nav
- ✓ "Tu mejor marca" lee de sesión real (no de `localStorage`)
- ✗ **Middleware de protección de rutas NO implementado** (hallazgo S-01)

**Spec 09 (Security Hardening):**

- Implementada: ✓
- Controles verificados: 5 / 5
- Hallazgos: 1 (MEDIO: leaked password protection pendiente de configuración manual)

**Detalle:**

- ✓ Función `rls_auto_enable()` cambió a `SECURITY INVOKER` (warnings resueltos)
- ✓ Validación de contraseñas elevada a 8+ caracteres (client-side y server-side)
- ✓ Headers HTTP de seguridad (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy`)
- ✓ Usuarios mock actualizados a contraseña de 8+ caracteres (`Test-001!`)
- ○ Leaked password protection documentado como configuración manual pendiente (hallazgo S-03)

---

## 7. Próxima Auditoría

**Fecha recomendada para próxima auditoría:** 2026-10-09 (30 días desde hoy)

**Triggers para auditoría intermedia:**

- Implementación de nueva feature de autenticación (OAuth, magic link, recuperación de contraseña)
- Cambios en políticas RLS (nuevas tablas, modificaciones a políticas existentes)
- Agregado de nuevas Server Actions que manejen datos sensibles
- Deploy a producción o cambio de entorno (staging → producción)
- Después de resolver el hallazgo crítico S-01 (middleware), para verificar que la implementación es correcta

---

## Anexo: Queries Ejecutadas

Lista completa de queries SQL ejecutadas durante la auditoría, para reproducibilidad:

```sql
-- 1. Verificar RLS habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('games', 'players', 'scores');

-- 2. Verificar políticas de players y scores
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('players', 'scores')
ORDER BY tablename, policyname;

-- 3. Verificar función rls_auto_enable()
SELECT proname, prosrc, provolatile, prosecdef, proacl
FROM pg_proc
WHERE proname = 'rls_auto_enable' AND pronamespace = 'public'::regnamespace;

-- 4. Verificar constraints de players.user_id
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
  AND tc.table_schema = ccu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'players'
  AND kcu.column_name = 'user_id';
```

**Comandos bash ejecutados:**

```bash
# Verificar si middleware.ts existe
find /Users/miguel.pastor/projects/pocs/ia/05-arcade-vault -maxdepth 1 -name "middleware.ts" -type f

# Verificar si .env.local está commiteado
git ls-files /Users/miguel.pastor/projects/pocs/ia/05-arcade-vault/.env.local 2>&1 | grep -q "\.env\.local"

# Verificar si .env.local está en .gitignore
grep -q "\.env\.local" /Users/miguel.pastor/projects/pocs/ia/05-arcade-vault/.gitignore

# Buscar secrets hardcodeados
grep -r -E "(api_key|apikey|secret|password|token|jwt|supabase_service_role)" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  lib/ app/ components/ 2>/dev/null | grep -v "// " | grep -v "/\*" | grep -v "process.env"
```

**Herramientas MCP usadas:**

```bash
# Supabase Security Advisors
mcp__supabase__get_advisors(type: "security")
mcp__supabase__get_advisors(type: "performance")

# Listar tablas
mcp__supabase__list_tables(schemas: ["public"], verbose: false)

# Ejecutar queries SQL
mcp__supabase__execute_sql(query: "...")
```

---

**Fin del reporte**
