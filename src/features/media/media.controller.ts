import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator.js';
import { MediaStage, RoleName } from '../../common/enums/domain.enums.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { CloudinaryService } from './cloudinary.service.js';
import {
  UploadMediaDto,
  UploadMediaResponseDto,
} from './dto/upload-media.dto.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export interface UploadedImageFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @OptionalAuth()
  @ApiBearerAuth()
  @Post('upload')
  @ApiOperation({
    summary:
      'Upload ảnh lên Cloudinary (DB chỉ lưu URL). Stage BEFORE hỗ trợ trước đăng nhập.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        stage: {
          type: 'string',
          enum: Object.values(MediaStage),
          default: MediaStage.BEFORE,
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
          callback(
            new BadRequestException(
              'Chỉ hỗ trợ định dạng ảnh JPEG, PNG, WEBP hoặc GIF',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: UploadedImageFile | undefined,
    @Body() dto: UploadMediaDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<UploadMediaResponseDto> {
    const stage = dto.stage ?? MediaStage.BEFORE;
    this.assertUploadPermission(stage, user);

    if (!file || !file.buffer?.length) {
      throw new BadRequestException('Vui lòng đính kèm file ảnh hợp lệ');
    }

    const url = await this.cloudinaryService.uploadImage(file.buffer, stage);
    return { url, stage };
  }

  private assertUploadPermission(
    stage: MediaStage,
    user?: AuthenticatedUser,
  ): void {
    if (stage === MediaStage.BEFORE) {
      return;
    }

    if (!user) {
      throw new UnauthorizedException(
        `Stage ${stage} yêu cầu đăng nhập trước khi tải ảnh`,
      );
    }

    if (
      stage === MediaStage.VERIFICATION &&
      user.role !== RoleName.VOLUNTEER &&
      user.role !== RoleName.STAFF &&
      user.role !== RoleName.ADMIN
    ) {
      throw new ForbiddenException(
        'Chỉ Thanh niên tình nguyện hoặc Cán bộ mới được tải ảnh xác minh',
      );
    }

    if (
      stage === MediaStage.AFTER &&
      user.role !== RoleName.STAFF &&
      user.role !== RoleName.ADMIN
    ) {
      throw new ForbiddenException(
        'Chỉ Cán bộ mới được tải ảnh sau xử lý',
      );
    }
  }
}
