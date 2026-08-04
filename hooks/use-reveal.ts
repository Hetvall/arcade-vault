"use client";

import { useEffect } from "react";

/**
 * Observa los elementos con la clase `.reveal` y les agrega `.in` cuando
 * entran en el viewport, disparando la animación de aparición definida en
 * `app/globals.css` (`.reveal` / `.reveal.in`).
 */
export function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
