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

  private envelope(user: {
    id: string;
    email: string;
    name: string | null;
    role: 'user' | 'admin';
    theme: 'light' | 'dark' | 'system';
    aiProviderMode: 'cotailor' | 'own_keys';
  }) {
    return {
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: 'active' as const,
        theme: user.theme,
        aiProviderMode: user.aiProviderMode,
        token: signToken({ sub: user.id, email: user.email, role: user.role }),
      },
      timestamp: new Date().toISOString(),
    };
  }

  // First-admin bootstrap: emails listed in ADMIN_EMAILS (comma-separated) are
  // promoted to admin AND activated at signup/signin — a bootstrap admin can
  // never be stuck waiting for approval. Promotion only; demotion is an
  // explicit admin action, never a side effect of editing the env var.
  private isBootstrapAdmin(email: string): boolean {
    return (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .includes(email);
  }

  // pending and suspended are DISTINCT rejections: pending means "not yet
  // approved", suspended means "an admin turned this account off".
  private assertUsable(user: { status: 'pending' | 'active' | 'suspended' }) {
    if (user.status === 'pending') {
      throw new UnauthorizedException({
        error: 'account_pending',
        message: 'Your account is awaiting admin approval. You will be able to sign in once it is verified.',
      });
    }
    if (user.status === 'suspended') {
      throw new UnauthorizedException({
        error: 'account_suspended',
        message: 'This account has been suspended. Contact an administrator.',
      });
    }
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

    const bootstrap = this.isBootstrapAdmin(email);
    const user = await this.prisma.user.create({
      data: {
        email,
        name: data.name?.trim() || null,
        passwordHash: await bcrypt.hash(data.password, BCRYPT_ROUNDS),
        role: bootstrap ? 'admin' : 'user',
        // New accounts wait for admin approval; bootstrap admins skip the queue.
        status: bootstrap ? 'active' : 'pending',
        verifiedAt: bootstrap ? new Date() : null,
      },
    });

    if (!bootstrap) {
      // No token: the account exists but cannot be used until approved.
      return {
        success: true,
        data: {
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: 'pending' as const,
          message: 'Account created. An administrator needs to approve it before you can sign in.',
        },
        timestamp: new Date().toISOString(),
      };
    }
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

    // Bootstrap admins are promoted and activated before the status check, so
    // a pending ADMIN_EMAILS account is never locked out of its own platform.
    let role = user.role;
    let status = user.status;
    if (this.isBootstrapAdmin(email) && (role !== 'admin' || status !== 'active')) {
      role = 'admin';
      status = 'active';
      await this.prisma.user.update({
        where: { id: user.id },
        data: { role, status, verifiedAt: user.verifiedAt ?? new Date(), disabledAt: null },
      });
    }

    // Only after the password is verified — account status is not for guessers.
    this.assertUsable({ status });

    return this.envelope({ ...user, role });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException({ error: 'unauthorized', message: 'Account no longer exists.' });
    }
    // Status changed mid-session: the next me() poll signs the client out.
    this.assertUsable(user);
    return {
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        theme: user.theme,
        aiProviderMode: user.aiProviderMode,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // Self-service password change (distinct from the signin upgrade path): the
  // current password must be verified, and legacy sha256 hashes are accepted so
  // a never-signed-in-since-migration user can still rotate their password.
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!currentPassword) {
      throw new BadRequestException({ error: 'missing_password', message: 'Your current password is required.' });
    }
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException({
        error: 'weak_password',
        message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      });
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException({
        error: 'same_password',
        message: 'New password must be different from your current password.',
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException({ error: 'unauthorized', message: 'Account no longer exists.' });
    }

    const currentOk = SHA256_HEX_RE.test(user.passwordHash)
      ? createHash('sha256').update(currentPassword).digest('hex') === user.passwordHash
      : await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentOk) {
      throw new BadRequestException({ error: 'invalid_password', message: 'Your current password is incorrect.' });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
    });
    return { success: true, data: { changed: true }, timestamp: new Date().toISOString() };
  }

  // User-editable account settings: display name, theme, AI-provider mode.
  // Only fields present in the patch are touched. own_keys is rejected until
  // per-user key storage exists — the UI already disables it, this is the guard.
  async updateSettings(
    userId: string,
    patch: { name?: string; theme?: 'light' | 'dark' | 'system'; aiProviderMode?: 'cotailor' | 'own_keys' },
  ) {
    const data: { name?: string | null; theme?: 'light' | 'dark' | 'system'; aiProviderMode?: 'cotailor' } = {};

    if (patch.name !== undefined) {
      data.name = patch.name.trim() || null;
    }
    if (patch.theme !== undefined) {
      if (!['light', 'dark', 'system'].includes(patch.theme)) {
        throw new BadRequestException({ error: 'invalid_theme', message: 'Unknown theme.' });
      }
      data.theme = patch.theme;
    }
    if (patch.aiProviderMode !== undefined) {
      if (patch.aiProviderMode === 'own_keys') {
        throw new BadRequestException({
          error: 'byo_unavailable',
          message: 'Bringing your own AI keys is not available yet.',
        });
      }
      if (patch.aiProviderMode !== 'cotailor') {
        throw new BadRequestException({ error: 'invalid_provider_mode', message: 'Unknown AI provider mode.' });
      }
      data.aiProviderMode = patch.aiProviderMode;
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.user.update({ where: { id: userId }, data });
    }
    return this.me(userId);
  }

  // Self-deactivation: soft-off (status: suspended), reversible by an admin.
  // Guarded by the same "never remove the last active admin" rail as the admin
  // panel — otherwise an admin could lock the whole platform out of management.
  async deactivate(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });
    if (!user) {
      throw new UnauthorizedException({ error: 'unauthorized', message: 'Account no longer exists.' });
    }

    if (user.role === 'admin' && user.status === 'active') {
      const otherAdmins = await this.prisma.user.count({
        where: { role: 'admin', status: 'active', id: { not: userId } },
      });
      if (otherAdmins === 0) {
        throw new BadRequestException({
          error: 'last_admin',
          message: 'You are the last active admin. Promote another admin before deactivating your account.',
        });
      }
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { status: 'suspended', disabledAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: { userId, eventType: 'user.self_deactivate', payload: {} },
      }),
    ]);
    return { success: true, data: { deactivated: true }, timestamp: new Date().toISOString() };
  }
}
