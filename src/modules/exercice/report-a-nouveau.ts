/**
 * REPORT À-NOUVEAU · le calcul, sans Prisma, UNE fois pour deux appelants.
 *
 * La clôture (`ExerciceService.cloturer`) produit le report DÉFINITIF ; le
 * nouvel exercice ouvert avant elle produit un report PROVISOIRE, que Sage
 * i7 permet « à tout moment […] de lancer, voir de relancer » (Traitement /
 * Fin d'exercice / Nouvel exercice). Les deux doivent rendre le même report
 * sur le même livre-journal : un second calcul écrit à part divergerait au
 * premier correctif, et le bilan d'ouverture provisoire ne ressemblerait plus
 * au définitif.
 *
 * La règle est celle du mode de chaque compte (`modeReportANouveau`) :
 * AUCUN (gestion) se solde sur le résultat, SOLDE reporte son solde (par
 * devise, voir `soldesParDevise`), DÉTAIL reporte chaque mouvement NON lettré
 * avec son échéance.
 *
 * CE QUE LE CALCUL LIT D'UN COMPTE (audit final F185) · un compte au DÉTAIL
 * reporte ses mouvements un à un, il lui faut ses lignes. Un compte au SOLDE
 * ou de gestion ne reporte que des SOMMES · son débit et son crédit, et ses
 * lignes en devise cumulées par devise et par sens (`SommesRan`). La clôture
 * et le report provisoire les demandent à la base, sans monter ces lignes en
 * mémoire ; un compte décrit par ses lignes est réduit aux mêmes sommes par
 * `sommesDesLignes`, qui est la définition que la requête reproduit.
 */

export type ModeRan = 'AUCUN' | 'SOLDE' | 'DETAIL';

/** Une ligne lue une à une · celles d'un compte au DÉTAIL. */
export interface LigneLueRan {
  debit: number;
  credit: number;
  lettre: string | null;
  libelle: string;
  dateEcheance: Date | null;
  /** L'opération en devise de la ligne (audit final F55) · voir `soldesParDevise`. */
  deviseId?: string | null;
  montantDevise?: number | null;
  coursApplique?: number | null;
}

/**
 * Des lignes en devise d'un compte, cumulées pour UNE devise et UN sens. Le
 * sens est celui de CHAQUE ligne · +1 quand son débit moins son crédit est
 * positif ou nul, −1 sinon. Il ne se déduit pas des cumuls : le montant en
 * devise est gardé sans signe, et une ligne inscrite en négatif (réimputation,
 * correction) le retranche alors qu'elle est portée au débit.
 */
export interface SommeEnDeviseRan {
  deviseId: string;
  sens: 1 | -1;
  debit: number;
  credit: number;
  montantDevise: number;
}

/** Les sommes d'un compte au SOLDE ou de gestion (audit final F185). */
export interface SommesRan {
  /**
   * Débit et crédit de TOUTES ses lignes du périmètre lu, en devise ou non ·
   * l'exercice entier à la clôture, le livre-journal seul au provisoire.
   */
  debit: number;
  credit: number;
  /** Ses seules lignes en devise · devise nommée ET montant en devise non nul. */
  enDevise: SommeEnDeviseRan[];
}

export interface CompteRan {
  id: string;
  numero: string;
  intitule: string;
  modeReportANouveau: ModeRan;
  /**
   * Les lignes une à une · la seule lecture qu'un compte au DÉTAIL reçoive.
   * Lues en base par la clôture et le provisoire, ce sont ses seules lignes
   * NON lettrées, celles que le report reprend (audit final F185) · leur
   * somme n'est donc pas le solde du compte.
   */
  lignes?: LigneLueRan[];
  /** Les sommes rendues par la base · au SOLDE et en gestion, elles priment sur `lignes`. */
  sommes?: SommesRan;
}

export interface LigneRan {
  compteId: string;
  debit: number;
  credit: number;
  libelle: string;
  dateEcheance?: Date | null;
  deviseId?: string;
  montantDevise?: number;
  coursApplique?: number;
}

