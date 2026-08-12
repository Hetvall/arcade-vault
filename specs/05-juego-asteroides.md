# 05 — Juego Asteroides (ROCAS)

- **Estado:** Implemented
- **Depende de:** —
- **Fecha:** 2026-08-11
- **Objetivo:** Portar el prototipo de Asteroids (`references/started-games/02-asteroids/game.js`) a un motor TypeScript reutilizable y conectarlo a la entrada `rocas` del catálogo, reemplazando la arena placeholder de `GamePlayer` por el juego real con HUD, pausa, fin de partida y guardado de puntuación integrados a la plataforma.

## Alcance

### Dentro de alcance

- Nuevo motor de juego portado 1:1 en mecánicas desde `references/started-games/02-asteroids/game.js`: física de la nave, wrap toroidal, asteroides que se dividen (grande → mediano → pequeño), balas, partículas de explosión, power-up de disparo triple (`PowerUp`, `POWERUP_DROP_CHANCE`, `POWERUP_DURATION`, `POWERUP_TTL`, `TRIPLE_SPREAD`), progresión de niveles (`spawnAsteroids`, `nextLevel`) y vidas con invencibilidad temporal al reaparecer. Ninguna constante de balance (velocidades, puntos, radios, cooldowns) cambia respecto al original.
- El motor se reestructura de variables/funciones globales de módulo a una clase `AsteroidsEngine` sin estado compartido entre instancias, para poder montarse/desmontarse limpiamente con el ciclo de vida de React (incluye StrictMode, que monta/desmonta efectos dos veces en desarrollo).
- `AsteroidsEngine` expone:
  - `constructor(canvas: HTMLCanvasElement, callbacks: { onStateChange(state: AsteroidsState): void })`.
  - `start()` — arranca el loop (`requestAnimationFrame`) y la partida.
  - `pause()` / `resume()` — congela/reanuda la simulación (`update(dt)` no se ejecuta en pausa; el loop de `requestAnimationFrame` sigue vivo pero no avanza estado ni redibuja más que el último frame).
  - `restart()` — reinicia la partida desde cero (equivalente a `initGame()` del original).
  - `destroy()` — cancela el `requestAnimationFrame` pendiente y remueve los listeners de teclado; se llama al desmontar el componente.
  - `onStateChange` se invoca en cada frame con `{ score, lives, level, tripleShotSecondsLeft, gameOver }`, reemplazando el HUD y el overlay de `GAME OVER` que el original dibujaba directamente en el canvas (`drawHUD`, `drawOverlay('GAME OVER', ...)`), los cuales se eliminan del `draw()` portado.
  - El auto-reinicio del original al pulsar ESPACIO en estado `gameover` se elimina; al llegar a `lives <= 0` el engine se queda en `gameOver: true` sin reiniciarse solo, esperando a que algo externo llame `restart()`.
- El canvas mantiene resolución lógica fija 800×600 (mismas coordenadas y constantes `W`/`H` que el original) y se escala visualmente por CSS dentro de `.crt-screen` (`width: 100%; height: auto; aspect-ratio: 4 / 3`), sin recalcular físicas por tamaño de contenedor.
- Nuevo Client Component `AsteroidsCanvas` que:
  - Renderiza el `<canvas>`, instancia `AsteroidsEngine` en un `useEffect` (con `useRef` para la instancia), y llama `destroy()` en el cleanup.
  - Recibe `paused: boolean` por props y llama `pause()`/`resume()` en el engine cuando cambia.
  - Recibe `onStateChange` por props y lo reenvía tal cual al engine (para que el componente padre, `GamePlayer`, mantenga el estado real en React).
  - Expone `restart()` al padre vía `ref` (o recibe un `restartSignal`/callback) para que el botón "JUGAR DE NUEVO" del modal existente pueda reiniciar la partida real.
- `components/game-player.tsx` se modifica para:
  - Cuando `game.id === "rocas"`: renderizar `AsteroidsCanvas` dentro de `.crt-screen` en lugar del `.game-arena` placeholder, y alimentar el HUD (`Puntuación`, `Vidas`, `Nivel`) y el modal de fin de partida (`over`, `score` finales) con el estado real recibido de `onStateChange`, en vez del `setInterval` de puntaje aleatorio actual.
  - Para cualquier otro `game.id`: comportamiento exacto actual sin cambios (arena placeholder + puntaje simulado).
  - El botón "PAUSA"/"REANUDAR" ahora controla pausa real para `rocas` (antes solo detenía el `setInterval` falso).
  - El botón "FIN" (terminar partida manualmente) para `rocas` fuerza el fin de partida usando el score/estado actual del engine (no mata la nave del juego real; simplemente corta la partida y abre el modal, igual que hoy hace para el resto de juegos).
  - "JUGAR DE NUEVO" en el modal llama `restart()` sobre el engine real para `rocas` (antes solo reseteaba el estado de React).
