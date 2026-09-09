import { User, UserProfile } from '../types/user.js';

export class UserService<T extends User = User> {
  private users: Map<string, T> = new Map();

  async findUserById(id: string): Promise<T | null> {
    return this.users.get(id) || null;
  }

  async updateUserProfile(id: string, profile: UserProfile): Promise<T> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error(`User not found: ${id}`);
    }
    user.profile = profile;
    return user;
  }
}
