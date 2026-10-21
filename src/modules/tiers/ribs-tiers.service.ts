import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { normaliserIban } from '../banques/banques';
import { motifRefusRibTiers } from './ribs-tiers';
import { RibTiersDto } from './dto/ribs-tiers.dto';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import {
  AVERTISSEMENT_AUTEUR_INCONNU,
  MOTIF_VISA_PAR_SON_AUTEUR,
  auteursDesVisas,
  coordonneesChangees,
  motifRefusVisa,
  presenterVisa,
  saisieDesCoordonnees,
} from './visa-rib';

const nul = (v: string | undefined) => (v === undefined || v.trim() === '' ? null : v.trim());

/**
 * RIB DES TIERS · voir ribs-tiers.ts. Structure du tiers, écrite par
 * l'administrateur comme la fiche elle-même : un RIB modifié en silence
 * détourne un paiement, et c'est pourquoi la table est aussi au journal
 * d'audit.
 */
@Injectable()
export class RibsTiersService {
  constructor(private readonly prisma: PrismaService) {}

  private async tiersDuDossier(tenantId: string, tiersId: string) {
    const tiers = await this.prisma.tiers.findFirst({ where: { id: tiersId, tenantId }, select: { id: true } });
    if (!tiers) throw new NotFoundException('Tiers introuvable pour ce dossier.');
    return tiers;
  }

  private async trouver(tenantId: string, id: string) {
    const rib = await this.prisma.ribTiers.findFirst({ where: { id, tenantId } });
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
    if (refus) throw new BadRequestException(refus);
    return donnees;
  }

  /** Les RIB du tiers, principal d'abord, chacun avec son visa (`visa-rib.ts`). */
  async lister(tenantId: string, tiersId: string, utilisateurId: string) {
    await this.tiersDuDossier(tenantId, tiersId);
    const [ribs, dossier] = await Promise.all([
      this.prisma.ribTiers.findMany({
        where: { tenantId, tiersId },
        orderBy: [{ estPrincipal: 'desc' }, { createdAt: 'asc' }],
      }),
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { visaRibs: true } }),
    ]);
    const courriels = await courrielsDesAuteurs(this.prisma, tenantId, auteursDesVisas(ribs));
    const exige = dossier?.visaRibs === true;
    return ribs.map((r) => ({ ...r, visa: presenterVisa(r, exige, utilisateurId, courriels) }));
  }

  /**
   * UN SEUL RIB PRINCIPAL PAR TIERS, et le premier l'est d'office · un tiers
   * qui n'a qu'un RIB ne doit pas se voir refuser un ordre de virement parce
   * que personne n'a coché la case. Marquer un autre principal retire la
   * marque au précédent, dans la même transaction.
   */
  async creer(tenantId: string, tiersId: string, dto: RibTiersDto, utilisateurId: string) {
    await this.tiersDuDossier(tenantId, tiersId);
    const donnees = this.donnees(dto);
    const existants = await this.prisma.ribTiers.count({ where: { tenantId, tiersId } });
    const principal = existants === 0 || dto.estPrincipal === true;
    return transactionJournalisee(this.prisma, async (tx) => {
      if (principal) await tx.ribTiers.updateMany({ where: { tenantId, tiersId }, data: { estPrincipal: false } });
      return tx.ribTiers.create({
        data: { ...donnees, tenantId, tiersId, estPrincipal: principal, ...saisieDesCoordonnees(utilisateurId, new Date()) },
      });
    });
  }

  /**
   * UN CHANGEMENT DES COORDONNÉES FAIT TOMBER LE VISA et nomme son auteur
   * (`visa-rib.ts`, règles 1 et 2) · jugé contre le RIB relu SOUS VERROU dans
   * la transaction, sans quoi deux modifications croisées laisseraient un
   * visa sur des coordonnées que personne n'a visées.
   */
  async modifier(tenantId: string, id: string, dto: RibTiersDto, utilisateurId: string) {
    await this.trouver(tenantId, id);
    const donnees = this.donnees(dto);
    return transactionJournalisee(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ribs_tiers" WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
      const rib = await tx.ribTiers.findFirst({ where: { id, tenantId } });
      if (!rib) throw new NotFoundException('RIB introuvable pour ce dossier.');
      if (dto.estPrincipal === true && !rib.estPrincipal) {
        await tx.ribTiers.updateMany({ where: { tenantId, tiersId: rib.tiersId }, data: { estPrincipal: false } });
      }
      return tx.ribTiers.update({
        where: { id: rib.id },
        data: {
          ...donnees,
          ...(dto.estPrincipal === true ? { estPrincipal: true } : {}),
          ...(coordonneesChangees(rib, donnees) ? saisieDesCoordonnees(utilisateurId, new Date()) : {}),
        },
      });
    });
  }

  /**
   * VISER LE RIB (`visa-rib.ts`, règles 3 et 4) · relu sous verrou, refusé à
   * l'auteur de la dernière saisie et sur un RIB changé depuis sa lecture,
   * écrit par une mise à jour UNITAIRE que le journal d'audit relit avec sa
   * pré-image.
   */
  async viser(tenantId: string, id: string, utilisateurId: string, saisiLeLu: string | null) {
    await this.trouver(tenantId, id);
    const vise = await transactionJournalisee(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ribs_tiers" WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`;
      const rib = await tx.ribTiers.findFirst({ where: { id, tenantId } });
      if (!rib) throw new NotFoundException('RIB introuvable pour ce dossier.');
      const refus = motifRefusVisa(rib, utilisateurId, saisiLeLu);
      if (refus === MOTIF_VISA_PAR_SON_AUTEUR) throw new ForbiddenException(refus);
      if (refus) throw new ConflictException(refus);
      return tx.ribTiers.update({ where: { id: rib.id }, data: { visePar: utilisateurId, viseLe: new Date() } });
    });
    return { rib: vise, avertissement: vise.saisiPar === null ? AVERTISSEMENT_AUTEUR_INCONNU : null };
  }

  /**
   * Retirer le principal laisse le tiers SANS principal si d'autres RIB
   * restent · en désigner un d'office choisirait le compte où partira le
   * prochain virement, et c'est une décision.
   */
  async supprimer(tenantId: string, id: string) {
    const rib = await this.trouver(tenantId, id);
    await this.prisma.ribTiers.delete({ where: { id: rib.id } });
    return { supprime: true };
  }
}

/**
 * Les courriels des auteurs, lus dans le seul dossier · un utilisateur retiré
 * n'y est plus, et l'écran le nomme comme tel (`nommerUtilisateur`).
 */
export async function courrielsDesAuteurs(prisma: PrismaService, tenantId: string, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, email: true } });
  return new Map(users.map((u) => [u.id, u.email]));
}
