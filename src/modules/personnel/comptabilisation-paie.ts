/**
 * P9 · LA PAIE DU MOIS AU JOURNAL, EN UNE ÉCRITURE.
 *
 * Chaque bulletin émis porte les chiffres que le travailleur a lus. La paie du
 * mois se passe pourtant en UNE écriture, pas en une par salarié · c'est ce
 * que fait le journal de paie global du Guide d'application SYSCOHADA
 * (Partie 1 ch. 3 section 4, Application 10), et c'est ce que le cabinet
 * reporte du livre de paie. Les trois temps du Guide sont gardés tels quels ·
 * brut (§ 4.1), retenues (§ 4.3), charges patronales (§ 4.2), voir
 * `passation-paie.ts`.
 *
 * LA PASSATION EST REJOUÉE SUR LES CHIFFRES FIGÉS DU BULLETIN, jamais relue
 * dans ses lignes stockées. Les montants sont ceux que le travailleur a
 * signés ; la RÈGLE D'IMPUTATION est celle du jour. Un bulletin émis avant la
 * correction du 2026-09-24 portait une passation combinée qui créditait le
 * 422 du seul net · relire ses lignes le ferait entrer au journal sous la
 * forme que le Guide ne présente pas.
 *
 * UN SEUL BULLETIN REFUSÉ ARRÊTE LE MOIS ENTIER. Passer les autres ferait
 * entrer au journal une masse salariale amputée d'un salaire, sur une
 * écriture équilibrée · rien en aval ne le verrait. Le refus nomme le
 * bulletin : c'est lui qu'il faut annuler et réémettre.
 *
 * AU CENTIME, ET ÉQUILIBRÉE PAR CONSTRUCTION. Un montant d'impôt mensuel porte
 * des décimales que la base ne garde pas (Decimal 18,2). Chaque ligne de
 * DÉTAIL est arrondie au centime, puis la ligne de TOTAL de chaque bloc est
 * recalculée comme la somme des détails arrondis · C/422 au bloc brut, D/422
 * au bloc des retenues, D/664 au bloc patronal, C/4428 au bloc des impôts et
 * taxes sur salaires (INPP et ONEM, décision T1 du 2026-10-07). Chaque bloc
 * s'équilibre donc
 * au centime, et l'écriture avec lui. L'écart éventuel entre le solde du 422
 * et la somme des nets est affiché, jamais logé dans un compte de bouclage.
 *
 * C2 (2026-10-07) · UN BULLETIN ANNULÉ APRÈS PASSATION SE REPREND EN NÉGATIF,
 * AVEC LE BULLETIN QUI LE REMPLACE. Son salaire est au livre-journal, dans
 * une écriture validée qui ne se retouche plus (AUDCIF art. 22, 2°). La
 * passation du mois l'inscrit EN NÉGATIF, ligne à ligne, à côté du bulletin
 * réémis · en recopiant les lignes de l'écriture d'origine (relecture M3,
 * comptes et montants tels que passés), ou, quand celle-ci porte d'autres
 * bulletins, par le rejeu de ses chiffres figés si l'écriture d'origine s'y
 * reconstitue au centime · seule la DIFFÉRENCE pèse sur
 * l'exercice où l'écriture est passée. Avant, le réémis se passait en entier
 * et l'ancien restait au journal · un salaire de décembre de 600 000 corrigé
 * à 620 000 en janvier de l'exercice suivant pesait 620 000 sur ce dernier,
 * le net déjà payé redevenant dû au 422 (cas chiffré P15). Les deux cas de
 * l'art. 20 aboutissent aux mêmes lignes · erreur commise et découverte dans
 * l'exercice, inscription en négatif (al. 2) ; erreur d'un exercice clôturé,
 * correction dans les comptes de l'exercice en cours, dite aux Notes annexes
 * (al. 4), le report à nouveau restant au cabinet si elle est significative
 * (al. 3). L'opération d'une période close s'inscrit dans la période ouverte,
 * sa date de valeur mentionnée distinctement (art. 22, 4°) · le service la
 * pose.
 */
import {
  compteDuRole,
  NOMENCLATURE_PAIE,
  passationPaie,
  type BlocPaie,
  type EntreePassation,
  type Referentiel,
  type SensLigne,
} from './passation-paie';

