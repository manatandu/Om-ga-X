import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModePaiementSalaire } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { normaliserIban } from '../banques/banques';
import { coordonneesImprimees, motifRefusRibTiers } from '../tiers/ribs-tiers';
import { RibTiersDto } from '../tiers/dto/ribs-tiers.dto';
import { courrielsDesAuteurs } from '../tiers/ribs-tiers.service';
import {
  AVERTISSEMENT_AUTEUR_INCONNU,
  MOTIF_VISA_PAR_SON_AUTEUR,
  auteursDesVisas,
  coordonneesChangees,
  motifRefusVisa,
  presenterVisa,
  saisieDesCoordonnees,
} from '../tiers/visa-rib';

const nul = (v: string | undefined) => (v === undefined || v.trim() === '' ? null : v.trim());

/** Au plus autant de RIB lus par salarié · au-delà, la liste le dit. */
export const PLAFOND_RIBS_SALARIE = 20;

/**
 * LIGNE SAGE-L5, FONCTION 75 · LE PAIEMENT DU SALARIÉ, côté registre · son
 * mode de paiement convenu (Code du travail, art. 98, al. 2) et ses
 * coordonnées bancaires.
 *
 * LES COORDONNÉES SONT UNE STRUCTURE, comme les RIB des tiers
 * (tiers/ribs-tiers.ts) · écrites par l'administrateur seul (contrôleur) et
 * au journal d'audit, puisqu'un RIB modifié en silence détourne un salaire.
 * Mêmes règles de saisie, une seule écriture de la règle
 * (`motifRefusRibTiers`), un PRINCIPAL par salarié, le premier d'office ·
 * retirer le principal n'en désigne aucun autre, choisir le compte où part le
 * prochain salaire étant une décision.
 */
@Injectable()
export class RibsSalariesService {
  constructor(private readonly prisma: PrismaService) {}

  private async salarie(tenantId: string, salarieId: string) {
    const s = await this.prisma.salarie.findFirst({ where: { id: salarieId, tenantId }, select: { id: true, modePaiement: true } });
    if (!s) throw new NotFoundException('Salarié introuvable dans ce dossier.');
    return s;
  }

  private async trouver(tenantId: string, id: string) {
    const rib = await this.prisma.ribSalarie.findFirst({ where: { id, tenantId } });
    if (!rib) throw new NotFoundException('RIB introuvable pour ce dossier.');
    return rib;
  }

  private donnees(dto: RibTiersDto) {
    const iban = nul(dto.iban);
    const donnees = {
      banque: dto.banque.trim(),
      titulaire: nul(dto.titulaire),
      codeBanque: nul(dto.codeBanque),
      codeGuichet: nul(dto.codeGuichet),
      numeroCompte: nul(dto.numeroCompte),
      cle: nul(dto.cle),
      iban: iban ? normaliserIban(iban) : null,
      codeBic: nul(dto.codeBic)?.toUpperCase() ?? null,
      devise: nul(dto.devise)?.toUpperCase() ?? null,
      commentaire: nul(dto.commentaire),
    };
    const refus = motifRefusRibTiers(donnees);
    if (refus) throw new BadRequestException(refus.replace('du tiers', 'du salarié'));
    return donnees;
  }

