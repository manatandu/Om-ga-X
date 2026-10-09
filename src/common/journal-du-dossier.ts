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
 * LE JOURNAL EN FILTRE, D'UN AUTRE DOSSIER, EST INTROUVABLE (paquet 1, ligne
 * C, point C3, passe V1 n° 2).
 *
 * La liste des écritures, le brouillard, l'export du journal et la liste des
 * modèles de saisie se filtrent par un `journalId` facultatif, lu nu jusqu'ici.
 * Le journal d'un AUTRE dossier y passait · le filtre `{ tenantId, journalId }`
 * ne ramenait rien, et la réponse était une liste VIDE en 200, lue comme
 * « aucune écriture dans ce journal » (les modèles de saisie, eux, rendaient
 * les modèles « tous journaux » comme si le journal était celui du dossier).
 * Même cause que l'exercice (`exercice-requis.ts`), même remède, à l'entrée de
 * la route · le journal donné est lisible et du dossier de la SESSION, sinon
 * 404 nommé ; absent, il reste absent (le filtre est facultatif). La garde de
 * cloisonnement n'est pas touchée · elle refuse, elle ne réécrit pas, et une
 * requête bornée au bon dossier ne lui donne rien à refuser.
 *
 * Illisible, il est refusé en 400 nommé · comme l'exercice facultatif (audit
 * final F234, suite), « abc » ne se lit jamais comme « aucune écriture ».
 */
export const MESSAGE_JOURNAL_ILLISIBLE =
  "Le paramètre journalId, quand il est donné, doit être un identifiant de journal valide · un identifiant illisible n'est jamais lu comme un journal vide.";

/** Même forme que l'exercice · il ne dit pas si le journal existe ailleurs. */
export const MESSAGE_JOURNAL_HORS_DOSSIER = 'Journal introuvable dans ce dossier.';

const FORMAT_FACULTATIF = new ParseUUIDPipe({
  optional: true,
  exceptionFactory: () => new BadRequestException(MESSAGE_JOURNAL_ILLISIBLE),
});

@Injectable()
export class JournalFacultatifDuDossier implements PipeTransform<unknown, Promise<string | undefined>> {
  static readonly format = FORMAT_FACULTATIF;

  constructor(private readonly prisma: PrismaService) {}

  async transform(valeur: unknown, metadata: ArgumentMetadata): Promise<string | undefined> {
    const id: string | undefined = await FORMAT_FACULTATIF.transform(valeur as string, metadata);
    if (id === undefined || id === null) return id;
    const tenantId = dossierDeLaSession();
    const journal = await this.prisma.journal.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!journal) throw new NotFoundException(MESSAGE_JOURNAL_HORS_DOSSIER);
    return id;
  }
}

export const JOURNAL_FACULTATIF = JournalFacultatifDuDossier;
