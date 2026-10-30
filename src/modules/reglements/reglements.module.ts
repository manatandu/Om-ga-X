import { Module } from '@nestjs/common';
import { CourrierModule } from '../courrier/courrier.module';
import { EnvoiAvisReglementService } from './envoi-avis-reglement.service';
import { EnvoiAvisReglementController } from './envoi-avis-reglement.controller';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';
import { LettrageModule } from '../lettrage/lettrage.module';
import { ReglementsController } from './reglements.controller';
import { ReglementsService } from './reglements.service';
import { OrdresVirementController } from './ordres-virement.controller';
import { OrdresVirementService } from './ordres-virement.service';
import { LotsVirementController } from './lots-virement.controller';
import { LotsVirementService } from './lots-virement.service';
import { ModesReglementController } from './modes-reglement.controller';
import { ModesReglementService } from './modes-reglement.service';

@Module({
  // La FILE des courriels · l'avis de règlement part par elle (ligne gl-saisie, fonction 35).
  imports: [LicenceModule, JwtAuthModule, ComptabiliteModule, LettrageModule, CourrierModule],
  controllers: [ReglementsController, OrdresVirementController, LotsVirementController, ModesReglementController, EnvoiAvisReglementController],
  providers: [ReglementsService, OrdresVirementService, LotsVirementService, ModesReglementService, EnvoiAvisReglementService],
  // Le paiement des salaires (ligne sage-l5) fait naître ses ordres par ce module · aucun second.
  exports: [OrdresVirementService],
})
export class ReglementsModule {}
