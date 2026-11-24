import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CoreModule } from './core/core.module.js';
import { AiModule } from './features/ai/ai.module.js';
import { AuthModule } from './features/auth/auth.module.js';
import { DashboardModule } from './features/dashboard/dashboard.module.js';
import { FeedbackModule } from './features/feedback/feedback.module.js';
import { IssuesModule } from './features/issues/issues.module.js';
import { MasterDataModule } from './features/master-data/master-data.module.js';
import { MediaModule } from './features/media/media.module.js';
import { VerificationsModule } from './features/verifications/verifications.module.js';

@Module({
  imports: [
    CoreModule,
    AuthModule,
    MasterDataModule,
    MediaModule,
    AiModule,
    IssuesModule,
    VerificationsModule,
    FeedbackModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
