import { Module } from '@nestjs/common';
import { CourrierModule } from '../courrier/courrier.module';
import { DemandeInformationController } from './demande-information.controller';
import { DemandeInformationService } from './demande-information.service';

@Module({
  imports: [CourrierModule],
  controllers: [DemandeInformationController],
  providers: [DemandeInformationService],
  // La console de l'éditeur compte les demandes non parties et les reprend.
  exports: [DemandeInformationService],
})
export class DemandeInformationModule {}
