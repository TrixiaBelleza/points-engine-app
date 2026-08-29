/** Philippine mobile → E.164 (+63 9xxxxxxxxx). */

export function normalizePhMobile(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  let rest: string | null = null;
  if (digits.startsWith("63") && digits.length === 12) {
    rest = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length === 11) {
    rest = digits.slice(1);
  } else if (digits.length === 10 && digits.startsWith("9")) {
    rest = digits;
  } else if (hasPlus && digits.startsWith("63") && digits.length === 12) {
    rest = digits.slice(2);
  }
  if (!rest || rest.length !== 10 || !rest.startsWith("9")) return null;
  return `+63${rest}`;
}

export function formatPhMobile(e164: string): string {
  const m = e164.match(/^\+63(\d{3})(\d{3})(\d{4})$/);
  if (!m) return e164;
  return `+63 ${m[1]} ${m[2]} ${m[3]}`;
}

export function validateName(input: string): string {
  const name = input.trim();
  if (name.length < 2 || name.length > 80) {
    throw new Error("Full name must be 2–80 characters.");
  }
  return name;
}
