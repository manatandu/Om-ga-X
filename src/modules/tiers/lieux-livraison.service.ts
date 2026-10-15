import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
 * la fiche elle-même, au journal d'audit ; chaque geste qui touche la marque
 * principale passe dans une transaction, sans quoi deux lieux principaux
 * pourraient coexister.
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

  private autres(tenantId: string, tiersId: string) {
    return this.prisma.lieuLivraison.findMany({
      where: { tenantId, tiersId },
      select: { id: true, intitule: true, estActif: true },
      take: LIEUX_SERVIS_PAR_CLIENT + 1,
    });
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
    const autres = await this.autres(tenantId, tiersId);
    const refus = motifRefusIntitule(intitule, autres, null);
    if (refus) throw new BadRequestException(refus);
    const actif = dto.estActif !== false;
    const principal = principalApres({
      demande: dto.estPrincipal,
      actuel: false,
      actifApres: actif,
      autresLieuxActifs: autres.filter((a) => a.estActif).length,
    });
    if ('motif' in principal) throw new BadRequestException(principal.motif);
    const donnees = Object.fromEntries(CHAMPS.map((c) => [c, coordonnee(dto[c]) ?? null]));
    return transactionJournalisee(this.prisma, async (tx) => {
      if (principal.estPrincipal) await tx.lieuLivraison.updateMany({ where: { tenantId, tiersId }, data: { estPrincipal: false } });
      return tx.lieuLivraison.create({ data: { ...donnees, intitule, tenantId, tiersId, estActif: actif, estPrincipal: principal.estPrincipal } });
    });
  }

  async modifier(tenantId: string, id: string, dto: LieuLivraisonDto) {
    const lieu = await this.trouver(tenantId, id);
    const intitule = intituleDuLieu(dto.intitule);
    const autres = await this.autres(tenantId, lieu.tiersId);
    const refus = motifRefusIntitule(intitule, autres, lieu.id);
    if (refus) throw new BadRequestException(refus);
    const actif = dto.estActif ?? lieu.estActif;
    const principal = principalApres({
      demande: dto.estPrincipal,
      actuel: lieu.estPrincipal,
      actifApres: actif,
      autresLieuxActifs: autres.filter((a) => a.id !== lieu.id && a.estActif).length,
    });
    if ('motif' in principal) throw new BadRequestException(principal.motif);
    const donnees = Object.fromEntries(CHAMPS.flatMap((c) => (coordonnee(dto[c]) === undefined ? [] : [[c, coordonnee(dto[c])]])));
    return transactionJournalisee(this.prisma, async (tx) => {
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
