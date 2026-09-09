export interface SharedAuthUser {
  id: string;
  role: string;
}

export interface SharedPaymentToken {
  tokenId: string;
  expiresAt: number;
}
