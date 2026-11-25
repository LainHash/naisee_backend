import type { ConfigService } from '@nestjs/config';
import { Priority } from '../../common/enums/domain.enums.js';
import type { IssueCategory } from '../master-data/entities/issue-category.entity.js';
import { AiService } from './ai.service.js';

describe('AiService', () => {
  const categories = [
    {
      id: 1,
      publicId: 'cat-road',
      code: 'ROAD_SURFACE',
      name: 'Mặt đường / Ổ gà',
      defaultPriority: Priority.HIGH,
      slaHours: 72,
    },
    {
      id: 2,
      publicId: 'cat-light',
      code: 'STREET_LIGHT',
      name: 'Đèn đường',
      defaultPriority: Priority.MEDIUM,
      slaHours: 24,
    },
    {
      id: 3,
      publicId: 'cat-waste',
      code: 'WASTE',
      name: 'Rác thải',
      defaultPriority: Priority.MEDIUM,
      slaHours: 48,
    },
    {
      id: 4,
      publicId: 'cat-flood',
      code: 'FLOODING',
      name: 'Ngập nước',
      defaultPriority: Priority.HIGH,
      slaHours: 12,
    },
  ] as IssueCategory[];

  function createService(env: Record<string, string | undefined> = {}) {
    const categoryRepo = {
      find: vi.fn().mockResolvedValue(categories),
    };
    const configService = {
      get: vi.fn((key: string) => env[key]),
    } as unknown as ConfigService;

    return new AiService(categoryRepo as never, configService);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('classifies flooding image URL using rule fallback with isMocked=true', async () => {
    const service = createService();

    const res = await service.classifyImage({
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/ngap-nuoc.jpg',
    });

    expect(res).toMatchObject({
      categoryPublicId: 'cat-flood',
      categoryCode: 'FLOODING',
      suggestedPriority: Priority.HIGH,
      isMocked: true,
    });
  });

  it('uses hint when URL does not contain category keywords', async () => {
    const service = createService();

    const res = await service.classifyImage({
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/img_1024.jpg',
      hint: 'Rác thải chất đống đầu hẻm',
    });

    expect(res.categoryCode).toBe('WASTE');
    expect(res.isMocked).toBe(true);
  });

  it('uses DeepSeek Vision when DEEPSEEK_API_KEY is configured and returns isMocked=false', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  categoryCode: 'STREET_LIGHT',
                  confidence: 0.96,
                  suggestedTitle: 'Trụ đèn số 12 tắt bóng hoàn toàn',
                  suggestedPriority: 'HIGH',
                }),
              },
            },
          ],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const service = createService({ DEEPSEEK_API_KEY: 'test-deepseek-key' });
    const res = await service.classifyImage({
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/img_99.jpg',
    });

    expect(res).toEqual({
      categoryPublicId: 'cat-light',
      categoryCode: 'STREET_LIGHT',
      categoryName: 'Đèn đường',
      confidence: 0.96,
      suggestedTitle: 'Trụ đèn số 12 tắt bóng hoàn toàn',
      suggestedPriority: Priority.HIGH,
      isMocked: false,
    });
  });

  it('falls back cleanly to rule-based result when Vision API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network timeout')),
    );

    const service = createService({ DEEPSEEK_API_KEY: 'test-deepseek-key' });
    const res = await service.classifyImage({
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/pothole.jpg',
    });

    expect(res.categoryCode).toBe('ROAD_SURFACE');
    expect(res.isMocked).toBe(true);
  });
});

