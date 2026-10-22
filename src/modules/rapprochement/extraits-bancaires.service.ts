import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatutRapprochement } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import type { Writable } from 'stream';
import { apresLaCle } from '../../common/lecture-par-lots';
import { PrismaService } from '../../common/prisma.service';
import { ExportService } from '../exports/export.service';
import { MAX_LIGNES_EXPORT, OPTIONS_CLASSEUR_EN_FLUX } from '../exports/classeur-en-flux';
import { FORMAT_DATE_FPM, montantFpm, poserFeuilleFpm, type ColonneFpm, type EnteteFpm } from '../exports/presentation-fpm';
import { departParmiLesClos } from './rapprochement.service';
import { arrondi } from './releve-bancaire';
import {
  COLONNES_EXTRAIT_FPM,
  ENTETES_EXTRAIT_FPM,
  LIMITE_EXTRAITS,
  MENTION_EXTRAIT,
  bornesDepuisLesDates,
  lendemain,
  nomDeFeuilleExtrait,
  ordonnerExtraits,
  periodeDesExtraits,
  soldeApres,
  type LigneExtrait,
  type SelectionExtraits,
  type TeteExtrait,
} from './extraits-bancaires';

export { LIMITE_EXTRAITS } from './extraits-bancaires';

/** Les comptes qui portent un extrait, servis avec la liste · un dossier a quelques banques, la borne dit le reste. */
export const LIMITE_COMPTES_A_EXTRAIT = 500;

/** Les lignes d'un extrait se lisent par lots, dans l'ordre du relevé, jamais d'un bloc (§ 8 bis). */
export const LOT_LIGNES_EXTRAIT = 500;

const FEUILLE_SOMMAIRE = 'Sommaire';

type LotDeLignes = Array<{
  id: string;
  rang: number;
  date: Date;
  libelle: string;
  reference: string | null;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  _count: { lignesEcriture: number; encoursOuverture: number };
}>;
const TOUT: SelectionExtraits = { compteIds: [], du: null, au: null };

const COLONNES_SOMMAIRE: ColonneFpm[] = [
  { cle: 'compte', largeur: 14, genre: 'texte', filetGauche: true },
  { cle: 'intitule', largeur: 36, genre: 'texte' },
  { cle: 'date', largeur: 12, genre: 'date' },
  { cle: 'lignes', largeur: 10, genre: 'texte' },
  { cle: 'solde', largeur: 16, genre: 'montant', filetDroit: true },
  { cle: 'feuille', largeur: 28, genre: 'texte', filetDroit: true },
];
const ENTETES_SOMMAIRE: EnteteFpm[] = [
  { colonne: 1, ligne: 0, texte: 'Compte' },
  { colonne: 2, ligne: 0, texte: 'Intitulé' },
  { colonne: 3, ligne: 0, texte: 'Date du relevé' },
  { colonne: 4, ligne: 0, texte: 'Lignes' },
  { colonne: 5, ligne: 0, texte: 'Solde imprimé' },
  { colonne: 6, ligne: 0, texte: 'Feuille' },
];

// L'instant de l'import, au jour et à l'heure de Kinshasa · `common/echeance.ts`
// ne rend que le jour, l'heure compte ici (deux imports le même jour).
const horodatage = (d: Date) => d.toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa', dateStyle: 'short', timeStyle: 'short' });

export interface CompteAExtrait {
  id: string;
  numero: string;
  intitule: string;
  /** Nombre d'extraits (relevés importés) du compte, sur tout le dossier. */
  extraits: number;
}

export interface ListeExtraits {
  extraits: TeteExtrait[];
  /** Nombre d'extraits dans la sélection demandée (comptes, dates), tranche comprise. */
  total: number;
  tronque: boolean;
  /** Les comptes du dossier qui portent au moins un extrait, quelle que soit la sélection · le choix de l'écran. */
  comptes: CompteAExtrait[];
  comptesTronques: boolean;
}

