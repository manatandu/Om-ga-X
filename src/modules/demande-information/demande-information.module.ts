import { Module } from '@nestjs/common';
import { CourrierModule } from '../courrier/courrier.module';
import { DemandeInformationController } from './demande-information.controller';
import { DemandeInformationService } from './demande-information.service';

@Module({
  imports: [CourrierModule],
  controllers: [DemandeInformationController],
  providers: [DemandeInformationService],
})
export class DemandeInformationModule {}
