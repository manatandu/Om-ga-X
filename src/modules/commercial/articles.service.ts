import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { referencesVers, refuserSiReferences } from '../../common/suppression/references';
import { comptesNonPersonnalises, motifComptesNonPersonnalises } from '../comptes/comptes-proposes';
import {
  motifRefusCompteAchat,
  motifRefusCompteVente,
  motifRefusPrix,
  motifRefusRemise,
  motifRefusTiersDuTarif,
  motifRefusUniteStockee,
  prixPropose,
} from './articles';
import { CreerArticleCommercialDto, ModifierArticleCommercialDto, PoserTarifClientDto } from './dto/articles.dto';

/** Une liste bornée qui se dit (CLAUDE.md § 8 bis) · convention d'OmegaX. */
export const PLAFOND_LISTE_ARTICLES = 500;

const SELECT_ARTICLE = {
  id: true,
  reference: true,
  designation: true,
  unite: true,
  compteVenteId: true,
  compteAchatId: true,
  tauxTvaId: true,
  exonere: true,
  prixVenteHT: true,
  prixAchatHT: true,
  articleStockId: true,
  actif: true,
  compteVente: { select: { numero: true, intitule: true } },
  compteAchat: { select: { numero: true, intitule: true } },
  tauxTva: { select: { code: true, taux: true } },
  articleStock: { select: { code: true, designation: true, uniteMesure: true } },
} satisfies Prisma.ArticleCommercialSelect;

type ArticleLu = Prisma.ArticleCommercialGetPayload<{ select: typeof SELECT_ARTICLE }>;

function vueArticle(a: ArticleLu) {
  return {
    ...a,
    prixVenteHT: a.prixVenteHT === null ? null : Number(a.prixVenteHT),
    prixAchatHT: a.prixAchatHT === null ? null : Number(a.prixAchatHT),
    tauxTva: a.tauxTva ? { code: a.tauxTva.code, taux: Number(a.tauxTva.taux) } : null,
    stocke: a.articleStockId !== null,
  };
}

/**
 * LES ARTICLES ET LES TARIFS (ligne commercial-l8, étape a). Une structure ·
 * rien n'y passe d'écriture, mais une pièce commerciale la lit pour proposer
 * ses comptes, son taux et son prix.
 */
@Injectable()
export class ArticlesCommerciauxService {
  constructor(private readonly prisma: PrismaService) {}

  async lister(tenantId: string, params: { recherche?: string; actifs?: string } = {}) {
    const r = params.recherche?.trim();
    const filtre: Prisma.ArticleCommercialWhereInput = {
      ...(params.actifs === 'oui' ? { actif: true } : {}),
      ...(r
        ? { OR: [{ reference: { contains: r, mode: 'insensitive' } }, { designation: { contains: r, mode: 'insensitive' } }] }
        : {}),
    };
    const [articles, total] = await Promise.all([
      this.prisma.articleCommercial.findMany({ where: { tenantId, ...filtre }, select: SELECT_ARTICLE, orderBy: { reference: 'asc' }, take: PLAFOND_LISTE_ARTICLES }),
      this.prisma.articleCommercial.count({ where: { tenantId, ...filtre } }),
    ]);
    return { total, plafond: PLAFOND_LISTE_ARTICLES, tronque: total > articles.length, articles: articles.map(vueArticle) };
  }

  async lire(tenantId: string, id: string) {
    const a = await this.prisma.articleCommercial.findFirst({ where: { id, tenantId }, select: SELECT_ARTICLE });
    if (!a) throw new NotFoundException('Article introuvable dans ce dossier.');
    return vueArticle(a);
  }

