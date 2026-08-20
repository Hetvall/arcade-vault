"use client";

// Monta y desmonta ArkanoidEngine (lib/games/arkanoid/engine.ts) siguiendo
// el ciclo de vida de React. Mismo patrón que AsteroidsCanvas/TetrisCanvas
// (ver specs/08-juego-arkanoid.md).

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  ArkanoidEngine,
  type ArkanoidPalette,
  type ArkanoidState,
} from "@/lib/games/arkanoid/engine";

export interface ArkanoidCanvasHandle {
  restart: () => void;
  setKey: (key: string, pressed: boolean) => void;
}

interface ArkanoidCanvasProps {
  paused: boolean;
  palette: ArkanoidPalette;
  onStateChange: (state: ArkanoidState) => void;
}

const ArkanoidCanvas = forwardRef<ArkanoidCanvasHandle, ArkanoidCanvasProps>(
  function ArkanoidCanvas({ paused, palette, onStateChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<ArkanoidEngine | null>(null);

    // Se guarda en un ref para que el efecto de montaje (abajo) no dependa
    // de la identidad de la función y no reinicie el motor en cada render
    // de GamePlayer.
    const onStateChangeRef = useRef(onStateChange);
    useEffect(() => {
      onStateChangeRef.current = onStateChange;
    }, [onStateChange]);

    // La paleta inicial se pasa por ref para no reiniciar el motor cuando
    // cambia el skin; los cambios se aplican en caliente vía setPalette abajo.
    const paletteRef = useRef(palette);
    useEffect(() => {
      paletteRef.current = palette;
    }, [palette]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const engine = new ArkanoidEngine(
        canvas,
        {
          onStateChange: (state) => onStateChangeRef.current(state),
        },
        paletteRef.current
      );
      engineRef.current = engine;
      engine.start();

      return () => {
        engine.destroy();
        engineRef.current = null;
      };
    }, []);

    // Cambio de skin en caliente sin remontar el motor ni reiniciar la
    // partida.
    useEffect(() => {
      engineRef.current?.setPalette(palette);
    }, [palette]);

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
      setKey: (key, pressed) => {
        engineRef.current?.setKey(key, pressed);
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
