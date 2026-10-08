import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { NatureCreanceDouteuse } from '@prisma/client';

/**
 * Une pièce justificative · fiche du compte 49, « courriers et autres
 * protêts, justificatifs du caractère douteux ou litigieux de la créance » ;
 * fiche du compte 65, « notifications de cessation de paiement relevées ou
 * courrier des avocats ». Nature et référence ; la date est facultative.
 */
export class PieceJustificativeDto {
  @IsString()
  @MaxLength(120)
  nature!: string;

  @IsString()
  @MaxLength(200)
  reference!: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}

class MotifEtPiecesDto {
  @IsString()
  @MaxLength(2000)
  motif!: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PieceJustificativeDto)
  pieces!: PieceJustificativeDto[];
}

/**
 * Une facture désignée (ligne A7 bis) · la ligne de la facture au compte du
 * client et la part TTC que la créance en reprend.
 */
export class FactureDesigneeDto {
  @IsUUID('4')
  ligneEcritureId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  montant!: number;
}

/** « Désigner les factures » · après le reclassement, ou avec lui. */
export class DesignerFacturesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => FactureDesigneeDto)
  factures!: FactureDesigneeDto[];
}

/** Le reclassement d'une créance client au 416 (fiche du compte 41). */
export class ReclasserCreanceDto extends MotifEtPiecesDto {
  /**
   * Les factures que le reclassement reprend (ligne A7 bis) · facultatives
   * ici, désignables ensuite. Rien n'est lettré (A7 ter).
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => FactureDesigneeDto)
  factures?: FactureDesigneeDto[];

  @IsUUID('4')
  exerciceId!: string;

  @IsUUID('4')
  journalId!: string;

  @IsDateString()
  date!: string;

  @IsUUID('4')
  compteCreanceId!: string;

  /** Le 416 choisi · absent, le serveur prend celui qu'il propose. */
  @IsOptional()
  @IsUUID('4')
  compte416Id?: string;

  /** m5 · le 491 choisi sous la racine de la nature · absent, le premier de détail. */
  @IsOptional()
  @IsUUID('4')
  compte491Id?: string;

  @IsEnum(NatureCreanceDouteuse)
  nature!: NatureCreanceDouteuse;

  @IsNumber({ maxDecimalPlaces: 2 })
  montant!: number;
}

/** La revue de la dépréciation à la clôture d'un exercice (fiche du compte 49). */
export class RevoirDepreciationDto extends MotifEtPiecesDto {
  @IsUUID('4')
  exerciceId!: string;

  @IsUUID('4')
  journalId!: string;

  /** La dépréciation NÉCESSAIRE à la clôture, déclarée · jamais un taux. */
  @IsNumber({ maxDecimalPlaces: 2 })
  depreciationNecessaire!: number;
}

/** La perte sur créance irrécouvrable (fiche du compte 65) · D 651 / C 416, au TTC entier. */
export class PerteCreanceDto extends MotifEtPiecesDto {
  @IsUUID('4')
  exerciceId!: string;

  @IsUUID('4')
  journalId!: string;

  @IsDateString()
  date!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  montant!: number;

  /** Le 651 choisi · absent, le serveur prend celui qu'il propose. */
  @IsOptional()
  @IsUUID('4')
  comptePerteId?: string;

  /**
   * POINT D (décision de Manasse du 2026-10-08) · les duplicatas surchargés
   * envoyés au client, facture désignée par facture désignée (O.-L. n° 10/001,
   * art. 52, al. 3 ; décret n° 011/42, art. 127, al. 2). Présents, la perte
   * récupère la taxe dans la même écriture (D 651 HT / D 443 / C compte
   * d'origine) ; absents, elle passe au TTC entier. Le montant de la taxe
   * n'est jamais reçu, il est rejoué par le serveur.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => DuplicataFactureDto)
  duplicatas?: DuplicataFactureDto[];
}


/** L'encaissement d'une créance reclassée · D trésorerie / C 416. */
export class RecouvrementCreanceDto extends MotifEtPiecesDto {
  @IsUUID('4')
  exerciceId!: string;

