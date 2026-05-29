const WEAK_PASSWORDS = new Set(
  [
    "password",
    "password1",
    "password123",
    "12345678",
    "123456789",
    "1234567890",
    "qwerty123",
    "azerty123",
    "letmein1",
    "admin123",
    "bloxking",
    "roblox123",
  ].map((p) => p.toLowerCase()),
);

export function passwordPolicyError(password: string): string | null {
  if (password.length < 10) {
    return "Le mot de passe doit faire au moins 10 caractères.";
  }
  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    return "Ce mot de passe est trop courant. Choisis-en un plus unique.";
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  if (!hasLetter || !hasDigit) {
    return "Utilise au moins une lettre et un chiffre.";
  }
  return null;
}
