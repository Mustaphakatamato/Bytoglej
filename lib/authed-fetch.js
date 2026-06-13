// Cookies are sent automatically with same-origin fetch requests.
// The middleware keeps the session cookie fresh on every request,
// so plain fetch is sufficient — no manual Authorization header needed.
export async function authedFetch(url, opts = {}) {
  return fetch(url, { credentials: 'same-origin', ...opts });
}
