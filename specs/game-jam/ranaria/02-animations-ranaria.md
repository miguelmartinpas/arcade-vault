# SPEC game-jam/ranaria/02 — Animaciones y efectos visuales de Ranaria

> **Status:** Draft
> **Depends on:** game-jam/ranaria/01
> **Date:** 2026-08-12
> **Objective:** Agregar animaciones de salto, partículas de muerte y efectos visuales que mejoren el feedback del jugador en Ranaria (Frogger).

## Scope

**In:**

- Animación de salto de la rana con arco parabólico al moverse entre celdas
- Partículas al morir en carretera (explosión con fragmentos rojos/naranjas)
- Partículas al morir en río (splash de agua con gotas azules)
- Animación de llegada a meta (flash de celebración, parpadeo de la meta ocupada)
- Trail effect leve de la rana al saltar (estela de opacidad decreciente)
- Feedback visual al pausar (overlay semi-transparente sobre el canvas)
- Animación de transición de nivel (flash de pantalla + texto "NIVEL N")

**Out of scope:**

- Efectos de sonido (no hay assets de audio disponibles)
- Power-ups visuales (requiere spec dedicada 03)
- Timer visual (spec 03)
- Modificar mecánica core (ya en spec 01)
- Controles táctiles

## Data model

Extensión al estado del motor (agregar al closure existente de `lib/games/frogger/engine.ts`):

```typescript
// Nuevo estado para efectos visuales
let particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string }>; // partículas de muerte/splash
let jumpAnimation: { active: boolean; fromX: number; fromY: number; toX: number; toY: number; progress: number } | null; // animación de salto
let levelTransition: { active: boolean; alpha: number; duration: number } | null; // flash de transición de nivel
let goalFlash: number[]; // flash de cada meta al ocuparla (0-1, fade out)
```

No hay cambios en Supabase (spec 01 ya hizo el alta).

## Implementation plan

1. Implementar animación de salto con arco: al presionar una tecla de dirección, en vez de mover la rana instantáneamente, iniciar `jumpAnimation` con posiciones `from`/`to` y `progress = 0`. En cada frame, incrementar `progress` de 0 a 1 en ~150ms; interpolar posición x/y linealmente y agregar desplazamiento vertical parabólico (ej. `y_offset = sin(progress * π) * 0.3` celdas) para simular el arco del salto. Al llegar a `progress >= 1`, completar el salto (mover la rana a `to`, desactivar animación). Mientras la animación está activa, ignorar inputs de teclado (no permitir saltos en el aire). Verificación: la rana salta con arco visible, no teleport instantáneo.

2. Implementar sistema de partículas: al morir (colisión con auto o caída al agua), generar 10-15 partículas con velocidades radiales aleatorias desde la posición de la rana. Cada partícula tiene `life` que decrementa cada frame; cuando llega a 0 se elimina. Color de partículas: rojo/naranja si murió en carretera, azul/cyan si murió en río. Dibujar partículas como círculos pequeños con opacidad proporcional a `life`. Verificación: al morir se ve burst de partículas del color apropiado.

3. Implementar animación de llegada a meta: al llegar a una meta vacía, iniciar `goalFlash[i] = 1.0` para esa meta. En cada frame, decrementar `goalFlash[i]` gradualmente hasta 0 en ~500ms. Dibujar la meta ocupada con opacidad/brillo modulado por `goalFlash[i]` (parpadeo que se desvanece). Verificación: al ocupar una meta se ve flash de celebración.

4. Implementar trail effect de la rana: durante la animación de salto, guardar las últimas 3-5 posiciones intermedias de la rana en un buffer circular. Dibujar cada posición del trail como una copia semi-transparente de la rana con opacidad decreciente (más vieja = más transparente). Limpiar el buffer al completar el salto. Verificación: la rana deja estela visual al saltar.

5. Implementar overlay de pausa: al pausar, dibujar rectángulo semi-transparente sobre el canvas con opacidad 0.4 y texto "PAUSA" centrado. Verificación: al pausar se ve overlay oscuro con texto.

6. Implementar transición de nivel: al completar las 5 metas (subir de nivel), iniciar `levelTransition` con `alpha = 1.0` y decrementar gradualmente en ~1000ms. Mientras `alpha > 0`, dibujar flash blanco sobre todo el canvas con opacidad `alpha` y texto "NIVEL N" centrado. Después del flash, continuar el juego normal con velocidades aumentadas. Verificación: al subir de nivel se ve flash de pantalla completa con texto.

