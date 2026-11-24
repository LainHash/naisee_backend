import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor.js';

/**
 * Configures global API prefix, CORS, response envelope, DTO validation, and OpenAPI docs.
 */
export function setupApp(app: INestApplication): void {
  const configService = app.get(ConfigService);

  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  const corsOrigins = configService
    .get<string>('CORS_ORIGIN', 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const swaggerEnabled =
    configService.get<string>('SWAGGER_ENABLED', 'true') !== 'false';

  app.setGlobalPrefix(apiPrefix);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NaiSee API')
      .setDescription('NaiSee Smart City Incident Reporting & Civic CRM API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs/openapi.json',
    });
  }
}
