import { SensEffet } from '@prisma/client';
import { Allow, ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { FacultatifNonNul } from '../../common/facultatif-non-nul';

/**
 * L'ACCEPTATION D'UN EFFET · le tiers, le compte de portefeuille (412 ou
 * 402), le journal d'opérations diverses des actes sans trésorerie, et les
 * lignes ouvertes du tiers que l'effet règle (lettrées avec l'acceptation).
 * Montant, référence, tiré et dates se jugent ensemble dans
 * `motifRefusEffet`, qui nomme le champ · `@Allow()` les déclare au pipe
 * global (`whitelist`, `forbidNonWhitelisted`), qui refusait la pièce entière
 * avant que la règle ne les lise (vu sur vraie base, fonction 40).
 */
export class AccepterEffetDto {
  @IsUUID('4')
  exerciceId!: string;

  @IsEnum(SensEffet, { message: 'Le sens est A_RECEVOIR ou A_PAYER.' })
  sens!: SensEffet;

  @IsUUID('4')
  journalId!: string;

  @IsUUID('4')
  compteTiersId!: string;

  @IsUUID('4')
  compteEffetId!: string;

  @Allow()
  montant?: unknown;

  @Allow()
  reference?: unknown;

  @Allow()
  tire?: unknown;

  @Allow()
  dateCreation?: unknown;

  @Allow()
  dateEcheance?: unknown;

  /** Les lignes ouvertes du tiers que l'effet règle · lettrées avec l'acceptation, partiel admis. Facultatif. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  ligneIds?: string[];
}

/** La remise à l'encaissement · au 512 choisi, à sa date. */
export class RemettreEffetDto {
  @Allow()
  date?: unknown;

  @IsUUID('4')
  compteEncaissementId!: string;
}

/** La remise à l'escompte · au 415 choisi, à sa date. */
export class EscompterEffetDto {
  @Allow()
  date?: unknown;

  @IsUUID('4')
  compteEscompteNonEchuId!: string;
}

/** Le décompte de la banque · journal de banque, 564 ou 565, frais (675), commission (6312), référence du décompte. */
export class DecompteEffetDto {
  @Allow()
  date?: unknown;

  @IsUUID('4')
  journalBanqueId!: string;

  @IsUUID('4')
  compteCreditEscompteId!: string;

  @Allow()
  frais?: unknown;

  @FacultatifNonNul('Omettez le compte des frais, ou choisissez-le.')
  @IsUUID('4')
  compteFraisId?: string;

  @Allow()
  commission?: unknown;

  @FacultatifNonNul('Omettez le compte de commission, ou choisissez-le.')
  @IsUUID('4')
  compteCommissionId?: string;

  @Allow()
  referencePiece?: unknown;
}

/** L'encaissement d'un effet remis · journal de banque, commission (6312), référence de l'avis. */
export class EncaisserEffetDto {
  @Allow()
  date?: unknown;

  @IsUUID('4')
  journalBanqueId!: string;

  @Allow()
  commission?: unknown;

  @FacultatifNonNul('Omettez le compte de commission, ou choisissez-le.')
  @IsUUID('4')
  compteCommissionId?: string;

  @Allow()
  referencePiece?: unknown;
}

/** Un acte daté sans autre choix · le dénouement de l'escompte. */
export class DateActeDto {
  @Allow()
  date?: unknown;
}

/** L'impayé · au 4132 que la fiche du compte 41 prescrit. */
export class ImpayeEffetDto {
  @Allow()
  date?: unknown;

  @IsUUID('4')
  compteImpayeId!: string;
}

/** Le bon à payer · aucune écriture, la date et la référence du relevé ou de l'avis. */
export class BonAPayerDto {
  @Allow()
  date?: unknown;

  @FacultatifNonNul('Omettez la référence, ou écrivez-la.')
  @IsString()
  @Length(1, 60)
  referencePiece?: string;
}

/** Le paiement d'un effet à payer · journal de banque, référence de la pièce. */
export class PayerEffetDto {
  @Allow()
  date?: unknown;

  @IsUUID('4')
  journalBanqueId!: string;

  @Allow()
  referencePiece?: unknown;
}

export class AnnulerActeDto {
  @IsString()
  @Length(3, 500)
  motif!: string;
}