/**
 * EXTRAITS BANCAIRES (ligne sage-l3, fonction 45) · la liste des relevés
 * importés, compte par compte, et leur ÉDITION CHAÎNÉE en un classeur, une
 * feuille par extrait dans l'ordre de la banque (règles dans
 * `extraits-bancaires.ts`, décision D14). Rien n'est écrit en base par ce
 * service, hors ce que l'import pose déjà (`releveImporteLe`, `releveNomFichier`).
 */
@Injectable()
export class ExtraitsBancairesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exportService: ExportService,
  ) {}

  /**
   * La liste par compte · chaque rapprochement qui porte au moins une ligne
   * de relevé, DANS LA SÉLECTION (comptes choisis, bornes sur la date du
   * relevé, écrites dans la requête · la troncature se juge sur elle), du plus
   * ancien au plus récent, avec ses nombres et son solde de départ (celui du
   * rapprochement précédent clos, ou déclaré · `departParmiLesClos`, les clos
   * des comptes de la tranche lus en une fois). Les nombres viennent
   * d'agrégats, jamais d'une boucle sur les lignes.
   */
  async listerExtraits(tenantId: string, selection: SelectionExtraits = TOUT): Promise<ListeExtraits> {
    // La borne du dossier est ÉCRITE dans chaque appel (le balayage de
    // `cloisonnement.spec.ts` la lit par sa structure, jamais dans une
    // variable) · `filtre` ne porte que le reste.
    const filtre: Prisma.RapprochementBancaireWhereInput = {
      ...(selection.compteIds.length > 0 ? { compteId: { in: selection.compteIds } } : {}),
      // Une date de relevé peut porter une heure · la borne haute est le
      // lendemain EXCLU, pour que le jour « au » entre entier.
      ...(selection.du || selection.au
        ? { dateReleve: { ...(selection.du ? { gte: selection.du } : {}), ...(selection.au ? { lt: lendemain(selection.au) } : {}) } }
        : {}),
      releve: { some: { tenantId } },
    };
    const [total, rapprochements, parCompte] = await Promise.all([
      this.prisma.rapprochementBancaire.count({ where: { tenantId, ...filtre } }),
      this.prisma.rapprochementBancaire.findMany({
        where: { tenantId, ...filtre },
        include: { compte: { select: { id: true, numero: true, intitule: true } } },
        orderBy: [{ compte: { numero: 'asc' } }, { dateReleve: 'asc' }, { id: 'asc' }],
        take: LIMITE_EXTRAITS,
      }),
      this.prisma.rapprochementBancaire.groupBy({
        by: ['compteId'],
        where: { tenantId, releve: { some: { tenantId } } },
        _count: { _all: true },
        orderBy: { compteId: 'asc' },
        take: LIMITE_COMPTES_A_EXTRAIT + 1,
      }),
    ]);
    const ids = rapprochements.map((r) => r.id);
    const comptesDeLaTranche = [...new Set(rapprochements.map((r) => r.compteId))];
    const comptesAExtrait = parCompte.slice(0, LIMITE_COMPTES_A_EXTRAIT);
    const [sommes, rapprochees, clos, comptesNommes] = await Promise.all([
      this.prisma.ligneReleveBancaire.groupBy({
        by: ['rapprochementId'],
        where: { tenantId, rapprochementId: { in: ids } },
        _sum: { debit: true, credit: true },
        _count: { _all: true },
      }),
      this.prisma.ligneReleveBancaire.groupBy({
        by: ['rapprochementId'],
        where: {
          tenantId,
          rapprochementId: { in: ids },
          OR: [{ lignesEcriture: { some: { ecriture: { tenantId } } } }, { encoursOuverture: { some: { tenantId } } }],
        },
        _count: { _all: true },
      }),
      this.prisma.rapprochementBancaire.findMany({
        where: { tenantId, compteId: { in: comptesDeLaTranche }, statut: StatutRapprochement.CLOTURE },
        select: { compteId: true, clotureAt: true, soldeReleve: true, dateDepart: true },
        orderBy: { clotureAt: 'asc' },
      }),
      this.prisma.compte.findMany({
        where: { tenantId, id: { in: comptesAExtrait.map((c) => c.compteId) } },
        select: { id: true, numero: true, intitule: true },
        orderBy: { numero: 'asc' },
      }),
    ]);
    const sommeDe = new Map(sommes.map((s) => [s.rapprochementId, s]));
    const rapprocheesDe = new Map(rapprochees.map((s) => [s.rapprochementId, s._count._all]));
    const closDe = new Map<string, typeof clos>();
    for (const c of clos) closDe.set(c.compteId, [...(closDe.get(c.compteId) ?? []), c]);
    const extraits: TeteExtrait[] = rapprochements.map((r) => {
      const s = sommeDe.get(r.id);
      const debit = Number(s?._sum.debit ?? 0);
      const credit = Number(s?._sum.credit ?? 0);
      const { soldeDepart } = departParmiLesClos(r, closDe.get(r.compteId) ?? []);
      const mouvementsNet = arrondi(credit - debit);
      return {
        rapprochementId: r.id,
        compteId: r.compte.id,
        compteNumero: r.compte.numero,
        compteNom: r.compte.intitule,
        dateReleve: r.dateReleve,
        soldeReleve: Number(r.soldeReleve),
        soldeDepart,
        mouvementsNet,
        ecartReleve: soldeDepart === null ? null : arrondi(soldeDepart + mouvementsNet - Number(r.soldeReleve)),
        nombreLignes: s?._count._all ?? 0,
        nombreRapprochees: rapprocheesDe.get(r.id) ?? 0,
        statut: r.statut === StatutRapprochement.CLOTURE ? 'CLOTURE' : 'EN_COURS',
        releveImporteLe: r.releveImporteLe,
        releveNomFichier: r.releveNomFichier,
      };
    });
    const nombreDe = new Map(comptesAExtrait.map((c) => [c.compteId, c._count._all]));
    return {
      extraits,
      total,
      tronque: total > rapprochements.length,
      comptes: comptesNommes.map((c) => ({ ...c, extraits: nombreDe.get(c.id) ?? 0 })),
      comptesTronques: parCompte.length > LIMITE_COMPTES_A_EXTRAIT,
    };
  }

  /**
   * L'ÉDITION CHAÎNÉE · un classeur, une feuille de sommaire puis une feuille
   * par extrait retenu, compte par compte et du plus ancien au plus récent.
   * Tout se juge AVANT le premier octet · comptes du dossier, sélection non
   * vide, sélection sous la tranche, volume sous le plafond des exports (sinon
   * un classeur tronqué passerait pour complet). Un compte choisi sans extrait
   * dans les bornes est dit au sommaire, jamais tu. Les lignes se relisent
   * par lots après ces refus · un relevé qui a changé entre la liste et sa
   * feuille ARRÊTE le flux (la connexion est détruite, jamais un classeur qui
   * dit un décompte faux).
   */
  async editionChainee(
    tenantId: string,
    selection: SelectionExtraits,
    ouvrir: (nomFichier: string) => Writable,
  ): Promise<{ feuilles: number; lignes: number; comptesSansExtrait: { numero: string; intitule: string }[] }> {
    const comptesChoisis =
      selection.compteIds.length === 0
        ? []
        : await this.prisma.compte.findMany({ where: { tenantId, id: { in: selection.compteIds } }, select: { id: true, numero: true, intitule: true } });
    if (comptesChoisis.length !== selection.compteIds.length) {
      throw new NotFoundException('Un des comptes choisis est introuvable pour ce dossier · relisez la liste des comptes.');
    }
    const liste = await this.listerExtraits(tenantId, selection);
    if (liste.tronque) {
      throw new BadRequestException(
        `La sélection porte ${liste.total} extraits, au-delà des ${LIMITE_EXTRAITS} qu'une édition chaînée réunit · restreignez-la par compte ou par dates.`,
      );
    }
    const retenus = ordonnerExtraits(liste.extraits, selection);
    if (retenus.length === 0) throw new BadRequestException('Aucun extrait dans la sélection · aucun relevé importé sur ces comptes et ces dates.');
    const lignesTotales = retenus.reduce((s, e) => s + e.nombreLignes, 0);
    if (lignesTotales > MAX_LIGNES_EXPORT) {
      throw new BadRequestException(
        `${lignesTotales.toLocaleString('fr-FR')} lignes de relevé, au-delà du plafond de ${MAX_LIGNES_EXPORT.toLocaleString('fr-FR')} · restreignez l'édition par compte ou par dates.`,
      );
    }
    const comptesSansExtrait = comptesChoisis
      .filter((c) => !retenus.some((e) => e.compteId === c.id))
      .map((c) => ({ numero: c.numero, intitule: c.intitule }));

    const jour = (d: Date) => d.toISOString().slice(0, 10);
    const identite = await this.exportService.identiteEtat(tenantId, {
      ...(selection.du ? { dateDebut: jour(selection.du) } : {}),
      ...(selection.au ? { dateFin: jour(selection.au) } : {}),
    });
    const { debut, fin } = periodeDesExtraits(retenus, selection);

    const sortie = ouvrir(`extraits-bancaires-${jour(debut)}-${jour(fin)}.xlsx`);
    const classeur = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: sortie, ...OPTIONS_CLASSEUR_EN_FLUX });
    classeur.creator = 'OmegaX';
    classeur.created = new Date();

    // Les noms de feuille se posent AVANT le sommaire, qui les cite.
    const pris = new Set<string>([FEUILLE_SOMMAIRE]);
    const feuilleDe = new Map(retenus.map((e) => [e.rapprochementId, nomDeFeuilleExtrait(e.compteNumero, e.dateReleve, pris)]));

    const sommaire = poserFeuilleFpm(classeur, sortie, {
      nomFeuille: FEUILLE_SOMMAIRE,
      titre: 'Extraits bancaires',
      sousTitre: `Édition chaînée · ${retenus.length} extrait${retenus.length > 1 ? 's' : ''}`,
      identite,
      debut,
      fin,
      colonnes: COLONNES_SOMMAIRE,
      entetes: ENTETES_SOMMAIRE,
      lignesEntete: 1,
      mention: MENTION_EXTRAIT,
    });
    for (const e of retenus) {
      await sommaire.ajouter({
        compte: e.compteNumero,
        intitule: e.compteNom,
        date: e.dateReleve,
        lignes: e.nombreLignes,
        solde: montantFpm(e.soldeReleve),
        feuille: feuilleDe.get(e.rapprochementId),
      });
    }
    for (const c of comptesSansExtrait) {
      await sommaire.ajouter({ compte: c.numero, intitule: c.intitule, feuille: 'Aucun extrait dans la sélection' });
    }
    sommaire.fermer();

    let lignesEcrites = 0;
    for (const e of retenus) {
      const importe = e.releveImporteLe
        ? `fichier « ${e.releveNomFichier ?? 'sans nom'} » importé le ${horodatage(e.releveImporteLe)}`
        : 'import non daté (relevé importé avant la fonction)';
      // Le cartouche se pose avant les lignes (rien ne se relit en flux) · sa
      // période vient d'un agrégat, jamais des lignes rapatriées.
      const dates = await this.prisma.ligneReleveBancaire.aggregate({
        where: { tenantId, rapprochementId: e.rapprochementId },
        _min: { date: true },
        _max: { date: true },
      });
      const bornes = bornesDepuisLesDates(e, dates._min.date, dates._max.date);
      const feuille = poserFeuilleFpm(classeur, sortie, {
        nomFeuille: feuilleDe.get(e.rapprochementId)!,
        titre: `Extrait ${e.compteNumero}`,
        sousTitre: `${e.compteNom} · relevé au ${e.dateReleve.toLocaleDateString('fr-FR')} · rapprochement ${e.statut === 'CLOTURE' ? 'clos' : 'en cours'}`,
        identite,
        debut: bornes.debut,
        fin: bornes.fin,
        colonnes: COLONNES_EXTRAIT_FPM,
        entetes: ENTETES_EXTRAIT_FPM,
        lignesEntete: 1,
        mention: `${MENTION_EXTRAIT} · ${importe}`,
      });
      // Le solde de départ s'écrit même nul · un zéro DÉCLARÉ se distingue
      // d'un solde inconnu ; les autres montants suivent la présentation du
      // cabinet (un zéro est une cellule vide, `montantFpm`).
      await feuille.ajouter({ libelle: 'Solde de départ', solde: e.soldeDepart, rapprochee: e.soldeDepart === null ? 'inconnu' : null }, { gras: true });
      let solde = e.soldeDepart;
      let debit = 0;
      let credit = 0;
      let lues = 0;
      let rapprocheesLues = 0;
      let apres: { rang: number; id: string } | null = null;
      for (;;) {
        const lot: LotDeLignes = await this.prisma.ligneReleveBancaire.findMany({
          where: {
            tenantId,
            rapprochementId: e.rapprochementId,
            ...(apres ? apresLaCle<Prisma.LigneReleveBancaireWhereInput>([{ champ: 'rang', valeur: apres.rang }, { champ: 'id', valeur: apres.id }]) : {}),
          },
          orderBy: [{ rang: 'asc' }, { id: 'asc' }],
          take: LOT_LIGNES_EXTRAIT,
          include: { _count: { select: { lignesEcriture: true, encoursOuverture: true } } },
        });
        for (const l of lot) {
          const ligne: LigneExtrait = {
            rang: l.rang,
            date: l.date,
            libelle: l.libelle,
            reference: l.reference,
            debit: Number(l.debit),
            credit: Number(l.credit),
            rapprochee: l._count.lignesEcriture > 0 || l._count.encoursOuverture > 0,
          };
          solde = soldeApres(solde, ligne);
          debit += ligne.debit;
          credit += ligne.credit;
          lues += 1;
          if (ligne.rapprochee) rapprocheesLues += 1;
          await feuille.ajouter({
            rang: ligne.rang,
            date: ligne.date,
            libelle: ligne.libelle,
            reference: ligne.reference,
            debit: montantFpm(ligne.debit),
            credit: montantFpm(ligne.credit),
            solde: solde === null ? null : montantFpm(solde),
            rapprochee: ligne.rapprochee ? 'Oui' : null,
          });
        }
        if (lot.length < LOT_LIGNES_EXTRAIT) break;
        apres = { rang: lot[lot.length - 1].rang, id: lot[lot.length - 1].id };
      }
      if (lues !== e.nombreLignes || rapprocheesLues !== e.nombreRapprochees) {
        throw new Error(
          `L'extrait ${e.compteNumero} du ${jour(e.dateReleve)} a changé pendant l'édition (${e.nombreLignes} lignes comptées, ${lues} lues) · relancez l'édition.`,
        );
      }
      await feuille.ajouter({ libelle: 'Total des mouvements', debit: montantFpm(debit), credit: montantFpm(credit) }, { gras: true, filetHaut: true });
      await feuille.ajouter({ libelle: 'Solde du relevé (imprimé par la banque)', solde: montantFpm(e.soldeReleve) }, { gras: true });
      if (e.ecartReleve !== null && Math.abs(e.ecartReleve) >= 0.005) {
        await feuille.ajouter({ libelle: 'Écart entre le solde reconstitué et le solde imprimé', solde: montantFpm(e.ecartReleve) }, { gras: true });
      }
      await feuille.ajouter({ libelle: `${rapprocheesLues} ligne(s) rapprochée(s) sur ${lues}` });
      feuille.fermer();
      lignesEcrites += lues;
    }
    await classeur.commit();
    return { feuilles: retenus.length + 1, lignes: lignesEcrites, comptesSansExtrait };
  }
}

/** Le format de date du cartouche, repris pour les cellules de date des lignes. */
export const FORMAT_DATE_EXTRAIT = FORMAT_DATE_FPM;
