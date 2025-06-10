import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  // Additional e2e tests for face-recognition module
  it('/face-recognition (GET)', () => {
    return request(app.getHttpServer())
      .get('/face-recognition')
      .expect(200);
  });

  // Additional e2e tests for whatsapp module
  it('/whatsapp (GET)', () => {
    return request(app.getHttpServer())
      .get('/whatsapp')
      .expect(200);
  });
});
