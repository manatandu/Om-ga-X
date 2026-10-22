import { Module } from '@nestjs/common';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';
import { LettrageModule } from '../lettrage/lettrage.module';
import { RemisesController } from './remises.controller';
import { RemisesService } from './remises.service';

@Module({
  imports: [LicenceModule, JwtAuthModule, ComptabiliteModule, LettrageModule],
  controllers: [RemisesController],
  providers: [RemisesService],
})
export class RemisesModule {}
