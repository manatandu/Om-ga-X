import { Module } from '@nestjs/common';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { MessagerieController } from './messagerie.controller';
import { UtilisateursConnectesController } from './utilisateurs-connectes.controller';
import { MessagerieService } from './messagerie.service';

/**
 * Ligne dossier-l9, fonction 95 · les utilisateurs connectés du dossier et la
 * messagerie interne. La présence s'écrit dans `JwtStrategy` (`presence.ts`),
 * sans service · ce module la LIT.
 */
@Module({
  imports: [LicenceModule, JwtAuthModule],
  controllers: [MessagerieController, UtilisateursConnectesController],
  providers: [MessagerieService],
  exports: [MessagerieService],
})
export class MessagerieModule {}
