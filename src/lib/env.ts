/**
 * Reads an optional environment variable that has a working default.
 *
 * `process.env.X ?? fallback` is wrong for these: `??` only catches
 * `undefined`, so a variable that is present but blank — exactly what copying
 * `.env.example` into a hosting dashboard produces — wins over the default and
 * propagates as an empty string.
 *
 * Blank means unset here. Values are trimmed so a stray space in a dashboard
 * field cannot break a URL or a header name.
 */
export function envOr(name: string, fallback: string): string {
  const value = process.env[name];
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed === '' ? fallback : trimmed;
}
