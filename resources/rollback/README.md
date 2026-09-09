# Guía de Rollback - Arcade Vault

Este directorio contiene los comandos de rollback para cada merge realizado a `master`.

## ¿Cómo funciona?

Cada vez que se mergea una spec a `master`, se genera automáticamente un archivo `rollback-<fecha>-<version>.md` que contiene el comando exacto para revertir ese merge si fuera necesario.

## Estrategias de Rollback

### 🎯 Opción recomendada: Revertir el merge (seguro)

Esta es la forma más segura de hacer rollback porque **no reescribe la historia de git**.

```bash
# El comando específico está en el archivo rollback-YYYY-MM-DD-1.0.XX.md
git revert -m 1 <merge-commit-hash>
git push origin master
```

**Ventajas:**

- ✅ No reescribe la historia (seguro para trabajo colaborativo)
- ✅ Mantiene el registro completo de qué se hizo y por qué
- ✅ Se puede "revertir el revert" si necesitas recuperar los cambios después
- ✅ Otros desarrolladores no tendrán conflictos

**Cuándo usar:**

- En cualquier situación donde otras personas puedan estar trabajando en el proyecto
- Cuando quieres mantener un historial completo y auditable
- Como primera opción siempre

---

### ⚠️ Opción alternativa: Reset al tag (destructivo)

**Solo usar en casos extremos y si sos el único trabajando en el proyecto.**

```bash
# Volver al tag anterior (estado estable conocido)
git reset --hard 1.0.<XX-1>  # tag de la versión anterior

# Push forzado (DESTRUCTIVO)
git push origin master --force
```

**Desventajas:**

- ❌ Reescribe la historia de git
- ❌ Otros desarrolladores tendrán conflictos graves
- ❌ Pérdida del registro de lo que pasó
- ❌ Puede causar pérdida de trabajo si alguien más hizo commits encima

**Cuándo usar:**

- Solo en repositorios personales
- Solo si nadie más está trabajando
- Como último recurso cuando el revert no es suficiente

---

### 📋 Rollback de un commit específico

Si solo necesitas deshacer UN cambio específico dentro del merge (no todo el merge):

```bash
# Revertir un commit individual
git revert <commit-hash-específico>
git push origin master
```

---

## 🏷️ Uso de los tags

Los tags sirven como **puntos de referencia estables** del último estado conocido bueno:

```bash
# Ver el código en un tag específico (sin modificar nada)
git checkout 1.0.10

# Crear una rama desde ese tag para trabajar
git checkout -b hotfix-from-1.0.10 1.0.10

# Comparar el estado actual con un tag
git diff 1.0.10 master

# Volver a master
git checkout master
```

---

## 📁 Archivos de rollback

Cada archivo `rollback-<fecha>-<version>.md` contiene:

1. **Comando de revert exacto** con el hash del merge commit
2. **Información de contexto**: qué spec se mergeó, cuándo, qué cambió
3. **Tag de referencia**: el tag `1.0.XX` asociado a ese merge
4. **Comando de reset alternativo** (solo para casos extremos)

**Ejemplo de uso:**

```bash
# 1. Leer el archivo de rollback de la versión que querés revertir
cat resources/rollback/rollback-2026-09-09-1.0.10.md

# 2. Copiar y ejecutar el comando de revert que aparece ahí
git revert -m 1 230ae36

# 3. Push del revert
git push origin master
```

---

## 🔍 Identificar qué revertir

Si no sabes cuál merge revertir:

```bash
# Ver historial de merges
git log --oneline --merges

# Ver cambios introducidos por un merge
git show <merge-commit-hash>

# Ver diferencias entre tags
git diff 1.0.09 1.0.10
```

---

## ⚡ Flujo completo de rollback recomendado

1. **Identificar el problema**: ¿Qué versión causó el issue?

2. **Localizar el archivo de rollback**:

    ```bash
    ls -la resources/rollback/
    ```

3. **Leer el archivo de la versión problemática**:

    ```bash
    cat references/rollback/rollback-YYYY-MM-DD-1.0.XX.md
    ```

4. **Ejecutar el comando de revert** (copiado del archivo):

    ```bash
    git revert -m 1 <merge-commit-hash>
    ```

5. **Revisar el revert**:

    ```bash
    git show HEAD  # ver qué deshizo
    ```

6. **Push del revert**:

    ```bash
    git push origin master
    ```

7. **Verificar** que todo volvió al estado esperado

8. **Documentar** en un issue o commit message por qué se hizo el rollback

---

## 💡 Mejores prácticas

- ✅ **Siempre preferí `git revert`** sobre `git reset --force`
- ✅ **Documentá por qué** haces el rollback en el mensaje del commit
- ✅ **Verificá** que el rollback hizo lo que esperabas antes de pushear
- ✅ **Comunicá** al equipo cuando hagas un rollback
- ✅ **Guardá** los archivos de rollback en este directorio (no los borres)
- ❌ **Nunca uses `--force`** en master a menos que sea absolutamente necesario

---

## 🆘 Recuperación después de un rollback

Si después de revertir te das cuenta de que no era necesario:

```bash
# Revertir el revert (recuperar los cambios)
git revert <commit-hash-del-revert>
git push origin master
```

Los tags siguen apuntando al commit original, así que siempre podés volver a ese estado.

---

## 📞 En caso de problemas

Si algo sale mal durante un rollback:

1. **No entres en pánico**
2. **No hagas `git push --force`** sin pensarlo
3. **Consultá el estado actual**: `git status` y `git log`
4. **Si estás en detached HEAD**: `git checkout master`
5. **Si tenés cambios sin commitear**: `git stash` primero
6. **Si ya hiciste push de algo mal**: coordiná con el equipo antes de forzar nada

Los tags son tu red de seguridad: siempre podés volver a un estado conocido bueno.
