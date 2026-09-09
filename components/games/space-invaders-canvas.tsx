"use client";

// Monta y desmonta SpaceInvadersEngine (lib/games/space-invaders/engine.ts)
// siguiendo el ciclo de vida de React. Mismo patrón que AsteroidsCanvas/
// ArkanoidCanvas (ver specs/15-juego-space-invaders.md). Sin paleta de skin:
// el sistema de skins queda fuera de alcance de este spec.

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  SpaceInvadersEngine,
  type SpaceInvadersState,
} from "@/lib/games/space-invaders/engine";

export interface SpaceInvadersCanvasHandle {
  restart: () => void;
}

interface SpaceInvadersCanvasProps {
  paused: boolean;
  onStateChange: (state: SpaceInvadersState) => void;
}

const SpaceInvadersCanvas = forwardRef<
  SpaceInvadersCanvasHandle,
  SpaceInvadersCanvasProps
>(function SpaceInvadersCanvas({ paused, onStateChange }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SpaceInvadersEngine | null>(null);

  // Se guarda en un ref para que el efecto de montaje (abajo) no dependa de
  // la identidad de la función y no reinicie el motor en cada render de
  // GamePlayer.
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new SpaceInvadersEngine(canvas, {
      onStateChange: (state) => onStateChangeRef.current(state),
    });
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (paused) engine.pause();
    else engine.resume();
  }, [paused]);

  useImperativeHandle(ref, () => ({
    restart: () => {
      engineRef.current?.restart();
    },
  }));

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      className="space-invaders-canvas"
    />
  );
});

export default SpaceInvadersCanvas;