export type BulletinAComptabiliser = {
  readonly id: string;
  readonly numero: number;
  readonly nomComplet: string;
  readonly statut: 'EMIS' | 'ANNULE';
  readonly ecritureId: string | null;
  readonly netAPayerFc: number;
  /** Ce qui a été saisi à l'émission · porte les éléments et leur nature. */
  readonly entree: unknown;
  /** La simulation figée à l'émission. */
  readonly calcul: unknown;
  /**
   * C2 · l'écriture qui a repris ce bulletin annulé en négatif. Absent d'un
   * appelant qui ne la lit pas · le bulletin est alors tenu pour non repris.
   */
  readonly ecritureNegatifId?: string | null;
  /**
   * RELECTURE M3 · l'écriture qui a passé ce bulletin, telle qu'au journal,
   * lue pour le bulletin annulé à reprendre en négatif. Absente, ou sans
   * ligne, elle n'est plus retrouvable · la reprise se refuse, nommée.
   */
  readonly origine?: OrigineDuBulletin | null;
};

/** Une écriture de paie déjà passée, ses lignes telles qu'au journal. */
export type OrigineDuBulletin = {
  readonly ecritureId: string;
  readonly numeroPiece?: string | null;
  readonly lignes: readonly { readonly compte: string; readonly intitule: string; readonly debit: number; readonly credit: number }[];
};

/**
 * Les blocs de l'écriture du mois · ceux de la passation, plus la reprise en
 * négatif d'une écriture d'origine recopiée ligne à ligne (relecture M3),
 * qui n'appartient à aucun temps du Guide · elle annule ce qui a été passé.
 */
export type BlocDuMois = BlocPaie | 'REPRISE_EN_NEGATIF';

export type LigneDuMois = {
  readonly bloc: BlocDuMois;
  readonly compte: string;
  readonly intitule: string;
  readonly sens: SensLigne;
  readonly montantFc: number;
  /** C2 · reprise en négatif d'un bulletin annulé après passation. */
  readonly negatif?: boolean;
};

export type PropositionPaieDuMois = {
  readonly moisDePaie: string;
  readonly referentiel: Referentiel;
  /** Les bulletins émis que cette écriture passerait. */
  readonly aPasser: readonly { id: string; numero: number; nomComplet: string }[];
  /** Les bulletins émis déjà portés par une écriture. */
  readonly dejaPasses: readonly { numero: number; nomComplet: string; ecritureId: string }[];
  /**
   * Annulés APRÈS avoir été passés · leur salaire est au journal, dans
   * `ecritureId`. `ecritureNegatifId` dit l'écriture qui l'a repris en
   * négatif, `null` tant que personne ne l'a fait.
   */
  readonly annulesApresPassation: readonly {
    numero: number;
    nomComplet: string;
    ecritureId: string;
    ecritureNegatifId: string | null;
  }[];
  /** C2 · ceux que CETTE écriture reprendrait en négatif. */
  readonly negatifsAPasser: readonly { id: string; numero: number; nomComplet: string; ecritureId: string }[];
  readonly refus: readonly { numero: number; nomComplet: string; motifs: readonly string[] }[];
  readonly lignes: readonly LigneDuMois[];
  readonly totalDebitFc: number;
  readonly totalCreditFc: number;
  readonly equilibree: boolean;
  /** Solde créditeur du 422 après l'écriture · le net à payer du mois. */
  readonly solde422Fc: number;
  /** Somme des nets figés sur les bulletins passés. */
  readonly sommeDesNetsFc: number;
  readonly reserves: readonly string[];
};

const ORDRE_DES_BLOCS: readonly BlocDuMois[] = [
  'BRUT',
  'RETENUES',
  'PATRONALES',
  'IMPOTS_ET_TAXES_SUR_SALAIRES',
  'AVANTAGES_EN_NATURE',
  'REPRISE_EN_NEGATIF',
];

/** Le compte qui porte le TOTAL de chaque bloc, et son sens. */
const TOTAL_DU_BLOC: Readonly<
  Record<
    BlocPaie,
    {
      role: 'REMUNERATIONS_DUES' | 'CHARGES_SOCIALES_PATRONALES' | 'AUTRES_IMPOTS_ET_TAXES' | 'TRANSFERTS_DE_CHARGES';
      sens: SensLigne;
    }
  >
