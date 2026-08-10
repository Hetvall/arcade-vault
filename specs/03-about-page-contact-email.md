# 03 — About Page y Envío de Correo de Contacto

- **Estado:** Approved
- **Depende de:** SPEC 02
- **Fecha:** 2026-08-10
- **Objetivo:** Portar la pantalla "Acerca de" (`references/templates/home-about/about.jsx`) a `app/about/page.tsx` con su formulario de contacto funcional, enviando el mensaje por correo real a través de Resend.

## Alcance

### Dentro de alcance

- Nueva ruta `/about` (`app/about/page.tsx`), Client Component, portada de `references/templates/home-about/about.jsx`:
  - Hero "ACERCA DE": kicker, título, misión, fila de 3 highlights (`HighlightIcon` con iconos pixel SVG inline: HEART, BROWSER, PLANT).
  - Divisor animado (`.about-divider`) con los 24 píxeles decorativos.
  - Sección de contacto (`.about-contact`): columna de intro (kicker, título, subtítulo, 3 tips) + formulario (nombre, correo, mensaje).
  - Animaciones de aparición al hacer scroll (`useEffect` + `IntersectionObserver`, clase `.reveal`/`.in`), igual patrón que el resto del sitio (Home ya lo usa).
  - Copy en español, igual que el template.
- Formulario de contacto funcional:
  - Validación de campos vacíos (nombre, correo, mensaje) → si falta alguno, animación `shake` como en el template, sin llamar al servidor.
  - Validación de formato de correo con una regex simple (`algo@algo.algo`) tanto en cliente como en el endpoint del servidor; correo con formato inválido dispara el mismo estado de error visual que un campo vacío (`shake`), sin llamar al servidor.
  - Al enviar: estado "enviando" (botón deshabilitado, texto `ENVIANDO…`) mientras se espera la respuesta del endpoint.
  - Éxito: se muestra el bloque `.terminal-success` del template (líneas de log + mensaje con el nombre en mayúsculas) y botón "ENVIAR OTRO MENSAJE" que resetea el formulario.
  - Error (fallo de red o error del endpoint): se muestra una variante en rojo del bloque terminal, con una línea de error explícita (p.ej. `[ERROR] No se pudo enviar el mensaje. Intenta de nuevo.`) y un botón para volver al formulario **sin perder** lo que el usuario había escrito (nombre/correo/mensaje se conservan).
- Endpoint `app/api/contact/route.ts` (Route Handler, `POST`):
  - Recibe `{ name, email, message }`, valida en servidor (campos no vacíos + formato de correo), responde `400` con detalle si la validación falla.
  - Envía el correo con el SDK de Resend (`resend` npm package):
    - `from`: `onboarding@resend.dev`.
    - `to`: `jamesorozcoh@gmail.com` (vía variable de entorno `CONTACT_TO_EMAIL`, con ese valor como default documentado).
    - `reply_to`: el correo ingresado en el formulario, para poder responder directo.
    - Asunto fijo: `Nuevo mensaje de contacto – Arcade Vault`.
    - Cuerpo (texto plano o HTML simple) con nombre, correo y mensaje del remitente.
  - Responde `200` en éxito, `502`/`500` con mensaje genérico si Resend falla; no expone la API key ni detalles internos del error al cliente.
  - La API key de Resend se lee de `process.env.RESEND_API_KEY`, nunca hardcodeada.
- Dependencia nueva: agregar `resend` a `package.json`.
- Variables de entorno:
  - `RESEND_API_KEY` — clave de Resend, sin valor por defecto (el endpoint responde error controlado si falta).
  - `CONTACT_TO_EMAIL` — destinatario del formulario, default `jamesorozcoh@gmail.com`.
  - Se crea `.env.local.example` documentando ambas variables (sin valores reales de la API key); `.env*` ya está en `.gitignore`, por lo que `.env.local` con la key real nunca se commitea.
- Actualizar `components/nav.tsx`: agregar enlace "Acerca de" → `/about` en el nav de escritorio y en el panel móvil, con su propio estado activo (`pathname === "/about"`).
- Portar a `app/globals.css` las clases CSS necesarias desde `references/templates/home-about/styles.css`: `.about*`, `.highlight*`, `.hl-*`, `.contact-*`, `.field`, `.terminal-success`, `.term-*`, `.line`, `.caret`, `.shake` y demás clases/animaciones referenciadas por esta pantalla (incluye la variante de error del terminal, que no existe en el template y se define como parte de este spec, reutilizando la estética `.term-*` con acento rojo).
- Responsive (mobile y desktop), igual que el resto del sitio.

