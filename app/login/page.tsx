"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/context/session-context";
import { createClient } from "@/lib/supabase/client";
import {
  EMAIL_REGEX,
  PASSWORD_REGEX,
  getPasswordRequirements,
} from "@/lib/validation";

type Tab = "in" | "up";
type Provider = "google" | "github";

interface Message {
  kind: "error" | "info";
  text: string;
}

/** Traduce errores de Supabase Auth a copy en español, sin filtrar detalles internos. */
function describeAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Credenciales inválidas.";
  if (m.includes("email not confirmed"))
    return "Debes confirmar tu correo antes de iniciar sesión.";
  if (m.includes("already registered") || m.includes("already exists"))
    return "Ese correo ya está registrado.";
  if (m.includes("password") && m.includes("character"))
    return "La contraseña es demasiado corta.";
  if (m.includes("rate limit"))
    return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  return "No se pudo completar la operación. Intenta de nuevo.";
}

export default function LoginPage() {
  const router = useRouter();
  const { login, playAsGuest } = useSession();

  const [tab, setTab] = useState<Tab>("in");
  const [alias, setAlias] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [signupDone, setSignupDone] = useState(false);

  const switchTab = (next: Tab) => {
    setTab(next);
    setMessage(null);
    setSignupDone(false);
  };

  const passwordRequirements = getPasswordRequirements(pass);
  const isSignupValid = PASSWORD_REGEX.test(pass) && EMAIL_REGEX.test(email);
  const isLoginValid = EMAIL_REGEX.test(email) && pass.trim().length > 0;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);

    if (tab === "up") {
      if (!isSignupValid) {
        setMessage({
          kind: "error",
          text: "Revisa el correo y los requisitos de la contraseña antes de continuar.",
        });
        return;
      }

      setLoading(true);
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: { username: (alias || "PLAYER1").toUpperCase().slice(0, 10) },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      setLoading(false);

      if (error) {
        setMessage({ kind: "error", text: describeAuthError(error.message) });
        return;
      }

      setSignupDone(true);
      return;
    }

    if (!isLoginValid) {
      setMessage({
        kind: "error",
        text: "Escribe un correo válido y tu contraseña.",
      });
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    setLoading(false);

    if (error) {
      setMessage({ kind: "error", text: describeAuthError(error.message) });
      return;
    }

    if (data.user) {
      login({
        name:
          data.user.user_metadata?.username ||
          email.split("@")[0].toUpperCase().slice(0, 10),
      });
    }
    router.push("/games");
  };

  const handleOAuth = async (provider: Provider) => {
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?oauth_provider=${provider}`,
      },
    });
    if (error) {
      setMessage({ kind: "error", text: describeAuthError(error.message) });
    }
  };

  const handleForgotPassword = async () => {
    setMessage(null);
    if (!email.trim()) {
      setMessage({
        kind: "error",
        text: "Escribe tu correo para enviarte el enlace de recuperación.",
      });
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);

    if (error) {
      setMessage({ kind: "error", text: describeAuthError(error.message) });
      return;
    }

    setMessage({
      kind: "info",
      text: `Te enviamos un enlace para restablecer tu contraseña a ${email}.`,
    });
  };

  const handleGuest = () => {
    playAsGuest();
    router.push("/games");
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={tab === "in" ? "on" : ""}
            onClick={() => switchTab("in")}
          >
            INICIAR SESIÓN
          </button>
          <button
            className={tab === "up" ? "on" : ""}
            onClick={() => switchTab("up")}
          >
            CREAR CUENTA
          </button>
        </div>

        {signupDone ? (
          <div
            className="field slide-in"
            style={{ textAlign: "center", gap: 12 }}
          >
            <div
              className="mono"
              style={{ fontSize: 13, color: "var(--cyan)" }}
            >
              ▸ REVISA TU CORREO
            </div>
            <div
              className="mono"
              style={{ fontSize: 12, color: "var(--ink-dim)" }}
            >
              Te enviamos un enlace de confirmación a {email}. Ábrelo para
              activar tu cuenta.
            </div>
            <button
              className="btn ghost"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() => {
                setSignupDone(false);
                switchTab("in");
              }}
            >
              VOLVER A INICIAR SESIÓN
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={submit}>
              {tab === "up" && (
                <div className="field slide-in">
                  <label>Alias</label>
                  <input
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="px_kai"
                  />
                </div>
              )}
              <div className="field">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jugador@vault.gg"
                  required
                />
              </div>
              <div className="field">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              {tab === "up" && (
                <ul
                  className="mono"
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "-6px 0 4px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    fontSize: 11,
                    letterSpacing: "0.04em",
                  }}
                >
                  {passwordRequirements.map((req) => (
                    <li
                      key={req.label}
                      style={{
                        color: req.met ? "var(--cyan)" : "var(--ink-faint)",
                      }}
                    >
                      {req.met ? "✓" : "✗"} {req.label}
                    </li>
                  ))}
                </ul>
              )}

              {tab === "in" && (
                <button
                  type="button"
                  className="mono"
                  onClick={handleForgotPassword}
                  style={{
                    background: "none",
                    border: 0,
                    padding: 0,
                    color: "var(--ink-faint)",
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}

              <button
                className="btn lg"
                type="submit"
                style={{ width: "100%", marginTop: 8 }}
                disabled={loading || (tab === "up" && !isSignupValid)}
              >
                {loading
                  ? "PROCESANDO…"
                  : tab === "in"
                    ? "ENTRAR AL VAULT"
                    : "CREAR Y JUGAR"}
              </button>

              {message && (
                <div
                  className="toast-error"
                  style={
                    message.kind === "info"
                      ? {
                          color: "var(--cyan)",
                          textShadow: "0 0 8px var(--cyan)",
                        }
                      : undefined
                  }
                >
                  ▸ {message.text}
                </div>
              )}
            </form>

            <button
              className="btn ghost"
              style={{ width: "100%", marginTop: 10 }}
              onClick={handleGuest}
            >
              JUGAR COMO INVITADO
            </button>

            <div className="auth-divider">O CONTINÚA CON</div>
            <div className="social">
              <button
                className="btn ghost"
                type="button"
                onClick={() => handleOAuth("google")}
              >
                ◆ GOOGLE
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => handleOAuth("github")}
              >
                ▣ GITHUB
              </button>
            </div>
          </>
        )}

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
