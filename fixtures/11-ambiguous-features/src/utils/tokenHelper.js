// Ambiguous helper: could be auth token or payment token
export function parseTokenHeader(headerValue) {
  if (!headerValue) return null;
  const parts = headerValue.split(' ');
  return parts.length === 2 ? parts[1] : parts[0];
}

export function validateGenericToken(token) {
  return typeof token === 'string' && token.length > 8;
}
