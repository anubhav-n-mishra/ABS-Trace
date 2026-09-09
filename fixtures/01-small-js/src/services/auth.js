// Authentication business logic service
export function loginUser(email, password) {
  if (email && password) {
    return { token: 'jwt_token_sample', user: { email } };
  }
  throw new Error('Invalid credentials');
}

export function generateToken(userId) {
  return 'token_' + userId;
}
