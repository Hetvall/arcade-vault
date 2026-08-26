"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/context/session-context";

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useSession();

  const isActive = (
    name: "inicio" | "biblioteca" | "salon" | "pokemon" | "about" | "auth"
  ) => {
    if (name === "inicio") return pathname === "/";
    if (name === "biblioteca")
      return pathname === "/games" || pathname.startsWith("/game/");
    if (name === "salon") return pathname === "/leaderboard";
    if (name === "pokemon") return pathname === "/pokemon";
    if (name === "about") return pathname === "/about";
    return pathname === "/login";
  };

  // Oculta el navbar del sitio en viewports táctiles mientras se juega
  // (spec 10, ampliación de alcance): la clase solo tiene efecto vía CSS
  // @media, así que en desktop (o fuera de /game/[id]/play) no cambia nada.
  const isPlayingGame = /^\/game\/[^/]+\/play(\/|$)/.test(pathname);

  const close = () => setOpen(false);

  const handleSignOut = () => {
    setMenuOpen(false);
    logout();
    router.push("/");
  };

  return (
    <>
      <nav className={"av-nav" + (isPlayingGame ? " av-nav-playing" : "")}>
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={isActive("inicio") ? "active" : ""}>
            Inicio
          </Link>
          <Link
            href="/games"
            className={isActive("biblioteca") ? "active" : ""}
          >
            Biblioteca
          </Link>
          <Link
            href="/leaderboard"
            className={isActive("salon") ? "active" : ""}
          >
            Salón de la Fama
          </Link>
          <Link href="/pokemon" className={isActive("pokemon") ? "active" : ""}>
            Pokemon (Bonus)
          </Link>
          <Link href="/about" className={isActive("about") ? "active" : ""}>
            Acerca de
          </Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <div className="av-user-menu">
            <button
              className="btn ghost auth-btn"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {user.name} ▾
            </button>
            {menuOpen && (
              <>
                <div
                  className="av-user-backdrop"
                  onClick={() => setMenuOpen(false)}
                ></div>
                <div className="av-user-dropdown">
                  <div className="av-user-dropdown-label">{user.name}</div>
                  <button onClick={handleSignOut}>Cerrar sesión</button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            className="btn auth-btn"
            onClick={() => router.push("/login")}
          >
            Iniciar Sesión
          </button>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
      ></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div
          className="pixel neon-cyan"
          style={{ fontSize: 11, marginBottom: 16 }}
        >
          MENÚ
        </div>
        <Link
          href="/"
          className={isActive("inicio") ? "active" : ""}
          onClick={close}
        >
          Inicio
        </Link>
        <Link
          href="/games"
          className={isActive("biblioteca") ? "active" : ""}
          onClick={close}
        >
          Biblioteca
        </Link>
        <Link
          href="/leaderboard"
          className={isActive("salon") ? "active" : ""}
          onClick={close}
        >
          Salón de la Fama
        </Link>
        <Link
          href="/pokemon"
          className={isActive("pokemon") ? "active" : ""}
          onClick={close}
        >
          Pokemon (Bonus)
        </Link>
        <Link
          href="/about"
          className={isActive("about") ? "active" : ""}
          onClick={close}
        >
          Acerca de
        </Link>
        {user ? (
          <>
            <div className="av-mobile-user-label">{user.name}</div>
            <button
              onClick={() => {
                close();
                handleSignOut();
              }}
            >
              Cerrar sesión
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className={isActive("auth") ? "active" : ""}
            onClick={close}
          >
            Iniciar Sesión
          </Link>
        )}
        <div style={{ flex: 1 }}></div>
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: "var(--ink-faint)",
            letterSpacing: "0.16em",
          }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