> = {
  BRUT: { role: 'REMUNERATIONS_DUES', sens: 'CREDIT' },
  RETENUES: { role: 'REMUNERATIONS_DUES', sens: 'DEBIT' },
  PATRONALES: { role: 'CHARGES_SOCIALES_PATRONALES', sens: 'DEBIT' },
  IMPOTS_ET_TAXES_SUR_SALAIRES: { role: 'AUTRES_IMPOTS_ET_TAXES', sens: 'CREDIT' },
  AVANTAGES_EN_NATURE: { role: 'TRANSFERTS_DE_CHARGES', sens: 'CREDIT' },
};

const enCentimes = (fc: number) => Math.round(fc * 100);
const enFrancs = (centimes: number) => centimes / 100;

type Json = Record<string, unknown> | null | undefined;
const objet = (x: unknown): Json => (x && typeof x === 'object' ? (x as Record<string, unknown>) : null);
const nombreOuNull = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/**
 * L'entrée de la passation, reconstituée depuis le bulletin figé. Rend `null`
 * quand le bulletin ne porte pas ce qu'il faut · un bulletin illisible se
 * refuse, il ne se complète pas.
 */
/**
 * LES ÉLÉMENTS EN FRANCS (audit final F19). Le bulletin stipulé en dollars
 * garde la stipulation dans son entrée, et fige les montants convertis dans
 * `calcul.conversion.elements`, au cours du jour du calcul, dans le même
 * ordre. Les relire par leur RANG, jamais par leur libellé, que deux lignes
 * peuvent partager. Sans eux la passation additionnait `undefined`, l'écriture
 * sortait déséquilibrée, et le bulletin arrêtait la paie du mois entier.
 * Un élément sans montant en francs, ni converti, rend le bulletin illisible.
 */
function elementsEnFrancs(elements: unknown, conversion: Json): EntreePassation['elements'] | null {
  if (!Array.isArray(elements)) return null;
  const convertis = Array.isArray(conversion?.elements) ? (conversion!.elements as unknown[]) : null;
  const rendus: EntreePassation['elements'][number][] = [];
  for (const [i, brut] of elements.entries()) {
    const e = objet(brut);
    if (!e) return null;
    const montantFc = nombreOuNull(e.montantFc) ?? (convertis ? nombreOuNull(objet(convertis[i])?.montantFc) : null);
    if (montantFc === null) return null;
    rendus.push({ ...(e as unknown as EntreePassation['elements'][number]), montantFc });
  }
  return rendus;
}

export function entreeDuBulletin(b: BulletinAComptabiliser, referentiel: Referentiel): EntreePassation | null {
  const entree = objet(b.entree);
  const calcul = objet(b.calcul);
  const cotisations = objet(calcul?.cotisations);
  const retenue = objet(calcul?.retenue);
  const net = objet(calcul?.net);
  const lignes = cotisations?.lignes;
  const elements = elementsEnFrancs(entree?.elements, objet(calcul?.conversion));
  if (!elements || !Array.isArray(lignes)) return null;
  return {
    referentiel,
    elements,
    cotisations: lignes as EntreePassation['cotisations'],
    abstentionsCotisations: Array.isArray(cotisations?.abstentions) ? (cotisations!.abstentions as string[]) : [],
    irppFc: nombreOuNull(retenue?.retenueFc),
    netAPayerFc: nombreOuNull(net?.netAPayerFc),
    // Article 112, c) et f) · absentes d'un bulletin émis avant ce chantier,
    // qui n'en portait aucune. Le type et la catégorie sont ceux que le
    // registre a donnés à l'émission, figés avec le reste.
    retenuesAvances: Array.isArray(calcul?.retenuesAvances)
      ? (calcul!.retenuesAvances as EntreePassation['retenuesAvances'])
      : [],
  };
}

