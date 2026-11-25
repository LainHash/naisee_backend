import { AdministrativeUnitType } from '../../common/enums/domain.enums.js';
import type { Ward } from './entities/ward.entity.js';
import { WardBoundaryService } from './ward-boundary.service.js';

describe('WardBoundaryService', () => {
  const tranBienWard = {
    id: 1,
    publicId: 'ward-uuid-1',
    code: 'DN-TRAN-BIEN',
    name: 'Phường Trấn Biên',
    unitType: AdministrativeUnitType.WARD,
    provinceName: 'Tỉnh Đồng Nai',
    centerLat: 10.955,
    centerLng: 106.83,
    defaultZoom: 14,
    minLat: 10.94,
    maxLat: 10.97,
    minLng: 106.81,
    maxLng: 106.85,
    boundaryGeoJson: {
      type: 'Polygon',
      coordinates: [
        [
          [106.81, 10.94],
          [106.85, 10.94],
          [106.85, 10.97],
          [106.81, 10.97],
          [106.81, 10.94],
        ],
      ],
    },
    isActive: true,
  } as unknown as Ward;

  const longKhanhWard = {
    id: 2,
    publicId: 'ward-uuid-2',
    code: 'DN-LONG-KHANH',
    name: 'Phường Long Khánh',
    unitType: AdministrativeUnitType.WARD,
    provinceName: 'Tỉnh Đồng Nai',
    centerLat: 10.935,
    centerLng: 107.24,
    defaultZoom: 14,
    minLat: 10.91,
    maxLat: 10.96,
    minLng: 107.21,
    maxLng: 107.27,
    boundaryGeoJson: {
      type: 'Polygon',
      coordinates: [
        [
          [107.21, 10.91],
          [107.27, 10.91],
          [107.27, 10.96],
          [107.21, 10.96],
          [107.21, 10.91],
        ],
      ],
    },
    isActive: true,
  } as unknown as Ward;

  it('resolves coordinates inside a ward polygon and caches queries', async () => {
    const wardRepo = {
      find: vi.fn().mockResolvedValue([tranBienWard, longKhanhWard]),
    };
    const service = new WardBoundaryService(wardRepo as never);

    const first = await service.resolveByCoordinates(10.9512, 106.8245);
    const second = await service.resolveByCoordinates(10.935, 107.24);
    const outside = await service.resolveByCoordinates(21.0285, 105.8542);

    expect(first?.name).toBe('Phường Trấn Biên');
    expect(second?.name).toBe('Phường Long Khánh');
    expect(outside).toBeNull();
    expect(wardRepo.find).toHaveBeenCalledTimes(1);
  });

  it('finds active ward by publicId, code, or normalized name', async () => {
    const wardRepo = {
      find: vi.fn().mockResolvedValue([tranBienWard, longKhanhWard]),
    };
    const service = new WardBoundaryService(wardRepo as never);

    expect(
      (await service.findActiveWard({ wardPublicId: 'ward-uuid-2' }))?.name,
    ).toBe('Phường Long Khánh');
    expect(
      (await service.findActiveWard({ wardName: 'Trấn Biên' }))?.code,
    ).toBe('DN-TRAN-BIEN');
    expect(
      await service.findActiveWard({ wardName: 'Không tồn tại' }),
    ).toBeNull();
  });
});

