# Receta: los 5 seams de controles táctiles

Esta es la receta concreta que replica `specs/10-controles-tactiles-moviles.md` en un juego
nuevo. Cada seam muestra el código real de un juego existente como plantilla — cópialo y
adáptalo, no lo reinventes.

## 1. Motor — `lib/games/<id>/engine.ts`

Dos formas, según cómo el motor ya lea el teclado hoy.

### 1a. Estado continuo (el motor lee `this.keys[code]` cada frame)

Ejemplo real, Asteroids (`lib/games/asteroids/engine.ts`), indexado por `e.code`:

```ts
setKey(code: string, pressed: boolean) {
  if (pressed) {
    if (!this.keys[code]) this.justPressed[code] = true;
    this.keys[code] = true;
  } else {
    this.keys[code] = false;
  }
}
// onKeyDown → this.setKey(e.code, true);
// onKeyUp   → this.setKey(e.code, false);
```

Arkanoid (`lib/games/arkanoid/engine.ts`) indexa por `e.key` en vez de `e.code` — respeta cuál
usa el motor que estás tocando:

```ts
setKey(key: string, pressed: boolean) {
  if (key in this.keys) this.keys[key as keyof typeof this.keys] = pressed;
}
```

`justPressed[code]` es para acciones que el motor trata como "un solo evento por pulsación" aunque
lean `this.keys` (p. ej. el disparo de Asteroids, consumido por un `pressed(code)` que resetea el
flag). Si tu juego tiene una acción así, replica ese patrón: `justPressed` se marca `true` en el
flanco `false→true` de `setKey`, y algo en el `update()` del motor lo consume y lo vuelve a poner
en `false`.

### 1b. Input discreto (cada tecla dispara una acción, una vez)

Ejemplo real, Tetris (`lib/games/tetris/engine.ts`): el `switch` que antes vivía directo en
`onKeyDown` se extrae a un método privado compartido:

```ts
private handleAction(code: string) {
  if (this.paused || this.gameOver) return;
  switch (code) {
    case "ArrowLeft":  /* mover pieza a la izquierda */ break;
    case "ArrowRight": /* mover pieza a la derecha */ break;
    case "ArrowDown":  this.softDrop(); break;
    case "ArrowUp":
    case "KeyX":        this.tryRotate(); break;
    case "Space":        this.hardDrop(); break;
  }
}

pressKey(code: string) {
  this.handleAction(code);
}

// onKeyDown ahora sólo maneja teclas que NO deben ser táctiles (p. ej. "KeyP" de pausa)
// y delega el resto en this.handleAction(e.code).
```

Snake (`lib/games/snake/engine.ts`) sigue el mismo molde: `handleAction` llama
`queueDirection(...)` para Arrow/WASD, `pressKey` lo envuelve.

**Regla:** el guard de `paused`/`gameOver` vive en `handleAction`, así que tanto el teclado como
`pressKey` lo respetan automáticamente — no lo dupliques en el canvas ni en `touch-controls.tsx`.

## 2. Handle del canvas — `components/games/<id>-canvas.tsx`

Añade el método nuevo al tipo del handle y a la implementación, junto a `restart` (ya existente):

```ts
export interface <Id>CanvasHandle {
  restart: () => void;
  setKey: (code: string, pressed: boolean) => void; // o pressKey: (code: string) => void;
}

// dentro de useImperativeHandle(ref, () => ({
//   restart: () => engineRef.current?.restart(),
//   setKey: (code, pressed) => engineRef.current?.setKey(code, pressed),
// }), []);
```

Usa `pressKey` en vez de `setKey` si el motor es de input discreto (1b).

## 3. Layout — `components/games/touch-controls.tsx`

El componente ya expone una unión discriminada por familia de firma de `onKey`:

```ts
interface HoldControlsProps {
  layout: "asteroids" | "arkanoid" | "<id>"; // añade tu id aquí si es setKey
  onKey: (code: string, pressed: boolean) => void;
}

interface PressControlsProps {
  layout: "snake" | "tetris" | "<id>"; // añade tu id aquí si es pressKey
  onKey: (code: string) => void;
}
```

Crea el sub-componente de botones reusando `TouchButton` y las clases CSS existentes. Ejemplo
mínimo (2 botones, estilo Arkanoid — hold, sin repeat):

