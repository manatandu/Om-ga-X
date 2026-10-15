import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { referencesVers, refuserSiReferences } from '../../common/suppression/references';
import { LieuLivraisonDto } from './dto/lieux-livraison.dto';
import { intituleDuLieu, LIEUX_SERVIS_PAR_CLIENT, motifRefusIntitule, motifRefusTypeLieu, principalApres } from './lieux-livraison';

const CHAMPS = ['adresse', 'complement', 'boitePostale', 'ville', 'pays', 'contact', 'telephone', 'email'] as const;
/** Une coordonnée · vide efface, absente ne change rien. */
const coordonnee = (v: string | null | undefined) => (v === undefined ? undefined : v === null || v.trim() === '' ? null : v.trim());

/**
 * LIEUX DE LIVRAISON DES CLIENTS (ligne sage-l2, fonction 31) · voir
 * `lieux-livraison.ts`. Structure du tiers, écrite par l'administrateur comme
 * la fiche elle-même, au journal d'audit.
 *
 * LE GESTE SE JUGE SOUS LE VERROU DU CLIENT (relecture « échecs silencieux »
 * de la ligne sage-l2, m8) · la marque principale et l'unicité de l'intitulé
 * étaient jugées hors de la transaction, sur une tranche de 201 lieux · deux
 * créations simultanées posaient deux principaux ou deux lieux de même nom,
 * et le 202e homonyme passait. Création et modification prennent un verrou
 * consultatif par client DANS leur transaction (comme les modes de
 * règlement), relisent le lieu, cherchent l'homonyme par une requête ciblée
 * et comptent les autres lieux actifs, puis écrivent.
 */
@Injectable()
export class LieuxLivraisonService {
  constructor(private readonly prisma: PrismaService) {}

  private async clientDuDossier(tenantId: string, tiersId: string) {
    const tiers = await this.prisma.tiers.findFirst({ where: { id: tiersId, tenantId }, select: { id: true, type: true } });
    if (!tiers) throw new NotFoundException('Tiers introuvable pour ce dossier.');
    return tiers;
  }

  private async trouver(tenantId: string, id: string) {
    const lieu = await this.prisma.lieuLivraison.findFirst({ where: { id, tenantId } });
    if (!lieu) throw new NotFoundException('Lieu de livraison introuvable pour ce dossier.');
    return lieu;
  }

