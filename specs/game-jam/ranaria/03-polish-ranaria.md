# SPEC game-jam/ranaria/03 — Polish y features avanzadas de Ranaria

> **Status:** Draft
> **Depends on:** game-jam/ranaria/02
> **Date:** 2026-08-12
> **Objective:** Agregar timer por intento, power-ups, obstáculos avanzados y mejoras de UX para completar la experiencia de Ranaria (Frogger).

## Scope

**In:**

- Timer por intento (60 segundos por vida)
- Bonus de puntuación por tiempo restante al llegar a meta (+1 punto por segundo restante)
- Barra de tiempo visual en el HUD (dentro del canvas, parte superior)
- Power-up de mosca (aparece aleatoriamente en zona segura, +200 puntos, +5 segundos de tiempo)
- Obstáculos avanzados: tortugas que se sumergen periódicamente (3 estados: arriba, bajando, abajo)
- Cocodrilos en el río (boca abierta/cerrada periódicamente, muerte si rana toca boca abierta)
- Niveles con velocidad creciente más pronunciada (cada nivel +15% velocidad, cap a 2.5× velocidad inicial)
- HUD mejorado con iconos de vidas (ranas pequeñas) y timer visual
- Screen shake al morir (vibración del canvas por ~200ms)
- Feedback visual de "tiempo bajo" (parpadeo rojo cuando quedan <10 segundos)

**Out of scope:**

- Efectos de sonido (no hay assets de audio disponibles)
- Controles táctiles
- Múltiples layouts de nivel (el layout de carriles permanece igual)
- Modificar la tabla `games` o agregar nuevos registros (ya hecho en spec 01)
- Sistema de high score persistente en cliente (ya resuelto por Supabase)

## Data model

Extensión al estado del motor (agregar al closure existente de `lib/games/frogger/engine.ts`):

```typescript
// Nuevo estado para features avanzadas
let timeLeft: number; // segundos restantes en el intento actual (60 inicial)
let timeAccum: number; // acumulador de dt para decrementar timeLeft cada segundo
let powerUp: { x: number; y: number; type: 'fly' } | null; // power-up activo (mosca)
let turtles: Array<{
    lane: number;
    x: number;
    speed: number;
    width: number;
    state: 'up' | 'down' | 'submerged';
    stateTime: number;
}>; // tortugas que se sumergen
let crocodiles: Array<{ lane: number; x: number; speed: number; width: number; mouthOpen: boolean; mouthTime: number }>; // cocodrilos
let screenShake: { active: boolean; duration: number; intensity: number }; // efecto de shake al morir
```

No hay cambios en Supabase (spec 01 ya hizo el alta).

## Implementation plan

1. Implementar timer por intento: agregar `timeLeft = 60` (segundos) al iniciar cada vida. En el loop, acumular `dt` en `timeAccum`; cada vez que `timeAccum >= 1.0`, decrementar `timeLeft` en 1 segundo y resetear `timeAccum`. Si `timeLeft` llega a 0, tratar como muerte (decrementar vidas, resetear rana). Dibujar barra de tiempo horizontal en la parte superior del canvas (ancho proporcional a `timeLeft / 60`). Verificación: timer decrementa cada segundo, llegar a 0 mata a la rana.

2. Implementar bonus por tiempo restante: al llegar a meta, calcular bonus como `timeLeft * 1` (1 punto por segundo restante), sumar al score total, mostrar texto flotante "+X BONUS" sobre la meta. Verificación: llegar rápido a meta otorga más puntos que llegar lento.

3. Implementar power-up de mosca: cada 10-15 segundos, si no hay power-up activo, spawnear una mosca en una posición aleatoria de zona segura (fila 0 o 6). Si la rana toca la mosca, sumar +200 al score, agregar +5 segundos a `timeLeft` (cap a 60), eliminar power-up, mostrar texto "+200 +5s". Dibujar mosca como sprite simple o círculo con animación de aleteo. Verificación: recolectar mosca suma puntos y tiempo.

