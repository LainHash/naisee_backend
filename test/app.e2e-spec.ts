import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { RoleName } from './../src/common/enums/domain.enums.js';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/app.setup.js';

describe('AppController & Auth RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
    jwtService = app.get(JwtService);
  });

  it('/api/v1 (GET)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1')
      .expect(200);

    expect(res.body).toEqual({
      success: true,
      data: 'Hello World!',
    });
  });

  it('/api/v1/health (GET)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(res.body).toEqual({
      success: true,
      data: {
        status: 'ok',
        database: 'not_initialized',
      },
    });
  });

  it('/api/v1/auth/me returns 401 without Bearer token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  it('/api/v1/auth/staff-check returns 403 for CITIZEN and 200 for STAFF', async () => {
    const citizenToken = await jwtService.signAsync({
      sub: 1,
      publicId: 'uuid-citizen',
      role: RoleName.CITIZEN,
      fullName: 'Cô/Chú Minh',
      phone: '0901000001',
      ward: 'Phường Trấn Biên',
      departmentId: null,
    });

    await request(app.getHttpServer())
      .get('/api/v1/auth/staff-check')
      .set('Authorization', `Bearer ${citizenToken}`)
      .expect(403);

    const staffToken = await jwtService.signAsync({
      sub: 2,
      publicId: 'uuid-staff',
      role: RoleName.STAFF,
      fullName: 'Chị Lan',
      phone: '0901000002',
      ward: 'Phường Trấn Biên',
      departmentId: 1,
    });

    const staffRes = await request(app.getHttpServer())
      .get('/api/v1/auth/staff-check')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(staffRes.body).toEqual({
      success: true,
      data: {
        allowed: true,
        role: RoleName.STAFF,
      },
    });
  });

  it('/docs/openapi.json (GET)', async () => {
    const res = await request(app.getHttpServer())
      .get('/docs/openapi.json')
      .expect(200);

    expect(res.body.info?.title).toBe('NaiSee API');
    expect(res.body.paths?.['/api/v1']).toBeDefined();
    expect(res.body.paths?.['/api/v1/auth/demo-switch']).toBeDefined();
  });

  afterEach(async () => {
    await app.close();
  });
});