### Fuera de alcance

- Persistencia de los mensajes de contacto en base de datos o `localStorage` — el mensaje solo se envía por correo, no se guarda en ningún lado.
- Rate limiting, CAPTCHA o cualquier otra protección anti-spam/abuso en el endpoint.
- Plantillas HTML de correo con diseño (branding, imágenes) — el cuerpo del correo es texto/HTML simple, no una plantilla visual elaborada.
- Verificación de dominio propio en Resend — se usa el remitente de pruebas `onboarding@resend.dev`.
- Cualquier cambio a las demás rutas (`/`, `/games`, `/game/[id]`, `/login`, `/leaderboard`) más allá de agregar el enlace "Acerca de" en `components/nav.tsx`.
- Notificaciones adicionales (confirmación por correo al usuario que llenó el formulario) — solo se notifica al destinatario fijo (`CONTACT_TO_EMAIL`).

## Modelo de datos

No se introduce persistencia. Estructura de la petición al endpoint:

```ts
// app/api/contact/route.ts
interface ContactRequest {
  name: string;
  email: string;
  message: string;
}
```

No hay tipos de respuesta más allá de un `{ ok: true }` en éxito o `{ ok: false, error: string }` en fallo, usados solo para pintar el estado en el formulario (no se persisten en ningún store).

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app/` en lo referente a Route Handlers (`route.ts`, métodos `POST`, `Request`/`Response`) antes de crear `app/api/contact/route.ts` — confirmar las convenciones de Next 16.
2. Instalar la dependencia `resend` (`npm install resend`) y agregarla a `package.json`.
3. Crear `.env.local.example` con `RESEND_API_KEY=` y `CONTACT_TO_EMAIL=jamesorozcoh@gmail.com`; documentar en un comentario que `RESEND_API_KEY` debe configurarse localmente en `.env.local` (no se commitea).
4. Portar las clases CSS de la pantalla About (`.about*`, `.highlight*`, `.hl-*`, `.contact-*`, `.field`, `.terminal-success`, `.term-*`, `.line`, `.caret`, `.shake`) desde `references/templates/home-about/styles.css` a `app/globals.css`, apoyándose en `/frontend-design`; agregar la variante visual de error del terminal (mismo patrón `.term-*` con acento rojo) ya que no existe en el template original.
5. Crear `app/api/contact/route.ts`: validar body (`name`/`email`/`message` no vacíos + regex de email), llamar a Resend con `from: "onboarding@resend.dev"`, `to: process.env.CONTACT_TO_EMAIL`, `reply_to: email`, asunto y cuerpo fijos; devolver `200`/`400`/`500` según corresponda.
6. Crear `app/about/page.tsx` como Client Component: portar el hero, highlights, divisor y sección de contacto de `about.jsx`; reusar/portar el hook de reveal-on-scroll ya usado en Home.
7. Implementar el formulario de contacto: estado `idle | sending | success | error`, validación de campos vacíos + formato de email antes de enviar (`shake` si falla), `fetch("/api/contact", { method: "POST", ... })` al enviar, y los tres estados visuales (formulario, éxito `.terminal-success`, error con variante roja y datos conservados).
8. Actualizar `components/nav.tsx`: agregar el enlace "Acerca de" (`/about`) en el nav de escritorio y en el panel móvil, con su propio `isActive`.
9. Pasada de responsive (mobile ≤480px, desktop ≥1280px) de la pantalla About.
10. Pasada final de consistencia visual contra `references/templates/home-about/about.jsx` usando `/frontend-design`.
11. Prueba manual end-to-end: configurar `RESEND_API_KEY` real en `.env.local`, enviar un mensaje de prueba desde `/about` y confirmar que llega a `jamesorozcoh@gmail.com` con `reply-to` correcto.
12. Ejecutar `npm run lint` y corregir lo que reporte.

## Criterios de aceptación

- [ ] `/about` renderiza el hero "ACERCA DE" (kicker, título, misión, 3 highlights), el divisor animado y la sección de contacto, visualmente igual a `references/templates/home-about/about.jsx`.
- [ ] El Nav (desktop y menú móvil) muestra "Acerca de" → `/about`, con estado activo correcto en esa ruta.
- [ ] Enviar el formulario con algún campo vacío dispara la animación `shake` y no hace ninguna petición de red.
- [ ] Enviar el formulario con un correo mal formado (sin `@` o sin dominio) dispara la misma animación `shake` y no hace ninguna petición de red.
- [ ] Enviar el formulario con datos válidos muestra el estado "enviando" (botón deshabilitado, texto `ENVIANDO…`) y luego el bloque `.terminal-success` con el nombre en mayúsculas.
- [ ] "ENVIAR OTRO MENSAJE" resetea el formulario a sus campos vacíos.
- [ ] Con `RESEND_API_KEY` configurada, un envío válido llega como correo real a `jamesorozcoh@gmail.com` (o al valor de `CONTACT_TO_EMAIL`), con asunto `Nuevo mensaje de contacto – Arcade Vault`, cuerpo con nombre/correo/mensaje, y `reply-to` igual al correo ingresado.
- [ ] Si el envío falla (API caída, key inválida, error de red), se muestra el estado de error en el formulario (variante roja del terminal) sin perder los datos ya escritos, y existe una forma de volver a intentar.
- [ ] `RESEND_API_KEY` y la API key de Resend nunca se exponen al cliente (no aparecen en el HTML/JS enviado al navegador ni en la respuesta del endpoint).
- [ ] `.env.local.example` existe con `RESEND_API_KEY` y `CONTACT_TO_EMAIL` documentados; ningún archivo `.env*` con valores reales queda commiteado.
- [ ] El layout de `/about` es responsive: verificado en un viewport móvil (≤480px) y uno de escritorio (≥1280px).
- [ ] `npm run lint` pasa sin errores.

## Decisiones tomadas y descartadas

- **El envío de correo vive en un Route Handler (`app/api/contact/route.ts`)**, no en una Server Action, para mantener un endpoint HTTP explícito y separar claramente cliente/servidor — decisión explícita del usuario.
- **Remitente `onboarding@resend.dev`** en vez de un dominio propio verificado — no hay dominio verificado en Resend todavía; queda documentado como algo a revisar si el proyecto adquiere un dominio propio.
- **Destinatario fijo `jamesorozcoh@gmail.com`**, configurable vía `CONTACT_TO_EMAIL` con ese valor como default — no hay un buzón de equipo separado en este momento.
- **Sin persistencia de los mensajes** (ni base de datos ni `localStorage`) — el formulario es un canal de contacto directo por correo, no un sistema de tickets; consistente con que el resto del proyecto solo persiste sesión/puntuaciones, no mensajería.
- **Sin rate limiting ni CAPTCHA** en este spec — se acepta el riesgo de spam a bajo volumen por ahora; se puede añadir en un spec futuro si se vuelve un problema real.
- **Se agrega validación real de formato de email** (regex simple, cliente + servidor), más estricta que el template original (que solo valida campos no vacíos) — evita envíos con correos claramente inválidos y falsos `reply-to`.
- **Se agrega un estado de error visual** (variante roja del `.terminal-success`) que no existe en el template original — el prototipo estático no contempla fallos de red porque no enviaba correos de verdad; es necesario ahora que el envío es real.
- **El enlace "Acerca de" se agrega al Nav en este spec**, cerrando el pendiente que el spec 02 dejó explícitamente fuera de su alcance.

## Riesgos identificados

- Si `RESEND_API_KEY` no está configurada (por ejemplo en un entorno de despliegue donde se olvidó setearla), el endpoint debe fallar de forma controlada (`500` con mensaje genérico) en vez de romper el build o exponer un stack trace — mitigación: chequeo explícito de la variable al inicio del handler.
- El remitente de pruebas `onboarding@resend.dev` puede tener límites de envío o ser filtrado como spam por algunos proveedores de correo — mitigación: si esto ocurre en la prueba manual del paso 11, documentarlo y evaluar verificar un dominio propio en un spec futuro.
- Next.js 16 puede tener convenciones distintas para Route Handlers respecto a versiones anteriores — mitigación: leer `node_modules/next/dist/docs/01-app/` antes de escribir `app/api/contact/route.ts`, como indica `AGENTS.md`.
