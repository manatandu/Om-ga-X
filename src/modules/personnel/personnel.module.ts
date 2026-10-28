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
import { FeuillesTempsController } from './feuilles-temps.controller';
import { FeuillesTempsService } from './feuilles-temps.service';
import { ReglementsModule } from '../reglements/reglements.module';
import { PaiementSalairesController } from './paiement-salaires.controller';
import { PaiementSalairesService } from './paiement-salaires.service';
import { RibsSalariesService } from './ribs-salaries.service';
import { RepartitionsAnalytiquesPaieController } from './repartitions-analytiques-paie.controller';
import { RepartitionsAnalytiquesPaieService } from './repartitions-analytiques-paie.service';
import { QuestionnairePaieController } from './questionnaire-paie.controller';
import { QuestionnairePaieService } from './questionnaire-paie.service';
import { PiecesJointesModule } from '../../common/pieces-jointes/pieces-jointes.module';
import { PiecesJointesSalarieController } from './pieces-jointes-salarie.controller';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';
import { SuiviPersonnelController } from './suivi-personnel.controller';
import { SuiviPersonnelService } from './suivi-personnel.service';

@Module({
  // ReglementsModule · le paiement des salaires fait naître ses ordres de virement par le module existant.
  imports: [LicenceModule, JwtAuthModule, ComptabiliteModule, ReglementsModule, PiecesJointesModule],
  controllers: [
    PersonnelController,
    AvancesRubriquesController,
    BaremesPaieController,
    CongesController,
    AbsencesController,
    MajorationsHeuresController,
    // Ligne sage-l5, fonction 78, reste · feuilles de temps et compteurs libres.
    FeuillesTempsController,
    PaiementSalairesController,
    RepartitionsAnalytiquesPaieController,
    QuestionnairePaieController,
    // Ligne sage-l6 · les documents de la fiche du salarié (fonction 22).
    PiecesJointesSalarieController,
    // Ligne microfina-m3, idée 3 · ordres et frais de mission.
    MissionsController,
    // Ligne microfina-m3, lot 2 · demandes de congé, échéancier, formation, main-d'œuvre.
    SuiviPersonnelController,
  ],
  providers: [
    PersonnelService,
    ComptabilisationPaieService,
    AvancesRubriquesService,
    BaremesPaieService,
    CongesService,
    AbsencesService,
    MajorationsHeuresService,
    FeuillesTempsService,
    PaiementSalairesService,
    RibsSalariesService,
    RepartitionsAnalytiquesPaieService,
    QuestionnairePaieService,
    MissionsService,
    SuiviPersonnelService,
  ],
  exports: [PersonnelService],
})
export class PersonnelModule {}
