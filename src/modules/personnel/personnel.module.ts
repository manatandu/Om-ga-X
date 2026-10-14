import { Module } from '@nestjs/common';
import { PersonnelService } from './personnel.service';
import { PersonnelController } from './personnel.controller';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';
import { ComptabilisationPaieService } from './comptabilisation-paie.service';
import { AvancesRubriquesController } from './avances-rubriques.controller';
import { AvancesRubriquesService } from './avances-rubriques.service';
import { BaremesPaieController } from './baremes-paie.controller';
import { BaremesPaieService } from './baremes-paie.service';
import { CongesController } from './conges.controller';
import { CongesService } from './conges.service';
import { AbsencesController } from './absences.controller';
import { AbsencesService } from './absences.service';
import { MajorationsHeuresController } from './majorations-heures.controller';
import { MajorationsHeuresService } from './majorations-heures.service';
import { ReglementsModule } from '../reglements/reglements.module';
import { PaiementSalairesController } from './paiement-salaires.controller';
import { PaiementSalairesService } from './paiement-salaires.service';
import { RibsSalariesService } from './ribs-salaries.service';
import { RepartitionsAnalytiquesPaieController } from './repartitions-analytiques-paie.controller';
import { RepartitionsAnalytiquesPaieService } from './repartitions-analytiques-paie.service';

@Module({
  // ReglementsModule · le paiement des salaires fait naître ses ordres de virement par le module existant.
  imports: [LicenceModule, JwtAuthModule, ComptabiliteModule, ReglementsModule],
  controllers: [
    PersonnelController,
    AvancesRubriquesController,
    BaremesPaieController,
    CongesController,
    AbsencesController,
    MajorationsHeuresController,
    PaiementSalairesController,
    RepartitionsAnalytiquesPaieController,
  ],
  providers: [
    PersonnelService,
    ComptabilisationPaieService,
    AvancesRubriquesService,
    BaremesPaieService,
    CongesService,
    AbsencesService,
    MajorationsHeuresService,
    PaiementSalairesService,
    RibsSalariesService,
    RepartitionsAnalytiquesPaieService,
  ],
  exports: [PersonnelService],
})
export class PersonnelModule {}
