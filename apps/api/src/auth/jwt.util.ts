import * as jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;
  email: string;
}

const TOKEN_TTL = '7d';

function secret(): string {
  return process.env.JWT_SECRET || 'dev-only-change-me';
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, secret());
  if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
    throw new Error('Malformed token payload');
  }
  return { sub: decoded.sub, email: String(decoded.email ?? '') };
}
