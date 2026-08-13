"use client";

// Monta y desmonta ArkanoidEngine (lib/games/arkanoid/engine.ts) siguiendo
// el ciclo de vida de React. Mismo patrón que AsteroidsCanvas/TetrisCanvas
// (ver specs/08-juego-arkanoid.md).

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  ArkanoidEngine,
  type ArkanoidState,
} from "@/lib/games/arkanoid/engine";

export interface ArkanoidCanvasHandle {
  restart: () => void;
}

interface ArkanoidCanvasProps {
  paused: boolean;
  onStateChange: (state: ArkanoidState) => void;
}

const ArkanoidCanvas = forwardRef<ArkanoidCanvasHandle, ArkanoidCanvasProps>(
  function ArkanoidCanvas({ paused, onStateChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<ArkanoidEngine | null>(null);

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

      const engine = new ArkanoidEngine(canvas, {
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
        className="arkanoid-canvas"
      />
    );
  }
);

export default ArkanoidCanvas;
