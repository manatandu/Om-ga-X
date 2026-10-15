import { IsBoolean, IsEnum } from 'class-validator';
import { ModeExportEcritures } from '@prisma/client';

/**
 * L'export demandé (ligne sage-l7, fonction 99) · les modifications depuis le
 * dernier export, ou tout ce que la portée retient, brouillard compris ou non.
 * Les deux champs sont exigés · un défaut silencieux enverrait le brouillard à
 * une receveuse qui ne voulait que le livre-journal, ou l'inverse.
 */
export class ExporterEcrituresDto {
  @IsEnum(ModeExportEcritures, { message: 'Mode d’export inconnu · « MODIFICATIONS » ou « COMPLET ».' })
  mode!: ModeExportEcritures;

  @IsBoolean({ message: 'Dites si le brouillard part avec le livre-journal (« inclureBrouillard », oui ou non).' })
  inclureBrouillard!: boolean;
}
