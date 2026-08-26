"use client";

import { useEffect, useState } from "react";

const MIN_COUNT = 1;
const MAX_COUNT = 1025; // último ID conocido en PokeAPI

function spriteUrl(id: number) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

export default function ContadorPage() {
  const [count, setCount] = useState(MIN_COUNT);
  const [name, setName] = useState<{ id: number; value: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`https://pokeapi.co/api/v2/pokemon/${count}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.name) {
          setName({ id: count, value: data.name });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [count]);

  const displayName = name?.id === count ? name.value : null;

  return (
    <div
      className="fade-in"
      style={{ padding: "48px 24px", textAlign: "center" }}
    >
      <div className="kicker pixel neon-cyan">▸ CONTADOR POKÉMON</div>
      <h1 className="about-title" style={{ marginBottom: 32 }}>
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

        <div className="pixel" style={{ fontSize: 20, minHeight: 28 }}>
          {displayName ? displayName.toUpperCase() : "…"}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button
            className="btn ghost"
            type="button"
            disabled={count <= MIN_COUNT}
            onClick={() => setCount((c) => Math.max(MIN_COUNT, c - 1))}
          >
            − ANTERIOR
          </button>
          <button
            className="btn xl press"
            type="button"
            disabled={count >= MAX_COUNT}
            onClick={() => setCount((c) => Math.min(MAX_COUNT, c + 1))}
          >
            ▶ SIGUIENTE
          </button>
        </div>

        <button
          className="btn ghost"
          type="button"
          onClick={() => setCount(MIN_COUNT)}
        >
          REINICIAR
        </button>
      </div>
    </div>
  );
}
