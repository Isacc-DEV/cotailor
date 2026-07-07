import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';
import { verifyToken } from './jwt.util';

export interface AuthUser {
  userId: string;
  email: string;
  role: 'user' | 'admin';
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = req.headers.authorization;
    let token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    // EventSource cannot set headers, so SSE clients pass ?token= instead.
    if (!token && typeof req.query?.token === 'string') token = req.query.token;

    if (!token) {
      throw new UnauthorizedException({ error: 'unauthorized', message: 'Missing bearer token' });
    }
    try {
      const payload = verifyToken(token);
      req.user = { userId: payload.sub, email: payload.email, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedException({ error: 'unauthorized', message: 'Invalid or expired token' });
    }
  }
}
