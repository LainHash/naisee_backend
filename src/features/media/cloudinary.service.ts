import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import type { MediaStage } from '../../common/enums/domain.enums.js';
import { resolveCloudinaryConfig } from '../../core/config/cloudinary.config.js';

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Streams an image buffer directly to Cloudinary and returns its secure HTTPS URL.
   * Database entities only persist the returned URL.
   */
  async uploadImage(buffer: Buffer, stage: MediaStage): Promise<string> {
    const cfg = resolveCloudinaryConfig(this.configService);
    if (!cfg.isConfigured) {
      throw new ServiceUnavailableException(
        'Cloudinary chưa được cấu hình. Hãy thiết lập CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (hoặc CLOUDINARY_URL) trong .env',
      );
    }

    cloudinary.config({
      cloud_name: cfg.cloudName,
      api_key: cfg.apiKey,
      api_secret: cfg.apiSecret,
      secure: true,
    });

    const folder = `${cfg.folder}/${stage.toLowerCase()}`;

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
        },
        (error, uploadResult) => {
          if (error) {
            reject(
              new InternalServerErrorException(
                `Upload Cloudinary thất bại: ${error.message}`,
              ),
            );
            return;
          }
          if (!uploadResult?.secure_url) {
            reject(
              new InternalServerErrorException(
                'Cloudinary không trả về secure_url',
              ),
            );
            return;
          }
          resolve(uploadResult);
        },
      );

      stream.end(buffer);
    });

    return result.secure_url;
  }
}

