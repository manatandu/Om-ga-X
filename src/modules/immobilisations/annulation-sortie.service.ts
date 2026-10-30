import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { retirerLesLignesLibres } from '../comptabilite/lignes-libres';
import { prendreLeVerrouDuDossierBorne } from '../../common/transaction-de-saisie';
import { NatureMouvementDepreciation, NatureTraitementImmobilisation, Prisma, StatutEcriture, StatutExercice, StatutImmobilisation } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { libelleReference, referencesVers } from '../../common/suppression/references';
import { EcritureService } from '../comptabilite/ecriture.service';
import { motifLignesTenues } from '../comptabilite/lignes-tenues';
import { HORS_SITUATION } from '../comptabilite/ecritures-de-situation';
import { AnnulationTraitementService } from './annulation-traitement.service';
import { NATURES_ANNULABLES } from './annulation-traitement';
import { compteStockRecupere } from './materiel-recupere';
import {
  ActePosterieur,
  complementDUneSortieAncienne,
  LIBELLE_ROLE,
  lirePassesEcart,
  motifRefusAnnulationSortie,
  motifRefusMotifAnnulationSortie,
  ORDRE_DES_ROLES,
  PassEcart,
  RoleEcritureSortie,
} from './annulation-sortie';

type Db = Prisma.TransactionClient | PrismaService;
const n = (d: unknown) => Number(d ?? 0);
const jour = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('/');

/**
 * Les modules qui RETIENNENT les écritures d'une sortie et que l'annulation
 * libère elle-même · tout autre détenteur refuse (`detenteursDeLEcriture`,
 * même liste que le refus de supprimer).
 */
const DETENTEURS_LIBERES = new Set([
  'une immobilisation (sortie)',
  'une immobilisation (produit de cession)',
  'une immobilisation (écart de réévaluation soldé à la sortie)',
  'une immobilisation (dotation complémentaire de la sortie)',
  'une dotation aux amortissements',
  "une dépréciation d'immobilisation",
]);

/** Ce que l'annulation lit d'une sortie. */
interface SortieLue {
  fiche: {
    id: string;
    designation: string;
    statut: StatutImmobilisation;
    dateSortie: Date | null;
    createdAt: Date;
    fractionDeId: string | null;
    quantite: number;
    valeurOrigine: number;
    valeurResiduelle: number;
    amortissementAnterieur: number;
  };
  lot: { id: string; designation: string; statut: StatutImmobilisation } | null;
  exercice: { id: string; dateFin: Date; statut: StatutExercice } | null;
  ecritures: Array<{ role: RoleEcritureSortie; id: string; numeroPiece: number | null; statut: StatutEcriture; montant: number }>;
  dotationComplementId: string | null;
  repriseLotId: string | null;
  passes: PassEcart[];
  motifRefus: string | null;
  /** L'instantané de la fiche (et du lot), gardé par l'historique. */
  instantane: Record<string, unknown>;
}

/**
 * ANNULER LA SORTIE D'UNE IMMOBILISATION · voir `annulation-sortie.ts` pour le
 * texte et les règles. Lit la sortie, la juge, et sous le verrou de la fiche
 * (et du lot) la rejoue · retire ou inscrit en négatif chacune de ses
 * écritures, rend à la fiche ce que la sortie lui avait pris, garde
 * l'historique.
 */
