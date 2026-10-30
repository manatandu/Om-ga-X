import { Injectable, NotFoundException } from '@nestjs/common';
import { NatureFacture, Prisma, SensFacture, StatutExercice } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { jourDeKinshasa } from '../../common/echeance';
import { HORS_SITUATION } from '../comptabilite/ecritures-de-situation';
import { filtreOuverturePasseeAuPremierJour } from '../exercice/ouverture-passee';
import { jugerEncours, type EncoursLu } from './encours-client';

/** Exercices précédents remontés au plus pour lire un solde · même borne que la situation bancaire. */
const REMONTEE_MAX = 20;
/** Comptes d'un tiers lus au plus · une panoplie en compte cinq, la borne se dit. */
const COMPTES_MAX = 50;

const lendemain = (d: Date) => new Date(d.getTime() + 86_400_000);
const centimes = (d: Prisma.Decimal | null | undefined) => new Prisma.Decimal(d ?? 0).times(100).toDecimalPlaces(0).toNumber();

/**
 * L'ENCOURS D'UN CLIENT (ligne commercial-l8, fonction 30). Règle dans
 * `encours-client.ts`. Le solde se lit comme celui d'un compte bancaire à une
 * date (`ConditionsBancairesService.soldeDuRib`) · l'exercice qui contient la
 * date, lignes datées au plus tard ce jour, brouillard compris, ni simulation
 * ni à-nouveau provisoire (A7 ter, B1) ; sans ouverture qui porte ces comptes,
 * les exercices précédents non clôturés s'ajoutent, sans quoi le premier jour
 * de N+1 se lirait sur des comptes vides. Un solde qui ne se lit pas est
 * « non calculé », jamais zéro.
 */
@Injectable()
export class EncoursClientService {
  constructor(private readonly prisma: PrismaService) {}

  private async centimesDe(tenantId: string, compteIds: string[], exerciceId: string, avant: Date | null): Promise<number> {
    const s = await this.prisma.ligneEcriture.aggregate({
      where: {
        compteId: { in: compteIds },
        ecriture: { tenantId, exerciceId, ...(avant ? { date: { lt: avant } } : {}), estANouveauProvisoire: false, ...HORS_SITUATION },
      },
      _sum: { debit: true, credit: true },
    });
    return centimes(s._sum?.debit) - centimes(s._sum?.credit);
  }

  /** Le solde net (débit moins crédit) des comptes, en francs, à la date · ou le motif qui l'empêche. */
  async soldeDesComptes(tenantId: string, compteIds: string[], date: Date): Promise<{ solde: number | null; motif: string | null }> {
    if (!compteIds.length) return { solde: 0, motif: null };
    const exercice = await this.prisma.exercice.findFirst({
      where: { tenantId, dateDebut: { lte: date }, dateFin: { gte: date } },
      select: { id: true, dateDebut: true },
    });
    if (!exercice) return { solde: null, motif: `aucun exercice ne couvre le ${date.toLocaleDateString('fr-FR', { timeZone: 'UTC' })}` };
    let total = await this.centimesDe(tenantId, compteIds, exercice.id, lendemain(date));
    let courant = exercice;
    for (let rang = 0; ; rang++) {
      const ouverture = await this.prisma.ecriture.count({
        where: { AND: [filtreOuverturePasseeAuPremierJour(tenantId, courant), { lignes: { some: { compteId: { in: compteIds } } } }] },
      });
      if (ouverture > 0) break;
      const precedent = await this.prisma.exercice.findFirst({
        where: { tenantId, dateFin: { lt: courant.dateDebut } },
        orderBy: { dateFin: 'desc' },
        select: { id: true, dateDebut: true, statut: true },
      });
      if (!precedent || precedent.statut === StatutExercice.CLOTURE) break;
      if (rang >= REMONTEE_MAX) {
        return { solde: null, motif: `plus de ${REMONTEE_MAX} exercices ouverts se suivent sans ouverture qui porte ces comptes · clôturez-en ou passez un bilan d'ouverture` };
      }
      total += await this.centimesDe(tenantId, compteIds, precedent.id, null);
      courant = precedent;
    }
    return { solde: total / 100, motif: null };
  }

