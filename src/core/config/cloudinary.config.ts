import { ConfigService } from '@nestjs/config';

export interface CloudinaryEnvConfig {
  isConfigured: boolean;
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
}

function parseCloudinaryUrl(url: string): {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
} | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'cloudinary:') return null;
    const cloudName = parsed.hostname;
    const apiKey = decodeURIComponent(parsed.username);
    const apiSecret = decodeURIComponent(parsed.password);
    if (!cloudName || !apiKey || !apiSecret) return null;
    return { cloudName, apiKey, apiSecret };
  } catch {
    return null;
  }
}

/**
 * Resolves Cloudinary credentials from CLOUDINARY_URL or separate env vars.
 */
export function resolveCloudinaryConfig(
  configService: ConfigService,
): CloudinaryEnvConfig {
  const cloudinaryUrl = configService.get<string>('CLOUDINARY_URL')?.trim();
  const parsedFromUrl = cloudinaryUrl
    ? parseCloudinaryUrl(cloudinaryUrl)
    : null;

  const cloudName =
    configService.get<string>('CLOUDINARY_CLOUD_NAME')?.trim() ||
    parsedFromUrl?.cloudName ||
    '';
  const apiKey =
    configService.get<string>('CLOUDINARY_API_KEY')?.trim() ||
    parsedFromUrl?.apiKey ||
    '';
  const apiSecret =
    configService.get<string>('CLOUDINARY_API_SECRET')?.trim() ||
    parsedFromUrl?.apiSecret ||
    '';
  const folder =
    configService.get<string>('CLOUDINARY_FOLDER')?.trim() || 'naisee';

  return {
    isConfigured: Boolean(cloudName && apiKey && apiSecret),
    cloudName,
    apiKey,
    apiSecret,
    folder,
  };
}

