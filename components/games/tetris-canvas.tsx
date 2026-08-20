"use client";

// Monta y desmonta TetrisEngine (lib/games/tetris/engine.ts) siguiendo el
// ciclo de vida de React. Mismo patrón que AsteroidsCanvas (ver
// specs/07-juego-tetris.md), adaptado a los dos canvases (tablero + preview
// de siguiente pieza) que usa Tetris.

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  TetrisEngine,
  type TetrisPalette,
  type TetrisState,
} from "@/lib/games/tetris/engine";

export interface TetrisCanvasHandle {
  restart: () => void;
  pressKey: (code: string) => void;
}

interface TetrisCanvasProps {
  paused: boolean;
  palette: TetrisPalette;
  onStateChange: (state: TetrisState) => void;
}

const TetrisCanvas = forwardRef<TetrisCanvasHandle, TetrisCanvasProps>(
  function TetrisCanvas({ paused, palette, onStateChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const nextCanvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<TetrisEngine | null>(null);

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
      const nextCanvas = nextCanvasRef.current;
      if (!canvas || !nextCanvas) return;

      const engine = new TetrisEngine(
        canvas,
        nextCanvas,
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

    // Cambio de skin en caliente sin remmontar el motor ni reiniciar la
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
      pressKey: (code) => {
        engineRef.current?.pressKey(code);
      },
    }));

    return (
      <>
        <canvas
          ref={canvasRef}
          width={300}
          height={600}
          className="tetris-canvas"
        />
        <canvas
          ref={nextCanvasRef}
          width={120}
          height={120}
          className="tetris-next-canvas"
        />
      </>
    );
  }
);

export default TetrisCanvas;
