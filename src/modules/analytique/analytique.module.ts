import { Module } from '@nestjs/common';
import { AnalytiqueService } from './analytique.service';
import { EtatsAnalytiquesService } from './etats-analytiques.service';
import { EngagementService } from './engagement.service';
import { OdAnalytiqueService } from './od-analytique.service';
import { AnalytiqueController } from './analytique.controller';
import { ComptabiliteGestionController } from './gestion/comptabilite-gestion.controller';
import { ComptabiliteGestionService } from './gestion/comptabilite-gestion.service';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { PiecesJointesModule } from '../../common/pieces-jointes/pieces-jointes.module';
import { PiecesJointesSectionController } from './pieces-jointes-section.controller';
import { BonsCommandeController } from './bons-commande.controller';
import { BonsCommandeService } from './bons-commande.service';
import { GrillesAnalytiquesService } from './grilles-analytiques.service';
import { BudgetsComptesService } from './budgets-comptes.service';

@Module({
  imports: [LicenceModule, JwtAuthModule, PiecesJointesModule],
  // Comptabilité de gestion (ligne A20) · dans le module analytique, dont
  // elle lit les sections et écrit les OD, sans module de plus ni import
  // circulaire avec la comptabilité générale.
  // Ligne sage-l6 · les documents des sections (fonction 22).
  // Ligne microfina-m2, idée 2 · les bons de commande qui font naître les engagements.
  controllers: [AnalytiqueController, ComptabiliteGestionController, PiecesJointesSectionController, BonsCommandeController],
  // Ligne analytique, fonction n° 48 · les grilles analytiques des comptes.
  providers: [
    AnalytiqueService,
    EtatsAnalytiquesService,
    EngagementService,
    OdAnalytiqueService,
    ComptabiliteGestionService,
    BonsCommandeService,
    GrillesAnalytiquesService,
    // Ligne analytique, fonction n° 51 · les budgets des comptes généraux.
    BudgetsComptesService,
  ],
  exports: [AnalytiqueService, EngagementService],
})
export class AnalytiqueModule {}
