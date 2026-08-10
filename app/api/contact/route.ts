import { Resend } from "resend";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ContactRequest {
  name: string;
  email: string;
  message: string;
}

function isValidBody(body: Partial<ContactRequest>): body is ContactRequest {
  if (
    typeof body.name !== "string" ||
    typeof body.email !== "string" ||
    typeof body.message !== "string"
  ) {
    return false;
  }

  if (!body.name.trim() || !body.email.trim() || !body.message.trim()) {
    return false;
  }

  return EMAIL_REGEX.test(body.email.trim());
}

export async function POST(request: Request) {
  let body: Partial<ContactRequest>;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Cuerpo de la petición inválido." },
      { status: 400 }
    );
  }

  if (!isValidBody(body)) {
    return Response.json(
      { ok: false, error: "Nombre, correo y mensaje son obligatorios, y el correo debe tener un formato válido." },
      { status: 400 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.error("RESEND_API_KEY no está configurada.");
    return Response.json(
      { ok: false, error: "No se pudo enviar el mensaje. Intenta de nuevo más tarde." },
      { status: 500 }
    );
  }

  const to = process.env.CONTACT_TO_EMAIL || "jamesorozcoh@gmail.com";
  const { name, email, message } = body;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to,
      replyTo: email.trim(),
      subject: "Nuevo mensaje de contacto – Arcade Vault",
      text: `Nombre: ${name.trim()}\nCorreo: ${email.trim()}\n\nMensaje:\n${message.trim()}`,
    });

    if (error) {
      console.error("Error al enviar correo con Resend:", error);
      return Response.json(
        { ok: false, error: "No se pudo enviar el mensaje. Intenta de nuevo." },
        { status: 502 }
      );
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Error inesperado al enviar correo:", err);
    return Response.json(
      { ok: false, error: "No se pudo enviar el mensaje. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
