// Helpers de validación compartidos por los flujos de auth (registro, login, reset password).
// Ver specs/13-medidas-seguridad.md.

/**
 * Mínimo 8 caracteres, al menos una minúscula, una mayúscula, un dígito y un símbolo.
 */
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

/**
 * Patrón básico de formato de email: algo@algo.algo
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PasswordRequirement = {
  label: string;
  met: boolean;
};

/**
 * Devuelve el estado (cumplido/no cumplido) de cada requisito de la contraseña,
 * para pintar la lista en vivo mientras el usuario escribe.
 */
export function getPasswordRequirements(
  password: string
): PasswordRequirement[] {
  return [
    { label: "Al menos 8 caracteres", met: password.length >= 8 },
    { label: "Una letra minúscula", met: /[a-z]/.test(password) },
    { label: "Una letra mayúscula", met: /[A-Z]/.test(password) },
    { label: "Un número", met: /\d/.test(password) },
    { label: "Un símbolo", met: /[^\w\s]/.test(password) },
  ];
}