const EPSILON = 0.005;
const arrondi2 = (x: number) => Math.round(x * 100) / 100;

/**
 * LES SOMMES D'UN COMPTE DÉCRIT PAR SES LIGNES · la définition que la lecture
 * de la base reproduit (`lireComptesDuReport`, exercice.service.ts). Une
 * ligne est en devise quand elle nomme sa devise ET porte un montant en devise
 * non nul ; les autres vont au seul reste en francs, comme avant F185.
 */
export function sommesDesLignes(lignes: LigneLueRan[]): SommesRan {
  let debit = 0;
  let credit = 0;
  const enDevise = new Map<string, SommeEnDeviseRan>();
  for (const l of lignes) {
    debit += l.debit;
    credit += l.credit;
    if (!l.deviseId || !l.montantDevise) continue;
    const sens = l.debit - l.credit >= 0 ? 1 : -1;
    const cle = `${l.deviseId}|${sens}`;
    const g = enDevise.get(cle) ?? { deviseId: l.deviseId, sens, debit: 0, credit: 0, montantDevise: 0 };
    g.debit += l.debit;
    g.credit += l.credit;
    g.montantDevise += l.montantDevise;
    enDevise.set(cle, g);
  }
  return { debit, credit, enDevise: [...enDevise.values()] };
}

/** Les sommes que le calcul lit · celles de la base, sinon celles des lignes. */
function sommesDuCompte(c: CompteRan): SommesRan {
  return c.sommes ?? sommesDesLignes(c.lignes ?? []);
}

/**
 * Débit moins crédit du compte sur le périmètre lu, non arrondi · pour un
 * compte au SOLDE ou de gestion. Un compte au DÉTAIL lu par la clôture ne
 * porte que ses lignes non lettrées (`CompteRan.lignes`), et ce solde-là
 * n'est pas le sien · le service ne l'appelle que sur les comptes de gestion.
 */
export function soldeDuCompte(c: CompteRan): number {
  const s = sommesDuCompte(c);
  return s.debit - s.credit;
}

/**
 * LA DEVISE SUIT LE REPORT (audit final F55) · le report ne recopiait ni la
 * devise ni le montant en devise, et la réévaluation ne lit que l'exercice ·
 * une créance en dollars née en N-1 n'était jamais réévaluée en N, et une
 * banque en dollars ne l'était plus après sa première clôture.
 *
 * En DÉTAIL, chaque ligne reportée garde les trois champs de la ligne
 * d'origine. En SOLDE, le solde se reporte PAR DEVISE · une ligne par devise,
 * au montant en francs et en devise de ses lignes, au cours moyen qu'ils
 * définissent, et une ligne en francs pour le reste (les écarts de
 * réévaluation, passés sans devise, y tombent · celui d'une créance ou d'une
 * dette, la contre-passation de l'ouverture le solde ; celui d'une banque ou
 * d'une caisse, réalisé et jamais contre-passé (AUDCIF art. 57, ligne A5 bis),
 * y reste, et la réévaluation suivante l'ajoute à la ligne de sa devise par
 * `DevisesService.ecartsReportesDesDisponibilites`). Une devise dont le solde en francs et le solde en devise ne
 * sont pas de même sens ne se reporte pas en devise · le montant en devise
 * est gardé sans signe et c'est le sens de la ligne qui le donne, si bien
 * qu'aucune ligne ne saurait la porter. Elle reste dans le reste en francs.
 *
 * Le calcul part des SOMMES par devise et par sens (audit final F185) · le
 * solde en francs d'une devise est la somme de ses débits moins ses crédits,
 * son solde en devise la somme de ses montants affectés du sens des lignes.
 * Les devises sortent dans l'ordre de leur identifiant · l'ordre dans lequel
 * la base rend ses regroupements n'est garanti par rien.
 */
