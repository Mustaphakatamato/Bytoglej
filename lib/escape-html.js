// Escape user-provided strings before interpolating into HTML (emails m.m.)
// Forhindrer HTML/script-injektion i Resend-emails og andre HTML-kontekster.
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
