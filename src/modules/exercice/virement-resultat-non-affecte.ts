import { soldeDuCompte, type CompteRan, type LigneRan } from './report-a-nouveau';

/**
 * LE RÉSULTAT DE L'EXERCICE PRÉCÉDENT NON AFFECTÉ EST VIRÉ AU REPORT À NOUVEAU
 * EN FIN D'EXERCICE (simulation sur vraie base du 2026-10-08, tranché par la
 * loi).
 *
 * AUDCIF, Titre VII, compte 13, commentaires · « L'affectation du résultat
 * d'un exercice est décidée par les organes compétents au cours de l'exercice
 * suivant ; le compte 13 est donc soldé lors de la comptabilisation de cette
 * affectation. En fin d'exercice, le résultat de l'exercice précédent non
 * affecté à un compte de réserves et non distribué est viré au compte de
 * report à nouveau. » ; « Dans les entités individuelles, le solde du compte
 * 13 est viré au compte 103 (Capital personnel). »
 * SYCEBNL, Partie 2 ch. 3, compte 13, commentaires · « En fin d'exercice, le
 * résultat net de l'exercice précédent non affecté à un compte de réserves
 * sera viré au compte 12 – Report à nouveau. »
 *
 * Sans ce virement, la clôture de N+1 laissait le résultat de N au 13, où il
 * se cumulait avec celui de N+1 · le bilan de N+1 sortait déséquilibré du
 * résultat de N (les états lisaient alors le résultat sur les classes 6 à 8
 * avant clôture, jamais en plus sur le 13 · ils les additionnent depuis la
 * passe V1, `resultatAuBilan`), la colonne N-1 du bilan de N+2 était
 * fausse aux capitaux propres, et l'affectation de N devenait impossible
 * (son exercice d'accueil clôturé). Scénario chiffré · perte 2026 de
 * 46 072 000 non affectée, bilan 2027 à 165 828 000 contre 211 900 000.
 *
 * Ce qui est au 13 À LA CLÔTURE, avant l'écriture qui solde les comptes de
 * gestion, n'est JAMAIS le résultat de l'exercice clos (il ne s'y porte
 * qu'après) · c'est le résultat d'un exercice antérieur repris à l'ouverture
 * et que l'affectation n'a pas soldé. Une affectation passée avant la
 * clôture a déjà soldé le 13 · rien n'est viré.
 */

/** Comptes de destination, lus dans le plan semé de chaque référentiel. */
export interface DestinationsVirement {
  /** Résultat créditeur (bénéfice, excédent). */
  credit: string;
  /** Résultat débiteur (perte, déficit). */
  debit: string;
}

/**
 * Les numéros semés · SYSCOHADA 12100000 « Report à nouveau créditeur » et
 * 12910000 « Perte nette à reporter » (sous 129 « Report à nouveau
 * débiteur ») ; SYCEBNL 12100000 « Report à nouveau des excédents » et
 * 12900000 « Report à nouveau des déficits » ; entité individuelle du
 * SYSCOHADA, 10300000 « Capital personnel » dans les deux sens.
 */
export function destinationsDuVirement(
  referentiel: 'SYSCOHADA' | 'SYCEBNL',
  entiteIndividuelle: boolean,
): DestinationsVirement {
  if (referentiel === 'SYSCOHADA' && entiteIndividuelle) return { credit: '10300000', debit: '10300000' };
  if (referentiel === 'SYSCOHADA') return { credit: '12100000', debit: '12910000' };
  return { credit: '12100000', debit: '12900000' };
}

const EPSILON = 0.005;
const FORMAT_MONTANT = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Un montant écrit en français au centime, dans un message de la clôture. */
export function montantFr(n: number): string {
  return FORMAT_MONTANT.format(Math.round(n * 100) / 100);
}
const arrondi2 = (x: number) => Math.round(x * 100) / 100;

/** Un compte de résultat au sens du compte 13 (130 à 139), hors comptes de gestion. */
export function estCompteDuResultat(c: Pick<CompteRan, 'numero' | 'modeReportANouveau'>): boolean {
  return c.numero.startsWith('13') && c.modeReportANouveau !== 'AUCUN';
}

/**
 * Les lignes du virement · chaque compte 13 soldé, la contrepartie nette au
 * compte de destination. `montant` est le résultat viré, positif pour un
 * bénéfice, négatif pour une perte ; `lignes` est vide s'il n'y a rien à
 * virer.
 */
