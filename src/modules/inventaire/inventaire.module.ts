import { Module } from '@nestjs/common';
import { InventaireService } from './inventaire.service';
import { InventaireController } from './inventaire.controller';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';
import { ArretesCaisseController } from './arretes-caisse.controller';
import { ArretesCaisseService } from './arretes-caisse.service';

@Module({
  imports: [LicenceModule, JwtAuthModule, ComptabiliteModule],
  // Ligne microfina-m2, idée 5 · l'arrêté de caisse quotidien et le plafond d'encaisse.
  controllers: [InventaireController, ArretesCaisseController],
  providers: [InventaireService, ArretesCaisseService],
  exports: [InventaireService],
})
export class InventaireModule {}
