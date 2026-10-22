import { Module } from '@nestjs/common';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';
import { OperationsTresorerieController } from './operations-tresorerie.controller';
import { TauxReferenceController } from './taux-reference.controller';
import { OperationsTresorerieService } from './operations-tresorerie.service';

@Module({
  imports: [LicenceModule, JwtAuthModule, ComptabiliteModule],
  controllers: [OperationsTresorerieController, TauxReferenceController],
  providers: [OperationsTresorerieService],
})
export class TresorerieModule {}
