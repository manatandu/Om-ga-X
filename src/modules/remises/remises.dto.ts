import { NatureRemise } from '@prisma/client';
import { Allow, ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { FacultatifNonNul } from '../../common/facultatif-non-nul';

/** Un type de remise · nature, banque de remise, journal des opérations, comptes du 51 et de commission, modèle du bordereau. */
export class CreerTypeRemiseDto {
  @IsString()
  @Length(1, 10)
  code!: string;

  @IsString()
  @Length(3, 60)
  intitule!: string;

  @IsEnum(NatureRemise, { message: 'La nature est CHEQUES ou CARTES.' })
  nature!: NatureRemise;

  @IsUUID('4')
  journalBanqueId!: string;

  @IsUUID('4')
  journalOperationsId!: string;

  @IsUUID('4')
  compteReceptionId!: string;

  @FacultatifNonNul('Omettez le compte de transit, ou choisissez-le.')
  @IsUUID('4')
  compteTransitId?: string;

  @FacultatifNonNul('Omettez le compte de commission, ou choisissez-le.')
  @IsUUID('4')
  compteCommissionId?: string;

  @FacultatifNonNul('Omettez le modèle du bordereau, ou écrivez-le.')
  @IsString()
  @MaxLength(4000)
  modeleBordereau?: string;
}

/** Ce qui se retouche sur un type · l'intitulé, le modèle (null l'efface), la commission (null la retire), l'activité. */
export class ModifierTypeRemiseDto {
  @FacultatifNonNul("Omettez l'intitulé, ou écrivez-le.")
  @IsString()
  @Length(3, 60)
  intitule?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  modeleBordereau?: string | null;

  @IsOptional()
  @IsUUID('4')
  compteCommissionId?: string | null;

  @FacultatifNonNul("Omettez l'activité, ou dites-la.")
  @IsBoolean()
  estActif?: boolean;
}

/** Une valeur reçue · un chèque ou une transaction par carte, du tiers, à sa date. */
export class RecevoirValeurDto {
  @IsUUID('4')
  exerciceId!: string;

  @IsUUID('4')
  typeRemiseId!: string;

  @IsUUID('4')
  compteTiersId!: string;

  // Montant, référence, date, banque tirée et titulaire se jugent ensemble
  // dans `motifRefusValeur`, qui nomme le champ · laissés `unknown` ici.
  // `@Allow()` les déclare au pipe global (`whitelist`, `forbidNonWhitelisted`),
  // qui refusait la pièce entière (« property montant should not exist »)
  // avant que la règle ne les lise · vu sur vraie base.
  @Allow()
  montant?: unknown;

  @Allow()
  reference?: unknown;

  @Allow()
  date?: unknown;

  @Allow()
  banqueTiree?: unknown;

  @Allow()
  titulaire?: unknown;

  /** Les lignes ouvertes du tiers que la valeur règle · lettrées avec elle, partiel admis. Facultatif. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  ligneIds?: string[];
}

/** Un bordereau · les valeurs reçues d'un même type, remises ce jour. */
export class RemettreDto {
  @IsUUID('4')
  exerciceId!: string;

  @IsUUID('4')
  typeRemiseId!: string;

  @IsString()
  date!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  valeurIds!: string[];
}

/** L'avis de crédit de la banque · date, référence de la pièce, commission prélevée. */
export class AvisCreditDto {
  // Jugés ensemble dans `motifRefusAvisCredit` · `@Allow()` pour le pipe global.
  @Allow()
  date?: unknown;

  @Allow()
  referenceAvis?: unknown;

  @Allow()
  commission?: unknown;
}

/** Une valeur revenue impayée · au 413 que la fiche du compte 41 prescrit. */
export class ImpayeDto {
  // Jugée dans `motifRefusImpaye` · `@Allow()` pour le pipe global.
  @Allow()
  date?: unknown;

  @IsUUID('4')
  compteImpayeId!: string;
}

export class AnnulerRemiseDto {
  @IsString()
  @Length(3, 500)
  motif!: string;
}

