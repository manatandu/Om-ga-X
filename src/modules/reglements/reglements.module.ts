import { Module } from '@nestjs/common';
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
  imports: [LicenceModule, JwtAuthModule, ComptabiliteModule, LettrageModule],
  controllers: [ReglementsController, OrdresVirementController, LotsVirementController, ModesReglementController],
  providers: [ReglementsService, OrdresVirementService, LotsVirementService, ModesReglementService],
  // Le paiement des salaires (ligne sage-l5) fait naître ses ordres par ce module · aucun second.
  exports: [OrdresVirementService],
})
export class ReglementsModule {}
