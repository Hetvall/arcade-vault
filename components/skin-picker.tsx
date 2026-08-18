"use client";

// Selector de skin por juego. Está scoped explícitamente a un `gameId` (lo
// muestra en su etiqueta) para que quede claro sobre qué juego actúa, ya que
// el skin no es global. Persiste la elección por juego en localStorage
// (av_skins, ver lib/skins.ts) y notifica al padre vía onChange.
//
// Se usa en dos puntos: dentro del reproductor (components/game-player.tsx) y
// fuera de él, en la ficha del juego (app/game/[id]/page.tsx), para poder
// fijar el skin sin entrar a jugar.

import { useEffect, useState } from "react";
import {
  getStoredSkin,
  setStoredSkin,
  SKIN_IDS,
  SKIN_LABELS,
  type SkinId,
} from "@/lib/skins";

interface SkinPickerProps {
  gameId: string;
  gameTitle: string;
  // Notifica al reproductor para aplicar el skin en caliente. Opcional: fuera
  // del reproductor (ficha) basta con persistir.
  onChange?: (skin: SkinId) => void;
}

export default function SkinPicker({
  gameId,
  gameTitle,
  onChange,
}: SkinPickerProps) {
  // Arranca en el default para coincidir con el render de servidor; se
  // sincroniza con localStorage tras montar (mismo patrón que la sesión).
  const [skin, setSkin] = useState<SkinId>("classic");

  useEffect(() => {
    const stored = getStoredSkin(gameId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSkin(stored);
    onChange?.(stored);
    // Solo al montar / cambiar de juego.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const select = (next: SkinId) => {
    setSkin(next);
    setStoredSkin(gameId, next);
    onChange?.(next);
  };

  return (
    <div
      className="skin-picker"
      role="group"
      aria-label={`Skin de ${gameTitle}`}
    >
      <span className="skin-picker-label">
        SKIN · <strong>{gameTitle}</strong>
      </span>
      <div className="skin-picker-options">
        {SKIN_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={"skin-chip" + (skin === id ? " active" : "")}
            aria-pressed={skin === id}
            onClick={() => select(id)}
          >
            {SKIN_LABELS[id]}
          </button>
        ))}
      </div>
    </div>
  );
}