  /** Le verrou du client, tenu jusqu'à la fin de la transaction. */
  private async verrouillerLeClient(tx: Prisma.TransactionClient, tenantId: string, tiersId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`lieux-livraison:${tenantId}:${tiersId}`}))`;
  }

  /**
   * L'intitulé et la marque jugés dans la transaction · l'homonyme cherché par
   * une requête CIBLÉE (sans égard à la casse, puis confirmé par la règle
   * pure, un `_` ou un `%` de l'intitulé ne faisant qu'élargir la lecture),
   * les autres lieux actifs comptés, jamais lus sur une tranche.
   */
  private async jugerLeGeste(tx: Prisma.TransactionClient, tenantId: string, tiersId: string, intitule: string, idCourant: string | null) {
    const sauf = idCourant ? { NOT: { id: idCourant } } : {};
    const homonymes = await tx.lieuLivraison.findMany({
      where: { tenantId, tiersId, intitule: { equals: intitule, mode: 'insensitive' }, ...sauf },
      select: { id: true, intitule: true },
      take: 50,
    });
    const refus = motifRefusIntitule(intitule, homonymes, idCourant);
    if (refus) throw new BadRequestException(refus);
    return tx.lieuLivraison.count({ where: { tenantId, tiersId, estActif: true, ...sauf } });
  }

  /** Les lieux du client, le principal d'abord · bornés, et la borne se dit. */
  async lister(tenantId: string, tiersId: string) {
    await this.clientDuDossier(tenantId, tiersId);
    const [lieux, total] = await Promise.all([
      this.prisma.lieuLivraison.findMany({
        where: { tenantId, tiersId },
        orderBy: [{ estPrincipal: 'desc' }, { estActif: 'desc' }, { createdAt: 'asc' }],
        take: LIEUX_SERVIS_PAR_CLIENT,
      }),
      this.prisma.lieuLivraison.count({ where: { tenantId, tiersId } }),
    ]);
    return { lieux, total, tronque: total > lieux.length };
  }

  async creer(tenantId: string, tiersId: string, dto: LieuLivraisonDto) {
    const tiers = await this.clientDuDossier(tenantId, tiersId);
    const refusType = motifRefusTypeLieu(tiers.type);
    if (refusType) throw new BadRequestException(refusType);
    const intitule = intituleDuLieu(dto.intitule);
    // Vide ou trop long se refuse avant toute transaction.
    const refusForme = motifRefusIntitule(intitule, [], null);
    if (refusForme) throw new BadRequestException(refusForme);
    const actif = dto.estActif !== false;
    const donnees = Object.fromEntries(CHAMPS.map((c) => [c, coordonnee(dto[c]) ?? null]));
    return transactionJournalisee(this.prisma, async (tx) => {
      await this.verrouillerLeClient(tx, tenantId, tiersId);
      const autresLieuxActifs = await this.jugerLeGeste(tx, tenantId, tiersId, intitule, null);
      const principal = principalApres({ demande: dto.estPrincipal, actuel: false, actifApres: actif, autresLieuxActifs });
      if ('motif' in principal) throw new BadRequestException(principal.motif);
      if (principal.estPrincipal) await tx.lieuLivraison.updateMany({ where: { tenantId, tiersId }, data: { estPrincipal: false } });
      return tx.lieuLivraison.create({ data: { ...donnees, intitule, tenantId, tiersId, estActif: actif, estPrincipal: principal.estPrincipal } });
    });
  }

  async modifier(tenantId: string, id: string, dto: LieuLivraisonDto) {
    const trouve = await this.trouver(tenantId, id);
    const intitule = intituleDuLieu(dto.intitule);
    const refusForme = motifRefusIntitule(intitule, [], trouve.id);
    if (refusForme) throw new BadRequestException(refusForme);
    const donnees = Object.fromEntries(CHAMPS.flatMap((c) => (coordonnee(dto[c]) === undefined ? [] : [[c, coordonnee(dto[c])]])));
    return transactionJournalisee(this.prisma, async (tx) => {
      await this.verrouillerLeClient(tx, tenantId, trouve.tiersId);
      // RELU SOUS LE VERROU · un geste concurrent a pu lui retirer la marque
      // ou le retirer.
      const lieu = await tx.lieuLivraison.findFirst({ where: { id: trouve.id, tenantId } });
      if (!lieu) throw new NotFoundException('Lieu de livraison introuvable pour ce dossier.');
      const autresLieuxActifs = await this.jugerLeGeste(tx, tenantId, lieu.tiersId, intitule, lieu.id);
      const actif = dto.estActif ?? lieu.estActif;
      const principal = principalApres({ demande: dto.estPrincipal, actuel: lieu.estPrincipal, actifApres: actif, autresLieuxActifs });
      if ('motif' in principal) throw new BadRequestException(principal.motif);
      if (principal.estPrincipal && !lieu.estPrincipal) {
        await tx.lieuLivraison.updateMany({ where: { tenantId, tiersId: lieu.tiersId }, data: { estPrincipal: false } });
      }
      return tx.lieuLivraison.update({ where: { id: lieu.id }, data: { ...donnees, intitule, estActif: actif, estPrincipal: principal.estPrincipal } });
    });
  }

  /**
   * Retiré seulement si rien ne le porte (relations lues dans le schéma) ·
   * un document qui l'aurait recopié le retiendrait, renvoi à la mise en
   * sommeil. Retirer le principal laisse le client sans principal.
   */
  async supprimer(tenantId: string, id: string) {
    const lieu = await this.trouver(tenantId, id);
    refuserSiReferences(`Le lieu de livraison « ${lieu.intitule} »`, await referencesVers(this.prisma, 'LieuLivraison', lieu.id, tenantId));
    await this.prisma.lieuLivraison.delete({ where: { id: lieu.id } });
    return { supprime: true };
  }
}
