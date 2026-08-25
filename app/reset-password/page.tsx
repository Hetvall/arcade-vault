"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PASSWORD_REGEX, getPasswordRequirements } from "@/lib/validation";

type Status = "checking" | "ready" | "no-session" | "saving" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [status, setStatus] = useState<Status>("checking");
  const [pass, setPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // El enlace de recuperación deja la sesión activa vía
    // app/auth/callback/route.ts antes de llegar aquí. Si no hay sesión, el
    // enlace expiró o ya se usó.
    supabase.auth.getUser().then(({ data }) => {
      setStatus(data.user ? "ready" : "no-session");
    });
  }, []);

  const passwordRequirements = getPasswordRequirements(pass);
  const isPasswordValid = PASSWORD_REGEX.test(pass);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid) {
      setError("La contraseña no cumple los requisitos.");
      return;
    }
    if (pass !== confirmPass) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setStatus("saving");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: pass,
    });

    if (updateError) {
      setStatus("ready");
      setError("No se pudo actualizar la contraseña. Intenta de nuevo.");
      return;
    }

    setStatus("done");
    setTimeout(() => router.push("/games"), 1500);
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
            RESTABLECER CONTRASEÑA
          </div>
        </div>

        {status === "checking" && (
          <div
            className="mono"
            style={{
              textAlign: "center",
              fontSize: 12,
              color: "var(--ink-dim)",
            }}
          >
            VERIFICANDO ENLACE…
          </div>
        )}

        {status === "no-session" && (
          <div className="field" style={{ textAlign: "center", gap: 12 }}>
            <div
              className="mono"
              style={{ fontSize: 12, color: "var(--ink-dim)" }}
            >
              Este enlace de recuperación ya expiró o no es válido. Solicita uno
              nuevo desde el login.
            </div>
            <button
              className="btn ghost"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() => router.push("/login")}
            >
              VOLVER AL LOGIN
            </button>
          </div>
        )}

        {status === "done" && (
          <div className="field" style={{ textAlign: "center", gap: 12 }}>
            <div
              className="mono"
              style={{ fontSize: 13, color: "var(--cyan)" }}
            >
              ▸ CONTRASEÑA ACTUALIZADA
            </div>
            <div
              className="mono"
              style={{ fontSize: 12, color: "var(--ink-dim)" }}
            >
              Entrando al vault…
            </div>
          </div>
        )}

        {(status === "ready" || status === "saving") && (
          <form onSubmit={submit}>
            <div className="field">
              <label>Nueva contraseña</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

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

            <div className="field">
              <label>Confirmar contraseña</label>
              <input
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              className="btn lg"
              type="submit"
              style={{ width: "100%", marginTop: 8 }}
              disabled={status === "saving" || !isPasswordValid}
            >
              {status === "saving" ? "GUARDANDO…" : "GUARDAR CONTRASEÑA"}
            </button>

            {error && <div className="toast-error">▸ {error}</div>}
          </form>
        )}
      </div>
    </div>
  );
}
