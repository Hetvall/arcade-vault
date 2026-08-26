"use client";

import { useEffect, useState } from "react";

const MIN_COUNT = 1;
const MAX_COUNT = 1025; // último ID conocido en PokeAPI

function spriteUrl(id: number) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

function clamp(value: number) {
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, value));
}

export default function PokemonPage() {
  const [count, setCount] = useState(MIN_COUNT);
  const [names, setNames] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (names[count]) return;

    const controller = new AbortController();

    fetch(`https://pokeapi.co/api/v2/pokemon/${count}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.name) setNames((prev) => ({ ...prev, [count]: data.name }));
      })
      .catch(() => {});

    return () => controller.abort();
  }, [count, names]);

  const displayName = names[count] ?? null;

  // Cada Pokémon nuevo vuelve a ocultar el nombre hasta que se revele.
  const goTo = (next: number) => {
    setRevealed(false);
    setCount(clamp(next));
  };

  return (
    <div
      className="fade-in"
      style={{ padding: "48px 24px", textAlign: "center" }}
    >
      <div className="kicker pixel neon-cyan">▸ POKÉMON (BONUS)</div>
      <h1 className="about-title pokemon-title" style={{ marginBottom: 32 }}>
        ¿QUÉ POKÉMON ES?
      </h1>

      <div
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
          padding: "32px 48px",
        }}
      >
        <div className="pixel neon-yellow" style={{ fontSize: 48 }}>
          #{count}
        </div>

        <img
          key={count}
          src={spriteUrl(count)}
          alt={displayName ?? `Pokémon #${count}`}
          width={200}
          height={200}
          style={{ imageRendering: "pixelated" }}
        />

        <div
          className="pixel"
          style={{
            fontSize: 20,
            minHeight: 28,
            filter: revealed ? "none" : "blur(8px)",
            userSelect: revealed ? "auto" : "none",
            transition: "filter 0.2s ease",
          }}
        >
          {displayName ? displayName.toUpperCase() : "…"}
        </div>

        <button
          className="btn ghost"
          type="button"
          onClick={() => setRevealed((r) => !r)}
        >
          {revealed ? "OCULTAR" : "👁 REVELAR"}
        </button>

        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button
            className="btn ghost"
            type="button"
            disabled={count <= MIN_COUNT}
            onClick={() => goTo(count - 1)}
          >
            − ANTERIOR
          </button>
          <button
            className="btn xl press"
            type="button"
            disabled={count >= MAX_COUNT}
            onClick={() => goTo(count + 1)}
          >
            ▶ SIGUIENTE
          </button>
        </div>

        <button
          className="btn ghost"
          type="button"
          onClick={() => goTo(MIN_COUNT)}
        >
          REINICIAR
        </button>
      </div>
    </div>
  );
}
