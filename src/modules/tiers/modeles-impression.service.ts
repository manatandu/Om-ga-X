import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { NatureModeleImpression, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { libelleReference, referencesVers } from '../../common/suppression/references';
import {
  COLONNE_DU_TIERS,
  type Cadre,
  PLAFOND_MODELES_IMPRESSION,
  cadreDuModele,
  intituleDuModele,
  motifRefusAttribution,
  motifRefusIntituleModele,
  motifRefusTexteModele,
} from './modeles-impression';
import { CreerModeleImpressionDto, ModifierModeleImpressionDto } from './dto/modeles-impression.dto';

type LecteurModeles = Pick<PrismaService, 'modeleImpressionTiers'>;
type LecteurCadres = Pick<PrismaService, 'modeleImpressionTiers' | 'tiers'>;

/**
 * LE MODÈLE CHOISI SUR LA FICHE D'UN TIERS (création, modification) · du
 * dossier, sinon introuvable ; de la nature de sa zone, sinon refusé. La clé
 * étrangère ne vérifie que l'existence de l'identifiant, jamais son dossier ·
 * sans ce contrôle, un appel direct poserait le modèle d'un autre cabinet.
 */
export async function modeleDuDossierPourLaZone(prisma: LecteurModeles, tenantId: string, id: string, nature: NatureModeleImpression) {
  const modele = await prisma.modeleImpressionTiers.findFirst({ where: { id, tenantId }, select: { id: true, intitule: true, nature: true } });
  if (!modele) throw new NotFoundException("Modèle d'impression introuvable pour ce dossier.");
  const motif = motifRefusAttribution(nature, modele);
  if (motif) throw new BadRequestException(motif);
  return modele;
}

/**
 * LES CADRES DES TIERS POUR UN DOCUMENT · par tiers, le cadre de son modèle
 * de cette nature, s'il en a un ; sinon le cadre par défaut du document quand
 * il en a un (l'avis de règlement), rien sinon (la lettre de relance et le
 * relevé partent tels qu'OmegaX les compose). Deux lectures pour tout un lot
 * (les tiers, puis leurs modèles) · une émission de cinq cents relances ne
 * fait pas cinq cents allers-retours.
 */
export async function cadresDesTiers(
  prisma: LecteurCadres,
  tenantId: string,
  tiersIds: readonly string[],
  nature: NatureModeleImpression,
  contexte: { entite: string; jour: Date },
  cadreParDefaut?: string,
): Promise<Map<string, Cadre>> {
  const cadres = new Map<string, Cadre>();
  const ids = [...new Set(tiersIds)];
  if (!ids.length) return cadres;
  const tiers = await prisma.tiers.findMany({
    where: { tenantId, id: { in: ids } },
    select: {
      id: true,
      nom: true,
      code: true,
      qualite: true,
      contact: true,
      adresse: true,
      boitePostale: true,
      ville: true,
      pays: true,
      modeleImpressionExtraitId: true,
      modeleImpressionReglementId: true,
      modeleImpressionRappelId: true,
    },
  });
  const colonne = COLONNE_DU_TIERS[nature];
  if (cadreParDefaut !== undefined) {
    for (const t of tiers) cadres.set(t.id, cadreDuModele({ intitule: null, texte: cadreParDefaut }, t, contexte));
  }
  const avecModele = tiers.filter((t) => t[colonne]);
  if (!avecModele.length) return cadres;
  const modeles = new Map(
    (
      await prisma.modeleImpressionTiers.findMany({
        where: { tenantId, nature, id: { in: [...new Set(avecModele.map((t) => t[colonne] as string))] } },
        select: { id: true, intitule: true, texte: true },
      })
    ).map((m) => [m.id, m] as const),
  );
  for (const t of avecModele) {
    const modele = modeles.get(t[colonne] as string);
    if (modele) cadres.set(t.id, cadreDuModele(modele, t, contexte));
  }
  return cadres;
}

/** Les modèles d'impression du dossier (ligne sage-l2, fonction 27) · règles dans `modeles-impression.ts`. */
@Injectable()
export class ModelesImpressionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cent au plus, toutes natures · la borne de la table est celle de la
   * liste. Chacun dit combien de tiers l'ont choisi · c'est ce qui le retient
   * à la suppression.
   */
  async lister(tenantId: string) {
    const [modeles, extraits, reglements, rappels] = await Promise.all([
      this.prisma.modeleImpressionTiers.findMany({
        where: { tenantId },
        orderBy: [{ nature: 'asc' }, { intitule: 'asc' }],
        take: PLAFOND_MODELES_IMPRESSION,
        select: { id: true, nature: true, intitule: true, texte: true },
      }),
      this.prisma.tiers.groupBy({ by: ['modeleImpressionExtraitId'], where: { tenantId, modeleImpressionExtraitId: { not: null } }, _count: { _all: true } }),
      this.prisma.tiers.groupBy({ by: ['modeleImpressionReglementId'], where: { tenantId, modeleImpressionReglementId: { not: null } }, _count: { _all: true } }),
      this.prisma.tiers.groupBy({ by: ['modeleImpressionRappelId'], where: { tenantId, modeleImpressionRappelId: { not: null } }, _count: { _all: true } }),
    ]);
    const usages = new Map<string, number>();
    for (const g of extraits) usages.set(g.modeleImpressionExtraitId as string, g._count._all);
    for (const g of reglements) usages.set(g.modeleImpressionReglementId as string, g._count._all);
    for (const g of rappels) usages.set(g.modeleImpressionRappelId as string, g._count._all);
    return modeles.map((m) => ({ ...m, nombreTiers: usages.get(m.id) ?? 0 }));
  }

  async creer(tenantId: string, userId: string, dto: CreerModeleImpressionDto) {
    const intitule = intituleDuModele(dto.intitule);
    const motifTexte = motifRefusTexteModele(dto.texte);
    if (motifTexte) throw new BadRequestException(motifTexte);
    try {
      return await transactionJournalisee(this.prisma, async (tx) => {
        // Plafond et intitulé se jugent sous un verrou du dossier · deux
        // créations simultanées liraient sinon chacune la place libre.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`modeles-impression:${tenantId}`}))`;
        const nombre = await tx.modeleImpressionTiers.count({ where: { tenantId } });
        if (nombre >= PLAFOND_MODELES_IMPRESSION) {
          throw new BadRequestException(
            `Le dossier tient déjà ${PLAFOND_MODELES_IMPRESSION} modèles d'impression · supprimez un modèle qu'aucun tiers n'emploie.`,
          );
        }
        const autres = await tx.modeleImpressionTiers.findMany({ where: { tenantId, nature: dto.nature }, select: { id: true, intitule: true } });
        const motif = motifRefusIntituleModele(intitule, autres, null);
        if (motif) throw new BadRequestException(motif);
        return tx.modeleImpressionTiers.create({
          data: { tenantId, nature: dto.nature, intitule, texte: dto.texte, createdBy: userId },
          select: { id: true, nature: true, intitule: true, texte: true },
        });
      });
    } catch (e) {
      throw this.dejaPris(e, intitule);
    }
  }

  /**
   * L'intitulé et le texte se retouchent à tout moment · le texte enregistré
   * d'une relance déjà émise ne change pas (relances.service.ts, le texte
   * envoyé fait foi), seuls les documents suivants prennent le nouveau texte.
   */
  async modifier(tenantId: string, id: string, dto: ModifierModeleImpressionDto) {
    const existant = await this.prisma.modeleImpressionTiers.findFirst({ where: { id, tenantId }, select: { id: true, nature: true } });
    if (!existant) throw new NotFoundException("Modèle d'impression introuvable pour ce dossier.");
    if (dto.texte !== undefined) {
      const motifTexte = motifRefusTexteModele(dto.texte);
      if (motifTexte) throw new BadRequestException(motifTexte);
    }
    const intitule = dto.intitule === undefined ? undefined : intituleDuModele(dto.intitule);
    try {
      return await transactionJournalisee(this.prisma, async (tx) => {
        if (intitule !== undefined) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`modeles-impression:${tenantId}`}))`;
          const autres = await tx.modeleImpressionTiers.findMany({
            where: { tenantId, nature: existant.nature },
            select: { id: true, intitule: true },
          });
          const motif = motifRefusIntituleModele(intitule, autres, existant.id);
          if (motif) throw new BadRequestException(motif);
        }
        return tx.modeleImpressionTiers.update({
          where: { id: existant.id },
          data: {
            ...(intitule !== undefined ? { intitule } : {}),
            ...(dto.texte !== undefined ? { texte: dto.texte } : {}),
          },
          select: { id: true, nature: true, intitule: true, texte: true },
        });
      });
    } catch (e) {
      throw this.dejaPris(e, intitule ?? '');
    }
  }

  /**
   * Retiré seulement si aucun tiers ne l'a choisi (relations lues dans le
   * schéma, `references.ts`) · le refus nomme combien, et dit le geste qui le
   * lève. Un modèle n'a pas de mise en sommeil · le refus commun la
   * conseillerait, d'où ce message propre.
   */
  async supprimer(tenantId: string, id: string) {
    const existant = await this.prisma.modeleImpressionTiers.findFirst({ where: { id, tenantId }, select: { id: true, intitule: true } });
    if (!existant) throw new NotFoundException("Modèle d'impression introuvable pour ce dossier.");
    const sujet = `Le modèle d'impression « ${existant.intitule} »`;
    const refuserSiChoisi = async () => {
      const refs = await referencesVers(this.prisma, 'ModeleImpressionTiers', existant.id, tenantId);
      if (refs.length) {
        throw new ConflictException(
          `${sujet} ne peut pas être supprimé · il est choisi : ${refs.map(libelleReference).join(', ')}. ` +
            "Choisissez un autre modèle, ou aucun, sur la fiche de ces tiers d'abord.",
        );
      }
    };
    await refuserSiChoisi();
    try {
      await this.prisma.modeleImpressionTiers.delete({ where: { id: existant.id } });
    } catch (e) {
      // CHOISI ENTRE LE COMPTE ET LA SUPPRESSION · la clé étrangère refuse
      // (P2003), et le refus se dit comme le premier, recompté.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        await refuserSiChoisi();
        throw new ConflictException(`${sujet} vient d’être choisi par un tiers · changez d'abord sa fiche.`);
      }
      throw e;
    }
    return { supprime: true };
  }

  /** Deux modèles de même intitulé dans une nature · la base refuse, le refus se dit. */
  private dejaPris(e: unknown, intitule: string): unknown {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return new ConflictException(`Le dossier a déjà un modèle « ${intitule} » pour ce document.`);
    }
    return e;
  }
}