export function propositionPaieDuMois(
  moisDePaie: string,
  referentiel: Referentiel,
  bulletins: readonly BulletinAComptabiliser[],
): PropositionPaieDuMois {
  const emis = bulletins.filter((b) => b.statut === 'EMIS');
  const aPasser = emis.filter((b) => !b.ecritureId);
  const dejaPasses = emis
    .filter((b) => b.ecritureId)
    .map((b) => ({ numero: b.numero, nomComplet: b.nomComplet, ecritureId: b.ecritureId as string }));
  const annules = bulletins.filter((b) => b.statut === 'ANNULE' && b.ecritureId);
  const annulesApresPassation = annules.map((b) => ({
    numero: b.numero,
    nomComplet: b.nomComplet,
    ecritureId: b.ecritureId as string,
    ecritureNegatifId: b.ecritureNegatifId ?? null,
  }));
  const negatifs = annules.filter((b) => !b.ecritureNegatifId);
  const negatifsAPasser = negatifs.map((b) => ({
    id: b.id,
    numero: b.numero,
    nomComplet: b.nomComplet,
    ecritureId: b.ecritureId as string,
  }));

  const reserves: string[] = [];
  if (negatifs.length > 0) {
    reserves.push(RESERVE_REPRISE_EN_NEGATIF(negatifs.map((b) => b.numero)));
  }

  const refus: { numero: number; nomComplet: string; motifs: string[] }[] = [];
  // Détail par (bloc, compte, sens, reprise), en centimes. Les lignes de TOTAL
  // sont ignorées ici et recalculées plus bas.
  const detail = new Map<
    string,
    { bloc: BlocDuMois; compte: string; intitule: string; sens: SensLigne; centimes: number; negatif: boolean }
  >();
  let sommeDesNets = 0;

  for (const b of aPasser) {
    const entree = entreeDuBulletin(b, referentiel);
    if (!entree) {
      refus.push({ numero: b.numero, nomComplet: b.nomComplet, motifs: ['Bulletin illisible · ses éléments ou ses cotisations manquent.'] });
      continue;
    }
    const v = passationPaie(entree);
    if (v.refus.length > 0) {
      refus.push({ numero: b.numero, nomComplet: b.nomComplet, motifs: v.refus.map((r) => `${r.motif} · ${r.explication}`) });
      continue;
    }
    sommeDesNets += enCentimes(b.netAPayerFc);
    for (const l of v.lignes) {
      const total = TOTAL_DU_BLOC[l.bloc];
      if (l.compte === compteDuRole(total.role, referentiel) && l.sens === total.sens) continue;
      const cle = `${l.bloc}|${l.compte}|${l.sens}`;
      const courant = detail.get(cle);
      if (courant) courant.centimes += enCentimes(l.montantFc);
      else detail.set(cle, { bloc: l.bloc, compte: l.compte, intitule: l.intitule, sens: l.sens, centimes: enCentimes(l.montantFc), negatif: false });
    }
  }

  // C2, RELECTURE M3 · L'INSCRIPTION EN NÉGATIF ANNULE CE QUI A ÉTÉ PASSÉ
  // (AUDCIF art. 20, al. 2) · elle reprend les lignes de l'écriture d'origine,
  // comptes et montants, jamais un rejeu à la règle du jour. Un bulletin passé
  // avant la décision T1 portait l'INPP et l'ONEM au 6641, au 4334 et au 4335 ·
  // rejoué à la règle du jour, son négatif tombait au 6415, au 6413 et au 4428,
  // et la reprise surévaluait les charges en laissant le 6415 négatif.
  //  - L'écriture d'origine ne porte QUE des bulletins repris ici · ses lignes
  //    se recopient en négatif, une à une.
  //  - Elle porte aussi d'autres bulletins · la part de celui-ci ne se lit
  //    qu'au rejeu, et seulement si l'écriture d'origine se RECONSTITUE au
  //    centime à la règle du jour (même règle, mêmes montants) ; sinon, refus
  //    nommé avec son issue.
  //  - Introuvable ou sans ligne · refus nommé.
  const rejouesALaRegleDuJour: BulletinAComptabiliser[] = [];
  const reprisesExactes: { origine: OrigineDuBulletin; bulletins: BulletinAComptabiliser[] }[] = [];
  for (const [ecritureId, repris] of groupesParEcriture(negatifs)) {
    const origine = repris.find((b) => b.origine?.ecritureId === ecritureId)?.origine ?? null;
    if (!origine || origine.lignes.length === 0) {
      for (const b of repris) {
        refus.push({ numero: b.numero, nomComplet: b.nomComplet, motifs: [MOTIF_ORIGINE_INTROUVABLE] });
      }
      continue;
    }
    const portes = bulletins.filter((b) => b.ecritureId === ecritureId);
    const reprisesPortees = bulletins.filter((b) => b.ecritureNegatifId === ecritureId);
    const tousRepris = reprisesPortees.length === 0 && portes.every((b) => repris.includes(b));
    if (tousRepris) {
      reprisesExactes.push({ origine, bulletins: repris });
      continue;
    }
    if (seReconstitueALaRegleDuJour(origine, portes, reprisesPortees, referentiel)) {
      rejouesALaRegleDuJour.push(...repris);
      continue;
    }
    const autres = portes.filter((b) => !repris.includes(b)).map((b) => b.numero);
    for (const b of repris) {
      refus.push({ numero: b.numero, nomComplet: b.nomComplet, motifs: [motifPartIllisible(origine, autres)] });
    }
  }

  for (const { origine, bulletins: repris } of reprisesExactes) {
    for (const b of repris) sommeDesNets -= enCentimes(b.netAPayerFc);
    for (const l of origine.lignes) {
      for (const [sens, montant] of [['DEBIT', l.debit], ['CREDIT', l.credit]] as const) {
        if (enCentimes(montant) === 0) continue;
        const cle = `REPRISE_EN_NEGATIF|${l.compte}|${sens}|NEGATIF`;
        const courant = detail.get(cle);
        if (courant) courant.centimes -= enCentimes(montant);
        else
          detail.set(cle, {
            bloc: 'REPRISE_EN_NEGATIF',
            compte: l.compte,
            intitule: `${l.intitule} · reprise en négatif (pièce n° ${origine.numeroPiece ?? '·'})`,
            sens,
            centimes: -enCentimes(montant),
            negatif: true,
          });
      }
    }
  }

  // Le rejeu à la règle du jour · seulement quand l'écriture d'origine s'y
  // reconstitue au centime (voir plus haut). Ses lignes restent À PART des
  // lignes positives · l'écriture montre ce qui est repris et ce qui est
  // passé, et le total de chaque bloc les additionne.
  for (const b of rejouesALaRegleDuJour) {
    const entree = entreeDuBulletin(b, referentiel);
    if (!entree) {
      refus.push({
        numero: b.numero,
        nomComplet: b.nomComplet,
        motifs: ["Bulletin annulé illisible · ses éléments ou ses cotisations manquent, et son salaire ne se reprend pas en négatif."],
      });
      continue;
    }
    const v = passationPaie(entree);
    if (v.refus.length > 0) {
      refus.push({
        numero: b.numero,
        nomComplet: b.nomComplet,
        motifs: v.refus.map((r) => `REPRISE EN NÉGATIF · ${r.motif} · ${r.explication}`),
      });
      continue;
    }
    sommeDesNets -= enCentimes(b.netAPayerFc);
    for (const l of v.lignes) {
      const total = TOTAL_DU_BLOC[l.bloc];
      if (l.compte === compteDuRole(total.role, referentiel) && l.sens === total.sens) continue;
      const cle = `${l.bloc}|${l.compte}|${l.sens}|NEGATIF`;
      const courant = detail.get(cle);
      if (courant) courant.centimes -= enCentimes(l.montantFc);
      else
        detail.set(cle, {
          bloc: l.bloc,
          compte: l.compte,
          intitule: `${l.intitule} · reprise en négatif`,
          sens: l.sens,
          centimes: -enCentimes(l.montantFc),
          negatif: true,
        });
    }
  }

  const vide = (motifReserve?: string): PropositionPaieDuMois => ({
    moisDePaie,
    referentiel,
    aPasser: aPasser.map((b) => ({ id: b.id, numero: b.numero, nomComplet: b.nomComplet })),
    dejaPasses,
    annulesApresPassation,
    negatifsAPasser,
    refus,
    lignes: [],
    totalDebitFc: 0,
    totalCreditFc: 0,
    equilibree: false,
    solde422Fc: 0,
    sommeDesNetsFc: 0,
    reserves: motifReserve ? [...reserves, motifReserve] : reserves,
  });

  if (refus.length > 0) {
    return vide(
      "UN BULLETIN REFUSÉ ARRÊTE LE MOIS · passer les autres ferait entrer au journal une masse salariale amputée " +
        "d'un salaire, sur une écriture équilibrée. Annulez et réémettez le bulletin nommé.",
    );
  }
  if (aPasser.length === 0 && negatifs.length === 0) return vide();

  const lignes: LigneDuMois[] = [];
  for (const bloc of ORDRE_DES_BLOCS) {
    if (bloc === 'REPRISE_EN_NEGATIF') {
      // Recopiée de l'écriture d'origine, équilibrée comme elle · aucune
      // ligne de total ne s'y recalcule.
      const reprise = [...detail.values()].filter((d) => d.bloc === bloc && d.centimes !== 0);
      lignes.push(
        ...reprise
          .sort((a, b) => (a.sens === b.sens ? a.compte.localeCompare(b.compte) : a.sens === 'DEBIT' ? -1 : 1))
          .map((d) => ({ bloc, compte: d.compte, intitule: d.intitule, sens: d.sens, montantFc: enFrancs(d.centimes), negatif: true })),
      );
      continue;
    }
    // Une reprise en négatif porte des centimes NÉGATIFS · un détail se garde
    // dès qu'il n'est pas nul, et le total du bloc peut l'être lui-même
    // (bulletin annulé sans remplaçant).
    const duBloc = [...detail.values()].filter((d) => d.bloc === bloc && d.centimes !== 0);
    if (duBloc.length === 0) continue;
    const total = TOTAL_DU_BLOC[bloc];
    const totalCentimes = duBloc.reduce((n, d) => n + d.centimes, 0);
    const ligneTotal: LigneDuMois | null =
      totalCentimes === 0
        ? null
        : {
            bloc,
            compte: compteDuRole(total.role, referentiel),
            intitule: NOMENCLATURE_PAIE[total.role].intitule,
            sens: total.sens,
            montantFc: enFrancs(totalCentimes),
          };
    const details = duBloc
      .sort((a, b) => a.compte.localeCompare(b.compte) || Number(a.negatif) - Number(b.negatif))
      .map((d) => ({
        bloc,
        compte: d.compte,
        intitule: d.intitule,
        sens: d.sens,
        montantFc: enFrancs(d.centimes),
        ...(d.negatif ? { negatif: true } : {}),
      }));
    // Débits avant crédits, dans chaque bloc · la présentation du Guide.
    const tous = !ligneTotal ? details : total.sens === 'DEBIT' ? [ligneTotal, ...details] : [...details, ligneTotal];
    lignes.push(...tous);
  }

  const somme = (sens: SensLigne) => lignes.filter((l) => l.sens === sens).reduce((n, l) => n + enCentimes(l.montantFc), 0);
  const debit = somme('DEBIT');
  const credit = somme('CREDIT');
  const c422 = compteDuRole('REMUNERATIONS_DUES', referentiel);
  const solde422 = lignes
    .filter((l) => l.compte === c422)
    .reduce((n, l) => n + (l.sens === 'CREDIT' ? enCentimes(l.montantFc) : -enCentimes(l.montantFc)), 0);

  // L'écart d'arrondi ne peut dépasser un centime par bulletin et par ligne
  // retenue · au-delà, ce n'est plus un arrondi, c'est un défaut.
  const ecart = solde422 - sommeDesNets;
  const tolerance = (aPasser.length + negatifs.length) * 3;
  // (Une reprise recopiée de l'écriture d'origine retranche son 422 tel qu'il
  // a été passé · l'écart avec les nets figés reste dans la même tolérance.)
  if (Math.abs(ecart) > tolerance) {
    return vide(
      `Le 422 solderait à ${enFrancs(solde422).toFixed(2)} FC quand les bulletins portent ${enFrancs(sommeDesNets).toFixed(2)} FC de net. ` +
        "Un écart de cette taille est un défaut du moteur, jamais un arrondi à rattraper. Rien n'est proposé.",
    );
  }
  if (ecart !== 0) {
    reserves.push(
      `ARRONDI · le solde du 422 (${enFrancs(solde422).toFixed(2)} FC) s'écarte de ${enFrancs(ecart).toFixed(2)} FC de la somme des nets ` +
        "figés sur les bulletins, chaque montant ayant été arrondi au centime. L'écart est montré, pas logé dans un compte.",
    );
  }

  reserves.push(
    "UNE ÉCRITURE POUR LE MOIS · la passation de chaque bulletin est rejouée sur ses chiffres figés, puis additionnée par " +
      "compte. Les trois temps du Guide d'application SYSCOHADA (Partie 1 ch. 3 section 4) sont gardés : brut, retenues, " +
      "charges patronales. L'impôt retenu n'est jamais une charge de l'employeur. L'INPP et l'ONEM forment un temps à part, " +
      "au 64 contre le 4428 · ce sont des impôts et taxes (fiche du compte 64 des deux textes), pas des charges sociales.",
    "LE PAIEMENT DES SALAIRES EST UNE SECONDE ÉCRITURE · le 422 est débité des paiements par le crédit de la trésorerie, " +
      "dans le journal de banque ou de caisse.",
  );

  return {
    moisDePaie,
    referentiel,
    aPasser: aPasser.map((b) => ({ id: b.id, numero: b.numero, nomComplet: b.nomComplet })),
    dejaPasses,
    annulesApresPassation,
    negatifsAPasser,
    refus,
    lignes,
    totalDebitFc: enFrancs(debit),
    totalCreditFc: enFrancs(credit),
    equilibree: debit === credit,
    solde422Fc: enFrancs(solde422),
    sommeDesNetsFc: enFrancs(sommeDesNets),
    reserves,
  };
}

