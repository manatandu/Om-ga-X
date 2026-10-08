import { Module } from '@nestjs/common';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';
import { LettrageModule } from '../lettrage/lettrage.module';
import { TvaModule } from '../tva/tva.module';
import { CreancesDouteusesController } from './creances-douteuses.controller';
import { CreancesDouteusesService } from './creances-douteuses.service';

@Module({
  // TvaModule · la taxe des factures, lue par la règle de la déclaration (A7 bis, partie 2).
  imports: [LicenceModule, JwtAuthModule, ComptabiliteModule, LettrageModule, TvaModule],
  controllers: [CreancesDouteusesController],
  providers: [CreancesDouteusesService],
})
export class CreancesDouteusesModule {}
