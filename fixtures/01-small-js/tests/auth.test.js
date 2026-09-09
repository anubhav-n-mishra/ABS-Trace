import { loginUser } from '../src/services/auth.js';

describe('Authentication', () => {
  it('authenticates valid credentials', () => {
    const session = loginUser('user@example.com', 'secret');
    expect(session.token).toBeDefined();
  });
});
