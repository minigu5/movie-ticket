// lib/parseEmails.ts
const EMAIL_REGEX = /[\w.+-]+@[\w.-]+\.[\w.-]+/g;
const SCHOOL_DOMAIN = '@ts.hs.kr';

export function extractSchoolEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) ?? [];
  const unique = Array.from(new Set(matches.map(e => e.toLowerCase())));
  return unique.filter(e => e.endsWith(SCHOOL_DOMAIN));
}