function soldesParDevise(s: SommesRan): { deviseId: string; francs: number; devise: number }[] {
  const parDevise = new Map<string, { deviseId: string; francs: number; devise: number }>();
  for (const g of s.enDevise) {
    const d = parDevise.get(g.deviseId) ?? { deviseId: g.deviseId, francs: 0, devise: 0 };
    d.francs += g.debit - g.credit;
    d.devise += g.sens * g.montantDevise;
    parDevise.set(g.deviseId, d);
  }
  return [...parDevise.values()]
    .sort((a, b) => (a.deviseId < b.deviseId ? -1 : a.deviseId > b.deviseId ? 1 : 0))
    .map((g) => ({ ...g, francs: arrondi2(g.francs), devise: arrondi2(g.devise) }))
    .filter((g) => Math.abs(g.francs) > EPSILON && Math.abs(g.devise) > EPSILON && Math.sign(g.francs) === Math.sign(g.devise));
}

/**
 * Débit moins crédit des comptes de gestion, au centime · positif = déficit,
 * négatif = excédent.
 */
export function resultatDesComptesDeGestion(comptes: CompteRan[]): number {
  return arrondi2(comptes.filter((c) => c.modeReportANouveau === 'AUCUN').reduce((s, c) => s + soldeDuCompte(c), 0));
}

/**
 * Les lignes du report. `resultat` porte le résultat de l'exercice sur son
 * compte (131 ou 139) · à la clôture, l'écriture de solde des comptes de
 * gestion l'y porte après la lecture des comptes ; au provisoire, rien ne l'y
 * porte. Dans les deux cas il est ajouté au solde lu de ce compte, ce qui
 * rend les deux reports identiques.
 */
export function lignesReportANouveau(
  comptes: CompteRan[],
  resultat: { compteId: string; montant: number } | null,
): LigneRan[] {
  const lignes: LigneRan[] = [];
  for (const c of comptes.filter((x) => x.modeReportANouveau === 'SOLDE')) {
    const sommes = sommesDuCompte(c);
    const s = sommes.debit - sommes.credit + (resultat && c.id === resultat.compteId ? resultat.montant : 0);
    if (Math.abs(s) <= EPSILON) continue;
    let reste = s;
    for (const g of soldesParDevise(sommes)) {
      lignes.push({
        compteId: c.id,
        debit: g.francs > 0 ? g.francs : 0,
        credit: g.francs < 0 ? -g.francs : 0,
        libelle: `Report à-nouveau ${c.numero} · ${c.intitule} · en devise`,
        deviseId: g.deviseId,
        montantDevise: Math.abs(g.devise),
        coursApplique: Math.round((Math.abs(g.francs) / Math.abs(g.devise)) * 1e6) / 1e6,
      });
      reste -= g.francs;
    }
    reste = arrondi2(reste);
    if (Math.abs(reste) <= EPSILON) continue;
    lignes.push({
      compteId: c.id,
      debit: reste > 0 ? reste : 0,
      credit: reste < 0 ? -reste : 0,
      libelle: `Report à-nouveau ${c.numero} · ${c.intitule}`,
    });
  }
  for (const c of comptes.filter((x) => x.modeReportANouveau === 'DETAIL')) {
    for (const l of c.lignes ?? []) {
      if (l.lettre) continue; // seuls les mouvements NON lettrés sont reportés en détail
      lignes.push({
        compteId: c.id,
        debit: l.debit,
        credit: l.credit,
        libelle: `RAN détail ${c.numero} · ${l.libelle}`,
        // L'échéance suit la créance ou la dette qu'elle qualifie · les notes
        // 6, 9, 10, 18A, 19 à 21 ventilent par elle (champ `dateEcheance` de
        // LigneEcriture, au schéma).
        dateEcheance: l.dateEcheance,
        // Et la devise, avec son montant et son cours (audit final F55).
        ...(l.deviseId && l.montantDevise
          ? {
              deviseId: l.deviseId,
              montantDevise: l.montantDevise,
              ...(l.coursApplique ? { coursApplique: l.coursApplique } : {}),
            }
          : {}),
      });
    }
  }
  return lignes;
}

