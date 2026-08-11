import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.getUser();

    // `AuthSessionMissingError` significa que Supabase respondió
    // correctamente pero no hay sesión (no hay usuario autenticado vía
    // Supabase, esperado mientras la auth siga siendo mock). Eso cuenta
    // como éxito de conectividad, no como fallo.
    if (error && error.name !== "AuthSessionMissingError") {
      console.error("Error al consultar Supabase Auth:", error);
      return Response.json(
        { ok: false, error: "No se pudo contactar a Supabase." },
        { status: 500 }
      );
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Error inesperado al consultar Supabase:", err);
    return Response.json(
      { ok: false, error: "No se pudo contactar a Supabase." },
      { status: 500 }
    );
  }
}
