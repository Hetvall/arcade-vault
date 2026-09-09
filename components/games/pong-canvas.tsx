"use client";

// Monta y desmonta PongEngine (lib/games/pong/engine.ts) siguiendo el ciclo
// de vida de React. Mismo patrón que SnakeCanvas/AsteroidsCanvas (ver
// specs/14-juego-pong.md): un único canvas 800x600 (4:3). Recibe la paleta de
// skin y la aplica en caliente vía setPalette sin reiniciar la partida.

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  PongEngine,
  type PongPalette,
  type PongState,
} from "@/lib/games/pong/engine";

export interface PongCanvasHandle {
  restart: () => void;
  setKey: (code: string, pressed: boolean) => void;
}

interface PongCanvasProps {
  paused: boolean;
  palette: PongPalette;
  onStateChange: (state: PongState) => void;
}

const PongCanvas = forwardRef<PongCanvasHandle, PongCanvasProps>(
  function PongCanvas({ paused, palette, onStateChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<PongEngine | null>(null);

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

      const engine = new PongEngine(
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
      setKey: (code, pressed) => {
        engineRef.current?.setKey(code, pressed);
      },
    }));

    return (
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="pong-canvas"
      />
    );
  }
);

export default PongCanvas;