  /**
   * TOUT CE QUE L'ARTICLE NOMME SE RELIT DANS CE DOSSIER · un compte, un taux
   * ou une fiche de stock d'un voisin passerait sinon par la clé étrangère,
   * qui ne voit pas le dossier. Les règles de chaque lien sont jugées sur
   * l'état que l'article AURA, pas sur la seule requête.
   */
  private async verifierLiens(
    tenantId: string,
    cible: { compteVenteId: string | null; compteAchatId: string | null; tauxTvaId: string | null; articleStockId: string | null; unite: string; exonere: boolean },
    articleId: string | null,
  ) {
    const idsComptes = [cible.compteVenteId, cible.compteAchatId].filter((x): x is string => !!x);
    const comptes = idsComptes.length
      ? await this.prisma.compte.findMany({
          where: { tenantId, id: { in: idsComptes } },
          select: { id: true, numero: true, intitule: true, classe: true, typeCompte: true, estActif: true },
        })
      : [];
    const compte = (id: string) => {
      const c = comptes.find((x) => x.id === id);
      if (!c) throw new NotFoundException('Compte introuvable dans ce dossier.');
      return c;
    };
    if (cible.compteVenteId) {
      const m = motifRefusCompteVente(compte(cible.compteVenteId));
      if (m) throw new BadRequestException(m);
    }
    if (cible.compteAchatId) {
      const m = motifRefusCompteAchat(compte(cible.compteAchatId));
      if (m) throw new BadRequestException(m);
    }
    // UN COMPTE PERSONNALISÉ, comme à la saisie (décision de Manasse du
    // 2026-10-09) · l'écriture que la facture fera passer le mouvementera.
    const motifPerso = motifComptesNonPersonnalises(await comptesNonPersonnalises(this.prisma, tenantId, idsComptes), 'le compte d’un article');
    if (motifPerso) throw new BadRequestException(motifPerso);

    if (cible.tauxTvaId) {
      if (cible.exonere) {
        throw new BadRequestException('Une opération exonérée ne porte pas de taux · exonération et taux zéro se distinguent (O.-L. n° 10/001, art. 24 et 43). Retirez l’un ou l’autre.');
      }
      const taux = await this.prisma.tauxTva.findFirst({ where: { id: cible.tauxTvaId, tenantId }, select: { estActif: true, code: true } });
      if (!taux) throw new NotFoundException('Taux de taxe introuvable dans ce dossier.');
      if (!taux.estActif) throw new BadRequestException(`Le taux ${taux.code} est en sommeil · il ne se propose plus.`);
    }
    if (cible.articleStockId) {
      const fiche = await this.prisma.articleStock.findFirst({
        where: { id: cible.articleStockId, tenantId },
        select: { actif: true, code: true, uniteMesure: true, articleCommercial: { select: { id: true, reference: true } } },
      });
      if (!fiche) throw new NotFoundException('Fiche de stock introuvable dans ce dossier.');
      if (!fiche.actif) throw new BadRequestException(`L’article de magasin ${fiche.code} est retiré · il ne reçoit plus de mouvement.`);
      if (fiche.articleCommercial && fiche.articleCommercial.id !== articleId) {
        throw new ConflictException(`La fiche de stock ${fiche.code} est déjà celle de l’article ${fiche.articleCommercial.reference} · une fiche ne sert qu’un article, sans quoi deux ventes se partageraient le même stock sans le dire.`);
      }
      const m = motifRefusUniteStockee(cible.unite, fiche.uniteMesure);
      if (m) throw new BadRequestException(m);
    }
  }

  private static prix(dto: { prixVenteHT?: number | null; prixAchatHT?: number | null }) {
    for (const [v, l] of [
      [dto.prixVenteHT, 'prix de vente hors taxes'],
      [dto.prixAchatHT, 'prix d’achat hors taxes'],
    ] as const) {
      const m = motifRefusPrix(v, l);
      if (m) throw new BadRequestException(m);
    }
  }

  async creer(tenantId: string, userId: string, dto: CreerArticleCommercialDto) {
    ArticlesCommerciauxService.prix(dto);
    const cible = {
      compteVenteId: dto.compteVenteId ?? null,
      compteAchatId: dto.compteAchatId ?? null,
      tauxTvaId: dto.tauxTvaId ?? null,
      articleStockId: dto.articleStockId ?? null,
      unite: dto.unite.trim(),
      exonere: dto.exonere ?? false,
    };
    await this.verifierLiens(tenantId, cible, null);
    const reference = dto.reference.trim();
    try {
      const a = await this.prisma.articleCommercial.create({
        data: {
          tenantId,
          reference,
          designation: dto.designation.trim(),
          ...cible,
          prixVenteHT: dto.prixVenteHT ?? null,
          prixAchatHT: dto.prixAchatHT ?? null,
          createdBy: userId,
        },
        select: SELECT_ARTICLE,
      });
      return vueArticle(a);
    } catch (e) {
      throw this.conflit(e, reference);
    }
  }