export function virementResultatNonAffecte(
  comptes: CompteRan[],
  destination: { credit: string; debit: string },
  idDuNumero: (numero: string) => string | undefined,
): { montant: number; lignes: LigneRan[]; compteDestination: string | null } {
  const lignes: LigneRan[] = [];
  let net = 0; // débit moins crédit des comptes 13
  for (const c of comptes.filter(estCompteDuResultat)) {
    const s = arrondi2(soldeDuCompte(c));
    if (Math.abs(s) <= EPSILON) continue;
    net += s;
    lignes.push({
      compteId: c.id,
      debit: s < 0 ? -s : 0,
      credit: s > 0 ? s : 0,
      libelle: `Résultat non affecté viré au report à nouveau · ${c.numero}`,
    });
  }
  net = arrondi2(net);
  if (lignes.length === 0) return { montant: 0, lignes: [], compteDestination: null };
  if (Math.abs(net) <= EPSILON) return { montant: 0, lignes, compteDestination: null };
  const numero = net > 0 ? destination.debit : destination.credit;
  const id = idDuNumero(numero);
  if (!id) {
    throw new Error(
      `Compte ${numero} introuvable dans ce dossier · le résultat de l'exercice précédent non affecté doit y être viré en fin d'exercice ` +
        "(AUDCIF Titre VII, compte 13 ; SYCEBNL Partie 2 ch. 3, compte 13). Ouvrez-le au plan comptable ou passez l'affectation avant de clôturer.",
    );
  }
  lignes.push({
    compteId: id,
    debit: net > 0 ? net : 0,
    credit: net < 0 ? -net : 0,
    libelle: 'Résultat de l’exercice précédent non affecté, viré au report à nouveau',
  });
  return { montant: -net, lignes, compteDestination: numero };
}

/**
 * Le même virement appliqué à un report déjà calculé · le report PROVISOIRE
 * ne passe aucune écriture dans l'exercice ouvert, mais doit rendre le même
 * report que la clôture (report-a-nouveau.ts). Les lignes du virement sont
 * fondues dans celles du report, compte par compte, hors devise.
 */
export function appliquerVirementAuReport(report: LigneRan[], virement: LigneRan[]): LigneRan[] {
  const resultat = report.map((l) => ({ ...l }));
  for (const v of virement) {
    const cible = resultat.find((l) => l.compteId === v.compteId && !l.deviseId);
    const delta = v.debit - v.credit;
    if (cible) {
      const s = arrondi2(cible.debit - cible.credit + delta);
      cible.debit = s > 0 ? s : 0;
      cible.credit = s < 0 ? -s : 0;
    } else {
      resultat.push({ compteId: v.compteId, debit: delta > 0 ? delta : 0, credit: delta < 0 ? -delta : 0, libelle: v.libelle });
    }
  }
  return resultat.filter((l) => l.debit > EPSILON || l.credit > EPSILON || l.deviseId);
}

/**
 * L'ÉCART DU BILAN QUE LE VIREMENT N'EXPLIQUE PAS · la clôture refuse un
 * bilan qui sortirait déséquilibré par un autre chemin (compte non rattaché,
 * défaut de correspondance). Les états lisent le résultat au bilan sur les
 * classes 6 à 8 ET sur le 13, sans le 130 au SYSCOHADA (`resultatAuBilan`,
 * passe V1, B1 · le résultat précédent non affecté reste au 13 jusqu'à
 * l'assemblée, fiche du compte 13 des deux plans). L'écart attendu (actif
 * moins passif) est donc la part du 13 que l'état n'a pas lue (le 130), et
 * que le virement porte au report à nouveau. Jusqu'au 2026-10-08 les états
 * laissaient tout le 13 de côté dès que les classes 6 à 8 étaient
 * mouvementées, et l'écart admis était le 13 entier. `resultat13` et
 * `resultatCompte13` sont au sens du passif (crédit moins débit). Rend null
 * quand l'état ne dit pas comment il a lu son résultat.
 */
export function ecartInexpliqueDuBilan(
  bilan: {
    totalActif: number;
    totalPassif: number;
    controle?: { resultatClasses678: number; resultatCompte13: number; compte13LuHorsDuResultat?: number } | null;
  },
  resultat13: number,
): number | null {
  const ecart = Number(bilan.totalActif) - Number(bilan.totalPassif);
  let partNonLue: number;
  if (bilan.controle) {
    // `compte13LuHorsDuResultat` · la part du 13 qu'un AUTRE poste lit (le
    // 130 en HC du SMT SYCEBNL, audit final F211) n'est pas « non lue ».
    partNonLue = resultat13 - bilan.controle.resultatCompte13 - (bilan.controle.compte13LuHorsDuResultat ?? 0);
  } else if (Math.abs(resultat13) <= EPSILON) {
    partNonLue = 0;
  } else {
    return null;
  }
  return arrondi2(ecart - partNonLue);
}
