import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.guard';

type UserStatus = 'pending' | 'active' | 'suspended';

export interface UserListQuery {
  search?: string;
  role?: 'user' | 'admin';
  status?: UserStatus;
  page?: number;
  pageSize?: number;
}

export interface UserPatch {
  role?: 'user' | 'admin';
  // Admins move accounts between active and suspended; approving a pending
  // account is status: 'active'. Nothing ever goes back to pending.
  status?: 'active' | 'suspended';
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: UserListQuery) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const where = {
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { name: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          _count: { select: { profiles: true, sessions: true } },
        },
      }),
    ]);

    // Last activity = newest session update per user on this page (one grouped query).
    const activity = await this.prisma.tailoringSession.groupBy({
      by: ['userId'],
      where: { userId: { in: users.map((u) => u.id) } },
      _max: { updatedAt: true },
    });
    const lastActivity = new Map(activity.map((a) => [a.userId, a._max.updatedAt]));

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        profileCount: u._count.profiles,
        sessionCount: u._count.sessions,
        lastActivityAt: lastActivity.get(u.id) ?? null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        verifiedAt: true,
        disabledAt: true,
        createdAt: true,
        profiles: {
          where: { deletedAt: null },
          select: { id: true, name: true, category: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    if (!user) throw new NotFoundException({ error: 'not_found', message: 'User not found.' });

    const [sessionsByState, recentEvents] = await Promise.all([
      this.prisma.tailoringSession.groupBy({
        by: ['state'],
        where: { userId: id },
        _count: { _all: true },
      }),
      this.prisma.auditLog.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, eventType: true, payload: true, createdAt: true },
      }),
    ]);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      verifiedAt: user.verifiedAt,
      suspendedAt: user.disabledAt,
      createdAt: user.createdAt,
      profiles: user.profiles,
      sessionsByState: Object.fromEntries(sessionsByState.map((s) => [s.state, s._count._all])),
      recentEvents,
    };
  }

  async update(actor: AuthUser, id: string, patch: UserPatch) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, status: true, verifiedAt: true },
    });
    if (!target) throw new NotFoundException({ error: 'not_found', message: 'User not found.' });

    const wantsDemotion = patch.role === 'user' && target.role === 'admin';
    const wantsSuspension = patch.status === 'suspended' && target.status !== 'suspended';

    // Rail 1: admins cannot lock themselves out — demote/suspend yourself is a
    // request another admin has to make.
    if (id === actor.userId && (wantsDemotion || wantsSuspension)) {
      throw new BadRequestException({
        error: 'self_modification',
        message: 'You cannot suspend or demote your own account.',
      });
    }

    // Rail 2: the platform must always keep at least one active admin.
    if ((wantsDemotion || wantsSuspension) && target.role === 'admin' && target.status === 'active') {
      const otherAdmins = await this.prisma.user.count({
        where: { role: 'admin', status: 'active', id: { not: id } },
      });
      if (otherAdmins === 0) {
        throw new BadRequestException({
          error: 'last_admin',
          message: 'Cannot remove the last active admin.',
        });
      }
    }

    const data: {
      role?: 'user' | 'admin';
      status?: UserStatus;
      verifiedAt?: Date;
      disabledAt?: Date | null;
    } = {};
    const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];

    if (patch.role && patch.role !== target.role) {
      data.role = patch.role;
      events.push({
        eventType: 'admin.user.role_change',
        payload: { from: target.role, to: patch.role },
      });
    }

    if (patch.status && patch.status !== target.status) {
      data.status = patch.status;
      if (patch.status === 'active') {
        data.disabledAt = null;
        if (target.status === 'pending') {
          // Approval: the admin verified this account.
          data.verifiedAt = new Date();
          events.push({ eventType: 'admin.user.verify', payload: {} });
        } else {
          events.push({ eventType: 'admin.user.reactivate', payload: {} });
        }
      } else {
        data.disabledAt = new Date();
        events.push({
          eventType: 'admin.user.suspend',
          payload: { previousStatus: target.status },
        });
      }
    }

    if (Object.keys(data).length === 0) return this.get(id);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data }),
      // Logged against the TARGET user (their timeline shows what happened to
      // them); the acting admin is in the payload.
      ...events.map((e) =>
        this.prisma.auditLog.create({
          data: {
            userId: id,
            eventType: e.eventType,
            payload: { ...e.payload, actorId: actor.userId, actorEmail: actor.email },
          },
        }),
      ),
    ]);

    return this.get(id);
  }

  async stats() {
    const [byStatus, admins, totalProfiles, sessionsByState, recentEvents] = await Promise.all([
      this.prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.user.count({ where: { role: 'admin' } }),
      this.prisma.profile.count({ where: { deletedAt: null } }),
      this.prisma.tailoringSession.groupBy({ by: ['state'], _count: { _all: true } }),
      this.prisma.auditLog.findMany({
        where: { eventType: { startsWith: 'admin.' } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          eventType: true,
          payload: true,
          createdAt: true,
          user: { select: { email: true } },
        },
      }),
    ]);

    const statusCount = (s: UserStatus) => byStatus.find((b) => b.status === s)?._count._all ?? 0;

    return {
      users: {
        total: byStatus.reduce((sum, b) => sum + b._count._all, 0),
        pending: statusCount('pending'),
        active: statusCount('active'),
        suspended: statusCount('suspended'),
        admins,
      },
      profiles: { total: totalProfiles },
      sessions: {
        total: sessionsByState.reduce((sum, s) => sum + s._count._all, 0),
        byState: Object.fromEntries(sessionsByState.map((s) => [s.state, s._count._all])),
      },
      recentAdminActivity: recentEvents,
    };
  }
}
