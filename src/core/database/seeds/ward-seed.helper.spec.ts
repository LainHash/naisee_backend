import { AdministrativeUnitType } from '../../../common/enums/domain.enums.js';
import { loadWardSeeds, upsertWardsAndBackfill } from './ward-seed.helper.js';

describe('ward-seed.helper', () => {
  it('loads all 23 Dong Nai wards from bundled dong-nai-wards.geojson', () => {
    const loaded = loadWardSeeds({});
    expect(loaded.source).toBe('geojson');
    expect(loaded.records).toHaveLength(23);
    expect(loaded.records[0].unitType).toBe(AdministrativeUnitType.WARD);
  });

  it('upserts wards and backfills missing wardId on users and issues by name or coordinates', async () => {
    const savedWards = [
      {
        id: 1,
        code: 'DN-TRAN-BIEN',
        name: 'Phường Trấn Biên',
        minLat: 10.93,
        maxLat: 10.968,
        minLng: 106.812,
        maxLng: 106.85,
        boundaryGeoJson: {
          type: 'Polygon',
          coordinates: [
            [
              [106.812, 10.93],
              [106.85, 10.93],
              [106.85, 10.968],
              [106.812, 10.968],
              [106.812, 10.93],
            ],
          ],
        },
        isActive: true,
      },
      {
        id: 2,
        code: 'DN-LONG-KHANH',
        name: 'Phường Long Khánh',
        minLat: 10.92,
        maxLat: 10.96,
        minLng: 107.215,
        maxLng: 107.255,
        boundaryGeoJson: {
          type: 'Polygon',
          coordinates: [
            [
              [107.215, 10.92],
              [107.255, 10.92],
              [107.255, 10.96],
              [107.215, 10.96],
              [107.215, 10.92],
            ],
          ],
        },
        isActive: true,
      },
    ];

    const wardRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((data: Record<string, unknown>) => data),
      save: vi.fn(async (data: unknown) => data),
      find: vi.fn().mockResolvedValue(savedWards),
    };
    const userRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([
          { id: 10, ward: 'Phường Trấn Biên', wardId: null },
        ]),
      }),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
    };
    const issueRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([
          {
            id: 20,
            ward: 'Khu vực Long Khánh',
            wardId: null,
            latitude: 10.94,
            longitude: 107.235,
          },
        ]),
      }),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
    };

    const manager = {
      getRepository: vi.fn((entity: { name?: string }) => {
        if (entity.name === 'Ward') return wardRepo;
        if (entity.name === 'User') return userRepo;
        return issueRepo;
      }),
    };

    const result = await upsertWardsAndBackfill(manager as never);

    expect(result.source).toBe('geojson');
    expect(result.backfilledUsers).toBe(1);
    expect(result.backfilledIssues).toBe(1);
    expect(userRepo.update).toHaveBeenCalledWith({ id: 10 }, { wardId: 1 });
    expect(issueRepo.update).toHaveBeenCalledWith(
      { id: 20 },
      { wardId: 2, ward: 'Phường Long Khánh' },
    );
  });
});