4. Implementar tortugas que se sumergen: en 2-3 carriles de río, reemplazar algunos troncos por grupos de tortugas. Cada grupo de tortugas tiene un estado (`up`, `down`, `submerged`) que cambia periódicamente cada 2-3 segundos. Si la rana está sobre tortugas en estado `submerged`, es muerte (caída al agua). Dibujar tortugas con animación de hundimiento (sprite o círculos que se achican). Verificación: tortugas se sumergen y emergen periódicamente, estar sobre tortugas sumergidas mata.

5. Implementar cocodrilos en el río: en 1-2 carriles de río, agregar cocodrilos que se mueven como troncos pero con boca que abre/cierra periódicamente cada 1.5-2 segundos. Si la rana está sobre un cocodrilo con boca abierta, es muerte. Si está sobre cocodrilo con boca cerrada, es seguro (funciona como tronco). Dibujar cocodrilo con animación de boca (sprite o rectángulo con "dientes" que aparecen). Verificación: cocodrilos abren/cierran boca, tocar boca abierta mata.

6. Implementar velocidad creciente por nivel más pronunciada: cambiar la fórmula de velocidad de +10% a +15% por nivel, con cap a 2.5× la velocidad inicial (nivel ~11). Aplicar a autos, troncos, tortugas y cocodrilos. Verificación: niveles avanzados son significativamente más rápidos.

7. Implementar HUD mejorado con iconos: dibujar vidas como pequeñas ranas (sprites o formas simples) en la esquina inferior izquierda del canvas. Timer como barra horizontal de color verde → amarillo → rojo según tiempo restante. Cuando `timeLeft < 10`, hacer parpadear la barra roja (alternar opacidad). Verificación: HUD visual muestra vidas y timer claramente.

8. Implementar screen shake al morir: al decrementar vidas (muerte), iniciar `screenShake` con `duration = 200` ms e `intensity = 5` px. En cada frame mientras shake activo, aplicar offset aleatorio (±intensity) a todas las coordenadas de dibujo del canvas. Decrementar `duration` con `dt` hasta 0. Verificación: al morir se ve vibración de pantalla breve.

9. Verificación manual completa: jugar con timer activo, recolectar moscas (ver bonus de puntos y tiempo), esquivar tortugas que se sumergen, esquivar cocodrilos con boca abierta, ver parpadeo rojo cuando queda poco tiempo, morir por timeout, ver screen shake al morir. Confirmar que specs 01 y 02 siguen funcionando correctamente.

## Acceptance criteria

- [ ] El timer decrementa cada segundo desde 60 hasta 0
- [ ] La barra de tiempo visual se muestra en la parte superior del canvas
- [ ] Al llegar a 0 segundos, la rana muere y vuelve al inicio
- [ ] Llegar a meta otorga bonus de +1 punto por segundo restante
- [ ] Las moscas aparecen aleatoriamente en zonas seguras cada 10-15 segundos
- [ ] Recolectar mosca suma +200 puntos y +5 segundos al timer
- [ ] Las tortugas se sumergen y emergen periódicamente en sus carriles
- [ ] Estar sobre tortugas sumergidas mata a la rana
- [ ] Los cocodrilos abren y cierran la boca periódicamente
- [ ] Tocar un cocodrilo con boca abierta mata a la rana
- [ ] Estar sobre cocodrilo con boca cerrada es seguro (funciona como tronco)
- [ ] Cada nivel aumenta la velocidad de obstáculos en ~15%
- [ ] El HUD muestra vidas como iconos de ranas pequeñas
- [ ] La barra de tiempo cambia de color (verde → amarillo → rojo) según tiempo restante
- [ ] Cuando quedan <10 segundos, la barra parpadea en rojo
- [ ] Al morir se ve screen shake (vibración) por ~200ms
- [ ] El gameplay de specs 01 y 02 sigue funcionando correctamente
- [ ] `npm run lint` y `next build` pasan sin errores

