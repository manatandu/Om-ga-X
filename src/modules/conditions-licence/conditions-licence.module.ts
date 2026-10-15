import { Module } from '@nestjs/common';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { CourrierModule } from '../courrier/courrier.module';
import { ConditionsLicenceController } from './conditions-licence.controller';
import { ConditionsLicenceService } from './conditions-licence.service';

/**
 * Les conditions de licence d'OmegaX et leur acceptation en ligne (ligne
 * pages-legales). Module à part et non sous `licence/` · celui-ci est importé
 * par le courrier, et l'accusé de réception passe par le courrier.
 */
@Module({
  imports: [JwtAuthModule, CourrierModule],
  controllers: [ConditionsLicenceController],
  providers: [ConditionsLicenceService],
})
export class ConditionsLicenceModule {}
