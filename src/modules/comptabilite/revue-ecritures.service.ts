import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StatutEcriture } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';

/**
 * LA REVUE DES ÉCRITURES PAR LE CABINET (ligne gl-saisie, fonction 64 · Sage
 * i7, registre et filtres de révision). Voir le modèle `RevueEcriture`.
 *
 * MARQUER ÉCARTE, IL NE JETTE PAS · un lot du journal peut mêler des pièces
 * validées et du brouillard. Les validées sont revues ; le brouillard est
 * écarté et compté (sa pièce change encore), comme la validation par période
 * écarte ce que le double regard refuse. Une pièce déjà revue garde sa
 * première revue · l'auteur et la date d'origine ne se réécrivent pas.
 *
 * Revoir est le geste du COMPTABLE (`@ReserveAuComptable` au contrôleur) ·
 * c'est un jugement porté sur la pièce, comme la valider.
 */
export const PLAFOND_REVUE_PAR_LOT = 500;
export const LONGUEUR_COMMENTAIRE_REVUE = 500;

export interface BilanRevue {
  revues: number;
  dejaRevues: number;
  /** Les pièces écartées, nommées par leur numéro, et pourquoi. */
  ecartees: { ecritureId: string; numeroPiece: number | null; motif: string }[];
}

@Injectable()
export class RevueEcrituresService {
  constructor(private readonly prisma: PrismaService) {}

  async marquer(tenantId: string, auteur: string, ecritureIds: string[], commentaire?: string): Promise<BilanRevue> {
    const ids = [...new Set(ecritureIds)];
    if (ids.length === 0) throw new BadRequestException('Aucune écriture à marquer revue.');
    if (ids.length > PLAFOND_REVUE_PAR_LOT) {
      throw new BadRequestException(`Au plus ${PLAFOND_REVUE_PAR_LOT} écritures par lot · découpez la sélection.`);
    }
    const note = commentaire?.trim() || null;
    if (note && note.length > LONGUEUR_COMMENTAIRE_REVUE) {
      throw new BadRequestException(`Le commentaire de revue tient en ${LONGUEUR_COMMENTAIRE_REVUE} caractères au plus.`);
    }
    return transactionJournalisee(this.prisma, async (tx) => {
      // Deux lectures, chacune avec son statut · les validées se revoient, les
      // autres (brouillard, situation) sont écartées et nommées.
      const [validees, autres] = await Promise.all([
        tx.ecriture.findMany({
          where: { tenantId, id: { in: ids }, statut: StatutEcriture.VALIDEE },
          select: { id: true, revue: { select: { id: true } } },
        }),
        tx.ecriture.findMany({
          where: { tenantId, id: { in: ids }, statut: { not: StatutEcriture.VALIDEE } },
          select: { id: true, numeroPiece: true, statut: true },
        }),
      ]);
      // Une écriture d'un autre dossier n'existe pas ici · le lot entier est refusé,
      // jamais marqué à moitié en silence.
      if (validees.length + autres.length !== ids.length) throw new NotFoundException('Écriture introuvable pour ce dossier.');
      const bilan: BilanRevue = { revues: 0, dejaRevues: 0, ecartees: [] };
      for (const e of autres) {
        bilan.ecartees.push({
          ecritureId: e.id,
          numeroPiece: e.numeroPiece,
          motif:
            e.statut === StatutEcriture.SITUATION
              ? 'écriture de situation · une simulation ne se révise pas'
              : 'au brouillard · la pièce change encore, validez-la avant de la marquer revue',
        });
      }
      for (const e of validees) {
        if (e.revue) {
          bilan.dejaRevues++;
          continue;
        }
        // UNE CRÉATION PAR ÉCRITURE, au journal d'audit · jamais un `createMany`,
        // qui n'y laisserait qu'un nombre.
        await tx.revueEcriture.create({ data: { tenantId, ecritureId: e.id, revuePar: auteur, commentaire: note } });
        bilan.revues++;
      }
      return bilan;
    });
  }

  async retirer(tenantId: string, ecritureId: string) {
    return transactionJournalisee(this.prisma, async (tx) => {
      const revue = await tx.revueEcriture.findFirst({ where: { tenantId, ecritureId }, select: { id: true } });
      if (!revue) throw new NotFoundException("Cette écriture n'est pas marquée revue.");
      // Un retrait UNITAIRE par l'identifiant · le journal d'audit garde qui
      // l'avait posée, quand, et qui l'a retirée.
      await tx.revueEcriture.delete({ where: { id: revue.id } });
      return { retiree: true };
    });
  }
}
