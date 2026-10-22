import { Allow, IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { FacultatifNonNul } from '../../../common/facultatif-non-nul';

/**
 * Les corps des déclarations de la fonction 46 · la RÈGLE juge chaque champ
 * (`conditions-bancaires.ts`, refus nommés), le DTO ne fait que les déclarer
 * au pipe global (`@Allow()`, sans quoi `forbidNonWhitelisted` refuse la
 * pièce entière, vu sur vraie base au n° 40) et borner les chaînes.
 */
export class ConditionsBancairesDto {
  @IsString() @MaxLength(10) dateEffet!: string;
  @Allow() typePalier?: 'INTERVALLE' | 'SEUIL' | null;
  @Allow() paliers?: Array<{ plafond: number; taux: number }>;
  @Allow() tauxInteretsCrediteurs?: number | null;
  @Allow() tauxCommissionMouvement?: number | null;
  @Allow() tauxCommissionPlusFortDecouvert?: number | null;
  @Allow() fraisTenueCompte?: number | null;
  @Allow() periodiciteFrais?: 'MENSUELLE' | 'TRIMESTRIELLE' | 'ANNUELLE' | null;
  @Allow() baseCalcul?: number | null;
  @IsString() @MaxLength(400) referenceConvention!: string;
  @IsString() @MaxLength(10) dateConvention!: string;
  @IsOptional() @IsString() @MaxLength(200) commentaire?: string | null;
}

export class AutorisationFinancementDto {
  @IsString() @MaxLength(20) nature!: 'DECOUVERT' | 'FACILITE_CAISSE' | 'CREDIT_TRESORERIE' | 'ESCOMPTE' | 'AUTRE';
  @Allow() montant!: number;
  @IsString() @MaxLength(10) dateDebut!: string;
  @IsOptional() @IsString() @MaxLength(10) dateFin?: string | null;
  @Allow() irrevocable!: boolean;
  @IsString() @MaxLength(400) referenceConvention!: string;
  @IsString() @MaxLength(10) dateConvention!: string;
  @IsOptional() @IsString() @MaxLength(200) commentaire?: string | null;
}

export class UnionComptesBancairesDto {
  @IsString() @MaxLength(10) code!: string;
  @IsString() @MaxLength(240) intitule!: string;
  @Allow() ribIds!: string[];
  // Un booléen, jamais « true » en chaîne lu comme faux (premier tour, m7) ; absent, la modification le laisse tel quel.
  // `null` refusé par son nom (second tour, m5) · la colonne n'admet pas `null`, `@IsOptional()` le laissait passer en 500.
  @FacultatifNonNul('La fusion des échelles · oui ou non, jamais vide.') @IsBoolean({ message: 'La fusion des échelles · oui ou non.' }) fusionEchelles?: boolean;
}

/** La date de lecture de la situation · facultative, aujourd'hui à Kinshasa sans elle. */
export class LectureConditionsDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date de lecture doit être un jour (AAAA-MM-JJ).' })
  au?: string;
}
