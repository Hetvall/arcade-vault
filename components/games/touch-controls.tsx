"use client";

// Overlay de controles táctiles compartido por los 4 juegos con motor real.
// Ver specs/10-controles-tactiles-moviles.md. No depende de ningún juego
// concreto: recibe `layout` (qué botones dibujar) y `onKey` (a qué método del
// ref del canvas reenviar cada pulsación) — game-player.tsx decide el resto.
//
// Dos familias de layout, con firmas de onKey distintas:
// - "hold" (asteroids, arkanoid): los motores leen this.keys cada frame
//   (setKey), así que basta con onKey(code, true) en touchstart y
//   onKey(code, false) en touchend/touchcancel. Asteroids es la excepción:
//   el botón de disparo simula pulsaciones repetidas (ver TouchButton.repeat)
//   porque el motor trata "Space" como pulsación discreta por frame
//   (justPressed), no como estado continuo.
// - "press" (snake, tetris): los motores exponen pressKey(code), una
//   pulsación = una acción. Tetris repite mientras se mantiene presionado
//   en izquierda/derecha/abajo (imitando el auto-repeat de teclado del que
//   depende hoy); snake no repite nunca (la serpiente ya avanza sola).
//
// Solo se usan handlers touchstart/touchend/touchcancel (nunca onClick) para
// no disparar además el evento de mouse fantasma que el navegador sintetiza
// tras un touch, lo que duplicaría la acción (ver "Riesgos identificados").

import { useEffect, useRef } from "react";

// Antes de empezar a repetir tras mantener presionado.
const REPEAT_DELAY_MS = 220;
// Cadencia de repetición (mover pieza en Tetris, disparo en Asteroids).
const REPEAT_INTERVAL_MS = 70;

interface TouchButtonProps {
  label: string;
  ariaLabel: string;
  className?: string;
  onPress: () => void;
  onRelease?: () => void;
  repeat?: boolean;
}

function TouchButton({
  label,
  ariaLabel,
  className,
  onPress,
  onRelease,
  repeat,
}: TouchButtonProps) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Por si el componente se desmonta a mitad de un touch (navegación,
  // fin de partida, etc.): evita timers huérfanos.
  useEffect(() => clearTimers, []);

  const handleStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onPress();
    if (repeat) {
      timeoutRef.current = setTimeout(() => {
        intervalRef.current = setInterval(onPress, REPEAT_INTERVAL_MS);
      }, REPEAT_DELAY_MS);
    }
  };

  const handleEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    clearTimers();
    onRelease?.();
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={className}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
    >
      {label}
    </button>
  );
}

interface HoldControlsProps {
  layout: "asteroids" | "arkanoid";
  onKey: (code: string, pressed: boolean) => void;
}

interface PressControlsProps {
  layout: "snake" | "tetris";
  onKey: (code: string) => void;
}

export type TouchControlsProps = HoldControlsProps | PressControlsProps;

function SnakeDpad({ onKey }: { onKey: (code: string) => void }) {
  return (
    <div className="dpad dpad-4">
      <TouchButton
        label="▲"
        ariaLabel="Arriba"
        className="dpad-up"
        onPress={() => onKey("ArrowUp")}
      />
      <TouchButton
        label="◄"
        ariaLabel="Izquierda"
        className="dpad-left"
        onPress={() => onKey("ArrowLeft")}
      />
      <TouchButton
        label="►"
        ariaLabel="Derecha"
        className="dpad-right"
        onPress={() => onKey("ArrowRight")}
      />
      <TouchButton
        label="▼"
        ariaLabel="Abajo"
        className="dpad-down"
        onPress={() => onKey("ArrowDown")}
      />
    </div>
  );
}

function TetrisControls({ onKey }: { onKey: (code: string) => void }) {
  return (
    <>
      <div className="dpad dpad-3">
        <TouchButton
          label="◄"
          ariaLabel="Izquierda"
          className="dpad-left"
          onPress={() => onKey("ArrowLeft")}
          repeat
        />
        <TouchButton
          label="▼"
          ariaLabel="Bajar"
          className="dpad-down"
          onPress={() => onKey("ArrowDown")}
          repeat
        />
        <TouchButton
          label="►"
          ariaLabel="Derecha"
          className="dpad-right"
          onPress={() => onKey("ArrowRight")}
          repeat
        />
      </div>
      <div className="touch-controls-actions">
        <TouchButton
          label="⟳"
          ariaLabel="Rotar"
          className="action-btn"
          onPress={() => onKey("ArrowUp")}
        />
        <TouchButton
          label="⇓"
          ariaLabel="Caída rápida"
          className="action-btn"
          onPress={() => onKey("Space")}
        />
      </div>
    </>
  );
}

function AsteroidsControls({
  onKey,
}: {
  onKey: (code: string, pressed: boolean) => void;
}) {
  return (
    <>
      <div className="dpad dpad-3">
        <TouchButton
          label="◄"
          ariaLabel="Rotar a la izquierda"
          className="dpad-left"
          onPress={() => onKey("ArrowLeft", true)}
          onRelease={() => onKey("ArrowLeft", false)}
        />
        <TouchButton
          label="▲"
          ariaLabel="Empuje"
          className="dpad-up"
          onPress={() => onKey("ArrowUp", true)}
          onRelease={() => onKey("ArrowUp", false)}
        />
        <TouchButton
          label="►"
          ariaLabel="Rotar a la derecha"
          className="dpad-right"
          onPress={() => onKey("ArrowRight", true)}
          onRelease={() => onKey("ArrowRight", false)}
        />
      </div>
      <div className="touch-controls-actions">
        <TouchButton
          label="●"
          ariaLabel="Disparar"
          className="action-btn action-btn-fire"
          // El motor trata "Space" como pulsación discreta por frame
          // (this.pressed() consume un flag justPressed en el flanco
          // false→true), así que para "mantener presionado y disparar" hay
          // que forzar un flanco nuevo en cada tick del repeat: false y
          // luego true, no solo true.
          onPress={() => {
            onKey("Space", false);
            onKey("Space", true);
          }}
          onRelease={() => onKey("Space", false)}
          repeat
        />
      </div>
    </>
  );
}

function ArkanoidControls({
  onKey,
}: {
  onKey: (code: string, pressed: boolean) => void;
}) {
  return (
    <div className="dpad dpad-2">
      <TouchButton
        label="◄"
        ariaLabel="Mover paleta a la izquierda"
        className="dpad-left"
        onPress={() => onKey("ArrowLeft", true)}
        onRelease={() => onKey("ArrowLeft", false)}
      />
      <TouchButton
        label="►"
        ariaLabel="Mover paleta a la derecha"
        className="dpad-right"
        onPress={() => onKey("ArrowRight", true)}
        onRelease={() => onKey("ArrowRight", false)}
      />
    </div>
  );
}

export default function TouchControls(props: TouchControlsProps) {
  return (
    <div className="touch-controls" data-layout={props.layout}>
      {props.layout === "snake" && <SnakeDpad onKey={props.onKey} />}
      {props.layout === "tetris" && <TetrisControls onKey={props.onKey} />}
      {props.layout === "asteroids" && (
        <AsteroidsControls onKey={props.onKey} />
      )}
      {props.layout === "arkanoid" && <ArkanoidControls onKey={props.onKey} />}
    </div>
  );
}
