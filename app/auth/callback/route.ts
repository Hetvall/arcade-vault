import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deriveAliasFromProfile } from "@/lib/session";

const OAUTH_PROVIDERS = new Set(["google", "github"]);

// Recibe el `code` que Supabase adjunta a los enlaces de confirmación de
// email, OAuth (Google/GitHub) y recuperación de contraseña, lo canjea por
// una sesión real, y redirige al destino final (`?next=`, por defecto
// `/games`). Si algo falla, vuelve a `/login` con el error en la query.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const oauthProvider = searchParams.get("oauth_provider");
  // Solo se acepta una ruta relativa interna — evita open redirects vía `next`.
  const redirectPath = next && next.startsWith("/") ? next : "/games";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Error al canjear el código de auth por sesión:", error);
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  // Login OAuth: fija el alias definitivo en `user_metadata.username` a
  // partir del perfil del proveedor con el que se acaba de autenticar
  // (`app/login/page.tsx` manda `oauth_provider` al iniciar el flujo). Es
  // necesario porque Supabase enlaza automáticamente identidades con el
  // mismo email en una sola cuenta y fusiona su `user_metadata`: sin esto,
  // un campo que solo manda un proveedor (p. ej. `user_name` de GitHub)
  // queda pegado ahí para siempre, aunque el login actual sea con otro
  // proveedor que no lo manda. Al escribir `username` explícitamente en
  // cada login OAuth, el alias mostrado siempre refleja el proveedor recién
  // usado. No aplica a confirmación de email (sin `oauth_provider`), donde
  // `username` ya se fijó a propósito en el registro.
  if (oauthProvider && OAUTH_PROVIDERS.has(oauthProvider) && data.user) {
    const identity = data.user.identities?.find(
      (i) => i.provider === oauthProvider
    );
    const alias = deriveAliasFromProfile(
      identity?.identity_data,
      oauthProvider
    );
    if (alias) {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { username: alias },
      });
      if (updateError) {
        console.error("Error al fijar el alias tras login OAuth:", updateError);
      }
    }
  }

  return NextResponse.redirect(`${origin}${redirectPath}`);
}
