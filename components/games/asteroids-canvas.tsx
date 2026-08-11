"use client";

// Monta y desmonta AsteroidsEngine (lib/games/asteroids/engine.ts) siguiendo
// el ciclo de vida de React. Ver specs/05-juego-asteroides.md.

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  AsteroidsEngine,
  type AsteroidsState,
} from "@/lib/games/asteroids/engine";

export interface AsteroidsCanvasHandle {
  restart: () => void;
}

interface AsteroidsCanvasProps {
  paused: boolean;
  onStateChange: (state: AsteroidsState) => void;
}

const AsteroidsCanvas = forwardRef<AsteroidsCanvasHandle, AsteroidsCanvasProps>(
  function AsteroidsCanvas({ paused, onStateChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<AsteroidsEngine | null>(null);

    // Se guarda en un ref para que el efecto de montaje (abajo) no dependa
    // de la identidad de la función y no reinicie el motor en cada render
    // de GamePlayer.
    const onStateChangeRef = useRef(onStateChange);
    useEffect(() => {
      onStateChangeRef.current = onStateChange;
    }, [onStateChange]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const engine = new AsteroidsEngine(canvas, {
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
        className="asteroids-canvas"
      />
    );
  }
);

export default AsteroidsCanvas;
