import { Priority } from '../../../common/enums/domain.enums.js';
import { IssuePriorityService } from './issue-priority.service.js';

describe('IssuePriorityService', () => {
  const service = new IssuePriorityService();

  it('keeps defaultPriority when no escalation rules match', () => {
    const result = service.evaluate({
      defaultPriority: Priority.MEDIUM,
      categoryName: 'Rác thải',
      reportCount: 1,
      title: 'Rác tồn đọng góc phố',
    });

    expect(result.suggestedPriority).toBe(Priority.MEDIUM);
    expect(result.priorityReason).toContain('Rác thải');
  });

  it('upgrades to HIGH when reportCount >= 5', () => {
    const result = service.evaluate({
      defaultPriority: Priority.LOW,
      categoryName: 'Vấn đề khác',
      reportCount: 5,
      title: 'Vấn đề khu dân cư',
    });

    expect(result.suggestedPriority).toBe(Priority.HIGH);
    expect(result.priorityReason).toContain('5 lượt ghi nhận');
  });

  it('upgrades to CRITICAL when dangerous keywords or >=10 reports appear', () => {
    const byKeyword = service.evaluate({
      defaultPriority: Priority.MEDIUM,
      categoryName: 'Đèn đường',
      reportCount: 1,
      title: 'Dây điện hở điện trước cổng trường học',
    });
    expect(byKeyword.suggestedPriority).toBe(Priority.CRITICAL);

    const byCount = service.evaluate({
      defaultPriority: Priority.MEDIUM,
      categoryName: 'Rác thải',
      reportCount: 10,
      title: 'Bãi rác lớn',
    });
    expect(byCount.suggestedPriority).toBe(Priority.CRITICAL);
  });
});

