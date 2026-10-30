import { Module } from '@nestjs/common';
import { CommercialController } from './commercial.controller';
import { CommercialService } from './commercial.service';
import { ArticlesCommerciauxController } from './articles.controller';
import { ArticlesCommerciauxService } from './articles.service';
import { StructuresCommercialesController } from './structures-commerciales.controller';
import { StructuresCommercialesService } from './structures-commerciales.service';
import { EncoursClientService } from './encours-client.service';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';

@Module({
  imports: [LicenceModule, JwtAuthModule],
  controllers: [CommercialController, ArticlesCommerciauxController, StructuresCommercialesController],
  providers: [CommercialService, ArticlesCommerciauxService, StructuresCommercialesService, EncoursClientService],
  exports: [CommercialService, ArticlesCommerciauxService, EncoursClientService],
})
export class CommercialModule {}
