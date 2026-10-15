import { Module } from '@nestjs/common';
import { TiersService } from './tiers.service';
import { TiersController, ModeleReglementController } from './tiers.controller';
import { DocumentsTiersController } from './documents-tiers.controller';
import { DocumentsTiersService } from './documents-tiers.service';
import { RibsTiersController } from './ribs-tiers.controller';
import { RibsTiersService } from './ribs-tiers.service';
import { LieuxLivraisonController } from './lieux-livraison.controller';
import { LieuxLivraisonService } from './lieux-livraison.service';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';

@Module({
  imports: [LicenceModule, JwtAuthModule],
  controllers: [TiersController, ModeleReglementController, DocumentsTiersController, RibsTiersController, LieuxLivraisonController],
  providers: [TiersService, DocumentsTiersService, RibsTiersService, LieuxLivraisonService],
  exports: [TiersService],
})
export class TiersModule {}
