import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NatureExtraitPeriode, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma.service';
import { transactionJournalisee } from '../../../common/audit/transaction-journalisee';
import { jourFr, type PeriodeExtrait } from '../../comptabilite/periode-extrait';
import { HORS_SITUATION } from '../../comptabilite/ecritures-de-situation';

/**
 * LES EXTRAITS DE PÉRIODE, NUMÉROTÉS ET DATÉS (ligne export-periode, condition
 * 3 · AUDCIF art. 22, 7°, « les états périodiques fournis soient numérotés et
 * datés »). Une balance ou un grand livre lu sur une période de l'exercice
 * prend un numéro de la suite continue du dossier quand il est REMIS · le
 * fichier Excel produit. La balance et le livre de l'exercice entier n'en
 * prennent pas · rien ne change pour eux. L'écran montre la période sans la
 * numéroter · ce qui se remet est le fichier (retrait d'« Imprimer
 * l'extrait », décision de Manasse du 2026-10-16, fonction non demandée).
 *
 * LE NUMÉRO SE PREND AU DERNIER MOMENT · après les refus (volume, période),
 * juste avant le premier octet, comme l'export des modifications qui ne
 * numérote jamais un export vide (sage-l7). Un fichier qui s'interrompt ensuite
 * GARDE son numéro, et l'échec est écrit sur l'extrait · rendu au suivant, le
 * numéro porterait deux documents.
 */
export interface ExtraitNumerote {
  numero: number;
  etabliLe: Date;
  periode: PeriodeExtrait;
}

export interface DemandeExtrait {
  tenantId: string;
  nature: NatureExtraitPeriode;
  /** Ce que l'extrait porte, en clair · « Balance des comptes », « Grand livre du compte 52110000 · Banque ». */
  libelle: string;
  periode: PeriodeExtrait;
  etabliPar: string;
}

/** Le motif d'un fichier interrompu, borné · le message de l'erreur, jamais une pile. */
export function motifInterruption(e: unknown): string {
  const brut = e instanceof Error ? e.message : String(e);
  return `Production interrompue · ${brut}`.slice(0, 500);
}

@Injectable()
export class ExtraitsPeriodeService {
  private readonly logger = new Logger(ExtraitsPeriodeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * NUMÉROTE UN EXTRAIT · le numéro suit le dernier du dossier, sous un verrou
   * par dossier dans la transaction · deux extraits simultanés ne prennent
   * jamais le même numéro (la contrainte d'unicité le refuserait, mais en
   * erreur au lieu d'attendre).
   */
  async numeroter(d: DemandeExtrait): Promise<ExtraitNumerote & { id: string }> {
    const cree = await transactionJournalisee(this.prisma, async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`extraits-periode:${d.tenantId}`}))`;
      const max = await tx.extraitPeriode.aggregate({ where: { tenantId: d.tenantId }, _max: { numero: true } });
      return tx.extraitPeriode.create({
        data: {
          tenantId: d.tenantId,
          numero: (max._max.numero ?? 0) + 1,
          nature: d.nature,
          libelle: d.libelle,
          dateDebut: d.periode.du,
          dateFin: d.periode.au,
          etabliPar: d.etabliPar,
          // Un fichier n'est remis qu'à son dernier octet · `produire` pose
          // la fin, ou l'échec.
          termineLe: null,
        },
        // AUCUN `select` · le journal d'audit range le résultat de la création
        // comme état d'après (relecture TypeScript M1) ; réduit à trois
        // colonnes, il tairait libellé, nature et dates, et une
        // retouche après coup ne se verrait plus.
      });
    });
    return { id: cree.id, numero: cree.numero, etabliLe: cree.etabliLe, periode: d.periode };
  }

  /**
   * PRODUIT UN FICHIER NUMÉROTÉ · `travail` reçoit de quoi prendre le numéro,
   * et l'appelle une fois ses refus passés. Fini, l'extrait est marqué
   * terminé ; interrompu, son échec est écrit et l'erreur d'origine remonte.
   * Une marque manquée est CONSIGNÉE, jamais substituée à l'issue du fichier
   * (le fichier parti l'est, l'erreur d'origine reste celle qu'on voit).
   */
  async produire<T>(d: DemandeExtrait, travail: (numeroter: () => Promise<ExtraitNumerote>) => Promise<T>): Promise<T> {
    let id: string | null = null;
    const numeroter = async (): Promise<ExtraitNumerote> => {
      if (id) throw new Error('Un extrait de période ne se numérote qu’une fois.');
      const e = await this.numeroter(d);
      id = e.id;
      return e;
    };
    let resultat: T;
    try {
      resultat = await travail(numeroter);
    } catch (e) {
      if (id) {
        await this.prisma.extraitPeriode
          .update({ where: { id }, data: { motifEchec: motifInterruption(e) } })
          .catch((err: unknown) =>
            this.logger.error(`Extrait de période ${id} · interruption non écrite (${err instanceof Error ? err.message : String(err)})`),
          );
      }
      throw e;
    }
    if (id) {
      await this.prisma.extraitPeriode
        .update({ where: { id }, data: { termineLe: new Date() } })
        .catch((err: unknown) =>
          this.logger.error(`Extrait de période ${id} · fichier remis, fin non écrite (${err instanceof Error ? err.message : String(err)})`),
        );
    }
    return resultat;
  }

  /**
   * UN EXTRAIT VIDE NE PREND PAS DE NUMÉRO (relecture « échecs silencieux »
   * m3) · aucune ligne de l'exercice datée au plus tard le dernier jour, ni
   * report ni mouvement, rien à remettre · un numéro consommé pour une page
   * vide ferait un trou dans la suite qui ne s'expliquerait par rien. Le
   * livre-journal et le brouillard, jamais une écriture de situation, comme
   * la balance et les livres.
   */
  async refuserSiVide(tenantId: string, exerciceId: string, periode: PeriodeExtrait, compteId?: string): Promise<void> {
    const lignes = await this.prisma.ligneEcriture.count({
      where: {
        ...(compteId ? { compteId } : {}),
        ecriture: { tenantId, exerciceId, ...HORS_SITUATION, date: { lt: periode.finExclue } },
      },
    });
    if (lignes === 0) {
      throw new BadRequestException(
        `Aucune écriture jusqu'au ${jourFr(periode.au)}${compteId ? ' sur ce compte' : ''} · ni report ni mouvement, rien à numéroter.`,
      );
    }
  }

  /** Ce que l'extrait porte, en clair · le compte relu dans le dossier (404 nommé sinon). */
  async libelleDe(
    tenantId: string,
    nature: NatureExtraitPeriode,
    o: { compteId?: string; avecGrandsLivres?: boolean } = {},
  ): Promise<string> {
    if (nature === NatureExtraitPeriode.BALANCE) {
      return o.avecGrandsLivres ? 'Balance des comptes, avec le grand livre de chaque compte' : 'Balance des comptes';
    }
    if (!o.compteId) return 'Grand livre des comptes';
    const compte = await this.prisma.compte.findFirst({ where: { id: o.compteId, tenantId }, select: { numero: true, intitule: true } });
    if (!compte) throw new NotFoundException('Compte introuvable dans ce dossier.');
    return `Grand livre du compte ${compte.numero} · ${compte.intitule}`;
  }
}
