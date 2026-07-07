import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { LlmModule } from './llm/llm.module';
import { CoreModule } from './core/core.module';
import { AnalysisModule } from './analysis/analysis.module';
import { SessionsModule } from './sessions/sessions.module';
import { ProfilesModule } from './profiles/profiles.module';
import { ProfileImportModule } from './profile-import/profile-import.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { ResumeStylesModule } from './resume-styles/resume-styles.module';
import { JwtAuthGuard } from './auth/auth.guard';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    LlmModule,
    CoreModule,
    AnalysisModule,
    SessionsModule,
    ProfilesModule,
    ProfileImportModule,
    AuthModule,
    AdminModule,
    ResumeStylesModule,
  ],
  controllers: [HealthController],
  // Every route requires a bearer token unless marked @Public().
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
