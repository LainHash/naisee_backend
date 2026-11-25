import { AdministrativeUnitType, Priority } from '../../common/enums/domain.enums.js';
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
    const wardRepo = { find: vi.fn() };
    const wardBoundaryService = { resolveByCoordinates: vi.fn() };
    const service = new MasterDataService(
      categoryRepo as never,
      departmentRepo as never,
      wardRepo as never,
      wardBoundaryService as never,
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

  it('lists active wards and omits boundaryGeoJson unless requested', async () => {
    const wardEntity = {
      publicId: 'ward-uuid-1',
      code: 'DN-TRAN-BIEN',
      name: 'Phường Trấn Biên',
      unitType: AdministrativeUnitType.WARD,
      provinceName: 'Tỉnh Đồng Nai',
      centerLat: 10.9574,
      centerLng: 106.8427,
      defaultZoom: 14,
      minLat: 10.935,
      maxLat: 10.975,
      minLng: 106.805,
      maxLng: 106.865,
      boundaryGeoJson: { type: 'Polygon', coordinates: [] },
      isActive: true,
    };
    const wardRepo = { find: vi.fn().mockResolvedValue([wardEntity]) };
    const wardBoundaryService = { resolveByCoordinates: vi.fn() };
    const service = new MasterDataService(
      { find: vi.fn() } as never,
      { find: vi.fn() } as never,
      wardRepo as never,
      wardBoundaryService as never,
    );

    const withoutBoundary = await service.getWards({});
    expect(withoutBoundary).toEqual([
      {
        publicId: 'ward-uuid-1',
        code: 'DN-TRAN-BIEN',
        name: 'Phường Trấn Biên',
        unitType: AdministrativeUnitType.WARD,
        provinceName: 'Tỉnh Đồng Nai',
        centerLat: 10.9574,
        centerLng: 106.8427,
        defaultZoom: 14,
        bbox: [106.805, 10.935, 106.865, 10.975],
        isActive: true,
      },
    ]);

    const withBoundary = await service.getWards({ includeBoundary: true });
    expect(withBoundary[0].boundaryGeoJson).toEqual({
      type: 'Polygon',
      coordinates: [],
    });
  });

  it('resolves ward by coordinates via WardBoundaryService', async () => {
    const wardBoundaryService = {
      resolveByCoordinates: vi
        .fn()
        .mockResolvedValueOnce({
          publicId: 'ward-uuid-1',
          code: 'DN-TRAN-BIEN',
          name: 'Phường Trấn Biên',
          unitType: AdministrativeUnitType.WARD,
          provinceName: 'Tỉnh Đồng Nai',
          centerLat: 10.9574,
          centerLng: 106.8427,
          defaultZoom: 14,
          minLat: 10.935,
          maxLat: 10.975,
          minLng: 106.805,
          maxLng: 106.865,
          isActive: true,
        })
        .mockResolvedValueOnce(null),
    };
    const service = new MasterDataService(
      { find: vi.fn() } as never,
      { find: vi.fn() } as never,
      { find: vi.fn() } as never,
      wardBoundaryService as never,
    );

    const inside = await service.resolveWard(10.9512, 106.8245);
    expect(inside.inServiceArea).toBe(true);
    expect(inside.ward?.name).toBe('Phường Trấn Biên');

    const outside = await service.resolveWard(0, 0);
    expect(outside).toEqual({ inServiceArea: false, ward: null });
  });
});
