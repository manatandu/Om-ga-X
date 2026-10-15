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

@Module({
  imports: [LicenceModule, JwtAuthModule, JournauxModule, ExerciceModule, AnalytiqueModule, PiecesJointesModule],
  // Ligne sage-l6 · les pièces justificatives des écritures (fonction 22).
  controllers: [EcritureController, PiecesJointesEcritureController],
  providers: [EcritureService],
  exports: [EcritureService],
})
export class ComptabiliteModule {}