  /** Le mode convenu et les RIB, principal d'abord · les coordonnées telles que l'ordre les imprime. */
  async lire(tenantId: string, salarieId: string, utilisateurId: string) {
    const s = await this.salarie(tenantId, salarieId);
    const [ribs, total, dossier] = await Promise.all([
      this.prisma.ribSalarie.findMany({
        where: { tenantId, salarieId },
        orderBy: [{ estPrincipal: 'desc' }, { createdAt: 'asc' }],
        take: PLAFOND_RIBS_SALARIE,
      }),
      this.prisma.ribSalarie.count({ where: { tenantId, salarieId } }),
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { visaRibs: true } }),
    ]);
    const courriels = await courrielsDesAuteurs(this.prisma, tenantId, auteursDesVisas(ribs));
    const exige = dossier?.visaRibs === true;
    return {
      modePaiement: s.modePaiement,
      ribs: ribs.map((r) => ({ ...r, coordonnees: coordonneesImprimees(r), visa: presenterVisa(r, exige, utilisateurId, courriels) })),
      total,
      tronque: total > ribs.length,
    };
  }

  /**
   * LE MODE CONVENU · `null` remet « pas encore dit ». Une clé absente est
   * refusée · un corps vide n'efface pas un mode déclaré. Écrit par une mise
   * à jour UNITAIRE, que le journal d'audit relit avec sa pré-image.
   */
  async definirMode(tenantId: string, salarieId: string, mode: ModePaiementSalaire | null | undefined, utilisateurId: string) {
    if (mode === undefined) {
      throw new BadRequestException('Le mode de paiement se déclare (virement, chèque, espèces), ou « pas encore dit » (null).');
    }
    await this.salarie(tenantId, salarieId);
    await this.prisma.salarie.update({ where: { id: salarieId, tenantId }, data: { modePaiement: mode } });
    return this.lire(tenantId, salarieId, utilisateurId);
  }

  async creer(tenantId: string, salarieId: string, dto: RibTiersDto, utilisateurId: string) {
    await this.salarie(tenantId, salarieId);
    const donnees = this.donnees(dto);
    const existants = await this.prisma.ribSalarie.count({ where: { tenantId, salarieId } });
    const principal = existants === 0 || dto.estPrincipal === true;
    return transactionJournalisee(this.prisma, async (tx) => {
      if (principal) await tx.ribSalarie.updateMany({ where: { tenantId, salarieId }, data: { estPrincipal: false } });
      return tx.ribSalarie.create({
        data: { ...donnees, tenantId, salarieId, estPrincipal: principal, ...saisieDesCoordonnees(utilisateurId, new Date()) },
      });
    });
  }

  /** Un changement des coordonnées fait tomber le visa, jugé sous verrou · comme les RIB des tiers. */
  async modifier(tenantId: string, id: string, dto: RibTiersDto, utilisateurId: string) {
    await this.trouver(tenantId, id);
    const donnees = this.donnees(dto);
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ribs_salaries" WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
      const rib = await tx.ribSalarie.findFirst({ where: { id, tenantId } });
      if (!rib) throw new NotFoundException('RIB introuvable pour ce dossier.');
      if (dto.estPrincipal === true && !rib.estPrincipal) {
        await tx.ribSalarie.updateMany({ where: { tenantId, salarieId: rib.salarieId }, data: { estPrincipal: false } });
      }
      return tx.ribSalarie.update({
        where: { id: rib.id },
        data: {
          ...donnees,
          ...(dto.estPrincipal === true ? { estPrincipal: true } : {}),
          ...(coordonneesChangees(rib, donnees) ? saisieDesCoordonnees(utilisateurId, new Date()) : {}),
        },
      });
    });
  }

  /** Viser le RIB du salarié · mêmes règles que celui d'un tiers (`tiers/visa-rib.ts`). */
  async viser(tenantId: string, id: string, utilisateurId: string, saisiLeLu: string | null) {
    await this.trouver(tenantId, id);
    const vise = await transactionJournalisee(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ribs_salaries" WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
      const rib = await tx.ribSalarie.findFirst({ where: { id, tenantId } });
      if (!rib) throw new NotFoundException('RIB introuvable pour ce dossier.');
      const refus = motifRefusVisa(rib, utilisateurId, saisiLeLu);
      if (refus === MOTIF_VISA_PAR_SON_AUTEUR) throw new ForbiddenException(refus);
      if (refus) throw new ConflictException(refus);
      return tx.ribSalarie.update({ where: { id: rib.id }, data: { visePar: utilisateurId, viseLe: new Date() } });
    });
    return { rib: vise, avertissement: vise.saisiPar === null ? AVERTISSEMENT_AUTEUR_INCONNU : null };
  }

  /** Un ordre déjà émis a RECOPIÉ le RIB · le retirer ne change pas un ordre daté. */
  async supprimer(tenantId: string, id: string) {
    const rib = await this.trouver(tenantId, id);
    await this.prisma.ribSalarie.delete({ where: { id: rib.id } });
    return { supprime: true };
  }
}
