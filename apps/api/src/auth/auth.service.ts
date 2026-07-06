import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { signToken } from './jwt.util';

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Pre-bcrypt accounts stored unsalted sha256 hex; recognize them to upgrade on signin.
const SHA256_HEX_RE = /^[a-f0-9]{64}$/;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private envelope(user: { id: string; email: string; name: string | null }) {
    return {
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        name: user.name,
        token: signToken({ sub: user.id, email: user.email }),
      },
      timestamp: new Date().toISOString(),
    };
  }

  async signup(data: { email: string; password: string; name?: string }) {
    const email = data.email?.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      throw new BadRequestException({ error: 'invalid_email', message: 'A valid email is required.' });
    }
    if (!data.password || data.password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException({
        error: 'weak_password',
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      });
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({ error: 'user_exists', message: 'An account with this email already exists.' });
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name: data.name?.trim() || null,
        passwordHash: await bcrypt.hash(data.password, BCRYPT_ROUNDS),
      },
    });
    return this.envelope(user);
  }

  async signin(data: { email: string; password: string }) {
    const invalid = new UnauthorizedException({
      error: 'invalid_credentials',
      message: 'Invalid email or password.',
    });

    const email = data.email?.trim().toLowerCase();
    if (!email || !data.password) throw invalid;

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) throw invalid;

    if (SHA256_HEX_RE.test(user.passwordHash)) {
      const legacy = createHash('sha256').update(data.password).digest('hex');
      if (legacy !== user.passwordHash) throw invalid;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(data.password, BCRYPT_ROUNDS) },
      });
    } else if (!(await bcrypt.compare(data.password, user.passwordHash))) {
      throw invalid;
    }

    return this.envelope(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException({ error: 'unauthorized', message: 'Account no longer exists.' });
    }
    return {
      success: true,
      data: { userId: user.id, email: user.email, name: user.name },
      timestamp: new Date().toISOString(),
    };
  }
}
