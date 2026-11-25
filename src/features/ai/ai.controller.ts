import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { AiService } from './ai.service.js';
import {
  ClassifyImageDto,
  ClassifyImageResultDto,
} from './dto/classify-image.dto.js';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Public()
  @Post('classify-image')
  @ApiOperation({
    summary:
      'Phân tích ảnh sự cố để gợi ý danh mục, tiêu đề và mức độ ưu tiên (có fallback rule-based)',
  })
  classifyImage(
    @Body() dto: ClassifyImageDto,
  ): Promise<ClassifyImageResultDto> {
    return this.aiService.classifyImage(dto);
  }
}

