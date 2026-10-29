import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ficheIndividuelle, RESERVE_FICHE_INDIVIDUELLE, type BulletinPourFiche } from './fiche-individuelle';
import { classeurFicheIndividuelle } from './fiche-individuelle-excel';

/** Une année porte douze bulletins et leurs annulés · au-delà, la lecture le dit. */
export const PLAFOND_BULLETINS_DE_L_ANNEE = 200;

const objet = (x: unknown): Record<string, unknown> | null => (x && typeof x === 'object' ? (x as Record<string, unknown>) : null);

/**
 * LIGNE PAIE-SUITE, FONCTION 89 · la fiche individuelle et les cumuls par
 * rubrique d'un salarié pour une année · lus sur les bulletins émis
 * (`fiche-individuelle.ts`), jamais recalculés.
 */
@Injectable()
export class FicheIndividuelleService {
  constructor(private readonly prisma: PrismaService) {}

  async fiche(tenantId: string, salarieId: string, anneeLue: string | undefined) {
    const annee = Number(anneeLue);
    if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) throw new BadRequestException("L'année se lit AAAA.");
    const salarie = await this.prisma.salarie.findFirst({
      where: { id: salarieId, tenantId },
      select: { id: true, nom: true, postNom: true, prenoms: true, matricule: true },
    });
    if (!salarie) throw new NotFoundException('Salarié introuvable dans ce dossier.');
    const lus = await this.prisma.bulletinPaie.findMany({
      where: { tenantId, salarieId, moisDePaie: { startsWith: `${annee}-` } },
      orderBy: [{ moisDePaie: 'asc' }, { numero: 'asc' }],
      take: PLAFOND_BULLETINS_DE_L_ANNEE + 1,
      select: {
        numero: true,
        moisDePaie: true,
        nature: true,
        statut: true,
        totalVerseFc: true,
        assietteSocialeFc: true,
        cotisationsTravailleurFc: true,
        cotisationsEmployeurFc: true,
        irppFc: true,
        netAPayerFc: true,
        entree: true,
        calcul: true,
      },
    });
    // Une fiche amputée en silence dirait un cumul faux · au-delà de la borne,
    // la fiche se refuse plutôt que de se tronquer (§ 8 bis, document).
    if (lus.length > PLAFOND_BULLETINS_DE_L_ANNEE) {
      throw new BadRequestException(`Plus de ${PLAFOND_BULLETINS_DE_L_ANNEE} bulletins pour ce salarié en ${annee} · la fiche ne se lit plus d'un coup.`);
    }
    const bulletins: BulletinPourFiche[] = lus.map((b) => ({
      numero: b.numero,
      moisDePaie: b.moisDePaie,
      nature: b.nature,
      statut: b.statut,
      totalVerseFc: Number(b.totalVerseFc),
      assietteSocialeFc: Number(b.assietteSocialeFc),
      cotisationsTravailleurFc: Number(b.cotisationsTravailleurFc),
      cotisationsEmployeurFc: Number(b.cotisationsEmployeurFc),
      irppFc: Number(b.irppFc),
      netAPayerFc: Number(b.netAPayerFc),
      entree: b.entree,
      calcul: b.calcul,
    }));
    // Les rubriques du cabinet que les éléments nomment, lues dans CE dossier.
    const ids = [
      ...new Set(
        bulletins.flatMap((b) => {
          const el = objet(b.entree)?.elements;
          return Array.isArray(el) ? el.map((e) => objet(e)?.rubriqueId).filter((x): x is string => typeof x === 'string') : [];
        }),
      ),
    ];
    const rubriques = ids.length
      ? await this.prisma.rubriquePaie.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, code: true, libelle: true }, take: ids.length })
      : [];
    const f = ficheIndividuelle(annee, bulletins, new Map(rubriques.map((r) => [r.id, { code: r.code, libelle: r.libelle }])));
    return {
      ...f,
      salarie: { id: salarie.id, nom: [salarie.nom, salarie.postNom, salarie.prenoms].filter(Boolean).join(' '), matricule: salarie.matricule },
      reserve: RESERVE_FICHE_INDIVIDUELLE,
    };
  }

  async excel(tenantId: string, salarieId: string, anneeLue: string | undefined) {
    const f = await this.fiche(tenantId, salarieId, anneeLue);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { nom: true, numeroImpot: true } });
    const buffer = await classeurFicheIndividuelle(f, { entite: tenant.nom, nif: tenant.numeroImpot, salarie: f.salarie.nom, matricule: f.salarie.matricule });
    const nom = (f.salarie.matricule || f.salarie.nom).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40);
    return { buffer, nomFichier: `fiche-individuelle-${f.annee}-${nom}.xlsx` };
  }
}
