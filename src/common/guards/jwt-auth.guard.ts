import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type {
  AuthenticatedUser,
  JwtPayload,
} from '../interfaces/authenticated-user.interface.js';

export const DEV_FALLBACK_JWT_SECRET = 'naisee-dev-jwt-secret-change-in-prod';

export function resolveJwtSecret(configService: ConfigService): string {
  const secret = configService.get<string>('JWT_SECRET');
  if (secret) return secret;

  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  if (nodeEnv === 'production') {
    throw new Error('JWT_SECRET must be configured in production');
  }
  return DEV_FALLBACK_JWT_SECRET;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing Bearer access token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: resolveJwtSecret(this.configService),
      });

      request.user = {
        id: payload.sub,
        publicId: payload.publicId,
        role: payload.role,
        fullName: payload.fullName,
        phone: payload.phone,
        ward: payload.ward,
        departmentId: payload.departmentId ?? null,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private extractBearerToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) return undefined;
    const [scheme, token] = authHeader.split(' ');
    return scheme === 'Bearer' && token ? token : undefined;
  }
}

