import { Module } from '@nestjs/common';
import { RapprochementService } from './rapprochement.service';
import { RapprochementController } from './rapprochement.controller';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ExportsModule } from '../exports/exports.module';
import { ExtraitsBancairesService } from './extraits-bancaires.service';

@Module({
  // ExportsModule · l'identité du cartouche des extraits (fonction 45), lue par le même service que les balances.
  imports: [LicenceModule, JwtAuthModule, ExportsModule],
  controllers: [RapprochementController],
  providers: [RapprochementService, ExtraitsBancairesService],
  exports: [RapprochementService],
})
export class RapprochementModule {}