/**
 * UNE OUVERTURE DÉJÀ PASSÉE · une ligne d'une écriture de N+1 qui fait partie
 * de sa position d'ouverture (voir `ouvertureDejaPassee`, exercice.service.ts,
 * pour le périmètre · toute écriture datée ou valorisée au premier jour qui ne
 * touche aucun compte de gestion, hors report provisoire).
 */
export interface LigneOuverturePassee {
  /** Identifiant de la ligne · absent dans les calculs purs qui n'en ont pas besoin. */
  id?: string;
  compteId: string;
  debit: number;
  credit: number;
  libelle: string | null;
  dateEcheance: Date | null;
  deviseId: string | null;
  montantDevise: number | null;
  coursApplique: number | null;
}

/** Une position d'ouverture · un compte et une devise (null = francs seuls). */
export interface EcartOuverture {
  compteId: string;
  deviseId: string | null;
  /** Francs, débit moins crédit. */
  cloture: number;
  ouverture: number;
  /** Montant en devise, signé par le sens des lignes · null pour les francs seuls. */
  clotureDevise: number | null;
  ouvertureDevise: number | null;
}

/** La devise qu'une ligne porte réellement · nommée ET montant non nul (même règle que `sommesDesLignes`). */
function deviseDe(l: { deviseId?: string | null; montantDevise?: number | null }): string | null {
  return l.deviseId && l.montantDevise ? l.deviseId : null;
}

/**
 * AU2 · LE BILAN D'OUVERTURE NE S'ÉCRIT QU'UNE FOIS.
 *
 * « Le bilan d'ouverture d'un exercice doit correspondre au bilan de clôture
 * de l'exercice précédent » (AUDCIF art. 34 ; SYCEBNL art. 16, 4), l'art. 34
 * de l'AUDCIF étant exclu par l'art. 3 du SYCEBNL). Un bilan d'ouverture
 * importé dans N+1, puis la clôture de N, écrivaient l'ouverture DEUX fois
 * (relevé AU2, reproduit sur vraie base · client 600 000 pour 300 000).
 *
 * La confrontation se fait par COMPTE ET PAR DEVISE (second tour, R2) · le
 * report de la clôture d'un côté, la position d'ouverture déjà passée de
 * l'autre, en francs et en devise. Une ligne importée SANS devise sur un
 * compte que le report porte en dollars n'est jamais « concordante » · la
 * position en devise sortirait de N+1, et la réévaluation (AUDCIF art. 54,
 * ligne A5) ne la verrait plus. Rend les positions qui diffèrent, dans
 * l'ordre où elles apparaissent. Vide · l'ouverture EST le bilan de clôture.
 */
export function confrontationDeLOuverture(report: LigneRan[], passees: LigneOuverturePassee[]): EcartOuverture[] {
  const ordre: string[] = [];
  const parCle = new Map<string, EcartOuverture>();
  const de = (compteId: string, deviseId: string | null) => {
    const cle = `${compteId}|${deviseId ?? ''}`;
    if (!parCle.has(cle)) {
      ordre.push(cle);
      parCle.set(cle, { compteId, deviseId, cloture: 0, ouverture: 0, clotureDevise: deviseId ? 0 : null, ouvertureDevise: deviseId ? 0 : null });
    }
    return parCle.get(cle)!;
  };
  const sens = (l: { debit: number; credit: number }) => (l.debit - l.credit >= 0 ? 1 : -1);
  for (const l of report) {
    const p = de(l.compteId, deviseDe(l));
    p.cloture += l.debit - l.credit;
    if (p.clotureDevise !== null) p.clotureDevise += sens(l) * (l.montantDevise ?? 0);
  }
  for (const l of passees) {
    const p = de(l.compteId, deviseDe(l));
    p.ouverture += l.debit - l.credit;
    if (p.ouvertureDevise !== null) p.ouvertureDevise += sens(l) * (l.montantDevise ?? 0);
  }
  const arr = (x: number | null) => (x === null ? null : arrondi2(x));
  return ordre
    .map((cle) => {
      const p = parCle.get(cle)!;
      return { ...p, cloture: arrondi2(p.cloture), ouverture: arrondi2(p.ouverture), clotureDevise: arr(p.clotureDevise), ouvertureDevise: arr(p.ouvertureDevise) };
    })
    .filter(
      (p) =>
        Math.abs(arrondi2(p.cloture - p.ouverture)) > EPSILON ||
        (p.deviseId !== null && Math.abs(arrondi2((p.clotureDevise ?? 0) - (p.ouvertureDevise ?? 0))) > EPSILON),
    );
}