```tsx
function <Id>Controls({ onKey }: { onKey: (code: string, pressed: boolean) => void }) {
  return (
    <div className="dpad dpad-2">
      <TouchButton
        label="◄" ariaLabel="Mover a la izquierda" className="dpad-left"
        onPress={() => onKey("ArrowLeft", true)}
        onRelease={() => onKey("ArrowLeft", false)}
      />
      <TouchButton
        label="►" ariaLabel="Mover a la derecha" className="dpad-right"
        onPress={() => onKey("ArrowRight", true)}
        onRelease={() => onKey("ArrowRight", false)}
      />
    </div>
  );
}
```

Si el modelo es `pressKey` (estilo Snake/Tetris), los botones no llevan `onRelease` — sólo
`onPress={() => onKey("<Code>")}`, y `repeat` sólo si quieres auto-repeat mientras se mantiene
presionado (como Tetris en izquierda/derecha/abajo; Snake no repite porque ya avanza sola).

**Caso especial — acción "discreta por frame" (como el disparo de Asteroids):** si el motor
consume un `justPressed` en vez de leer estado continuo, el botón debe forzar un flanco nuevo en
cada repeat, no sólo mantener `true`:

```tsx
<TouchButton
  label="●"
  ariaLabel="Disparar"
  className="action-btn action-btn-fire"
  onPress={() => {
    onKey("Space", false);
    onKey("Space", true);
  }}
  onRelease={() => onKey("Space", false)}
  repeat
/>
```

Añade la rama en el render final de `TouchControls`:

```tsx
{props.layout === "<id>" && <<Id>Controls onKey={props.onKey} />}
```

**CSS a reusar** (`app/globals.css`, bloque `touch controls` ~línea 1560): `.dpad` (grid 3×3),
`.dpad-2` (fila de 2), `.dpad-up/-down/-left/-right` (grid-area), `.touch-controls-actions`
(fila de botones circulares), `.action-btn`, `.action-btn-fire` (variante magenta). Sólo crea una
variante nueva (p. ej. `.dpad-N` para N ≠ 2/3/4) si ninguna encaja; sigue el mismo patrón de
`grid-template-areas` + `repeat(N, 52px)`.

## 4. Wiring — `components/game-player.tsx`

Patrón exacto (ya existe para los 4 juegos actuales, líneas ~438–469):

```tsx
{isTouchDevice && (
  <>
    {/* ...juegos existentes... */}
    {is<Id> && (
      <TouchControls
        layout="<id>"
        onKey={(code, pressed) => <id>Ref.current?.setKey(code, pressed)}
        // o: onKey={(code) => <id>Ref.current?.pressKey(code)}
      />
    )}
  </>
)}
```

`isTouchDevice` viene del hook ya existente `useIsTouchDevice()` (usa
`window.matchMedia("(pointer: coarse)")`) — no lo reimplementes. `<id>Ref` es el mismo ref que ya
se usa para `restart` en el flujo de "jugar de nuevo"; sólo asegúrate de que su tipo incluya el
método nuevo del handle (seam 2).

## 5. CSS

Sólo si Fase 2 concluyó que hace falta una variante de `dpad`/`action-btn` nueva. Si el juego
encaja en `dpad-2`/`dpad-3`/`dpad-4` + `action-btn` existentes, **no toques `app/globals.css`**.

---

## Ruta especial — juegos de estructura combinada (Frogger y similares)

Frogger (`lib/games/frogger/FroggerGame.tsx`) no separa motor/canvas ni expone un handle
imperativo — es un único componente que remonta vía `frogKey` para reiniciar. Para estos casos:

- **No hay seam 1/2 clásico.** En su lugar, dentro del componente combinado expón un manejador de
  input equivalente a `handleAction`/`setKey` (una función interna que ya recibe las pulsaciones
  de teclado) como una prop opcional o un `useImperativeHandle` nuevo que el componente no tenía
  antes — evalúa cuál requiere menos cambios estructurales y confírmalo con el usuario en Fase 2
  si no es obvio.
- **Seams 3–5 son idénticos**: layout en `touch-controls.tsx`, wiring condicional en
  `game-player.tsx` (el ref apunta ahora al componente combinado en vez de a un canvas wrapper),
  y CSS reusado.
- Si la estructura del juego objetivo no calza ni con el molde estándar (motor+canvas) ni con
  este molde combinado, pregunta al usuario cómo prefiere exponer el input antes de tocar código.
