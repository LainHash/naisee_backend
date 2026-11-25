import {
  IssueStatus,
  MediaStage,
  Priority,
  RoleName,
} from '../../../common/enums/domain.enums.js';
import { loadSeedWorkbook } from './seed-excel.helper.js';

describe('seed-excel.helper', () => {
  it('loads roles, departments, categories, users, media presets, and issues from naisee-seed-data.xlsx', async () => {
    const data = await loadSeedWorkbook();

    expect(data.roles).toHaveLength(4);
    expect(data.roles.map((r) => r.name)).toEqual(
      expect.arrayContaining([
        RoleName.CITIZEN,
        RoleName.STAFF,
        RoleName.VOLUNTEER,
        RoleName.ADMIN,
      ]),
    );

    expect(data.departments).toHaveLength(4);
    expect(data.categories).toHaveLength(5);

    expect(data.users.length).toBeGreaterThanOrEqual(6);
    expect(data.users[0]?.phone).toBe('0901000001');
    expect(data.users[1]?.departmentCode).toBe('ROAD_MAINTENANCE');

    expect(data.mediaPresets.length).toBeGreaterThanOrEqual(19);
    expect(
      data.mediaPresets.some((m) => m.stage === MediaStage.VERIFICATION),
    ).toBe(true);
    expect(
      data.mediaPresets.every((m) => m.url.startsWith('https://res.cloudinary.com/')),
    ).toBe(true);

    expect(data.issues.length).toBeGreaterThanOrEqual(200);
    expect(
      new Set(data.issues.map((i) => i.status)),
    ).toEqual(
      new Set([
        IssueStatus.PENDING_REVIEW,
        IssueStatus.RECEIVED,
        IssueStatus.VERIFYING,
        IssueStatus.IN_PROGRESS,
        IssueStatus.RESOLVED,
        IssueStatus.REJECTED,
      ]),
    );
    expect(data.issues[0]).toMatchObject({
      code: 'HT-2026-001',
      categoryCode: 'ROAD_SURFACE',
      ward: 'Phường Trấn Biên',
      status: IssueStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      reportCount: 8,
    });
    expect(
      data.issues.every(
        (i) =>
          Number.isFinite(i.lat) &&
          Number.isFinite(i.lng) &&
          Boolean(i.beforeImageUrl),
      ),
    ).toBe(true);
  });
});

