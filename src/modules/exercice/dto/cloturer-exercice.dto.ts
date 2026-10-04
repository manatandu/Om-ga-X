import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * AU2 · la déclaration que la clôture demande quand l'exercice suivant porte
 * déjà un bilan d'ouverture importé qui diffère du bilan de clôture (AUDCIF
 * art. 34 · SYCEBNL art. 16, 4)). Les deux champs sont facultatifs · sans
 * import, ou avec un import concordant, la clôture ne les lit pas. Aucune
 * colonne n'en reçoit un `null` · le service lit l'absence comme « rien n'est
 * déclaré » et refuse alors en nommant les deux gestes.
 */
export class CloturerExerciceDto {
  @IsOptional()
  @IsIn(['RECTIFIER', 'CONSERVER'])
  ouvertureImportee?: 'RECTIFIER' | 'CONSERVER';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motifConservation?: string;
}
