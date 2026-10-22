import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma.module';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { BanquesService } from './banques.service';
import { BanquesController } from './banques.controller';
import { ConditionsBancairesController } from './conditions-bancaires.controller';
import { ConditionsBancairesService } from './conditions-bancaires.service';

// LicenceModule et JwtAuthModule · le contrôleur pose leurs gardes (CLAUDE.md § 5).
@Module({
  imports: [PrismaModule, LicenceModule, JwtAuthModule],
  controllers: [BanquesController, ConditionsBancairesController],
  providers: [BanquesService, ConditionsBancairesService],
})
export class BanquesModule {}
