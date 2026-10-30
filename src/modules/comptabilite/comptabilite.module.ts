import { Module } from '@nestjs/common';
import { EcritureService } from './ecriture.service';
import { EcritureController } from './ecriture.controller';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { JournauxModule } from '../journaux/journaux.module';
import { ExerciceModule } from '../exercice/exercice.module';
import { AnalytiqueModule } from '../analytique/analytique.module';
import { PiecesJointesModule } from '../../common/pieces-jointes/pieces-jointes.module';
import { PiecesJointesEcritureController } from './pieces-jointes-ecriture.controller';
import { CircuitVisaController } from './circuit-visa.controller';
import { CircuitVisaService } from './circuit-visa.service';
import { InterrogationCompteController } from './interrogation-compte.controller';
import { InterrogationCompteService } from './interrogation-compte.service';
import { RevueEcrituresController } from './revue-ecritures.controller';
import { RevueEcrituresService } from './revue-ecritures.service';
import { EcheancesTiersController } from './echeances-tiers.controller';
import { EcheancesTiersService } from './echeances-tiers.service';

@Module({
  imports: [LicenceModule, JwtAuthModule, JournauxModule, ExerciceModule, AnalytiqueModule, PiecesJointesModule],
  // Ligne sage-l6 · les pièces justificatives des écritures (fonction 22).
  // Ligne microfina-m1 · le circuit de visa avant validation et la fiche d'imputation.
  // Ligne gl-saisie, fonctions 13, 34 et 64 · interroger le compte depuis la saisie, les
  // échéances proches des tiers, revoir les écritures.
  controllers: [
    EcritureController,
    PiecesJointesEcritureController,
    CircuitVisaController,
    InterrogationCompteController,
    RevueEcrituresController,
    EcheancesTiersController,
  ],
  providers: [EcritureService, CircuitVisaService, InterrogationCompteService, RevueEcrituresService, EcheancesTiersService],
  exports: [EcritureService, CircuitVisaService],
})
export class ComptabiliteModule {}
