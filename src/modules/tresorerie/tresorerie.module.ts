import { Module } from '@nestjs/common';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';
import { OperationsTresorerieController } from './operations-tresorerie.controller';
import { TauxReferenceController } from './taux-reference.controller';
import { OperationsTresorerieService } from './operations-tresorerie.service';
import { TitresPlacementController } from './titres-placement.controller';
import { TitresPlacementService } from './titres-placement.service';

@Module({
  imports: [LicenceModule, JwtAuthModule, ComptabiliteModule],
  controllers: [OperationsTresorerieController, TauxReferenceController, TitresPlacementController],
  providers: [OperationsTresorerieService, TitresPlacementService],
})
export class TresorerieModule {}
