import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { transactionJournalisee } from '../audit/transaction-journalisee';
import {
  LONGUEUR_MAX_COMMENTAIRE,
  decoderNomMultipart,
  empreinteDocument,
  identifierType,
  motifRefusDocument,
  nettoyerNomFichier,
} from './pieces-jointes';
import {
  LecteurDesPieces,
  ObjetDesPieces,
  ObjetLu,
  PLAFOND_PIECES_PAR_LISTE,
  RegleDesPieces,
  TABLES_DES_PIECES,
} from './table-des-pieces';

/**
 * Ce qu'une LISTE rend d'une pièce · jamais `contenu`. Un objet qui porte dix
 * scans de 5 Mo ferait sinon transiter 50 Mo pour afficher dix lignes. La
 * pièce elle-même ne sort que par `telecharger`, une à la fois.
 */
const SANS_CONTENU = {
  id: true,
  nomFichier: true,
  typeMime: true,
  taille: true,
  empreinte: true,
  commentaire: true,
  deposePar: true,
  createdAt: true,
} as const;

export interface PieceListee {
  id: string;
  nomFichier: string;
  typeMime: string;
  taille: number;
  empreinte: string;
  commentaire: string | null;
  deposePar: string | null;
  createdAt: Date;
}

/** Les quatre opérations que le service demande à une table de pièces. */
interface DelegueDesPieces {
  findMany(a: object): Promise<PieceListee[]>;
  findFirst(a: object): Promise<Record<string, unknown> | null>;
  count(a: object): Promise<number>;
  update(a: object): Promise<PieceListee>;
  delete(a: object): Promise<unknown>;
}

export interface FichierRecu {
  originalname: string;
  buffer: Buffer;
}

/**
 * LES PIÈCES JOINTES · le mécanisme commun (ligne sage-l6, fonction n° 22).
 *
 * Chaque objet l'emploie depuis SON contrôleur, avec SA règle
 * (`RegleDesPieces`) · le service ne sait ni ce qu'est une écriture validée ni
 * ce qu'est un salarié, il sait garder une pièce, la rendre, et demander à la
 * règle si l'objet existe, si l'on peut y déposer, si l'on peut en retirer.
 */
@Injectable()
export class PiecesJointesService {
  constructor(private readonly prisma: PrismaService) {}

  private delegue(db: LecteurDesPieces, objet: ObjetDesPieces): DelegueDesPieces {
    return (db as unknown as Record<string, DelegueDesPieces>)[TABLES_DES_PIECES[objet].delegue];
  }

  private async objetDuDossier(db: LecteurDesPieces, tenantId: string, regle: RegleDesPieces, objetId: string) {
    const objet = await regle.lireObjet(db, tenantId, objetId);
    if (!objet) throw new NotFoundException(`${majuscule(regle.designation)} introuvable pour ce dossier.`);
    return objet;
  }

