import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';
import { FORMAT_LETTRE_CHOISIE, MOTIF_FORMAT_LETTRE } from '../lettre-choisie';
import { Type } from 'class-transformer';
import { OrigineLettrage } from '@prisma/client';

export class LettrerDto {
  @IsArray()
  @ArrayMinSize(2)
  @IsUUID('4', { each: true })
  ligneIds!: string[];

  /**
   * Autorise un groupe dont le solde n'est pas nul · le lettrage PARTIEL que
   * le CPCC prévoit expressément (organisation comptable, chapitre du lettrage :
   * « la somme des montants lettrés au débit
   * pouvant être égale, supérieure ou inférieure à celle des montants lettrés
   * au crédit »). Demandé explicitement plutôt que déduit du solde : créer un
   * partiel sans que l'utilisateur l'ait voulu masquerait une erreur de
   * sélection.
   */
  @IsOptional()
  @IsBoolean()
  autoriserPartiel?: boolean;

  /**
   * LA LETTRE CHOISIE À LA MAIN (ligne sage-l1, fonction 16 · Sage i7,
   * Interrogation et lettrage, « changer la prochaine lettre »). Absente, le
   * groupe prend la lettre proposée (la suivante du compte). Le serveur la
   * refuse si elle sert déjà sur le compte (`motifLettreDejaEmployee`).
   */
  @IsOptional()
  @IsString()
  @Matches(FORMAT_LETTRE_CHOISIE, { message: MOTIF_FORMAT_LETTRE })
  lettre?: string;
}

/** Complète un groupe PARTIEL · une seule ligne suffit (le règlement du solde). */
export class CompleterLettrageDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ligneIds!: string[];
}

/** Le lettrage partiel d'un exercice clôturé à reconduire sur ses lignes d'à-nouveau (ligne lettrage-cloture). */
export class ReconduireLettrageDto {
  @IsUUID('4')
  lettrageId!: string;
}

export class VerrouillerLettrageDto {
  @IsBoolean()
  verrouille!: boolean;
}

export class DelettrerDto {
  @IsString()
  lettre!: string;
}

/**
 * Un groupe rejoué depuis le pré-lettrage. L'ORIGINE est reprise de la
 * proposition, jamais choisie : elle dit COMMENT le rapprochement a été trouvé,
 * pas qui l'a béni. Le service refuse `MANUEL` ici · un groupe composé à la
 * main passe par le lettrage manuel.
 */
export class GroupePreLettrageDto {
  @IsArray()
  @ArrayMinSize(2)
  @IsUUID('4', { each: true })
  ligneIds!: string[];

  @IsEnum(OrigineLettrage)
  origine!: OrigineLettrage;
}

export class ConfirmerPreLettrageDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GroupePreLettrageDto)
  groupes!: GroupePreLettrageDto[];
}
