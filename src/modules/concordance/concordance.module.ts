import { Module } from '@nestjs/common';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';
import { ImmobilisationsModule } from '../immobilisations/immobilisations.module';
import { ProvisionsModule } from '../provisions/provisions.module';
import { CreancesDouteusesModule } from '../creances-douteuses/creances-douteuses.module';
import { RapprochementModule } from '../rapprochement/rapprochement.module';
import { MaintenanceImmobilisationsService } from '../immobilisations/maintenance-immobilisations.service';
import { EtatsAnalytiquesService } from '../analytique/etats-analytiques.service';
import { ConcordanceController } from './concordance.controller';
import { ConcordanceService } from './concordance.service';

/**
 * La concordance relit les confrontations des modules · la maintenance des
 * immobilisations et les états analytiques ne sont pas exportés par leur
 * module, ils se fournissent ici (services sans état, sur le même client
 * Prisma) · leurs modules n'en sont pas retouchés.
 */
@Module({
  imports: [LicenceModule, JwtAuthModule, ComptabiliteModule, ImmobilisationsModule, ProvisionsModule, CreancesDouteusesModule, RapprochementModule],
  controllers: [ConcordanceController],
  providers: [ConcordanceService, MaintenanceImmobilisationsService, EtatsAnalytiquesService],
})
export class ConcordanceModule {}