## Decisions

- **Sí:** Timer de 60 segundos por vida (no por partida completa). **No:** Timer global — permite intentos cortos y focalizados, mantiene presión constante.
- **Sí:** Bonus de +1 punto por segundo restante al llegar a meta. **No:** Bonus fijo — recompensa gameplay rápido y skillful, incentiva tomar riesgos calculados.
- **Sí:** Power-up de mosca (+200 puntos, +5 segundos) en zonas seguras. **No:** Power-ups en zonas peligrosas — evita muertes frustrantes por intentar recolectar bonus, mantiene las zonas seguras como "respiro".
- **Sí:** Tortugas que se sumergen periódicamente (2-3 segundos por estado). **No:** Tortugas siempre seguras — agrega capa de timing skill adicional al río, distinto de simplemente "estar sobre plataforma".
- **Sí:** Cocodrilos con boca abierta/cerrada (1.5-2 segundos de ciclo). **No:** Cocodrilos siempre peligrosos — permite usar cocodrilos como plataformas "de riesgo", mecánica más interesante que evitarlos siempre.
- **Sí:** Velocidad +15% por nivel con cap a 2.5× (nivel ~11). **No:** Velocidad sin límite — evita que el juego se vuelva injugable en niveles muy altos, mantiene curva de dificultad razonable.
- **Sí:** HUD visual dentro del canvas (iconos de vidas, barra de timer). **No:** Depender solo del HUD de React — mejora la inmersión y concentración (toda la info relevante en el canvas).
- **Sí:** Screen shake al morir (~200ms, ±5px). **No:** Sin feedback de shake — el shake refuerza el impacto de la muerte, mejora el juice del juego.
- **Sí:** Parpadeo rojo de timer cuando quedan <10 segundos. **No:** Timer estático — alerta visual clara de urgencia sin necesidad de mirar el número exacto.

## Risks

| Risk                                                                                                                  | Mitigation                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timer puede causar frustración si el jugador no tiene tiempo suficiente para cruzar en niveles avanzados              | Ajustar duración del timer según nivel (ej. 60s nivel 1, 70s nivel 5+) o agregar más moscas en niveles altos para compensar                                         |
| Tortugas que se sumergen justo cuando la rana salta sobre ellas puede causar muertes "injustas"                       | Sincronizar el cambio de estado de tortugas con una pequeña animación de advertencia (ej. burbujas 0.5s antes de sumergirse) para dar tiempo de reacción al jugador |
| Cocodrilos con boca abierta pueden coincidir con la única plataforma disponible en un frame, haciendo imposible pasar | Garantizar que siempre haya al menos una plataforma segura (tronco o cocodrilo boca cerrada) visible en cada carril de río en todo momento                          |
| Screen shake puede causar mareo si es muy intenso o dura mucho                                                        | Limitar intensidad a ±5px y duración a 200ms; considerar agregar opción de configuración para desactivar shake si se reporta feedback negativo                      |
| Power-ups de mosca pueden spawnear en la misma posición que la rana, otorgando bonus sin esfuerzo                     | Validar que la posición de spawn de mosca no coincida con la posición actual de la rana; re-randomizar si coincide                                                  |
| Múltiples obstáculos animados (tortugas, cocodrilos, moscas) pueden afectar performance en dispositivos lentos        | Limitar número total de obstáculos animados simultáneos (ej. max 3 grupos de tortugas + 2 cocodrilos); optimizar dibujo usando sprites pre-renderizados si aplica   |

## What is NOT in this spec

- Efectos de sonido (música de fondo, SFX de salto/muerte/recolección)
- Controles táctiles
- Múltiples layouts de nivel (bordes con arbustos, lirios flotantes adicionales)
- Sistema de achievements o badges
- Replay system o grabación de partidas
- Modificar la tabla `games` en Supabase
- Leaderboard específico por nivel (solo global)

Cada uno de estos requiere spec propia y evaluación de valor vs. esfuerzo.