  private conflit(e: unknown, reference?: string) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const cible = String((e.meta as { target?: unknown } | undefined)?.target ?? '');
      return new ConflictException(
        cible.includes('articleStockId')
          ? 'Cette fiche de stock vient d’être donnée à un autre article · une fiche ne sert qu’un article.'
          : `La référence « ${reference ?? ''} » est déjà portée par un article de ce dossier.`,
      );
    }
    return e;
  }

  async modifier(tenantId: string, id: string, dto: ModifierArticleCommercialDto) {
    const actuel = await this.prisma.articleCommercial.findFirst({ where: { id, tenantId } });
    if (!actuel) throw new NotFoundException('Article introuvable dans ce dossier.');
    ArticlesCommerciauxService.prix(dto);
    const garde = <T>(v: T | undefined, a: T) => (v === undefined ? a : v);
    const cible = {
      compteVenteId: garde(dto.compteVenteId, actuel.compteVenteId),
      compteAchatId: garde(dto.compteAchatId, actuel.compteAchatId),
      tauxTvaId: garde(dto.tauxTvaId, actuel.tauxTvaId),
      articleStockId: garde(dto.articleStockId, actuel.articleStockId),
      unite: (dto.unite ?? actuel.unite).trim(),
      exonere: dto.exonere ?? actuel.exonere,
    };
    await this.verifierLiens(tenantId, cible, id);
    try {
      const a = await this.prisma.articleCommercial.update({
        where: { id },
        data: {
          ...cible,
          ...(dto.designation === undefined ? {} : { designation: dto.designation.trim() }),
          ...(dto.prixVenteHT === undefined ? {} : { prixVenteHT: dto.prixVenteHT }),
          ...(dto.prixAchatHT === undefined ? {} : { prixAchatHT: dto.prixAchatHT }),
          ...(dto.actif === undefined ? {} : { actif: dto.actif }),
        },
        select: SELECT_ARTICLE,
      });
      return vueArticle(a);
    } catch (e) {
      throw this.conflit(e, actuel.reference);
    }
  }

  /** Un article qui a servi ne se supprime pas · le refus nomme chaque usage. */
  async supprimer(tenantId: string, id: string) {
    const a = await this.prisma.articleCommercial.findFirst({ where: { id, tenantId }, select: { id: true, reference: true } });
    if (!a) throw new NotFoundException('Article introuvable dans ce dossier.');
    refuserSiReferences(`L’article ${a.reference}`, await referencesVers(this.prisma, 'ArticleCommercial', id, tenantId));
    await this.prisma.articleCommercial.delete({ where: { id } });
    return { supprime: true };
  }

  async tarifsDeLArticle(tenantId: string, articleId: string) {
    await this.lire(tenantId, articleId);
    const tarifs = await this.prisma.tarifClient.findMany({
      where: { tenantId, articleId },
      select: { id: true, tiersId: true, prixHT: true, remisePourcent: true, tiers: { select: { code: true, nom: true } } },
      orderBy: { tiers: { code: 'asc' } },
      take: PLAFOND_LISTE_ARTICLES,
    });
    const total = await this.prisma.tarifClient.count({ where: { tenantId, articleId } });
    return {
      total,
      tronque: total > tarifs.length,
      tarifs: tarifs.map((t) => ({ ...t, prixHT: t.prixHT === null ? null : Number(t.prixHT), remisePourcent: t.remisePourcent === null ? null : Number(t.remisePourcent) })),
    };
  }

  async poserTarif(tenantId: string, userId: string, dto: PoserTarifClientDto) {
    const prix = dto.prixHT ?? null;
    const remise = dto.remisePourcent ?? null;
    if (prix === null && remise === null) {
      throw new BadRequestException('Un tarif porte un prix propre, une remise, ou les deux · sans l’un ni l’autre, c’est le prix de base qui s’applique, et il n’y a rien à poser.');
    }
    const motif = motifRefusPrix(prix, 'prix hors taxes du client') ?? motifRefusRemise(remise);
    if (motif) throw new BadRequestException(motif);
    await this.lire(tenantId, dto.articleId);
    const tiers = await this.prisma.tiers.findFirst({ where: { id: dto.tiersId, tenantId }, select: { type: true } });
    if (!tiers) throw new NotFoundException('Tiers introuvable dans ce dossier.');
    const m = motifRefusTiersDuTarif(tiers.type);
    if (m) throw new BadRequestException(m);
    // Une ligne par couple (article, client) · reposer un tarif le remplace,
    // par identifiant (le journal d'audit nomme la ligne retouchée).
    const existant = await this.prisma.tarifClient.findFirst({ where: { tenantId, articleId: dto.articleId, tiersId: dto.tiersId }, select: { id: true } });
    const data = { prixHT: prix, remisePourcent: remise };
    try {
      const t = existant
        ? await this.prisma.tarifClient.update({ where: { id: existant.id }, data })
        : await this.prisma.tarifClient.create({ data: { tenantId, articleId: dto.articleId, tiersId: dto.tiersId, createdBy: userId, ...data } });
      return { id: t.id, prixHT: t.prixHT === null ? null : Number(t.prixHT), remisePourcent: t.remisePourcent === null ? null : Number(t.remisePourcent) };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Un tarif vient d’être posé pour ce client et cet article · rechargez la fiche.');
      }
      throw e;
    }
  }

  /** Prix proposé pour une vente (tarif du client, sinon prix de base) ou un achat (prix d'achat de base). */
  async propositionPrix(tenantId: string, articleId: string, tiersId: string | undefined, sens: 'VENTE' | 'ACHAT') {
    const a = await this.lire(tenantId, articleId);
    if (sens === 'ACHAT') return prixPropose(a.prixAchatHT, null);
    const tarif = tiersId
      ? await this.prisma.tarifClient.findFirst({ where: { tenantId, articleId, tiersId }, select: { prixHT: true, remisePourcent: true } })
      : null;
    return prixPropose(
      a.prixVenteHT,
      tarif ? { prixHT: tarif.prixHT === null ? null : Number(tarif.prixHT), remisePourcent: tarif.remisePourcent === null ? null : Number(tarif.remisePourcent) } : null,
    );
  }

  async retirerTarif(tenantId: string, id: string) {
    const t = await this.prisma.tarifClient.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!t) throw new NotFoundException('Tarif introuvable dans ce dossier.');
    await this.prisma.tarifClient.delete({ where: { id } });
    return { retire: true };
  }
}
