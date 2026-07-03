import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  const port = process.env.API_PORT ? Number(process.env.API_PORT) : 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`CoTailor API on http://localhost:${port}  (health: GET /health)`);
}

void bootstrap();
