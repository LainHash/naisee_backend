import { Priority } from '../../common/enums/domain.enums.js';
import { MasterDataService } from './master-data.service.js';

describe('MasterDataService', () => {
  it('maps active categories with defaultDepartment summary', async () => {
    const categoryRepo = {
      find: vi.fn().mockResolvedValue([
        {
          publicId: 'cat-uuid-1',
          code: 'ROAD_SURFACE',
          name: 'Mặt đường / Ổ gà',
          defaultPriority: Priority.HIGH,
          slaHours: 72,
          icon: 'construction',
          defaultDepartment: {
            publicId: 'dept-uuid-1',
            code: 'ROAD_MAINTENANCE',
            name: 'Đội duy tu đường bộ',
          },
        },
      ]),
    };
    const departmentRepo = { find: vi.fn() };
    const service = new MasterDataService(
      categoryRepo as never,
      departmentRepo as never,
    );

    const result = await service.getCategories();

    expect(result).toEqual([
      {
        publicId: 'cat-uuid-1',
        code: 'ROAD_SURFACE',
        name: 'Mặt đường / Ổ gà',
        defaultPriority: Priority.HIGH,
        slaHours: 72,
        icon: 'construction',
        defaultDepartment: {
          publicId: 'dept-uuid-1',
          code: 'ROAD_MAINTENANCE',
          name: 'Đội duy tu đường bộ',
        },
      },
    ]);
  });
});