  /** Le TTC des pièces d'une sélection · lignes (HT et taxe) et autres impôts et taxes, en centimes. */
  private async ttc(tenantId: string, filtre: Prisma.FactureWhereInput): Promise<{ centimes: number; nombre: number }> {
    const [lignes, autres, nombre] = await Promise.all([
      // Une ligne n'a pas de tenantId · la borne du dossier passe par sa facture.
      this.prisma.ligneFacture.aggregate({ where: { facture: { tenantId, ...filtre } }, _sum: { montantHT: true, montantTva: true } }),
      this.prisma.facture.aggregate({ where: { tenantId, ...filtre }, _sum: { autresImpotsEtTaxes: true } }),
      this.prisma.facture.count({ where: { tenantId, ...filtre } }),
    ]);
    return {
      centimes: centimes(lignes._sum?.montantHT) + centimes(lignes._sum?.montantTva) + centimes(autres._sum?.autresImpotsEtTaxes),
      nombre,
    };
  }

  /**
   * L'ENCOURS DU CLIENT À LA DATE (jour de Kinshasa par défaut). `venteEnCours`
   * est le TTC d'une vente pas encore enregistrée (l'écran qui la prépare).
   * Les factures de vente enregistrées sans écriture comptent, une note de
   * crédit non passée qui annule une facture passée se retranche · ni l'une
   * ni l'autre ne sont encore dans un solde.
   */
  async encours(tenantId: string, tiersId: string, date?: Date, venteEnCours = 0): Promise<EncoursLu & { tiers: { code: string; nom: string; devise: string | null } }> {
    const tiers = await this.prisma.tiers.findFirst({
      where: { id: tiersId, tenantId },
      select: { code: true, nom: true, encoursMaximum: true, devise: { select: { code: true } }, comptesRattaches: { select: { compteId: true }, take: COMPTES_MAX + 1 } },
    });
    if (!tiers) throw new NotFoundException('Tiers introuvable dans ce dossier.');
    const jour = date ?? jourDeKinshasa(new Date());
    const encoursMaximum = tiers.encoursMaximum === null ? null : Number(tiers.encoursMaximum);
    const ids = tiers.comptesRattaches.map((c) => c.compteId);
    const solde =
      ids.length > COMPTES_MAX
        ? { solde: null, motif: `ce tiers a plus de ${COMPTES_MAX} comptes rattachés` }
        : await this.soldeDesComptes(tenantId, ids, jour);
    const [enAttente, notes, ligneEnDevise] = await Promise.all([
      this.ttc(tenantId, { tiersId, sens: SensFacture.VENTE, nature: NatureFacture.FACTURE, ecritureId: null, noteDeCredit: null }),
      this.ttc(tenantId, { tiersId, sens: SensFacture.VENTE, nature: NatureFacture.NOTE_DE_CREDIT, ecritureId: null, factureAnnulee: { ecritureId: { not: null } } }),
      ids.length ? this.prisma.ligneEcriture.findFirst({ where: { compteId: { in: ids }, deviseId: { not: null }, ecriture: { tenantId, ...HORS_SITUATION } }, select: { id: true } }) : null,
    ]);
    return {
      // La devise habituelle (fonction 25) · rappelée à la vente, jamais convertie.
      tiers: { code: tiers.code, nom: tiers.nom, devise: tiers.devise?.code ?? null },
      ...jugerEncours({
        encoursMaximum,
        soldeComptable: solde.solde,
        motifSolde: solde.motif,
        facturesNonComptabilisees: (enAttente.centimes - notes.centimes) / 100,
        nombreFacturesNonComptabilisees: enAttente.nombre + notes.nombre,
        venteEnCours,
        aDesLignesEnDevise: !!ligneEnDevise,
      }),
    };
  }
}