/** Les bulletins à reprendre, groupés par l'écriture qui les a passés. */
function groupesParEcriture(negatifs: readonly BulletinAComptabiliser[]): Map<string, BulletinAComptabiliser[]> {
  const groupes = new Map<string, BulletinAComptabiliser[]>();
  for (const b of negatifs) {
    const cle = b.ecritureId as string;
    groupes.set(cle, [...(groupes.get(cle) ?? []), b]);
  }
  return groupes;
}

/** Une écriture, réduite à (compte, sens) → centimes, zéros ôtés. */
function empreinte(lignes: readonly { compte: string; sens: SensLigne; centimes: number }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of lignes) m.set(`${l.compte}|${l.sens}`, (m.get(`${l.compte}|${l.sens}`) ?? 0) + l.centimes);
  for (const [k, v] of m) if (v === 0) m.delete(k);
  return m;
}

/**
 * L'écriture d'origine est-elle EXACTEMENT ce que la règle du jour passerait
 * pour les bulletins qu'elle porte (et, en négatif, pour ceux qu'elle
 * reprenait) ? Alors la part d'un bulletin s'y lit par son rejeu. Sinon elle a
 * été passée sous une autre règle, ou retouchée, et sa part ne se lit pas.
 */
function seReconstitueALaRegleDuJour(
  origine: OrigineDuBulletin,
  portes: readonly BulletinAComptabiliser[],
  reprisesPortees: readonly BulletinAComptabiliser[],
  referentiel: Referentiel,
): boolean {
  const rejeu = propositionPaieDuMois('0000-00', referentiel, [
    ...portes.map((b) => ({ ...b, statut: 'EMIS' as const, ecritureId: null, ecritureNegatifId: null, origine: null })),
  ]);
  if (rejeu.refus.length > 0) return false;
  const positives = rejeu.lignes.map((l) => ({ compte: l.compte, sens: l.sens, centimes: enCentimes(l.montantFc) }));
  const lignesDe = (o: OrigineDuBulletin, signe: 1 | -1) =>
    o.lignes.flatMap((l) => [
      { compte: l.compte, sens: 'DEBIT' as const, centimes: signe * enCentimes(l.debit) },
      { compte: l.compte, sens: 'CREDIT' as const, centimes: signe * enCentimes(l.credit) },
    ]);
  const passe = empreinte(lignesDe(origine, 1));
  const egal = (attendu: Map<string, number>) =>
    attendu.size === passe.size && [...attendu].every(([k, v]) => passe.get(k) === v);

  // Les reprises que l'écriture d'origine portait déjà · rejouées à la règle
  // du jour, ou recopiées de LEUR écriture d'origine (relecture M3) · l'une
  // ou l'autre forme selon le moment où elles ont été passées.
  const reprisesALaRegleDuJour = ((): { compte: string; sens: SensLigne; centimes: number }[] | null => {
    const lignes: { compte: string; sens: SensLigne; centimes: number }[] = [];
    for (const b of reprisesPortees) {
      const entree = entreeDuBulletin(b, referentiel);
      const v = entree ? passationPaie(entree) : null;
      if (!v || v.refus.length > 0) return null;
      for (const l of v.lignes) lignes.push({ compte: l.compte, sens: l.sens, centimes: -enCentimes(l.montantFc) });
    }
    return lignes;
  })();
  if (reprisesALaRegleDuJour && egal(empreinte([...positives, ...reprisesALaRegleDuJour]))) return true;
  const origines = reprisesPortees.map((b) => b.origine);
  if (reprisesPortees.length > 0 && origines.every((o): o is OrigineDuBulletin => !!o && o.lignes.length > 0)) {
    const recopiees = [...new Map(origines.map((o) => [o.ecritureId, o])).values()].flatMap((o) => lignesDe(o, -1));
    if (egal(empreinte([...positives, ...recopiees]))) return true;
  }
  return false;
}

