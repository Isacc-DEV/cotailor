import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  async signup(data: { email: string; password: string; name: string }) {
    try {
      const existing = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existing) {
        return {
          success: false,
          error: { message: 'User already exists', code: 'USER_EXISTS' },
          timestamp: new Date().toISOString(),
        };
      }

      const passwordHash = crypto
        .createHash('sha256')
        .update(data.password)
        .digest('hex');

      const user = await this.prisma.user.create({
        data: {
          id: this.generateId(),
          email: data.email,
          passwordHash,
        },
      });

      const token = this.generateToken();

      return {
        success: true,
        data: {
          userId: user.id,
          email: user.email,
          token,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      return {
        success: false,
        error: { message, code: 'SIGNUP_ERROR' },
        timestamp: new Date().toISOString(),
      };
    }
  }

  async signin(data: { email: string; password: string }) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (!user) {
        return {
          success: false,
          error: { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' },
          timestamp: new Date().toISOString(),
        };
      }

      const passwordHash = crypto
        .createHash('sha256')
        .update(data.password)
        .digest('hex');

      if (user.passwordHash !== passwordHash) {
        return {
          success: false,
          error: { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' },
          timestamp: new Date().toISOString(),
        };
      }

      const token = this.generateToken();

      return {
        success: true,
        data: {
          userId: user.id,
          email: user.email,
          token,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Signin failed';
      return {
        success: false,
        error: { message, code: 'SIGNIN_ERROR' },
        timestamp: new Date().toISOString(),
      };
    }
  }
}
