const tokenStore = new Map<string, { userId: number; username: string; role: string }>();

export function createToken(userId: number, username: string, role: string): string {
  const token =
    Math.random().toString(36).substring(2) + Date.now().toString(36) + Math.random().toString(36).substring(2);
  tokenStore.set(token, { userId, username, role });
  return token;
}

export function validateToken(token: string): { userId: number; username: string; role: string } | null {
  return tokenStore.get(token) ?? null;
}

export function revokeToken(token: string): void {
  tokenStore.delete(token);
}