  /** Un journal de trésorerie · son compte reçoit le débit. */
  @IsUUID('4')
  journalId!: string;

  @IsDateString()
  date!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  montant!: number;
}

/** L'annulation d'une revue (AUDCIF art. 20, al. 2) · motif de 3 à 500 caractères. */
export class AnnulerRevueDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motif!: string;
}

/** L'annulation d'une perte ou d'un recouvrement (K4 · AUDCIF art. 20, al. 2) · même motif. */
export class AnnulerMouvementDto extends AnnulerRevueDto {}

/** A7 bis · « Retirer la désignation » d'une facture · même motif, au journal d'audit. */
export class RetirerDesignationDto extends AnnulerRevueDto {}

/** m2 · l'annulation d'un reclassement (AUDCIF art. 20, al. 2). */
export class AnnulerReclassementDto extends AnnulerRevueDto {}

/**
 * M9 · « Corriger par le résultat » · l'écriture de correction du cabinet,
 * VALIDÉE, et le motif (3 à 500 caractères), au journal d'audit.
 */
export class CorrigerParResultatDto extends AnnulerRevueDto {
  @IsUUID('4')
  ecritureId!: string;
}

/**
 * Second tour d'A7 ter, B-1 · LE LETTRAGE AU 416 D'UNE CRÉANCE ÉTEINTE, posé
 * par le module · `ligneIds`, les lignes d'À-NOUVEAU du 416 que le cabinet
 * désigne (aucune liaison ne les relie au reclassement d'un exercice
 * précédent, ni à une créance déclarée à l'ouverture) ; le module y joint les
 * lignes ouvertes de la créance dans l'exercice.
 */
export class Lettrer416Dto {
  @IsUUID('4')
  exerciceId!: string;

  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  ligneIds!: string[];
}

/**
 * DOSSIER REPRIS · la créance déjà au 416 et sa dépréciation déjà au 491
 * avant OmegaX, déclarées au premier jour de l'exercice choisi, sans écriture.
 */
export class DeclarerCreanceOuvertureDto {
  @IsUUID('4')
  exerciceId!: string;

  @IsUUID('4')
  compteCreanceId!: string;

  @IsUUID('4')
  compte416Id!: string;

  /** m5 · le 491 choisi sous la racine de la nature · absent, le premier de détail. */
  @IsOptional()
  @IsUUID('4')
  compte491Id?: string;

  @IsEnum(NatureCreanceDouteuse)
  nature!: NatureCreanceDouteuse;

  @IsNumber({ maxDecimalPlaces: 2 })
  montant!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  depreciationOuverture!: number;

  @IsString()
  @MaxLength(500)
  source!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  motif?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PieceJustificativeDto)
  pieces?: PieceJustificativeDto[];
}

/**
 * Ligne A7 bis, partie 2 · le duplicata d'une facture désignée, envoyé au
 * client (O.-L. n° 10/001, art. 52, al. 3 ; décret n° 011/42, art. 127, al. 2).
 * Référence et date d'envoi exigées par le service, qui nomme la facture.
 */
export class DuplicataFactureDto {
  @IsUUID('4')
  designationId!: string;

  @IsString()
  @MaxLength(200)
  reference!: string;

  @IsDateString()
  dateEnvoi!: string;
}

/**
 * Ligne A7 bis, partie 2 · « Récupérer la TVA (art. 52) » · le montant n'est
 * jamais reçu, il est REJOUÉ par le serveur facture par facture. Motif et
 * pièces · la preuve de l'irrécouvrabilité (décret n° 011/42, art. 127, al. 3).
 */
export class RecupererTvaCreanceDto extends MotifEtPiecesDto {
  @IsUUID('4')
  exerciceId!: string;

  /** Un journal d'opérations diverses, comme celui de la perte. */
  @IsUUID('4')
  journalId!: string;

  @IsDateString()
  date!: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => DuplicataFactureDto)
  duplicatas!: DuplicataFactureDto[];
}

/** L'annulation d'une récupération (AUDCIF art. 20, al. 2) · même motif. */
export class AnnulerRecuperationTvaDto extends AnnulerRevueDto {}