@Injectable()
export class AnnulationSortieService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ecritures: EcritureService,
    private readonly traitements: AnnulationTraitementService,
  ) {}

  /** L'aperçu · ce que l'annulation retirerait ou inscrirait en négatif, ou pourquoi elle est refusée. */
  async apercu(tenantId: string, id: string) {
    const l = await this.lire(this.prisma, tenantId, id);
    return {
      sortie: l.fiche.statut !== StatutImmobilisation.EN_SERVICE,
      annulable: l.motifRefus === null,
      motifRefus: l.motifRefus,
      partielle: !!l.fiche.fractionDeId,
      lot: l.lot ? { id: l.lot.id, designation: l.lot.designation } : null,
      ecritures: l.ecritures.map((e) => ({
        role: e.role,
        libelle: LIBELLE_ROLE[e.role],
        numeroPiece: e.numeroPiece,
        statut: e.statut,
        montant: e.montant,
        traitement: e.statut === StatutEcriture.BROUILLARD ? 'SUPPRIMEE' : 'INSCRITE_EN_NEGATIF',
      })),
    };
  }

  async annuler(tenantId: string, userId: string, id: string, motifSaisi: string) {
    const refusMotif = motifRefusMotifAnnulationSortie(motifSaisi);
    if (refusMotif) throw new BadRequestException(refusMotif);
    const motif = motifSaisi.trim();
    const avant = await this.lire(this.prisma, tenantId, id);
    if (avant.motifRefus) throw new BadRequestException(avant.motifRefus);

    return transactionJournalisee(this.prisma, async (tx) => {
      // Le dossier avant toute ligne ou fiche (saisie-serialisable, second tour, point 1).
      await prendreLeVerrouDuDossierBorne(tx, tenantId);
      // LE VERROU DES FICHES, dans un ordre fixe · celui que prennent la
      // dotation et l'annulation des traitements.
      const ids = [id, ...(avant.fiche.fractionDeId ? [avant.fiche.fractionDeId] : [])].sort();
      await tx.$queryRaw`SELECT id FROM "immobilisations" WHERE "tenantId" = ${tenantId} AND id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
      const c = await this.lire(tx, tenantId, id);
      if (c.motifRefus) throw new BadRequestException(c.motifRefus);

      // 1 · chaque écriture validée s'inscrit en négatif (art. 20, al. 2) ;
      // celles du brouillard partiront après la fiche, qui les retient.
      const traitees: Array<{ role: RoleEcritureSortie; id: string; numeroPiece: number | null; montant: number; negatif: { id: string; numeroPiece: number | null; date: Date } | null }> = [];
      for (const e of c.ecritures) {
        const negatif = e.statut === StatutEcriture.BROUILLARD ? null : await this.ecritures.inscrireEnNegatifPourAnnulation(tenantId, userId, e.id, motif, tx);
        traitees.push({ role: e.role, id: e.id, numeroPiece: e.numeroPiece, montant: e.montant, negatif });
      }

      // 2 · les lignes de réévaluation reprennent ce que la sortie leur a pris.
      for (const p of c.passes) {
        const ligne = await tx.ligneReevaluationBilan.findFirst({ where: { id: p.ligneId, tenantId }, select: { id: true } });
        if (!ligne) throw new ConflictException('Une ligne de réévaluation soldée par la sortie n’existe plus · rien n’est annulé.');
        await tx.ligneReevaluationBilan.update({
          where: { id: ligne.id },
          data: p.traitement === 'RESERVE' ? { ecartTransfere: { decrement: p.montant } } : { provisionReprise: { decrement: p.montant } },
        });
      }

      // 3 · la fiche lâche ses écritures, puis la dotation complémentaire part.
      await tx.immobilisation.update({
        where: { id },
        data: {
          statut: StatutImmobilisation.EN_SERVICE,
          dateSortie: null,
          prixCession: null,
          natureSortie: null,
          referencePieceSortie: null,
          datePieceSortie: null,
          ecritureSortieId: null,
          ecritureProduitCessionId: null,
          ecritureSortieEcartReevaluationId: null,
          ecritureComplementSortieId: null,
          passesEcartSortie: Prisma.DbNull,
          valeurMaterielRecupere: null,
          sourceMaterielRecupere: null,
          repriseDepreciationLotId: null,
        },
      });
      if (c.dotationComplementId) await tx.dotationAmortissement.delete({ where: { id: c.dotationComplementId } });

      // 4 · sortie partielle · la reprise de la part sur le lot part, les unités
      // reviennent au lot au centime, et la fiche des unités disparaît.
      if (c.fiche.fractionDeId) {
        if (c.repriseLotId) await tx.depreciationImmobilisation.delete({ where: { id: c.repriseLotId } });
        await tx.immobilisation.update({
          where: { id: c.fiche.fractionDeId },
          data: {
            quantite: { increment: c.fiche.quantite },
            valeurOrigine: { increment: c.fiche.valeurOrigine },
            valeurResiduelle: { increment: c.fiche.valeurResiduelle },
            amortissementsDetaches: { decrement: c.fiche.amortissementAnterieur },
          },
        });
      }

      // 5 · l'historique · une ligne par écriture, qui retient l'origine validée
      // et son négatif ; l'instantané de la fiche sur chacune.
      const surLaFiche = c.fiche.fractionDeId ?? id;
      for (const t of traitees) {
        await tx.annulationTraitementImmobilisation.create({
          data: {
            tenantId,
            nature: NatureTraitementImmobilisation.SORTIE,
            immobilisationId: surLaFiche,
            exerciceId: c.exercice!.id,
            acteId: id,
            acte: {
              role: t.role,
              libelle: `Annulation de la sortie de « ${c.fiche.designation} » · ${LIBELLE_ROLE[t.role]}`,
              biens: [surLaFiche],
              fiche: c.instantane,
            } as Prisma.InputJsonValue,
            montant: t.montant,
            motif,
            traitement: t.negatif ? 'INSCRITE_EN_NEGATIF' : 'SUPPRIMEE',
            numeroPieceOrigine: t.numeroPiece,
            ecritureOrigineId: t.negatif ? t.id : null,
            ecritureNegatifId: t.negatif?.id ?? null,
            annuleePar: userId,
          },
        });
      }
      // Ce qui visait la fiche des unités a été jugé par `lire`, sous le verrou.
      if (c.fiche.fractionDeId) await tx.immobilisation.delete({ where: { id } });

      // 6 · les écritures du brouillard, une et une seule chacune, ENCORE au
      // brouillard, sinon rien ne part (409).
      for (const t of traitees.filter((x) => !x.negatif)) {
        // Lignes libres seulement, sous le verrou du dossier (saisie-serialisable, second tour, point 1) · une ligne lettrée ou
        // pointée pendant le geste ne part plus avec son écriture, le groupe amputé en silence.
        await retirerLesLignesLibres(tx, tenantId, t.id, { statut: StatutEcriture.BROUILLARD }, { laisserNommerLEcriture: true });
        const r = await tx.ecriture.deleteMany({ where: { id: t.id, tenantId, statut: StatutEcriture.BROUILLARD } });
        if (r.count !== 1) {
          throw new ConflictException(
            "Une écriture de la sortie a été validée ou retirée pendant l'annulation · rien n'est annulé. Relancez · validée, elle " +
              "s'inscrira en négatif (AUDCIF art. 20, al. 2).",
          );
        }
      }
      return {
        annule: true,
        partielle: !!c.fiche.fractionDeId,
        fiche: { id: surLaFiche },
        ecritures: traitees.map((t) => ({
          role: t.role,
          libelle: LIBELLE_ROLE[t.role],
          numeroPieceOrigine: t.numeroPiece,
          traitement: t.negatif ? 'INSCRITE_EN_NEGATIF' : 'SUPPRIMEE',
          negatif: t.negatif ? { id: t.negatif.id, numeroPiece: t.negatif.numeroPiece, date: jour(t.negatif.date) } : null,
        })),
      };
    });
  }

  // ---------------------------------------------------------------------------
  // La lecture et le jugement · une seule, pour l'aperçu et pour le geste
  // ---------------------------------------------------------------------------

  private async lire(db: Db, tenantId: string, id: string): Promise<SortieLue> {
    const f = await db.immobilisation.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        designation: true,
        statut: true,
        dateSortie: true,
        createdAt: true,
        fractionDeId: true,
        immobilisationPrincipaleId: true,
        quantite: true,
        valeurOrigine: true,
        valeurResiduelle: true,
        amortissementAnterieur: true,
        natureSortie: true,
        prixCession: true,
        referencePieceSortie: true,
        datePieceSortie: true,
        ecritureSortieId: true,
        ecritureProduitCessionId: true,
        ecritureSortieEcartReevaluationId: true,
        ecritureComplementSortieId: true,
        passesEcartSortie: true,
        repriseDepreciationLotId: true,
        valeurMaterielRecupere: true,
        sourceMaterielRecupere: true,
        dotations: { select: { id: true, exerciceId: true, ecritureId: true, ecriture: { select: { date: true } } } },
      },
    });
    if (!f) throw new NotFoundException('Immobilisation introuvable pour ce dossier.');
    const fiche = {
      id: f.id,
      designation: f.designation,
      statut: f.statut,
      dateSortie: f.dateSortie,
      createdAt: f.createdAt,
      fractionDeId: f.fractionDeId,
      quantite: f.quantite,
      valeurOrigine: n(f.valeurOrigine),
      valeurResiduelle: n(f.valeurResiduelle),
      amortissementAnterieur: n(f.amortissementAnterieur),
    };
    const vide = (motifRefus: string): SortieLue => ({
      fiche,
      lot: null,
      exercice: null,
      ecritures: [],
      dotationComplementId: null,
      repriseLotId: null,
      passes: [],
      motifRefus,
      instantane: {},
    });
    const sortie = f.statut !== StatutImmobilisation.EN_SERVICE && !!f.dateSortie;
    const base = {
      sortie,
      transfertGroupe: false,
      echange: false,
      renouvelePar: null,
      optionLocationDeclaree: false,
      principalSorti: null,
      exerciceIntrouvable: false,
      exerciceClos: false,
      complementIndistinct: false,
      ecartSansParts: false,
      repriseLotIndistincte: false,
      lotSorti: false,
      refusEcriture: null,
      posterieurs: [],
    };
    if (!sortie) return vide(motifRefusAnnulationSortie(base)!);

    const [transfert, renouvellement, lot, contratDeclare, principal] = await Promise.all([
      db.transfertImmobilisationGroupe.findFirst({ where: { tenantId, immobilisationId: id, sens: 'SORTIE', annuleLe: null }, select: { id: true } }),
      db.immobilisation.findFirst({ where: { tenantId, composantRemplaceId: id }, select: { designation: true } }),
      f.fractionDeId ? db.immobilisation.findFirst({ where: { id: f.fractionDeId, tenantId }, select: { id: true, designation: true, statut: true } }) : null,
      // LA VOIE SÛRE (relecture du 2026-10-30, bloquant) · la levée ou la
      // non-levée de l'option se déclare UNE fois (AUDCIF Titre VIII ch. 8
      // § 2.1.9, `declarerOption`) et la clôture du contrat la relit · la
      // remettre à nul effacerait une décision datée que rien ne redemande
      // d'office. La sortie d'un bien dont l'option est déclarée ne s'annule
      // donc pas, et c'est dit.
      db.contratLocationAcquisition.findFirst({ where: { tenantId, immobilisationId: id, optionLevee: { not: null } }, select: { id: true } }),
      f.immobilisationPrincipaleId
        ? db.immobilisation.findFirst({ where: { id: f.immobilisationPrincipaleId, tenantId }, select: { designation: true, statut: true } })
        : null,
    ]);
    const ecritureSortie = f.ecritureSortieId
      ? await db.ecriture.findFirst({ where: { id: f.ecritureSortieId, tenantId, ...HORS_SITUATION }, select: { exerciceId: true, createdAt: true } })
      : null;
    const exercice = ecritureSortie
      ? await db.exercice.findFirst({ where: { id: ecritureSortie.exerciceId, tenantId }, select: { id: true, dateFin: true, statut: true } })
      : await db.exercice.findFirst({
          where: { tenantId, dateDebut: { lte: f.dateSortie! }, dateFin: { gte: f.dateSortie! } },
          select: { id: true, dateFin: true, statut: true },
        });
    const premiers = motifRefusAnnulationSortie({
      ...base,
      transfertGroupe: !!transfert,
      echange: f.natureSortie === 'ECHANGE',
      renouvelePar: renouvellement?.designation ?? null,
      optionLocationDeclaree: !!contratDeclare,
      principalSorti: principal && principal.statut !== StatutImmobilisation.EN_SERVICE ? principal.designation : null,
      exerciceIntrouvable: !exercice,
      exerciceClos: !!exercice && exercice.statut === StatutExercice.CLOTURE,
    });
    if (premiers || !exercice) return { ...vide(premiers ?? "L'exercice de la sortie est introuvable dans ce dossier · rien n'est annulé."), lot, exercice };

    // LA SORTIE D'AVANT LA LIGNE se reconnaît à l'absence de la liste des
    // parts (`passesEcartSortie` nul) · toute sortie passée depuis en pose
    // une, vide quand rien n'est soldé.
    const passes = lirePassesEcart(f.passesEcartSortie);
    const ancienne = passes === null;
    let dotationComplementId: string | null = null;
    let complementIndistinct = false;
    if (f.ecritureComplementSortieId) {
      dotationComplementId = f.dotations.find((d) => d.ecritureId === f.ecritureComplementSortieId)?.id ?? null;
    } else if (ancienne) {
      const lu = complementDUneSortieAncienne({
        ficheDesUnites: !!f.fractionDeId,
        dateSortie: f.dateSortie!,
        finExercice: exercice.dateFin,
        dotationsDeLExercice: f.dotations.filter((d) => d.exerciceId === exercice.id).map((d) => ({ id: d.id, dateEcriture: d.ecriture?.date ?? null })),
      });
      dotationComplementId = lu.dotationId;
      complementIndistinct = lu.indistinct;
    }
    const ecritureComplementId = dotationComplementId ? (f.dotations.find((d) => d.id === dotationComplementId)?.ecritureId ?? null) : null;

    // La reprise de la part de dépréciation sur le lot (sortie partielle).
    let repriseLotId: string | null = f.repriseDepreciationLotId;
    let repriseLotIndistincte = false;
    if (f.fractionDeId && !repriseLotId && ancienne) {
      const [reprises, fractions] = await Promise.all([
        db.depreciationImmobilisation.findMany({
          where: { immobilisationId: f.fractionDeId, exerciceId: exercice.id, nature: NatureMouvementDepreciation.CESSION_PARTIELLE, immobilisation: { tenantId } },
          select: { id: true },
        }),
        db.immobilisation.count({ where: { tenantId, fractionDeId: f.fractionDeId, dateSortie: { gte: f.dateSortie!, lte: exercice.dateFin } } }),
      ]);
      if (reprises.length === 1 && fractions === 1) repriseLotId = reprises[0].id;
      else if (reprises.length > 0) repriseLotIndistincte = true;
    }
    const reprise = repriseLotId
      ? await db.depreciationImmobilisation.findFirst({ where: { id: repriseLotId, immobilisation: { tenantId } }, select: { id: true, ecritureId: true } })
      : null;
    // La reprise nommée par la fiche des unités, sans clé étrangère (schéma) ·
    // introuvable, le refus le DIT au lieu d'un échec de suppression.
    let refusEcriture: string | null =
      repriseLotId && !reprise
        ? 'La reprise de la part de dépréciation passée sur le lot pour ces unités est introuvable · rien n’est annulé d’office ; ' +
          'la correction passe alors par une écriture en négatif saisie par le cabinet, avec son motif (AUDCIF art. 20, al. 2).'
        : null;

    // Les écritures, dans l'ordre où elles se défont.
    const parRole: Partial<Record<RoleEcritureSortie, string | null>> = {
      ECART: f.ecritureSortieEcartReevaluationId,
      PRODUIT: f.ecritureProduitCessionId,
      SORTIE: f.ecritureSortieId,
      COMPLEMENT: ecritureComplementId,
      REPRISE_LOT: reprise?.ecritureId ?? null,
    };
    const ids = ORDRE_DES_ROLES.map((r) => parRole[r]).filter((x): x is string => !!x);
    const lues = ids.length
      ? await db.ecriture.findMany({
          where: { tenantId, id: { in: ids }, ...HORS_SITUATION },
          select: {
            id: true,
            numeroPiece: true,
            statut: true,
            correction: { select: { id: true } },
            lignes: { select: { debit: true, lettre: true, lettrageId: true, rapprochementId: true, compte: { select: { id: true, numero: true } } } },
          },
        })
      : [];
    const parId = new Map(lues.map((e) => [e.id, e]));
    const ecritures: SortieLue['ecritures'] = [];
    for (const role of ORDRE_DES_ROLES) {
      const eid = parRole[role];
      if (!eid) continue;
      const e = parId.get(eid);
      if (!e) {
        refusEcriture = refusEcriture ?? `L'écriture de la ${LIBELLE_ROLE[role]} n'existe plus · relisez la fiche du bien avant d'annuler.`;
        continue;
      }
      const nom = `l'écriture n° ${e.numeroPiece ?? '·'} (${LIBELLE_ROLE[role]})`;
      if (!refusEcriture && e.correction) {
        refusEcriture = `${nom.charAt(0).toUpperCase()}${nom.slice(1)} est déjà corrigée par inscription en négatif · elle ne s’annule pas une seconde fois.`;
      }
      refusEcriture = refusEcriture ?? motifLignesTenues(e.lignes, nom, 'annuler', ', puis annulez la sortie');
      if (!refusEcriture) {
        const autres = (await this.ecritures.detenteursDeLEcriture(tenantId, e.id, db)).filter((d) => !DETENTEURS_LIBERES.has(d));
        if (autres.length > 0) {
          refusEcriture = `${nom.charAt(0).toUpperCase()}${nom.slice(1)} est aussi la contrepartie de ${autres.join(' et ')} · reprenez d’abord l’opération dans son module, puis annulez la sortie.`;
        }
      }
      const montant = Math.round(e.lignes.reduce((t, x) => t + n(x.debit), 0) * 100) / 100;
      ecritures.push({ role, id: e.id, numeroPiece: e.numeroPiece, statut: e.statut, montant });
    }

    // LE MATÉRIEL RÉCUPÉRÉ (lot 15) · la sortie l'a porté au 388 (SYSCOHADA) ou
    // au 378 (SYCEBNL) ; l'annuler le retire de ce stock. Consommé depuis, le
    // stock passerait négatif en silence · refusé, la valeur dite.
    const valeurRecuperee = n(f.valeurMaterielRecupere);
    if (!refusEcriture && valeurRecuperee > 0.004) {
      const dossier = await db.tenant.findFirst({ where: { id: tenantId }, select: { referentiel: true } });
      const racineStock = dossier ? compteStockRecupere(dossier.referentiel).racine : null;
      const sortieLue = f.ecritureSortieId ? parId.get(f.ecritureSortieId) : undefined;
      const ligneStock = racineStock ? sortieLue?.lignes.find((l) => l.compte.numero.startsWith(racineStock) && n(l.debit) > 0) : undefined;
      if (!ligneStock) {
        refusEcriture = 'La reprise en stock du matériel récupéré ne se retrouve pas sur l’écriture de sortie · rien n’est annulé d’office.';
      } else {
        const soldes = await db.ligneEcriture.aggregate({
          where: { compteId: ligneStock.compte.id, ecriture: { tenantId, exerciceId: exercice.id, estANouveauProvisoire: false, ...HORS_SITUATION } },
          _sum: { debit: true, credit: true },
        });
        const reste = Math.round((n(soldes._sum.debit) - n(soldes._sum.credit)) * 100);
        if (reste < Math.round(valeurRecuperee * 100)) {
          refusEcriture =
            `Le matériel récupéré (${valeurRecuperee.toFixed(2)}) porté au compte ${ligneStock.compte.numero} a été consommé depuis · ` +
            `le compte n’en porte plus que ${(reste / 100).toFixed(2)}, et annuler la sortie le rendrait négatif. Annulez d’abord la ` +
            'consommation du stock, puis la sortie.';
        }
      }
    }

    // LA FICHE DES UNITÉS PART AVEC L'ANNULATION · ce qui la vise encore (une
    // pièce jointe, un document) est dit dès l'aperçu, jamais au geste seul.
    let refusFiche: string | null = null;
    if (f.fractionDeId) {
      const reste = await referencesVers(db, 'Immobilisation', id, tenantId, ['DotationAmortissement.immobilisationId']);
      if (reste.length > 0) {
        refusFiche = `La fiche des unités porte encore ${reste.map(libelleReference).join(', ')} · retirez-les d’abord, puis annulez la sortie.`;
      }
    }

    // CE QUI A SUIVI LA SORTIE · sur la fiche sortie, tout acte enregistré
    // après l'écriture de sortie ; sur le lot d'une sortie partielle, tout acte
    // enregistré après la naissance de la fiche des unités, sa reprise exceptée.
    const posterieurs: ActePosterieur[] = [];
    const seuil = ecritureSortie?.createdAt ?? f.dateSortie!;
    const actes = await this.traitements.actesDesBiens(db, tenantId, [id]);
    for (const a of actes) {
      if (a.nature === 'SORTIE') continue;
      if (a.nature === 'DOTATION' && a.id === dotationComplementId) continue;
      if (a.creeLe.getTime() <= seuil.getTime()) continue;
      posterieurs.push({ libelle: a.libelle, issue: a.issue ?? issuePour(a.nature), creeLe: a.creeLe });
    }
    // LA RÉÉVALUATION DE L'EXERCICE, datée au plus tôt de la sortie · elle a
    // recensé les biens au bilan sans celui-ci (AUDCIF Titre VIII ch. 28) ;
    // rendu en service après elle, il serait au bilan sans avoir été réévalué.
    const reevaluation = await db.reevaluationBilan.findFirst({
      where: { tenantId, exerciceId: exercice.id, dateReevaluation: { gte: f.dateSortie! } },
      select: { createdAt: true, dateReevaluation: true },
    });
    if (reevaluation) {
      posterieurs.push({
        libelle: `la réévaluation des immobilisations du ${jour(reevaluation.dateReevaluation)}`,
        issue: 'annulez d’abord la réévaluation (onglet Traitements d’un bien qu’elle a réévalué)',
        creeLe: reevaluation.createdAt,
      });
    }
    if (lot && f.fractionDeId) {
      const actesLot = await this.traitements.actesDesBiens(db, tenantId, [lot.id]);
      for (const a of actesLot) {
        if (a.nature === 'SORTIE') continue;
        if (a.id === id || a.id === repriseLotId) continue;
        if (a.creeLe.getTime() <= f.createdAt.getTime()) continue;
        posterieurs.push({ libelle: `${a.libelle} (lot « ${lot.designation} »)`, issue: a.issue ?? issuePour(a.nature), creeLe: a.creeLe });
      }
    }

    const motifRefus = motifRefusAnnulationSortie({
      ...base,
      complementIndistinct,
      ecartSansParts: ancienne && !!f.ecritureSortieEcartReevaluationId,
      repriseLotIndistincte,
      lotSorti: !!lot && lot.statut !== StatutImmobilisation.EN_SERVICE,
      refusEcriture: refusEcriture ?? refusFiche,
      posterieurs,
    });
    return {
      fiche,
      lot,
      exercice,
      ecritures,
      dotationComplementId,
      repriseLotId,
      passes: passes ?? [],
      motifRefus,
      instantane: {
        id: f.id,
        designation: f.designation,
        statut: f.statut,
        dateSortie: f.dateSortie,
        natureSortie: f.natureSortie,
        prixCession: f.prixCession === null ? null : n(f.prixCession),
        referencePieceSortie: f.referencePieceSortie,
        datePieceSortie: f.datePieceSortie,
        quantite: f.quantite,
        valeurOrigine: fiche.valeurOrigine,
        valeurResiduelle: fiche.valeurResiduelle,
        amortissementAnterieur: fiche.amortissementAnterieur,
        fractionDeId: f.fractionDeId,
        valeurMaterielRecupere: f.valeurMaterielRecupere === null ? null : n(f.valeurMaterielRecupere),
        sourceMaterielRecupere: f.sourceMaterielRecupere,
        passesEcartSortie: passes,
      },
    };
  }
}

/** L'issue d'un acte postérieur · annulable depuis l'onglet Traitements, ou pas dans OmegaX. */
function issuePour(nature: string): string | null {
  if ((NATURES_ANNULABLES as readonly string[]).includes(nature)) return 'annulez-le d’abord depuis l’onglet Traitements de la fiche';
  if (nature === 'CESSION_PARTIELLE') return 'annulez d’abord la sortie de ces unités depuis leur fiche (« Annuler la sortie »)';
  if (nature === 'DEROGATOIRE_SOLDE') return 'annulez-la d’abord depuis l’onglet Traitements de la fiche';
  return null;
}
