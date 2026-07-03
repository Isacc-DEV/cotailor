import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { LlmModule } from './llm/llm.module';
import { CoreModule } from './core/core.module';
import { AnalysisModule } from './analysis/analysis.module';
import { SessionsModule } from './sessions/sessions.module';
import { ProfilesModule } from './profiles/profiles.module';
import { AuthModule } from './auth/auth.module';
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
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
