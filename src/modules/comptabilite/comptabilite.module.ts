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

@Module({
  imports: [LicenceModule, JwtAuthModule, JournauxModule, ExerciceModule, AnalytiqueModule, PiecesJointesModule],
  // Ligne sage-l6 · les pièces justificatives des écritures (fonction 22).
  // Ligne microfina-m1 · le circuit de visa avant validation et la fiche d'imputation.
  // Ligne gl-saisie, fonction 13 · interroger le compte depuis la saisie.
  controllers: [EcritureController, PiecesJointesEcritureController, CircuitVisaController, InterrogationCompteController],
  providers: [EcritureService, CircuitVisaService, InterrogationCompteService],
  exports: [EcritureService, CircuitVisaService],
})
export class ComptabiliteModule {}
