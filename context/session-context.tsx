"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import {
  addStoredScore,
  getStoredScores,
  getStoredUser,
  setStoredUser,
  type SavedScore,
  type SessionUser,
} from "@/lib/session";

interface SessionContextValue {
  user: SessionUser | null;
  scores: SavedScore[];
  login: (user: SessionUser) => void;
  logout: () => void;
  playAsGuest: () => void;
  saveScore: (entry: Omit<SavedScore, "at">) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  // Lazy initializer: lee localStorage directamente en vez de sincronizar
  // vía useEffect (patrón recomendado por Next.js para estado dependiente
  // de localStorage — ver "Preventing flash before hydration" en los docs).
  // En el render de servidor `window` no existe, así que el valor inicial
  // es siempre null/[]; los nodos de UI que dependen de `user`/`scores`
  // deben marcarse con `suppressHydrationWarning` para aceptar el valor
  // real que trae el cliente en el primer render.
  const [user, setUser] = useState<SessionUser | null>(() => getStoredUser());
  const [scores, setScores] = useState<SavedScore[]>(() => getStoredScores());

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

  const saveScore = (entry: Omit<SavedScore, "at">) => {
    addStoredScore(entry);
    setScores(getStoredScores());
  };

  return (
    <SessionContext.Provider
      value={{ user, scores, login, logout, playAsGuest, saveScore }}
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
