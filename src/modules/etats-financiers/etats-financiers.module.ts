import { Module } from '@nestjs/common';
import { EtatsFinanciersService } from './etats-financiers.service';
import { EtatsFinanciersProjetService } from './etats-financiers-projet.service';
import { EtatsFinanciersSmtService } from './etats-financiers-smt.service';
import { EtatsFinanciersProjetBudgetService } from './etats-financiers-projet-budget.service';
import { EtatsFinanciersController } from './etats-financiers.controller';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ExerciceModule } from '../exercice/exercice.module';
import { AnalytiqueModule } from '../analytique/analytique.module';
import {
  LECTEUR_BILAN_SYCEBNL_ASSOCIATIONS,
  LECTEUR_BILAN_SYCEBNL_PROJETS,
  LECTEUR_BILAN_SYCEBNL_SMT,
} from '../../common/lecteurs-bilan';

@Module({
  imports: [ComptabiliteModule, LicenceModule, JwtAuthModule, ExerciceModule, AnalytiqueModule],
  controllers: [EtatsFinanciersController],
  providers: [
    EtatsFinanciersService,
    EtatsFinanciersProjetService,
    EtatsFinanciersSmtService,
    EtatsFinanciersProjetBudgetService,
    // Lus par la clôture, qui refuse un bilan déséquilibré (common/lecteurs-bilan.ts).
    { provide: LECTEUR_BILAN_SYCEBNL_ASSOCIATIONS, useExisting: EtatsFinanciersService },
    { provide: LECTEUR_BILAN_SYCEBNL_PROJETS, useExisting: EtatsFinanciersProjetService },
    { provide: LECTEUR_BILAN_SYCEBNL_SMT, useExisting: EtatsFinanciersSmtService },
  ],
  exports: [EtatsFinanciersService, EtatsFinanciersProjetService, EtatsFinanciersSmtService, EtatsFinanciersProjetBudgetService],
})
export class EtatsFinanciersModule {}
