/**
 * LIGNE SAGE-L5, FONCTION 75 · LE PAIEMENT DES SALAIRES. Moteur pur.
 *
 * CE QUE LE TEXTE DIT DU PAIEMENT (Code du travail, titre V, chapitre II).
 * Art. 98, al. 1 · « La rémunération doit être payée en espèces, sous
 * déduction éventuelle de la contre-valeur des avantages dus et remis en
 * nature. » Le texte oppose les ESPÈCES à la NATURE, comme l'art. 105 (« les
 * deux tiers de la rémunération en espèces » contre « les avantages
 * contractuels en nature ») · un virement ou un chèque paient en monnaie, donc
 * « en espèces » au sens du Code, lecture d'OmegaX, dite. Art. 98, al. 2 ·
 * « au temps et au lieu convenus » · le MODE se convient, il se déclare par
 * salarié, jamais présumé. Art. 99, al. 2 · « au plus tard dans les six jours
 * suivant la période à laquelle il se rapporte » · six jours de calendrier,
 * l'art. 100, au même chapitre, disant « jours ouvrables » quand il les veut.
 *
 * L'ÉCRITURE · fiche du compte 42 des deux plans (AUDCIF, Titre VII ; SYCEBNL,
 * Partie 2 ch. 3) · « Débité […] des rémunérations versées au personnel, par
 * le crédit des comptes de trésorerie. » Le compte de trésorerie suit le
 * mode · une caisse (57, « opérations d'encaissement et de paiement
 * effectuées en espèces », fiche du compte 57 des deux plans) pour des
 * espèces, une banque ou assimilée (tout autre compte de trésorerie du
 * journal) pour un virement ou un chèque.
 *
 * LE BILLETAGE N'EST EXIGÉ PAR AUCUN TEXTE · comme la ventilation par coupure
 * du procès-verbal de caisse, c'est un ajout de l'éditeur. Les coupures se
 * DÉCLARENT (aucune liste de billets n'est au corpus), et la ventilation se
 * fait par les plus grosses coupures d'abord, la méthode du caissier ; ce qui
 * ne s'y ventile pas est DIT, jamais arrondi.
 */
import { MONNAIE_DE_TENUE } from '../../common/monnaie-de-tenue';

export type ModePaiement = 'VIREMENT' | 'CHEQUE' | 'ESPECES';

export const MODES_PAIEMENT: Readonly<Record<ModePaiement, { libelle: string; caisse: boolean }>> = {
  VIREMENT: { libelle: 'Virement', caisse: false },
  CHEQUE: { libelle: 'Chèque', caisse: false },
  ESPECES: { libelle: 'Espèces', caisse: true },
};

/** Au plus autant de salariés dans un paiement · au-delà, la liste se refuse et le paiement se scinde. */
export const PLAFOND_LIGNES_PAIEMENT = 500;
/** Au plus autant de coupures déclarées. */
export const PLAFOND_COUPURES = 20;

const centimes = (n: number) => Math.round(n * 100);
const auCentime = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

export interface JournalDuPaiement {
  code: string;
  type: string;
  estActif: boolean;
  compteTresorerie: { numero: string } | null;
}

/**
 * LE JOURNAL QUI PAIE · un journal de trésorerie actif, avec son compte, dont
 * la nature suit le mode, et tenu en francs (les nets figés des bulletins le
 * sont · une banque en devise porte ses lignes avec leur montant en devise et
 * leur cours, F49, qu'une pièce en francs perdrait).
 */
export function motifRefusJournalDuPaiement(mode: ModePaiement, journal: JournalDuPaiement | null, deviseDuRib: string | null): string | null {
  if (!journal) return 'Journal introuvable pour ce dossier.';
  if (journal.type !== 'TRESORERIE') {
    return `Le journal ${journal.code} n'est pas un journal de banque ou de caisse · un salaire versé crédite un compte de trésorerie (fiche du compte 42).`;
  }
  if (!journal.estActif) return `Le journal ${journal.code} est en sommeil · réactivez-le avant d'y payer des salaires.`;
  if (!journal.compteTresorerie) return `Le journal ${journal.code} n'a pas de compte de trésorerie · rattachez-lui son compte dans Journaux.`;
  const caisse = journal.compteTresorerie.numero.startsWith('57');
  if (MODES_PAIEMENT[mode].caisse && !caisse) {
    return `Un paiement en espèces sort d'une caisse (compte 57, « paiement effectué en espèces ») · le journal ${journal.code} porte le compte ${journal.compteTresorerie.numero}.`;
  }
  if (!MODES_PAIEMENT[mode].caisse && caisse) {
    return `Un ${MODES_PAIEMENT[mode].libelle.toLowerCase()} ne sort pas d'une caisse · le journal ${journal.code} porte le compte ${journal.compteTresorerie.numero}, choisissez un journal de banque.`;
  }
  const devise = (deviseDuRib ?? '').trim().toUpperCase();
  if (devise && devise !== MONNAIE_DE_TENUE) {
    return `Le journal ${journal.code} est tenu en ${devise} · les nets des bulletins sont en ${MONNAIE_DE_TENUE}. Payez depuis un compte en ${MONNAIE_DE_TENUE}, ou passez le paiement à la main avec le montant en devise et le cours.`;
  }
  return null;
}

