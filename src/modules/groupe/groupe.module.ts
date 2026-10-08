import { Module } from '@nestjs/common';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';
import { AuthModule } from '../auth/auth.module';
import { ExportsModule } from '../exports/exports.module';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { GroupeService } from './groupe.service';
import { GroupeController } from './groupe.controller';
import { LECTEUR_VIREMENTS_GROUPE } from '../../common/lecteurs-bilan';

@Module({
  // ComptabiliteModule pour EcritureService.balance : l'agrégat réutilise LE
  // MÊME calcul de balance que la fenêtre Balance de chaque dossier · aucun
  // second moteur, donc aucune divergence possible entre les deux.
  imports: [ComptabiliteModule, AuthModule, ExportsModule, LicenceModule, JwtAuthModule],
  controllers: [GroupeController],
  // Le 585 du groupe lu par la clôture d'un de ses dossiers (G1) · jeton,
  // sans quoi ExerciceModule importerait le groupe (cycle).
  providers: [GroupeService, { provide: LECTEUR_VIREMENTS_GROUPE, useExisting: GroupeService }],
})
export class GroupeModule {}
