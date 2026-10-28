import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma.module';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { BanquesService } from './banques.service';
import { BanquesController } from './banques.controller';
import { ConditionsBancairesController } from './conditions-bancaires.controller';
import { ConditionsBancairesService } from './conditions-bancaires.service';
import { ChequesController } from './cheques.controller';
import { ChequesService } from './cheques.service';

// LicenceModule et JwtAuthModule · le contrôleur pose leurs gardes (CLAUDE.md § 5).
@Module({
  imports: [PrismaModule, LicenceModule, JwtAuthModule],
  // Ligne microfina-m2, idée 9 · le registre des chèques émis.
  controllers: [BanquesController, ConditionsBancairesController, ChequesController],
  providers: [BanquesService, ConditionsBancairesService, ChequesService],
})
export class BanquesModule {}