- Controles: solo teclado, igual que el original (`←`/`→` rotar, `↑` propulsar, `Espacio` disparar). Soporte táctil queda fuera de alcance (ver "Fuera de alcance").
- "Mejor global" en `/game/rocas` (stat-strip de `app/game/[id]/page.tsx`): se extrae esa celda a un nuevo Client Component `components/best-score-stat.tsx` que:
  - Lee `scores` de `useSession()` (ya sincronizado desde `av_scores` en localStorage tras montar).
  - Calcula el máximo `score` entre todas las entradas guardadas en ese navegador para `game.id` (todas las iniciales/jugadores guardados localmente, no solo el usuario en sesión).
  - Si no hay ninguna entrada guardada para ese juego, cae al valor mock `game.best` como fallback (mismo comportamiento visual que hoy: número real, sin loading spinner ni layout shift perceptible — el fallback se pinta ya en el primer render porque `game.best` está disponible sin esperar el `useEffect`).
  - Se usa únicamente en `/game/rocas` por ahora (queda disponible para reusarse en otros juegos cuando tengan spec propio, pero este spec solo lo conecta ahí).
  - Se agrega `bestGlobalScoreFor(game: string, scores: SavedScore[]): number | null` a `lib/session.ts`, análogo a `bestScoreFor` ya existente pero sin filtrar por nombre de jugador.
- El resto de `app/game/[id]/page.tsx` permanece Server Component; solo la celda de "Mejor global" se vuelve cliente.

### Fuera de alcance

