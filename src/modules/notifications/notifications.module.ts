import { Global, Module } from '@nestjs/common';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { NotificationsController, PreferencesController } from './preferences.controller';
import { PreferencesService } from './preferences.service';

/**
 * Ligne dossier-l9, fonctions 96 et 100 · les préférences de chacun et les
 * notifications dans l'interface. Les modules qui disent un événement
 * appellent `notifierSansEchec` (notifications.ts), sans service à injecter.
 */
@Global()
@Module({
  imports: [LicenceModule, JwtAuthModule],
  controllers: [PreferencesController, NotificationsController],
  providers: [PreferencesService],
  exports: [PreferencesService],
})
export class NotificationsModule {}
