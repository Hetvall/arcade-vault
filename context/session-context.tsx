"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getStoredUser, setStoredUser, type SessionUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import { insertScore } from "@/lib/supabase/games";

interface SessionContextValue {
  user: SessionUser | null;
  login: (user: SessionUser) => void;
  logout: () => void;
  playAsGuest: () => void;
  saveScore: (entry: {
    game: string;
    name: string;
    score: number;
  }) => Promise<{ ok: boolean }>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  // Arranca en null a propósito: en el render de servidor `window` no
  // existe, y este es el mismo valor que verá el cliente en su primer
  // render, así que servidor y cliente siempre coinciden (sin mismatch de
  // hidratación posible). La sesión real de localStorage se sincroniza
  // justo después de montar.
  //
  // Probamos antes un lazy initializer (leer localStorage directamente en
  // el useState) siguiendo la guía de Next.js sobre "flash before
  // hydration", pero para un valor compuesto que cambia la cantidad/forma
  // de nodos renderizados (no solo un texto simple), provocó mismatches
  // reales de hidratación que `suppressHydrationWarning` no cubre. El
  // patrón useEffect+setState de abajo es el uso legítimo que la propia
  // documentación de React reconoce para sincronizar con una API de
  // navegador no disponible durante el render en servidor.
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(getStoredUser());
  }, []);

  const login = (nextUser: SessionUser) => {
    setStoredUser(nextUser);
    setUser(nextUser);
  };

  const logout = () => {
    setStoredUser(null);
    setUser(null);
  };

  const playAsGuest = () => {
    // Invitado: no crea ninguna sesión real, solo deja explícito que se
    // continúa sin autenticarse.
  };

  const saveScore = async (entry: {
    game: string;
    name: string;
    score: number;
  }) => {
    const { error } = await insertScore(createClient(), entry);
    return { ok: !error };
  };

  return (
    <SessionContext.Provider
      value={{ user, login, logout, playAsGuest, saveScore }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession debe usarse dentro de un SessionProvider");
  }
  return ctx;
}
