export type UserRole = 'ADMIN' | 'MEMBER' | 'GUEST';

export interface UserProfile {
  bio: string;
  avatarUrl?: string;
  phoneNumber?: string;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  profile?: UserProfile;
  createdAt: Date;
}
