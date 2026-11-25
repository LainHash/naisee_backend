import { Injectable } from '@nestjs/common';
import { Priority } from '../../../common/enums/domain.enums.js';

export interface PriorityEvaluationInput {
  defaultPriority: Priority;
  categoryName: string;
  reportCount: number;
  title?: string;
  description?: string | null;
}

export interface PriorityEvaluationResult {
  suggestedPriority: Priority;
  priorityReason: string;
}

const PRIORITY_RANK: Record<Priority, number> = {
  [Priority.LOW]: 1,
  [Priority.MEDIUM]: 2,
  [Priority.HIGH]: 3,
  [Priority.CRITICAL]: 4,
};

const CRITICAL_KEYWORDS = [
  'nguy hiểm',
  'tai nạn',
  'điện giật',
  'hở điện',
  'sập',
  'sụt lún',
  'ngập sâu',
  'chập điện',
  'trường học',
  'trẻ em',
];

const HIGH_KEYWORDS = [
  'ổ gà',
  'tối om',
  'mất điện',
  'ngập',
  'tắc cống',
  'mùi hôi',
];

@Injectable()
export class IssuePriorityService {
  /**
   * Computes rule-based priority suggestion and human-readable explanation.
   */
  evaluate(input: PriorityEvaluationInput): PriorityEvaluationResult {
    let best = input.defaultPriority;
    const reasons: string[] = [];

    if (input.reportCount >= 10) {
      best = this.maxPriority(best, Priority.CRITICAL);
      reasons.push(`Có ${input.reportCount} lượt ghi nhận từ cộng đồng`);
    } else if (input.reportCount >= 5) {
      best = this.maxPriority(best, Priority.HIGH);
      reasons.push(`Có ${input.reportCount} lượt ghi nhận tại cùng khu vực`);
    }

    const text = `${input.title ?? ''} ${input.description ?? ''}`.toLowerCase();
    const matchedCritical = CRITICAL_KEYWORDS.find((kw) => text.includes(kw));
    if (matchedCritical) {
      best = this.maxPriority(best, Priority.CRITICAL);
      reasons.push(`Phát hiện dấu hiệu nguy cơ cao ("${matchedCritical}")`);
    } else {
      const matchedHigh = HIGH_KEYWORDS.find((kw) => text.includes(kw));
      if (matchedHigh) {
        best = this.maxPriority(best, Priority.HIGH);
        reasons.push(`Ảnh hưởng trực tiếp sinh hoạt/lưu thông ("${matchedHigh}")`);
      }
    }

    if (reasons.length === 0) {
      reasons.push(`Mức ưu tiên mặc định theo nhóm ${input.categoryName}`);
    }

    return {
      suggestedPriority: best,
      priorityReason: reasons.join('; '),
    };
  }

  private maxPriority(a: Priority, b: Priority): Priority {
    return PRIORITY_RANK[a] >= PRIORITY_RANK[b] ? a : b;
  }
}