export const MOTIF_ORIGINE_INTROUVABLE =
  "REPRISE EN NÉGATIF REFUSÉE · l'écriture qui a passé ce bulletin n'est plus lisible au journal, et l'inscription en " +
  "négatif reprend CE QUI A ÉTÉ PASSÉ (AUDCIF art. 20, al. 2), jamais un rejeu à la règle du jour. Issue · retrouvez " +
  "l'écriture d'origine, ou inscrivez le négatif de ses lignes à la main (Corriger, inscription en négatif) ; tant que " +
  'le bulletin n’est pas repris ici, la paie du mois reste arrêtée.';

export const motifPartIllisible = (origine: OrigineDuBulletin, autres: readonly number[]) =>
  `REPRISE EN NÉGATIF REFUSÉE · l'écriture d'origine (pièce n° ${origine.numeroPiece ?? '·'}) porte aussi le(s) ` +
  `bulletin(s) n° ${autres.join(', ')}, et elle ne se reconstitue pas à la règle d'imputation du jour (passée sous ` +
  "une autre règle, par exemple l'INPP et l'ONEM au 6641, au 4334 et au 4335 avant la décision T1, ou retouchée) · la " +
  "part de ce bulletin dans ses lignes ne se lit pas, et un rejeu à la règle du jour reprendrait ce qui n'a pas été " +
  "passé (AUDCIF art. 20, al. 2). Issue · annulez aussi ce(s) bulletin(s) et réémettez-les · l'écriture d'origine se " +
  'reprend alors en négatif ligne à ligne, et les bulletins réémis se passent à la règle du jour.';

