/**
 * Escape user-controlled text before interpolating into HTML (email
 * templates). Prevents a maliciously chosen name/phone/city from injecting
 * markup into emails sent to other users.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
