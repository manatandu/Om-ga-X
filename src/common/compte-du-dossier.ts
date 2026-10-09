import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  NotFoundException,
  ParseUUIDPipe,
  PipeTransform,
} from '@nestjs/common';
import { dossierDeLaSession } from './exercice-requis';
import { PrismaService } from './prisma.service';

/**
 * LE COMPTE EN FILTRE, D'UN AUTRE DOSSIER, EST INTROUVABLE (paquet 1, ligne
 * C, premier tour de relecture, constat 4 · même règle que l'exercice et le
 * journal de C3).
 *
 * La liste des rapprochements (`GET /rapprochements?compteId=`) et
 * l'historique des rappels (`GET /relances/historique?compteId=`) se filtrent
 * par un `compteId` facultatif, lu nu jusqu'ici. Le compte d'un AUTRE dossier
 * y passait · le filtre `{ tenantId, compteId }` ne ramenait rien, et la
 * réponse était une liste VIDE en 200, lue comme « aucun rapprochement » ou
 * « aucune relance sur ce compte » ; un identifiant illisible (« abc ») de
 * même. Même remède, à l'entrée de la route · le compte donné est lisible et
 * du dossier de la SESSION, sinon 404 nommé ; absent, il reste absent (le
 * filtre est facultatif). La garde de cloisonnement n'est pas touchée · elle
 * refuse, elle ne réécrit pas.
 *
 * Illisible, il est refusé en 400 nommé · « abc » n'est jamais lu comme
 * « aucune ligne sur ce compte ».
 */
export const MESSAGE_COMPTE_ILLISIBLE =
  "Le paramètre compteId, quand il est donné, doit être un identifiant de compte valide · un identifiant illisible n'est jamais lu comme un compte sans mouvement.";

/** Même forme que l'exercice · il ne dit pas si le compte existe ailleurs. */
export const MESSAGE_COMPTE_HORS_DOSSIER = 'Compte introuvable dans ce dossier.';

const FORMAT_FACULTATIF = new ParseUUIDPipe({
  optional: true,
  exceptionFactory: () => new BadRequestException(MESSAGE_COMPTE_ILLISIBLE),
});

@Injectable()
export class CompteFacultatifDuDossier implements PipeTransform<unknown, Promise<string | undefined>> {
  static readonly format = FORMAT_FACULTATIF;

  constructor(private readonly prisma: PrismaService) {}

  async transform(valeur: unknown, metadata: ArgumentMetadata): Promise<string | undefined> {
    const id: string | undefined = await FORMAT_FACULTATIF.transform(valeur as string, metadata);
    if (id === undefined || id === null) return id;
    const tenantId = dossierDeLaSession();
    const compte = await this.prisma.compte.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!compte) throw new NotFoundException(MESSAGE_COMPTE_HORS_DOSSIER);
    return id;
  }
}

export const COMPTE_FACULTATIF = CompteFacultatifDuDossier;