/**
 * C2 · ce que la proposition dit de la reprise en négatif. Les deux cas de
 * l'art. 20 y sont, parce que le moteur ne sait pas, en proposant, dans quel
 * exercice le cabinet passera l'écriture.
 */
export const RESERVE_REPRISE_EN_NEGATIF = (numeros: readonly number[]) =>
  `REPRISE EN NÉGATIF · n° ${numeros.join(', ')}, annulé(s) après passation. Leur salaire est au livre-journal, dans ` +
  "l'écriture validée qui les a passés · cette écriture le reprend EN NÉGATIF, ligne à ligne, à côté du bulletin " +
  "réémis, et seule la différence pèse sur l'exercice où elle est passée. Dans le même exercice, c'est l'inscription en " +
  "négatif de l'erreur (AUDCIF art. 20, al. 2). Erreur d'un exercice clôturé · elle se corrige dans les comptes de " +
  "l'exercice en cours, la date de valeur du mois de paie mentionnée (art. 22, 4°), et se dit aux Notes annexes " +
  "(art. 20, al. 4) ; significative, elle passe par le report à nouveau (art. 20, al. 3), hors de ce geste. Le négatif " +
  "reprend les lignes de l'écriture d'origine, comptes et montants (relecture M3). Un négatif déjà inscrit à la main se contre-passe d'abord, sans quoi " +
  'la reprise compterait deux fois · la passation demande de le confirmer.';

/** Le dernier jour du mois de paie, date proposée par défaut. */
export function dernierJourDuMois(moisDePaie: string): string {
  const [a, m] = moisDePaie.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}
