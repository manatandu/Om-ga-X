import { NatureExtraitPeriode } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * L'IMPRESSION D'UN EXTRAIT DE L'ÉCRAN, ENREGISTRÉE AVANT LA BOÎTE
 * D'IMPRESSION (ligne export-periode, condition 3). Le périmètre seul ·
 * l'exercice, ce que l'écran montre (balance ou grand livre, un compte ou
 * tous) et la période, que le serveur relit (`periodeDeLExtrait`) · jamais un
 * montant du client.
 */
export class ImprimerExtraitDto {
  @IsUUID('all', { message: 'Exercice inconnu' })
  exerciceId!: string;

  @IsEnum(NatureExtraitPeriode, { message: 'Nature de l’extrait inconnue · BALANCE ou GRAND_LIVRE.' })
  nature!: NatureExtraitPeriode;

  // Jours AAAA-MM-JJ · lus et bornés à l'exercice par le serveur, refus nommé sinon.
  @IsOptional()
  @IsString()
  du?: string;

  @IsOptional()
  @IsString()
  au?: string;

  // Le grand livre d'UN compte · celui que l'écran montre filtré.
  @IsOptional()
  @IsUUID('all', { message: 'Compte inconnu' })
  compteId?: string;

  // La balance des tiers regroupés sur leur collectif.
  @IsOptional()
  @IsBoolean()
  regrouperTiers?: boolean;
}