  /**
   * Les pièces d'un objet, les plus récentes d'abord, bornées et dites
   * tronquées au-delà · avec ce que l'objet permet (déposer, retirer), que
   * l'écran lit au lieu de le recalculer.
   */
  async lister(tenantId: string, regle: RegleDesPieces, objetId: string) {
    const objet = await this.objetDuDossier(this.prisma, tenantId, regle, objetId);
    const where = { tenantId, [TABLES_DES_PIECES[regle.objet].colonne]: objetId };
    const table = this.delegue(this.prisma, regle.objet);
    const [pieces, total] = await Promise.all([
      table.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: PLAFOND_PIECES_PAR_LISTE, select: SANS_CONTENU }),
      table.count({ where }),
    ]);
    // Hors du périmètre de l'acteur, ni dépôt ni retrait · le motif le dit,
    // et l'écran ferme les deux gestes au lieu d'attendre le 403.
    const horsPerimetre = objet.motifHorsPerimetre ?? null;
    const depot = horsPerimetre ?? objet.motifRefusDepot;
    const retrait = horsPerimetre ?? objet.motifRefusRetrait;
    return {
      description: objet.description,
      pieces,
      total,
      tronque: total > pieces.length,
      depot: { permis: depot === null, motif: depot },
      retrait: { permis: retrait === null, motif: retrait },
    };
  }

  /** Le dépôt · tous les refus de la pièce, puis ceux de l'objet, avant toute écriture. */
  async deposer(
    tenantId: string,
    regle: RegleDesPieces,
    objetId: string,
    fichier: FichierRecu | undefined,
    commentaire: string | null | undefined,
    auteur: string,
  ): Promise<PieceListee> {
    const objet = await this.objetDuDossier(this.prisma, tenantId, regle, objetId);
    if (objet.motifHorsPerimetre) throw new ForbiddenException(objet.motifHorsPerimetre);
    if (objet.motifRefusDepot) throw new BadRequestException(objet.motifRefusDepot);
    if (!fichier) throw new BadRequestException('Aucun fichier reçu.');
    // Multer lit le nom en latin1 · voir `decoderNomMultipart`.
    const nomRecu = decoderNomMultipart(fichier.originalname);
    const refus = motifRefusDocument({ nom: nomRecu, contenu: fichier.buffer, commentaire });
    if (refus) throw new BadRequestException(refus);
    const nomFichier = nettoyerNomFichier(nomRecu);
    const type = identifierType(fichier.buffer, nomFichier);
    if ('refus' in type) throw new BadRequestException(type.refus);
    const commun = {
      tenantId,
      nomFichier,
      typeMime: type.typeMime,
      taille: fichier.buffer.length,
      empreinte: empreinteDocument(fichier.buffer),
      commentaire: commentaire?.trim() || null,
      contenu: fichier.buffer,
      deposePar: auteur,
    };
    try {
      return await this.creer(regle.objet, objetId, objet.description, commun);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Ce fichier est déjà joint à ${regle.designation} (même contenu).`);
      }
      // L'objet retiré entre la lecture et le dépôt · la clé étrangère refuse.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException(`${majuscule(regle.designation)} a été retiré pendant le dépôt · rien n'a été joint. Rechargez.`);
      }
      throw e;
    }
  }

  /**
   * L'ÉCRITURE DE LA PIÈCE, UNE TABLE PAR OBJET, la colonne de l'objet nommée
   * en toutes lettres · `liaisons-ecriture-ecrites.spec.ts` exige qu'une
   * colonne de liaison vers une écriture soit écrite quelque part. LE `select`
   * EST AUSSI CE QUE LE JOURNAL D'AUDIT GARDE du dépôt (son `apres` est le
   * résultat de l'écriture) · sans la colonne de l'objet, le maillon disait
   * qu'une pièce avait été jointe sans dire à quoi (relecture de la ligne
   * sage-l6, M1). Jamais `contenu`, exclu du journal.
   */
  private creer(
    objet: ObjetDesPieces,
    objetId: string,
    description: string,
    commun: Omit<Prisma.PieceJointeSectionUncheckedCreateInput, 'sectionId'>,
  ): Promise<PieceListee> {
    switch (objet) {
      case 'ECRITURE':
        // LA DESCRIPTION EST FIGÉE AU DÉPÔT · une écriture retirée au
        // brouillard laisse sa pièce détachée, et c'est par elle qu'on sait
        // encore ce qu'elle justifiait.
        return this.prisma.pieceJointeEcriture.create({
          data: { ...commun, ecritureId: objetId, ecritureDecrite: description },
          select: { ...SANS_CONTENU, ecritureId: true, ecritureDecrite: true },
        });
      case 'SECTION':
        return this.prisma.pieceJointeSection.create({
          data: { ...commun, sectionId: objetId },
          select: { ...SANS_CONTENU, sectionId: true },
        });
      case 'IMMOBILISATION':
        return this.prisma.pieceJointeImmobilisation.create({
          data: { ...commun, immobilisationId: objetId },
          select: { ...SANS_CONTENU, immobilisationId: true },
        });
      case 'SALARIE':
        return this.prisma.pieceJointeSalarie.create({
          data: { ...commun, salarieId: objetId },
          select: { ...SANS_CONTENU, salarieId: true },
        });
    }
  }

  /** La seule lecture qui porte `contenu` · une pièce, de cet objet, du dossier de la session. */
  async telecharger(tenantId: string, objet: ObjetDesPieces, id: string) {
    const piece = (await this.delegue(this.prisma, objet).findFirst({
      where: { id, tenantId },
      select: { nomFichier: true, typeMime: true, contenu: true },
    })) as { nomFichier: string; typeMime: string; contenu: Uint8Array } | null;
    if (!piece) throw new NotFoundException('Pièce introuvable pour ce dossier.');
    return piece;
  }

  /**
   * Le commentaire · une annotation d'OmegaX, ni la pièce ni l'écriture
   * qu'elle justifie · il se retouche donc à tout moment, au journal d'audit.
   */
  async modifierCommentaire(tenantId: string, objet: ObjetDesPieces, id: string, commentaire: string | null | undefined) {
    const texte = (commentaire ?? '').trim();
    if (texte.length > LONGUEUR_MAX_COMMENTAIRE) {
      throw new BadRequestException(`Le commentaire dépasse ${LONGUEUR_MAX_COMMENTAIRE} caractères (${texte.length}).`);
    }
    const table = this.delegue(this.prisma, objet);
    const piece = await table.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!piece) throw new NotFoundException('Pièce introuvable pour ce dossier.');
    try {
      return await table.update({ where: { id }, data: { commentaire: texte || null }, select: SANS_CONTENU });
    } catch (e) {
      // Retirée entre la lecture et la mise à jour (mineur 4 de la relecture) ·
      // un refus nommé, jamais une erreur technique.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw new ConflictException(MOTIF_PIECE_RETIREE);
      throw e;
    }
  }

  /**
   * LE RETRAIT, JUGÉ PAR LA RÈGLE DE L'OBJET DANS LA TRANSACTION QUI RETIRE ·
   * la règle pose son verrou d'abord (l'écriture qu'une validation pourrait
   * faire entrer au livre-journal entre la lecture et le retrait), puis dit
   * si la pièce peut partir. Une pièce DÉTACHÉE (objet retiré au brouillard)
   * n'a plus d'objet pour la retenir.
   *
   * UNE À UNE, PAR IDENTIFIANT · le journal d'audit ne garde la pré-image que
   * d'une suppression unitaire ; un `deleteMany` n'y laisserait que filtre et
   * compte.
   */
  async retirer(tenantId: string, regle: RegleDesPieces, id: string) {
    const colonne = TABLES_DES_PIECES[regle.objet].colonne;
    await transactionJournalisee(this.prisma, async (tx) => {
      const table = this.delegue(tx, regle.objet);
      const piece = await table.findFirst({ where: { id, tenantId }, select: { id: true, [colonne]: true } });
      if (!piece) throw new NotFoundException('Pièce introuvable pour ce dossier.');
      const objetId = piece[colonne] as string | null;
      let objet: ObjetLu | null = null;
      if (objetId) {
        if (regle.verrouiller) await regle.verrouiller(tx, tenantId, objetId);
        // RELUE APRÈS LE VERROU (second tour de relecture, mineur 1) · un
        // report l'a pu déplacer vers l'écriture qui remplace, une suppression
        // l'a pu détacher, entre la première lecture et le verrou. Déplacée,
        // elle se juge sur l'autre objet · le geste s'arrête et le dit ;
        // détachée, elle suit la règle de la pièce détachée.
        const relue = await table.findFirst({ where: { id, tenantId }, select: { id: true, [colonne]: true } });
        if (!relue) throw new ConflictException(MOTIF_PIECE_RETIREE);
        const maintenant = relue[colonne] as string | null;
        if (maintenant !== null && maintenant !== objetId) {
          throw new ConflictException(
            "Cette pièce a été reportée ailleurs pendant le retrait (ce qui la portait a été remplacé) · rien n'est retiré, rechargez la liste.",
          );
        }
        if (maintenant !== null) objet = await regle.lireObjet(tx, tenantId, objetId);
      }
      if (objet) {
        if (objet.motifHorsPerimetre) throw new ForbiddenException(objet.motifHorsPerimetre);
        if (objet.motifRefusRetrait) throw new ConflictException(objet.motifRefusRetrait);
      } else {
        // Détachée (dès le départ, ou pendant le geste), ou son objet disparu.
        const horsPerimetre = regle.motifHorsPerimetreDetachee?.() ?? null;
        if (horsPerimetre) throw new ForbiddenException(horsPerimetre);
      }
      try {
        // Jamais le binaire en retour.
        await table.delete({ where: { id }, select: { id: true } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw new ConflictException(MOTIF_PIECE_RETIREE);
        throw e;
      }
    });
    return { retire: true };
  }

  /**
   * LES PIÈCES DÉTACHÉES · jointes à une écriture retirée depuis au
   * brouillard. Elles ne se perdent pas (AUDCIF art. 24) · elles se lisent
   * ici, avec ce qu'elles justifiaient au dépôt, se téléchargent pour être
   * jointes à l'écriture ressaisie, et se retirent.
   */
  async listerDetachees(tenantId: string) {
    const [pieces, total] = await Promise.all([
      this.prisma.pieceJointeEcriture.findMany({
        where: { tenantId, ecritureId: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: PLAFOND_PIECES_PAR_LISTE,
        select: { ...SANS_CONTENU, ecritureDecrite: true },
      }),
      this.prisma.pieceJointeEcriture.count({ where: { tenantId, ecritureId: null } }),
    ]);
    return { pieces, total, tronque: total > pieces.length };
  }

  /**
   * LE NOMBRE DE PIÈCES PAR ÉCRITURE D'UN EXERCICE · un regroupement en base,
   * pour que la saisie et le journal disent quelle écriture en porte sans
   * rapatrier une pièce. Borné · au-delà, la réponse le dit et l'écran ne
   * montre que ce qu'elle porte (la liste de l'écriture reste exacte).
   */
  async decompteParEcriture(tenantId: string, exerciceId: string) {
    const PLAFOND = 20_000;
    const groupes = await this.prisma.pieceJointeEcriture.groupBy({
      by: ['ecritureId'],
      where: { tenantId, ecriture: { is: { tenantId, exerciceId } } },
      _count: { _all: true },
      orderBy: { ecritureId: 'asc' },
      take: PLAFOND + 1,
    });
    const retenus = groupes.slice(0, PLAFOND);
    return {
      parEcriture: Object.fromEntries(retenus.filter((g) => g.ecritureId).map((g) => [g.ecritureId as string, g._count._all])),
      tronque: groupes.length > PLAFOND,
    };
  }
}

/** Une pièce retirée par un autre geste entre la lecture et l'écriture · dit, jamais une erreur technique. */
export const MOTIF_PIECE_RETIREE = 'Cette pièce a été retirée par un autre geste pendant le vôtre · rechargez la liste.';

function majuscule(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}
