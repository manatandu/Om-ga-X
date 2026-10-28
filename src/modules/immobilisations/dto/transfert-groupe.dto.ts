import { IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * LIGNE SAGE-L4, N° 73 · le transfert d'un bien entre deux dossiers du groupe,
 * demandé depuis le siège. Les montants ne se reçoivent pas · le serveur les
 * lit sur la fiche du bien et les rejoue (`transfert-groupe.ts`).
 */
export class TransfertGroupeDto {
  @IsUUID('4')
  dossierCedantId!: string;

  @IsUUID('4')
  immobilisationId!: string;

  @IsUUID('4')
  dossierReceveurId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date du transfert se lit AAAA-MM-JJ.' })
  date!: string;

  /** La pièce commune aux deux comptabilités (fiche du compte 18, « les mêmes pièces justificatives »). */
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  referencePiece!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date de la pièce se lit AAAA-MM-JJ.' })
  datePiece!: string;

  @IsUUID('4')
  journalCedantId!: string;

  @IsUUID('4')
  journalReceveurId!: string;

  @IsUUID('4')
  compteLiaisonCedantId!: string;

  @IsUUID('4')
  compteLiaisonReceveurId!: string;
}

export class AnnulationTransfertGroupeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motif!: string;
}
