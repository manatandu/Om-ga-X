import { Module } from '@nestjs/common';
import { PiecesJointesService } from './pieces-jointes.service';

/**
 * Le mécanisme commun des pièces jointes (ligne sage-l6, fonction n° 22) ·
 * importé par les modules dont un objet reçoit une pièce (comptabilité,
 * analytique, immobilisations, personnel), qui l'emploient chacun chez eux.
 */
@Module({
  providers: [PiecesJointesService],
  exports: [PiecesJointesService],
})
export class PiecesJointesModule {}
