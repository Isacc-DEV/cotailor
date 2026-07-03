import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Pure-JS pg driver via a Prisma driver adapter — no native query engine
    // (queryCompiler preview), so it runs even where the native engine can't.
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    super({ adapter });
  }

  onModuleInit(): void {
    this.logger.log('PrismaService ready (pg driver adapter; connects lazily on first query).');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
