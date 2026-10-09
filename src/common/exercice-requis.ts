import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  NotFoundException,
  ParseUUIDPipe,
  PipeTransform,
} from '@nestjs/common';
import { acteurCourant } from './audit/contexte-audit';
import { PrismaService } from './prisma.service';

/**
 * L'EXERCICE EXIGÉ, EN UN SEUL PORTEUR.
 *
 * Un `@Query` ou un `@Param` scalaire échappe au ValidationPipe global (il ne
 * valide que des classes), et un `exerciceId` absent arrive `undefined`
 * jusqu'à Prisma, qui IGNORE un champ `undefined` · le filtre d'exercice
 * disparaissait sans bruit, et un état, un export ou une lecture portait sur
 * TOUS les exercices du dossier en se présentant comme celui d'un seul. Un
 * état faux et non signalé, plus grave qu'une erreur (audit final F234).
 *
 * Le pipe vivait en HUIT copies · sept contrôleurs (états SYCEBNL et
 * SYSCOHADA, exports, documents obligatoires, notes annexes, registre des
 * donateurs, groupe) et le module de consolidation, qui le partageait avec
 * les états IFRS. Les sept disaient la même phrase, la huitième y ajoutait
 * son propre motif (« le périmètre, le cumul et les états se lisent par
 * exercice »). Une copie qui diverge d'un mot diverge un jour d'une règle ·
 * `exercice-requis.spec.ts` refuse désormais, route par route et sur les
 * métadonnées que Nest lit, tout `ParseUUIDPipe` posé sur un `exerciceId`
 * qui ne serait pas celui-ci.
 *
 * L'EXERCICE D'UN AUTRE DOSSIER EST INTROUVABLE (paquet 1, ligne C, point C3,
 * passe V1 n° 2). Lisible ne veut pas dire « du dossier » · un identifiant
 * bien formé d'un exercice d'un AUTRE cabinet passait le format, et chaque
 * service en faisait ce qu'il voulait · la plupart rendaient une liste vide
 * ou un état tout à zéro en 200 (le filtre `{ tenantId, exerciceId }` ne
 * ramenant rien), lu comme « rien dans cet exercice » ; quelques-uns un 400 ;
 * et `POST /provisions/:exerciceId` CRÉAIT une provision dans le dossier de la
 * session rattachée à l'exercice de l'autre (clé étrangère sans dossier,
 * vérifié en base le 2026-10-09). Rien ne fuyait, mais toutes ces réponses
 * étaient fausses, et la dernière écrivait. LA CAUSE ÉTAIT COMMUNE · tous ces
 * paramètres passent par ce porteur, qui ne vérifiait que la forme. Il
 * vérifie désormais l'appartenance, UNE fois, avant toute lecture, et rend le
 * 404 nommé. La garde de cloisonnement n'est pas touchée · elle refuse, elle
 * ne réécrit jamais une requête, et elle ne peut rien dire d'un filtre qui
 * porte le bon `tenantId` et un exercice étranger (la requête est bornée, son
 * résultat vide).
 *
 * D'où des PORTEURS INJECTABLES et non plus des instances · Nest instancie la
 * classe dans le module du contrôleur et lui donne le client Prisma (global).
 * Le dossier jugé est celui de la SESSION, lu dans le contexte que
 * l'intercepteur d'audit pose pour toute la requête (`acteurCourant`), le même
 * que celui de la garde de cloisonnement · jamais un dossier reçu du client.
 */
export const MESSAGE_EXERCICE_REQUIS =
  "Le paramètre exerciceId est requis et doit être un identifiant d'exercice valide · chaque état et chaque lecture portent sur un seul exercice.";

/**
 * L'EXERCICE FACULTATIF, ET CE QU'IL N'AUTORISE PAS.
 *
 * Quelques routes ont un sens SANS exercice · une liste de campagnes, de
 * questionnaires ou de registres, dont chaque ligne porte le sien, et le
 * journal, qui se filtre aussi par dates et dont l'export se titre alors
 * « Toutes périodes ». Absent, l'identifiant y reste absent, et c'est voulu.
 *
 * PRÉSENT ET ILLISIBLE, il y est refusé comme ailleurs (audit final F234,
 * suite) · une valeur comme « undefined », venue d'un écran qui interpole un
 * exercice pas encore choisi, filtrait sur un identifiant qui n'existe pas et
 * rendait une liste VIDE, lue comme « rien dans cet exercice ». Le message
 * n'est pas celui du porteur requis, qui dirait « requis » d'un paramètre qui
 * ne l'est pas. La liste fermée des routes qui le portent, chacune avec son
 * motif, est tenue par `exercice-requis.spec.ts`. PRÉSENT ET D'UN AUTRE
 * DOSSIER, il y est introuvable comme ailleurs (C3).
 */
