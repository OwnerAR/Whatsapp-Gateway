import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: false, // Disable NestJS logger
  });
  app.setGlobalPrefix('api'); // Set a global prefix for all routes
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
