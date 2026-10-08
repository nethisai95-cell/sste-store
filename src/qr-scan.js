const uuidPattern = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const shortCodePattern = /^[\da-f]{8}$/i;
const scanPaths = new Set(['/admin', '/delivery']);

// Accepts a scanned deep link, a bare unit ID, or the 8-character code printed on a label.
export function parseQrPayload(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text || text.length > 2048) return null;
  if (uuidPattern.test(text)) return { type: 'unit', id: text.toLowerCase() };
  if (shortCodePattern.test(text)) return { type: 'short', id: text.toLowerCase() };

  let url;
  try {
    url = new URL(text, 'http://placeholder.invalid');
  } catch {
    return null;
  }
  if (!scanPaths.has(url.pathname)) return null;
  for (const type of ['unit', 'product', 'order']) {
    const id = url.searchParams.get(type);
    if (id && uuidPattern.test(id)) return { type, id: id.toLowerCase() };
  }
  return null;
}

export function unitShortCode(unitId) {
  return String(unitId).slice(0, 8).toUpperCase();
}
