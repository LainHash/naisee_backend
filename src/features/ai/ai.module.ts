import { Module } from '@nestjs/common';
import { MasterDataModule } from '../master-data/master-data.module.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';

@Module({
  imports: [MasterDataModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
