"use client";

// Monta y desmonta SnakeEngine (lib/games/snake/engine.ts) siguiendo el
// ciclo de vida de React. Mismo patrón que AsteroidsCanvas/TetrisCanvas (ver
// specs/09-juego-snake.md): un único canvas cuadrado 800x800.

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  SnakeEngine,
  type SnakePalette,
  type SnakeState,
} from "@/lib/games/snake/engine";

export interface SnakeCanvasHandle {
  restart: () => void;
  pressKey: (code: string) => void;
}

interface SnakeCanvasProps {
  paused: boolean;
  palette: SnakePalette;
  onStateChange: (state: SnakeState) => void;
}

const SnakeCanvas = forwardRef<SnakeCanvasHandle, SnakeCanvasProps>(
  function SnakeCanvas({ paused, palette, onStateChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<SnakeEngine | null>(null);

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

      const engine = new SnakeEngine(
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

    // Cambio de skin en caliente sin remontar el motor ni reiniciar la partida.
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
      pressKey: (code) => {
        engineRef.current?.pressKey(code);
      },
    }));

    return (
      <canvas
        ref={canvasRef}
        width={800}
        height={800}
        className="snake-canvas"
      />
    );
  }
);

export default SnakeCanvas;