/**
 * Une ouverture entièrement annulée (import et son négatif lié, par exemple)
 * n'est plus une ouverture · elle ne réclame aucune déclaration (second tour,
 * R10), et le report se passe comme s'il n'y en avait pas.
 */
export function ouvertureNulle(passees: LigneOuverturePassee[]): boolean {
  return confrontationDeLOuverture([], passees).length === 0;
}

/**
 * AU2 · LA RECTIFICATION, quand le cabinet déclare que le bilan de clôture
 * fait foi (les livres de N sont tenus dans OmegaX). L'ouverture déjà passée
 * est alors fausse sur chaque compte où une position diffère, et sa
 * correction suit la seule voie que le texte ouvre dans l'exercice en cours ·
 * « exclusivement par inscription en négatif des éléments erronés ;
 * l'enregistrement exact est ensuite opéré » (AUDCIF art. 20, al. 2, non
 * exclu par l'art. 3 du SYCEBNL). TOUTES les lignes de l'ouverture sur ce
 * compte sont inscrites en négatif (import, son négatif lié, une ressaisie à
 * la main · second tour, R1), puis les lignes exactes du report, dans UNE
 * écriture (le négatif et le report d'un même sous-ensemble de comptes ne
 * s'équilibrent qu'ensemble). Jamais d'écart en une ligne · une compensation
 * n'est pas une inscription en négatif. Jamais une écriture validée retirée
 * (art. 22, 2°). Les comptes qui concordent gardent leur ouverture.
 *
 * `negatifs` dit, pour chaque ligne inscrite en négatif, la ligne qu'elle
 * annule (son rang dans `lignes`), pour que la clôture puisse les lettrer
 * ensemble (second tour, R6).
 */
export function rectificationDeLOuverture(
  report: LigneRan[],
  passees: LigneOuverturePassee[],
): { lignes: LigneRan[]; comptesRectifies: string[]; negatifs: { rang: number; origine: LigneOuverturePassee }[] } {
  const comptesRectifies = [...new Set(confrontationDeLOuverture(report, passees).map((c) => c.compteId))];
  const lignes: LigneRan[] = [];
  const negatifs: { rang: number; origine: LigneOuverturePassee }[] = [];
  for (const compteId of comptesRectifies) {
    for (const l of passees.filter((x) => x.compteId === compteId)) {
      negatifs.push({ rang: lignes.length, origine: l });
      lignes.push({
        compteId,
        debit: arrondi2(-l.debit),
        credit: arrondi2(-l.credit),
        libelle: `Inscription en négatif · ${l.libelle ?? 'bilan d’ouverture'}`.slice(0, 250),
        dateEcheance: l.dateEcheance,
        ...(deviseDe(l) ? { deviseId: l.deviseId!, montantDevise: l.montantDevise!, ...(l.coursApplique ? { coursApplique: l.coursApplique } : {}) } : {}),
      });
    }
    lignes.push(...report.filter((x) => x.compteId === compteId));
  }
  return { lignes, comptesRectifies, negatifs };
}

/** Une ligne du report provisoire lettrée ou pointée, lue avant son retrait. */
export interface LigneTenue {
  compteId: string;
  debit: number;
  credit: number;
  dateEcheance: Date | null;
  deviseId: string | null;
  montantDevise: number | null;
  lettre: string | null;
  lettrageId: string | null;
  rapprochementId: string | null;
  ligneReleveId: string | null;
  /** Figée par une clôture avant son retrait · son pointage ne se défait plus (R5). */
  figee?: boolean;
}