- Controles táctiles/móviles para Asteroids — se porta solo el control por teclado del original. Un spec futuro puede cubrir controles táctiles para todos los juegos a la vez.
- Cualquier cambio de mecánicas o balance del juego (velocidades, puntos, probabilidad de power-up, tamaños de asteroides, etc.) respecto a `references/started-games/02-asteroids/game.js` — la portada es 1:1.
- Migrar el guardado de puntuaciones a Supabase — `saveScore` sigue escribiendo en `localStorage` vía `session-context.tsx`, sin cambios.
- Conectar los demás juegos del catálogo (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`) a motores reales — siguen usando la arena placeholder de `GamePlayer` hasta tener su propio spec.
- Cambiar el valor mock `game.best` en `lib/games.ts` — sigue existiendo como fallback, no se reemplaza ni se borra del catálogo.
- Sonido/música — el original no tiene audio y este spec no lo agrega.
- Tabla de puntuaciones específica de Asteroids con datos reales reemplazando `seededScores` en el leaderboard de `/game/rocas` — ese leaderboard lateral sigue siendo data falsa, solo cambia la celda "Mejor global" del stat-strip.
- Redimensionar el canvas dinámicamente según el contenedor (ResizeObserver) — se escala por CSS manteniendo la resolución lógica fija 800×600.

## Modelo de datos

```ts
// lib/games/asteroids/engine.ts
interface AsteroidsState {
  score: number;
  lives: number;
  level: number;
  tripleShotSecondsLeft: number; // 0 si no está activo
  gameOver: boolean;
}

class AsteroidsEngine {
  constructor(
    canvas: HTMLCanvasElement,
    callbacks: {
      onStateChange: (state: AsteroidsState) => void;
    }
  );
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
}
```

```ts
// lib/session.ts (adición)
function bestGlobalScoreFor(game: string, scores: SavedScore[]): number | null;
```

No se agregan tablas, claves de `localStorage` nuevas ni cambios al esquema de `SavedScore`/`SessionUser` ya existentes.

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app/` en lo referente a Client Components, `useEffect` y manejo de `<canvas>`/APIs de navegador, para confirmar que no hay convención distinta en Next 16 que afecte este patrón.
2. Crear `lib/games/asteroids/engine.ts`: portar las clases `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle` y toda la lógica de `update`/`draw`/`spawnAsteroids`/`nextLevel`/`explode`/`killShip` desde `references/started-games/02-asteroids/game.js`, envolviéndolas dentro de la clase `AsteroidsEngine` (estado de instancia, no globals de módulo). Quitar `drawHUD` y `drawOverlay('GAME OVER', ...)` del `draw()` portado. Quitar el auto-reinicio con `Space` en estado `gameover`. Añadir `pause()`/`resume()` (flag interno que `update()` respeta) y invocar `onStateChange` al final de cada `update()`.
3. Crear `components/games/asteroids-canvas.tsx` (Client Component): monta el `<canvas width={800} height={600}>`, instancia `AsteroidsEngine` en `useEffect` (cleanup con `destroy()`), sincroniza `paused` por props con `pause()/resume()`, reenvía `onStateChange`, y expone `restart()` vía `useImperativeHandle`/`forwardRef` para que `GamePlayer` pueda reiniciar la partida real desde el botón "JUGAR DE NUEVO".
4. Modificar `components/game-player.tsx`: reemplazar el `setInterval` de puntaje falso por el estado real cuando `game.id === "rocas"` (renderizando `AsteroidsCanvas` dentro de `.crt-screen` en vez de `.game-arena`), conectar los botones PAUSA/REANUDAR, FIN y JUGAR DE NUEVO al engine real solo para `rocas`, manteniendo el comportamiento actual sin cambios para el resto de juegos.
5. Agregar `bestGlobalScoreFor` en `lib/session.ts`.
6. Crear `components/best-score-stat.tsx` (Client Component) que usa `useSession()` + `bestGlobalScoreFor(game.id, scores)` con fallback a `game.best`.
7. Modificar `app/game/[id]/page.tsx`: reemplazar el valor estático de la celda "Mejor global" del `stat-strip` por `<BestScoreStat game={game} />`.
8. Prueba manual end-to-end: `npm run dev`, ir a `/games` → ROCAS → "JUGAR AHORA", jugar con teclado (rotar, propulsar, disparar, recoger power-up 3x, dividir asteroides, subir de nivel), pausar/reanudar, perder las 3 vidas, confirmar que aparece el modal "FIN DEL JUEGO" con el score real (no el overlay del canvas), guardar puntuación con iniciales, volver a `/game/rocas` y confirmar que "Mejor global" refleja la puntuación guardada; "JUGAR DE NUEVO" desde el modal reinicia una partida real jugable.
9. Confirmar que los demás juegos del catálogo (p.ej. `bloque-buster`) siguen mostrando la arena placeholder sin cambios de comportamiento.
10. Ejecutar `npm run lint` y corregir lo que reporte.

## Criterios de aceptación

- [ ] `/game/rocas/play` renderiza el canvas real de Asteroids (nave, asteroides, balas, partículas, power-up 3x) en vez de la arena placeholder de CSS.
- [ ] El HUD superior (`Puntuación`, `Vidas`, `Nivel`) refleja en tiempo real el estado del engine, no el `setInterval` de puntaje aleatorio.
- [ ] El canvas ya no dibuja su propio SCORE/NIVEL/vidas ni el overlay "GAME OVER" — esa información vive solo en el HUD y modal de React.
- [ ] Los controles de teclado (`←` `→` `↑` `Espacio`) funcionan igual que en `references/started-games/02-asteroids/game.js`: rotación, propulsión, disparo, y disparo triple mientras el power-up está activo.
- [ ] Los asteroides grandes se dividen en medianos y estos en pequeños al ser destruidos por una bala, con los mismos puntos (20/50/100) del original.
- [ ] El botón PAUSA congela la simulación real (la nave/asteroides dejan de moverse) y muestra el overlay "EN PAUSA" ya existente; REANUDAR la retoma sin perder estado.
- [ ] Al perder la tercera vida, el juego NO se reinicia solo con ESPACIO; en su lugar se abre el modal "FIN DEL JUEGO" de la plataforma con la puntuación final real.
- [ ] Guardar la puntuación desde el modal persiste en `av_scores` (localStorage) igual que para el resto de juegos, vía `saveScore` de `session-context.tsx`.
- [ ] "JUGAR DE NUEVO" en el modal reinicia una partida real y jugable del engine (no solo resetea contadores de React).
- [ ] "VOLVER AL VAULT" y "SALIR" navegan igual que hoy, sin dejar el `requestAnimationFrame` del engine corriendo en segundo plano (se llama `destroy()` al desmontar).
- [ ] En `/game/rocas`, la celda "Mejor global" muestra el máximo real guardado en `av_scores` para `rocas` si existe alguno; si no hay ninguno, muestra el valor mock actual (`41200`) sin romper el layout.
- [ ] Los demás juegos del catálogo (`bloque-buster`, `caida`, etc.) siguen mostrando la arena placeholder y el puntaje simulado, sin cambios de comportamiento.
- [ ] `npm run lint` pasa sin errores nuevos.

## Decisiones tomadas y descartadas

- **Motor como clase TS con callbacks (`AsteroidsEngine`) en vez de portar casi literal con variables de módulo**: el original usa globals de módulo (`ship`, `bullets`, `score`, ...) que no soportan más de una instancia viva ni un remount limpio (React StrictMode monta/desmonta efectos dos veces en desarrollo); encapsular todo el estado en una instancia de clase evita fugas de estado entre remounts y permite `destroy()` determinista.
- **Se elimina el HUD/overlay dibujado en canvas** (`drawHUD`, `drawOverlay('GAME OVER', ...)`) en vez de mantenerlo junto al HUD de React: mostrar la misma información dos veces (canvas + HUD React) sería ruido visual redundante; la plataforma ya tiene su propio sistema de HUD y modal consistente con el resto de juegos.
- **Se desactiva el auto-reinicio con ESPACIO en `gameover`**: el modal de fin de partida pide iniciales por teclado; si ESPACIO reiniciara la partida real mientras el jugador escribe o hace focus en el input, se perdería la puntuación antes de poder guardarla. El reinicio ahora es explícito vía el botón "JUGAR DE NUEVO".
- **Canvas de resolución lógica fija (800×600) escalado por CSS, no redimensionado dinámicamente**: mantiene intactas todas las constantes de física/velocidad del original (que asumen ese tamaño) sin tener que recalcularlas por viewport; es el mismo patrón de "resolución fija + escala visual" común en juegos de canvas portados, y evita un scope adicional (ResizeObserver, recomputar `W`/`H`) no pedido.
- **Solo teclado en este spec, controles táctiles fuera de alcance**: agregar controles táctiles es una feature transversal a todos los juegos del catálogo, no específica de Asteroids; mezclarla aquí infla el spec fuera de su objetivo de una sola frase.
- **"Mejor global" resuelto con un Client Component aislado (`BestScoreStat`) en vez de convertir toda la página de detalle en cliente**: preserva el render en servidor del resto de `/game/[id]/page.tsx` (SEO, carga inicial), aceptando que solo esa celda específica tenga un pequeño salto tras hidratar si hay puntuaciones guardadas (mitigado con el fallback a `game.best` que ya se pinta en el primer render).
- **Solo se conecta `rocas`; el resto del catálogo sigue con la arena placeholder**: es el alcance explícito pedido ("el primer juego de Asteroides"); conectar los demás juegos requiere sus propios motores/specs.
- **Sin cambios de balance/mecánicas respecto al original**: el juego ya fue diseñado y ajustado en `references/started-games/02-asteroids`; este spec es de integración a la plataforma, no de rediseño de gameplay.

## Riesgos identificados

- React StrictMode en desarrollo monta y desmonta efectos dos veces; si `AsteroidsEngine.destroy()` no cancela correctamente el `requestAnimationFrame` y remueve los listeners de teclado, podrían quedar dos loops corriendo en paralelo o listeners duplicados — mitigación: probar explícitamente el flujo de pausa/reinicio/salida en desarrollo (no solo en build de producción) antes de dar el spec por verificado.
- Los listeners de teclado (`keydown`/`keyup`) del original están en `window`; si el usuario navega fuera de `/game/rocas/play` sin que `destroy()` se ejecute a tiempo, podrían interferir con otras pantallas — mitigación: `destroy()` se llama en el cleanup de `useEffect`, que Next.js/React garantiza al desmontar el componente antes de navegar.
- `bestGlobalScoreFor` lee `av_scores` completo del navegador (todas las iniciales guardadas ahí, de cualquier "sesión" mock que haya jugado en ese dispositivo), lo cual puede no coincidir con lo que un usuario esperaría como "mejor global" real (que implicaría un backend compartido entre dispositivos) — aceptado como limitación conocida del modelo actual 100% localStorage, ya documentada en specs previas.
