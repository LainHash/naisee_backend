import { Controller, Get, Optional } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { AppService } from './app.service.js';
import { Public } from './common/decorators/public.decorator.js';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Optional() private readonly dataSource?: DataSource,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Root welcome message' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Service & PostgreSQL connectivity healthcheck' })
  async getHealth(): Promise<{ status: string; database: string }> {
    if (!this.dataSource?.isInitialized) {
      return { status: 'ok', database: 'not_initialized' };
    }

    await this.dataSource.query('SELECT 1');
    return { status: 'ok', database: 'connected' };
  }
}
