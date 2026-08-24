"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { userToSession, type SessionUser } from "@/lib/session";
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
  // Arranca en null a propósito: en el render de servidor no hay sesión de
  // Supabase disponible todavía, y este es el mismo valor que verá el
  // cliente en su primer render, así que servidor y cliente siempre
  // coinciden (sin mismatch de hidratación posible). La sesión real se
  // sincroniza justo después de montar, vía getUser() + onAuthStateChange.
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(userToSession(data.user));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(userToSession(session?.user ?? null));
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = (nextUser: SessionUser) => {
    // Actualización optimista: el flujo real de autenticación
    // (signUp/signInWithPassword/signInWithOAuth) vive en app/login/page.tsx
    // y ya dispara onAuthStateChange, que es quien deja `user` en su valor
    // definitivo. Esta función se conserva para no romper la firma que
    // consume la UI de login.
    setUser(nextUser);
  };

  const logout = () => {
    const supabase = createClient();
    supabase.auth.signOut();
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
