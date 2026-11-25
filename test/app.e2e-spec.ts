import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { MediaStage, RoleName } from './../src/common/enums/domain.enums.js';
import { CloudinaryService } from './../src/features/media/cloudinary.service.js';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/app.setup.js';

describe('AppController, Auth RBAC & Media Upload (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  const mockUploadImage = vi
    .fn()
    .mockResolvedValue(
      'https://res.cloudinary.com/demo/image/upload/v1/naisee/before/mock.png',
    );

  beforeEach(async () => {
    mockUploadImage.mockClear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CloudinaryService)
      .useValue({ uploadImage: mockUploadImage })
      .compile();

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

  it('enforces RBAC on /auth/staff-check and /departments', async () => {
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

    await request(app.getHttpServer())
      .get('/api/v1/departments')
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

  it('/api/v1/media/upload supports guest BEFORE and enforces auth on AFTER', async () => {
    const guestRes = await request(app.getHttpServer())
      .post('/api/v1/media/upload')
      .field('stage', MediaStage.BEFORE)
      .attach('file', Buffer.from('png-data'), {
        filename: 'pothole.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(guestRes.body).toEqual({
      success: true,
      data: {
        url: 'https://res.cloudinary.com/demo/image/upload/v1/naisee/before/mock.png',
        stage: MediaStage.BEFORE,
      },
    });
    expect(mockUploadImage).toHaveBeenCalledTimes(1);

    await request(app.getHttpServer())
      .post('/api/v1/media/upload')
      .field('stage', MediaStage.AFTER)
      .attach('file', Buffer.from('png-data'), {
        filename: 'after.png',
        contentType: 'image/png',
      })
      .expect(401);
  });

  it('/api/v1/ai/classify-image validates empty imageUrl with 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/ai/classify-image')
      .send({ imageUrl: '' })
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('/api/v1/issues/nearby validates missing lat/lng with 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/issues/nearby')
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('protects /issues/mine (401) and enforces CITIZEN/VOLUNTEER role + DTO validation on POST /issues', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/issues/mine')
      .expect(401);

    const staffToken = await jwtService.signAsync({
      sub: 2,
      publicId: 'uuid-staff',
      role: RoleName.STAFF,
      fullName: 'Chị Lan',
      phone: '0901000002',
      ward: 'Phường Trấn Biên',
      departmentId: 1,
    });

    await request(app.getHttpServer())
      .post('/api/v1/issues')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({})
      .expect(403);

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
      .post('/api/v1/issues')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ title: '' })
      .expect(400);
  });

  it('enforces STAFF RBAC and DTO validation on /staff/issues endpoints', async () => {
    await request(app.getHttpServer()).get('/api/v1/staff/issues').expect(401);

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
      .get('/api/v1/staff/issues')
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

    await request(app.getHttpServer())
      .patch('/api/v1/staff/issues/HT-2026-001/reject')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ rejectionReason: '' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/staff/issues/HT-2026-001/merge')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ sourceIssuePublicIds: [] })
      .expect(400);
  });

  it('/docs/openapi.json (GET)', async () => {
    const res = await request(app.getHttpServer())
      .get('/docs/openapi.json')
      .expect(200);

    expect(res.body.info?.title).toBe('NaiSee API');
    expect(res.body.paths?.['/api/v1/categories']).toBeDefined();
    expect(res.body.paths?.['/api/v1/media/upload']).toBeDefined();
    expect(res.body.paths?.['/api/v1/ai/classify-image']).toBeDefined();
    expect(res.body.paths?.['/api/v1/issues/nearby']).toBeDefined();
    expect(res.body.paths?.['/api/v1/issues/mine']).toBeDefined();
    expect(res.body.paths?.['/api/v1/issues']).toBeDefined();
    expect(res.body.paths?.['/api/v1/issues/{publicId}']).toBeDefined();
    expect(res.body.paths?.['/api/v1/issues/{publicId}/me-too']).toBeDefined();
    expect(res.body.paths?.['/api/v1/staff/issues']).toBeDefined();
    expect(res.body.paths?.['/api/v1/staff/issues/{publicId}/triage']).toBeDefined();
    expect(res.body.paths?.['/api/v1/staff/issues/{publicId}/reject']).toBeDefined();
    expect(res.body.paths?.['/api/v1/staff/issues/{publicId}/assign']).toBeDefined();
    expect(res.body.paths?.['/api/v1/staff/issues/{publicId}/merge']).toBeDefined();
  });

  afterEach(async () => {
    await app.close();
  });
});