/** Les coupures déclarées · positives, au centime, distinctes, au plus `PLAFOND_COUPURES`. */
export function motifRefusCoupures(coupures: readonly number[]): string | null {
  if (coupures.length === 0) return 'Déclarez au moins une coupure pour ventiler les espèces.';
  if (coupures.length > PLAFOND_COUPURES) return `Au plus ${PLAFOND_COUPURES} coupures.`;
  for (const c of coupures) {
    if (!Number.isFinite(c) || c <= 0) return 'Une coupure est une valeur faciale strictement positive.';
    if (!auCentime(c)) return `La coupure ${c} n'est pas au centime.`;
  }
  if (new Set(coupures.map(centimes)).size !== coupures.length) return 'Une coupure est déclarée deux fois.';
  return null;
}

export interface Billetage {
  detail: { valeur: number; nombre: number }[];
  /** Ce qui ne se ventile pas par les coupures déclarées · jamais arrondi. */
  reste: number;
}

/**
 * LES PLUS GROSSES COUPURES D'ABORD, en centimes entiers (le flottant ferait
 * d'un 0,30 un 0,29999). Le reste se dit · il porte « par les plus grosses
 * coupures d'abord », jamais « impossible à ventiler ».
 */
export function billetage(montant: number, coupures: readonly number[]): Billetage {
  let reste = centimes(montant);
  const detail: Billetage['detail'] = [];
  for (const valeur of [...coupures].sort((a, b) => b - a)) {
    const v = centimes(valeur);
    const nombre = Math.floor(reste / v);
    if (nombre > 0) {
      detail.push({ valeur, nombre });
      reste -= nombre * v;
    }
  }
  return { detail, reste: reste / 100 };
}

export interface BilletageDuPaiement {
  coupures: number[];
  parSalarie: { salarieId: string; nomComplet: string; montant: number; detail: Billetage['detail']; reste: number }[];
  /** Le nombre de chaque coupure à retirer de la banque ou à sortir de la caisse. */
  totaux: { valeur: number; nombre: number }[];
  resteTotal: number;
}

/** Le billetage de chaque net, et les totaux par coupure · ce qui s'imprime pour préparer les enveloppes. */
export function billetageDuPaiement(
  lignes: readonly { salarieId: string; nomComplet: string; montant: number }[],
  coupures: readonly number[],
): BilletageDuPaiement {
  const triees = [...coupures].sort((a, b) => b - a);
  const parSalarie = lignes.map((l) => ({ salarieId: l.salarieId, nomComplet: l.nomComplet, montant: l.montant, ...billetage(l.montant, triees) }));
  const totaux = triees
    .map((valeur) => ({ valeur, nombre: parSalarie.reduce((n, p) => n + (p.detail.find((d) => d.valeur === valeur)?.nombre ?? 0), 0) }))
    .filter((t) => t.nombre > 0);
  const resteTotal = parSalarie.reduce((n, p) => n + centimes(p.reste), 0) / 100;
  return { coupures: triees, parSalarie, totaux, resteTotal };
}

/** ART. 99, AL. 2 · le dernier jour où le salaire du mois peut être payé · le dernier jour du mois, plus six. */
export function echeanceArticle99(mois: string): string {
  const [a, m] = mois.split('-').map(Number);
  const fin = Date.UTC(a, m, 0);
  return new Date(fin + 6 * 86_400_000).toISOString().slice(0, 10);
}

export interface BulletinAPayer {
  id: string;
  salarieId: string;
  netAPayer: number;
  /** Ce que le salarié a déjà reçu pour le MÊME mois sur un bulletin annulé · le réémis ne paie que la différence. */
  dejaPayeAutres: number;
}

/**
 * CE QUI RESTE À PAYER SUR UN BULLETIN · son net, moins ce qu'un bulletin
 * annulé du même salarié et du même mois a déjà versé. Sans cette lecture, un
 * bulletin annulé et réémis (erreur corrigée, décompte final qui remplace le
 * bulletin du mois) ferait payer deux fois le même salaire. Un trop-perçu se
 * dit, il ne se compense pas en silence (fiche du compte 42 · aucune
 * compensation entre ce qui est dû au personnel et ce qu'il doit).
 */
export function resteAPayer(b: BulletinAPayer): { montant: number; tropPaye: number } {
  const ecart = centimes(b.netAPayer) - centimes(b.dejaPayeAutres);
  return ecart >= 0 ? { montant: ecart / 100, tropPaye: 0 } : { montant: 0, tropPaye: -ecart / 100 };
}

/**
 * LE CHÈQUE PORTE SON NUMÉRO · la pièce qui justifie l'écriture en porte les
 * références (AUDCIF art. 17, 3° et 5°, que l'art. 3 du SYCEBNL n'écarte pas),
 * et un chèque se rapproche du relevé par son numéro. Deux salariés ne
 * reçoivent pas le même chèque.
 */
export function motifRefusReferencesCheques(references: readonly { nomComplet: string; reference: string | null }[]): string | null {
  const manquants = references.filter((r) => !(r.reference ?? '').trim()).map((r) => r.nomComplet);
  if (manquants.length) return `Le numéro du chèque manque pour ${manquants.join(', ')} · un chèque se rapproche du relevé par son numéro.`;
  const vus = new Map<string, string>();
  for (const r of references) {
    const n = r.reference!.trim().toUpperCase();
    const deja = vus.get(n);
    if (deja) return `Le chèque n° ${r.reference!.trim()} est donné à ${deja} et à ${r.nomComplet}.`;
    vus.set(n, r.nomComplet);
  }
  return null;
}