export const MESSAGE_EXERCICE_ILLISIBLE =
  "Le paramètre exerciceId, quand il est donné, doit être un identifiant d'exercice valide · un identifiant illisible n'est jamais lu comme « tous les exercices » ni comme un exercice vide.";

/**
 * Le 404 d'un exercice que le dossier de la session ne porte pas. Il ne dit
 * pas « d'un autre dossier » · un identifiant inconnu partout et celui d'un
 * voisin répondent la même chose, sans quoi la réponse dirait au client qu'un
 * exercice existe ailleurs (C3).
 */
export const MESSAGE_EXERCICE_HORS_DOSSIER = 'Exercice introuvable dans ce dossier.';

const FORMAT_REQUIS = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException(MESSAGE_EXERCICE_REQUIS),
});

const FORMAT_FACULTATIF = new ParseUUIDPipe({
  optional: true,
  exceptionFactory: () => new BadRequestException(MESSAGE_EXERCICE_ILLISIBLE),
});

/**
 * Le dossier de la session, ou une PANNE · jamais un « tout est permis ».
 * Chaque route qui porte un de ces porteurs est derrière `JwtAuthGuard`
 * (`exercice-requis.spec.ts` le relit), si bien que l'intercepteur d'audit a
 * posé le contexte. Son absence est une erreur de câblage · la lire comme
 * « pas de dossier, donc pas de contrôle » rouvrirait C3 en silence, et un
 * 404 la déguiserait en donnée manquante. Un 500 la fait voir.
 */
export function dossierDeLaSession(): string {
  const tenantId = acteurCourant()?.tenantId;
  if (!tenantId) {
    throw new Error(
      "Aucun dossier de session pour juger l'appartenance d'un identifiant · la route doit être derrière JwtAuthGuard (exercice-requis.ts).",
    );
  }
  return tenantId;
}

/** L'exercice appartient au dossier de la session, ou le 404 nommé. */
export async function exigerExerciceDuDossier(prisma: PrismaService, exerciceId: string): Promise<void> {
  const tenantId = dossierDeLaSession();
  const exercice = await prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { id: true } });
  if (!exercice) throw new NotFoundException(MESSAGE_EXERCICE_HORS_DOSSIER);
}

/** L'exercice REQUIS · lisible, présent, et du dossier de la session. */
@Injectable()
export class ExerciceRequisDuDossier implements PipeTransform<unknown, Promise<string>> {
  /** Le contrôle de forme, celui d'avant C3, exposé pour être relu par les specs. */
  static readonly format = FORMAT_REQUIS;

  constructor(private readonly prisma: PrismaService) {}

  async transform(valeur: unknown, metadata: ArgumentMetadata): Promise<string> {
    const id: string = await FORMAT_REQUIS.transform(valeur as string, metadata);
    await exigerExerciceDuDossier(this.prisma, id);
    return id;
  }
}

/** L'exercice FACULTATIF · absent il reste absent ; donné, il est lisible et du dossier. */
@Injectable()
export class ExerciceFacultatifDuDossier implements PipeTransform<unknown, Promise<string | undefined>> {
  static readonly format = FORMAT_FACULTATIF;

  constructor(private readonly prisma: PrismaService) {}

  async transform(valeur: unknown, metadata: ArgumentMetadata): Promise<string | undefined> {
    const id: string | undefined = await FORMAT_FACULTATIF.transform(valeur as string, metadata);
    if (id === undefined || id === null) return id;
    await exigerExerciceDuDossier(this.prisma, id);
    return id;
  }
}

export const EXERCICE_REQUIS = ExerciceRequisDuDossier;
export const EXERCICE_FACULTATIF = ExerciceFacultatifDuDossier;

/**
 * L'EXERCICE D'UNE CELLULE DU GROUPE · la seule route où l'exercice nommé
 * n'est PAS celui du dossier de la session. Le siège lit la balance d'une de
 * ses cellules (`GET /groupe/cellules/:celluleId/balance`), et l'exercice est
 * celui de la CELLULE · le porteur du dossier le refuserait à tort. Ici, le
 * format seul ; l'appartenance de la cellule au groupe, puis de l'exercice à
 * la cellule, est jugée par `GroupeService.balanceCellule` (404 nommés). La
 * liste fermée de ses routes est tenue par `exercice-requis.spec.ts`.
 */
export const EXERCICE_D_UNE_CELLULE = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException(MESSAGE_EXERCICE_REQUIS),
});

/**
 * La même exigence au service · un appel qui ne passe pas par la route (un
 * autre module, un traitement) ne doit pas davantage mêler les exercices. Le
 * format n'y est pas revérifié, la route l'a fait · seule l'absence l'est.
 */
export function exigerExercice(exerciceId: unknown): asserts exerciceId is string {
  if (typeof exerciceId !== 'string' || exerciceId.trim() === '') throw new BadRequestException(MESSAGE_EXERCICE_REQUIS);
}
