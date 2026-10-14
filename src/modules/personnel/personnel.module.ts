import { Module } from '@nestjs/common';
import { PersonnelService } from './personnel.service';
import { PersonnelController } from './personnel.controller';
import { LicenceModule } from '../licence/licence.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ComptabiliteModule } from '../comptabilite/comptabilite.module';
import { ComptabilisationPaieService } from './comptabilisation-paie.service';
import { AvancesRubriquesController } from './avances-rubriques.controller';
import { AvancesRubriquesService } from './avances-rubriques.service';
import { BaremesPaieController } from './baremes-paie.controller';
import { BaremesPaieService } from './baremes-paie.service';
import { CongesController } from './conges.controller';
import { CongesService } from './conges.service';
import { AbsencesController } from './absences.controller';
import { AbsencesService } from './absences.service';

@Module({
  imports: [LicenceModule, JwtAuthModule, ComptabiliteModule],
  controllers: [PersonnelController, AvancesRubriquesController, BaremesPaieController, CongesController, AbsencesController],
  providers: [PersonnelService, ComptabilisationPaieService, AvancesRubriquesService, BaremesPaieService, CongesService, AbsencesService],
  exports: [PersonnelService],
})
export class PersonnelModule {}
