import { Module } from '@nestjs/common';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ExerciceModule } from '../exercice/exercice.module';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';
import { VirementsFondsController } from './virements-fonds.controller';
import { VirementsFondsService } from './virements-fonds.service';

@Module({
  imports: [LicenceModule, JwtAuthModule, ComptabiliteModule, ExerciceModule],
  controllers: [VirementsFondsController],
  providers: [VirementsFondsService],
})
export class VirementsFondsModule {}
