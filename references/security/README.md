# Auditorías de Seguridad - Arcade Vault

Este directorio contiene las auditorías de seguridad del proyecto y el estado conocido de la postura de seguridad.

## Agente de Auditoría

El agente `security-audit` (`.claude/agents/security-audit.md`) es el encargado de ejecutar auditorías de seguridad automatizadas del proyecto.

### Cómo Ejecutar una Auditoría

Para ejecutar una auditoría completa, usar cualquiera de estos comandos:

```
audita seguridad
```

o

```
revisa vulnerabilidades
```

o

```
security check
```

El agente generará un reporte estructurado en `references/security/security-audit-YYYY-MM-DD.md` con:

- Resumen ejecutivo con estado general
- Tabla de hallazgos clasificados por severidad
- Hallazgos detallados con evidencia y recomendaciones
- Recomendaciones priorizadas (acción inmediata / esta semana / backlog)
- Anexo con queries ejecutadas (reproducibilidad)

### Qué Audita el Agente

**Base de Datos (Supabase):**
- Warnings de seguridad (`get_advisors`)
- RLS habilitado en tablas (`games`, `players`, `scores`)
- Políticas RLS de insert autenticadas (no públicas)
- Función `rls_auto_enable()` (debe estar eliminada o SECURITY INVOKER)
- Constraints de `players.user_id` (unique + foreign key)

**Aplicación (Next.js):**
- Headers HTTP de seguridad (CSP, X-Frame-Options, etc.)
- Validación de contraseñas client-side (8+ chars, mayúscula, número, símbolo)
- Validación de contraseñas server-side (defensa en profundidad)
- Middleware de protección de rutas (`middleware.ts`)
- Server Actions (validación de sesión)
- Gestión de variables de entorno (`.env.local` no commiteado)
- Secrets hardcodeados en el código

### Clasificación de Severidad

El agente clasifica cada hallazgo según su severidad:

- **CRÍTICO:** Vulnerabilidad explotable que permite bypass de autenticación, escalación de privilegios, o exposición de datos sensibles. Requiere acción inmediata.
- **ALTO:** Configuración incorrecta o faltante que degrada significativamente la postura de seguridad. Debe corregirse pronto.
- **MEDIO:** Buena práctica no implementada o configuración débil sin impacto directo en seguridad. Conviene corregir.
- **BAJO:** Mejora cosmética o recomendación sin impacto en seguridad. Opcional.

### Cuándo Ejecutar una Auditoría

**Ejecución recomendada:**
- Después de implementar una spec de seguridad (08, 09, etc.)
- Antes de un deploy a producción
- Después de cambios en políticas RLS
- Después de agregar nuevas Server Actions
- Periódicamente (cada 30 días)

**Triggers de auditoría intermedia:**
- Nueva feature de autenticación implementada
- Cambios en headers HTTP o middleware
- Agregado de nuevas variables de entorno

### Archivos en este Directorio

- **`checklist.md`** - Estado conocido previo de la auditoría, warnings históricos de Supabase
- **`security-audit-YYYY-MM-DD.md`** - Reportes de auditorías ejecutadas (uno por fecha)
- **`README.md`** - Este archivo (documentación del proceso de auditoría)

### Notas Importantes

- El agente **NUNCA modifica código** - solo reporta hallazgos
- El agente **NUNCA ejecuta queries de escritura** en Supabase - solo SELECT
- Los secrets encontrados se redactan como `[SECRET REDACTED]` en el reporte
- Cada reporte tiene timestamp único - nunca se sobrescriben reportes anteriores
- Los reportes son comparables históricamente para ver evolución de seguridad

### Ejemplo de Flujo de Trabajo

1. **Ejecutar auditoría inicial:**
   ```
   audita seguridad
   ```

2. **Revisar reporte generado:**
   ```
   cat references/security/security-audit-YYYY-MM-DD.md
   ```
   (reemplazando YYYY-MM-DD con la fecha de la auditoría)

3. **Priorizar hallazgos críticos** según sección 5 del reporte

4. **Implementar correcciones** en specs específicas o directamente

5. **Re-auditar después de correcciones:**
   ```
   audita seguridad
   ```

6. **Comparar reportes históricos** para confirmar que hallazgos fueron resueltos

### Hallazgos Conocidos Actuales

Según `checklist.md`:

- ⚠️ Función `rls_auto_enable()` ejecutable por roles públicos como SECURITY DEFINER
- ⚠️ Leaked password protection deshabilitado (configuración manual pendiente)
- ❌ **Middleware de protección de rutas no existe** (hallazgo crítico detectado)

Ejecutar primera auditoría para generar baseline completo.