/** Une ligne qui peut la recevoir · du report définitif, ou d'une ouverture déjà passée encore libre. */
export interface LigneCandidate {
  id: string;
  compteId: string;
  debit: number;
  credit: number;
  dateEcheance: Date | null;
  deviseId: string | null;
  montantDevise: number | null;
}

/**
 * AU1 · CE QUI ÉTAIT LETTRÉ SUR LE PROVISOIRE PASSE SUR LE DÉFINITIF.
 *
 * Le report provisoire et le définitif sortent du même calcul sur le même
 * livre (`lignesReportANouveau`) · la ligne définitive qui remplace une ligne
 * provisoire a son compte, ses montants, son échéance et sa devise. Le groupe
 * de lettrage (ou le pointage) suit donc la ligne qui la remplace, au même
 * montant · son solde ne bouge pas.
 *
 * DEUX PASSES, ET AUCUNE DEVINETTE (second tour, R3) · l'appariement exact
 * d'abord (compte, débit, crédit, échéance, devise, montant en devise). Puis,
 * l'échéance seule relâchée, et seulement quand UNE candidate et une seule
 * convient · deux factures de même montant à des échéances différentes, le
 * règlement porté sur la mauvaise fausserait la balance âgée. La devise ne se
 * relâche JAMAIS · une ligne en dollars ne se porte pas sur une ligne en
 * francs. Chaque candidate sert une fois. Rend, pour chaque tenue, la ligne
 * qui la reçoit, ou null · le service la traite alors en orpheline.
 */
export function apparierTenues(tenues: LigneTenue[], candidates: LigneCandidate[]): (string | null)[] {
  const prises = new Set<string>();
  const memeDevise = (t: LigneTenue, c: LigneCandidate) =>
    c.compteId === t.compteId &&
    Math.abs(c.debit - t.debit) <= EPSILON &&
    Math.abs(c.credit - t.credit) <= EPSILON &&
    (deviseDe(c) ?? null) === (deviseDe(t) ?? null) &&
    Math.abs((c.montantDevise ?? 0) - (t.montantDevise ?? 0)) <= EPSILON;
  const exacte = (t: LigneTenue, c: LigneCandidate) =>
    memeDevise(t, c) && (c.dateEcheance?.getTime() ?? null) === (t.dateEcheance?.getTime() ?? null);
  const resultat: (string | null)[] = tenues.map(() => null);
  tenues.forEach((t, i) => {
    const c = candidates.find((x) => !prises.has(x.id) && exacte(t, x));
    if (c) {
      prises.add(c.id);
      resultat[i] = c.id;
    }
  });
  tenues.forEach((t, i) => {
    if (resultat[i] !== null) return;
    const possibles = candidates.filter((x) => !prises.has(x.id) && memeDevise(t, x));
    const rivales = tenues.filter((u, j) => j !== i && resultat[j] === null && possibles.some((x) => memeDevise(u, x)));
    if (possibles.length === 1 && rivales.length === 0) {
      prises.add(possibles[0].id);
      resultat[i] = possibles[0].id;
    }
  });
  return resultat;
}

/**
 * REPORT DES BUDGETS · Sage i7 : « demander le report des budgets sur le
 * nouvel exercice ». Un budget déjà saisi sur l'exercice suivant n'est JAMAIS
 * écrasé · il a été décidé, le report n'en est qu'une proposition. Une
 * section dont la convention s'achève avant le nouvel exercice n'est pas
 * reportée · on ne dote pas un financement terminé.
 */
export function budgetsAReporter(
  budgets: { sectionId: string; mois: number | null; montant: number }[],
  dejaDotes: { sectionId: string; mois: number | null }[],
  sectionsCloses: Set<string>,
): { sectionId: string; mois: number | null; montant: number }[] {
  const pris = new Set(dejaDotes.map((b) => `${b.sectionId}|${b.mois ?? ''}`));
  return budgets.filter((b) => !sectionsCloses.has(b.sectionId) && !pris.has(`${b.sectionId}|${b.mois ?? ''}`));
}
