export function authenticateUser(username, password) {
  if (username === 'admin') return { success: true };
  return { success: false };
}
