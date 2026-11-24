import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Priority } from '../../common/enums/domain.enums.js';
import { IssueCategory } from '../master-data/entities/issue-category.entity.js';
import type {
  ClassifyImageDto,
  ClassifyImageResultDto,
} from './dto/classify-image.dto.js';

interface RuleMatch {
  code: string;
  keywords: string[];
  suggestedTitle: string;
  suggestedPriority: Priority;
  confidence: number;
}

const CLASSIFICATION_RULES: RuleMatch[] = [
  {
    code: 'FLOODING',
    keywords: ['ngap', 'ngập', 'flood', 'nuoc', 'nước', 'cong', 'cống', 'mua', 'mưa'],
    suggestedTitle: 'Ngập nước cục bộ gây cản trở giao thông',
    suggestedPriority: Priority.HIGH,
    confidence: 0.93,
  },
  {
    code: 'STREET_LIGHT',
    keywords: ['den', 'đèn', 'light', 'streetlight', 'toi', 'tối', 'tru-dien', 'trụ điện'],
    suggestedTitle: 'Đèn đường không sáng vào ban đêm',
    suggestedPriority: Priority.MEDIUM,
    confidence: 0.89,
  },
  {
    code: 'WASTE',
    keywords: ['rac', 'rác', 'waste', 'trash', 'garbage', 'phe-thai', 'phế thải'],
    suggestedTitle: 'Tồn đọng rác thải tự phát cần thu gom',
    suggestedPriority: Priority.MEDIUM,
    confidence: 0.9,
  },
  {
    code: 'ROAD_SURFACE',
    keywords: ['o-ga', 'ổ gà', 'pothole', 'road', 'duong', 'đường', 'sut-lun', 'sụt lún', 'ho-ga'],
    suggestedTitle: 'Ổ gà / hư hỏng mặt đường cần khắc phục',
    suggestedPriority: Priority.HIGH,
    confidence: 0.91,
  },
];

interface VisionJsonPayload {
  categoryCode?: string;
  confidence?: number;
  suggestedTitle?: string;
  suggestedPriority?: Priority;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(IssueCategory)
    private readonly categoryRepo: Repository<IssueCategory>,
    private readonly configService: ConfigService,
  ) {}

  async classifyImage(
    dto: ClassifyImageDto,
  ): Promise<ClassifyImageResultDto> {
    const categories = await this.categoryRepo.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });

    if (categories.length === 0) {
      throw new NotFoundException(
        'Chưa có danh mục sự cố trong hệ thống. Hãy chạy npm run seed trước.',
      );
    }

    const geminiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    if (geminiKey && this.isHttpUrl(dto.imageUrl)) {
      const visionResult = await this.tryClassifyWithGemini(
        geminiKey,
        dto,
        categories,
      );
      if (visionResult) {
        return visionResult;
      }
    }

    return this.classifyByRules(dto, categories);
  }

  private async tryClassifyWithGemini(
    apiKey: string,
    dto: ClassifyImageDto,
    categories: IssueCategory[],
  ): Promise<ClassifyImageResultDto | null> {
    try {
      const imgResponse = await fetch(dto.imageUrl, {
        signal: AbortSignal.timeout(5000),
      });
      if (!imgResponse.ok) {
        return null;
      }

      const contentType =
        imgResponse.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg';
      const buffer = Buffer.from(await imgResponse.arrayBuffer());
      const base64Data = buffer.toString('base64');

      const model =
        this.configService.get<string>('AI_VISION_MODEL')?.trim() ||
        'gemini-2.5-flash';
      const categoryCodes = categories.map((c) => c.code).join(', ');
      const prompt = [
        'Phân tích ảnh sự cố hạ tầng đô thị tại Việt Nam và trả về JSON thuần (không markdown):',
        `{"categoryCode": "<một trong: ${categoryCodes}>", "confidence": <0..1>, "suggestedTitle": "<tiêu đề tiếng Việt ngắn gọn dưới 80 ký tự>", "suggestedPriority": "<LOW|MEDIUM|HIGH|CRITICAL>"}`,
        dto.hint ? `Gợi ý thêm từ người dùng: ${dto.hint}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const apiRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inlineData: { mimeType: contentType, data: base64Data } },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!apiRes.ok) {
        return null;
      }

      const json = (await apiRes.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        return null;
      }

      const parsed = JSON.parse(rawText) as VisionJsonPayload;
      const matchedCategory = categories.find(
        (c) => c.code === parsed.categoryCode,
      );
      if (!matchedCategory) {
        return null;
      }

      const validPriorities = new Set<string>(Object.values(Priority));
      const suggestedPriority =
        parsed.suggestedPriority && validPriorities.has(parsed.suggestedPriority)
          ? parsed.suggestedPriority
          : matchedCategory.defaultPriority;

      const confidence =
        typeof parsed.confidence === 'number' &&
        parsed.confidence >= 0 &&
        parsed.confidence <= 1
          ? Number(parsed.confidence.toFixed(2))
          : 0.85;

      return {
        categoryPublicId: matchedCategory.publicId,
        categoryCode: matchedCategory.code,
        categoryName: matchedCategory.name,
        confidence,
        suggestedTitle:
          parsed.suggestedTitle?.trim() || `${matchedCategory.name} cần xử lý`,
        suggestedPriority,
        isMocked: false,
      };
    } catch (error) {
      this.logger.warn(
        `Gemini Vision fallback sang rule-based: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private classifyByRules(
    dto: ClassifyImageDto,
    categories: IssueCategory[],
  ): ClassifyImageResultDto {
    const haystack = `${dto.imageUrl} ${dto.hint ?? ''}`.toLowerCase();

    for (const rule of CLASSIFICATION_RULES) {
      const category = categories.find((c) => c.code === rule.code);
      if (category && rule.keywords.some((kw) => haystack.includes(kw))) {
        return {
          categoryPublicId: category.publicId,
          categoryCode: category.code,
          categoryName: category.name,
          confidence: rule.confidence,
          suggestedTitle: rule.suggestedTitle,
          suggestedPriority: rule.suggestedPriority,
          isMocked: true,
        };
      }
    }

    const fallback =
      categories.find((c) => c.code === 'ROAD_SURFACE') ?? categories[0];

    return {
      categoryPublicId: fallback.publicId,
      categoryCode: fallback.code,
      categoryName: fallback.name,
      confidence: 0.78,
      suggestedTitle: `${fallback.name} cần kiểm tra hiện trường`,
      suggestedPriority: fallback.defaultPriority,
      isMocked: true,
    };
  }

  private isHttpUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }
}