7. Ajustar detección de colisiones y muerte para que no sean instantáneas durante la animación de salto: validar colisiones solo al finalizar cada salto (cuando `progress >= 1`), no en frames intermedios. Esto evita muertes "injustas" por colisiones durante el arco del salto. Verificación: la rana puede saltar "sobre" autos si el timing es correcto.

8. Verificación manual completa: jugar, saltar (ver arco), morir en carretera (ver explosión roja), morir en río (ver splash azul), llegar a meta (ver flash), pausar (ver overlay), completar 5 metas (ver transición de nivel). Confirmar que el gameplay del MVP no cambió (solo efectos visuales).

## Acceptance criteria

- [ ] La rana salta con animación de arco parabólico visible (~150ms de duración)
- [ ] Durante el salto, la rana no puede saltar de nuevo (inputs ignorados hasta completar)
- [ ] Al morir en carretera se ven partículas rojas/naranjas saliendo radialmente
- [ ] Al morir en río se ven partículas azules (splash de agua)
- [ ] Al llegar a una meta se ve flash de celebración que se desvanece
- [ ] La rana deja trail effect leve durante el salto
- [ ] Al pausar se ve overlay semi-transparente con texto "PAUSA"
- [ ] Al completar 5 metas se ve flash de pantalla completa con texto "NIVEL N"
- [ ] Las colisiones se validan al finalizar el salto, no durante el arco (se puede saltar sobre autos)
- [ ] El gameplay del MVP sigue funcionando exactamente igual (mecánica no cambia)
- [ ] `npm run lint` y `next build` pasan sin errores

## Decisions

- **Sí:** Animación de salto con arco parabólico (~150ms). **No:** Salto instantáneo — el arco mejora significativamente el feedback visual y la sensación de control.
- **Sí:** Ignorar inputs durante la animación de salto. **No:** Permitir saltos en el aire — evita mecánica confusa y mantiene el timing discreto de Frogger original.
- **Sí:** Colisiones validadas solo al finalizar el salto. **No:** Colisiones durante el arco — permite timing skill (saltar sobre autos) y evita muertes injustas durante la animación.
- **Sí:** Partículas simples (círculos con fade-out) con colores según contexto (rojo en carretera, azul en río). **No:** Sprites complejos — no hay assets disponibles y se busca mantener estilo minimalista.
- **Sí:** Trail effect durante el salto (últimas 3-5 posiciones). **No:** Trail continuo todo el tiempo — sería visualmente ruidoso y la rana pasa la mayor parte del tiempo estática esperando el próximo input.
- **Sí:** Flash de pantalla completa en transición de nivel (~1000ms). **No:** Transición instantánea — marca claramente el logro de completar las 5 metas y prepara al jugador para la velocidad aumentada.

## Risks

| Risk                                                                                                                  | Mitigation                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Animación de salto puede causar desincronización con movimiento de troncos (rana en el aire mientras tronco se mueve) | Continuar ajustando la posición de la rana por velocidad del tronco incluso durante la animación de salto, si está sobre un tronco al iniciar el salto               |
| Partículas pueden acumularse y causar lag si se muere repetidamente sin dar tiempo a que se limpien                   | Limitar el número máximo de partículas activas (ej. 100); si se alcanza el límite, eliminar las más viejas antes de agregar nuevas                                   |
| Flash de transición de nivel puede causar salto brusco si los autos/troncos se mueven durante el flash                | Pausar el movimiento de autos/troncos durante el flash de transición (~1000ms), reanudar después; usar el mismo mecanismo que `pause()` pero controlado internamente |
| Trail effect puede verse cortado si la rana salta muy cerca del borde del canvas                                      | Validar que cada posición del trail esté dentro de bounds antes de dibujarla; recortar o no dibujar posiciones fuera del canvas                                      |

## What is NOT in this spec

- Efectos de sonido
- Power-ups visuales
- Timer visual
- HUD mejorado con iconos
- Diferentes tipos de animaciones para distintos obstáculos
- Controles táctiles

Cada uno de estos requiere spec propia o assets adicionales.
