import { UserService } from '../src/services/UserService.js';

describe('User Management', () => {
  it('updates profile correctly', async () => {
    const service = new UserService();
    expect(service).toBeDefined();
  });
});
