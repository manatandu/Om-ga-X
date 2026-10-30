import { Module } from '@nestjs/common';
import { CommercialController } from './commercial.controller';
import { CommercialService } from './commercial.service';
import { ArticlesCommerciauxController } from './articles.controller';
import { ArticlesCommerciauxService } from './articles.service';
import { GestionCommercialeGuard } from './gestion-commerciale.guard';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';

@Module({
  imports: [LicenceModule, JwtAuthModule],
  controllers: [CommercialController, ArticlesCommerciauxController],
  providers: [CommercialService, ArticlesCommerciauxService, GestionCommercialeGuard],
  exports: [CommercialService, ArticlesCommerciauxService],
})
export class CommercialModule {}
