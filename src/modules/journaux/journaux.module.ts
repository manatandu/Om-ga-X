import { Module } from '@nestjs/common';
import { JournalService } from './journal.service';
import { AnalyseJournauxService } from './analyse-journaux.service';
import { JournalController } from './journal.controller';
import { ImpressionsJournalController } from './impressions-journal.controller';
import { ImpressionsJournalService } from './impressions-journal.service';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';

@Module({
  imports: [LicenceModule, JwtAuthModule],
  controllers: [JournalController, ImpressionsJournalController],
  providers: [JournalService, AnalyseJournauxService, ImpressionsJournalService],
  exports: [JournalService, AnalyseJournauxService, ImpressionsJournalService],
})
export class JournauxModule {}
