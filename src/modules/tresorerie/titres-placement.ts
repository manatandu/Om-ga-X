/**
 * TITRES DE PLACEMENT ET PARTS D'OPCVM (ligne sage-l3, fonction 47, décision
 * D16 · Sage, F_OPPLACEMENT). Règles pures, sans base.
 *
 * LES PARTS D'OPCVM SONT DES VALEURS MOBILIÈRES (AUDCIF Titre VIII ch. 13
 * § 1.1, « les parts d'OPCVM (SICAV et FCP) ») · détenues pour en tirer un
 * revenu ou une plus-value à brève échéance, elles vont au compte 50 « Titres
 * de placement » (§ 2.3 ; SYCEBNL Partie 2 ch. 3, compte 50), au sous-compte
 * que le cabinet choisit, jamais au 506 (intérêts courus) ni au 5021 (actions
 * ou parts propres, ch. 19).
 *
 * L'ENTRÉE AU COÛT D'ACQUISITION, FRAIS COMPRIS · l'AUDCIF range les frais
 * « dans un sous-compte du compte 50 » (§ 2.3.2, 5016, 5026, 5036), le
 * SYCEBNL compare la valeur d'inventaire à « la valeur d'achat, frais
 * d'acquisition inclus » · lecture d'OmegaX, les deux ensemble · les frais
 * font partie de la valeur d'entrée, et sortent avec le lot cédé.
 *
 * LA SORTIE AU P.E.P.S. (fiche du compte 50 des deux plans ; § 4, qui admet
 * aussi le C.U.M.P., non servi, au suivi) · la valeur comptable du titre cédé
 * est son coût d'entrée « non diminué par une éventuelle dépréciation » ; le
 * prix de cession s'entend « diminué des frais de cession strictement
 * nécessaires » (§ 4) ; l'écart au 777 (gain) ou au 6771 (perte, fiche du
 * compte 50 du SYCEBNL, sous-compte du 677 de l'AUDCIF § 4.2). Un lot entamé
 * garde sa valeur restante, et sa DERNIÈRE unité sortie prend tout ce qui
 * reste (jamais quantité × coût unitaire, qui laisserait des centimes · même
 * règle que le magasin).
 *
 * L'INVENTAIRE · valeur déclarée avec sa source (§ 3.2 · « cours moyen du
 * dernier mois avant la clôture » pour un titre coté, « valeur probable de
 * négociation » sinon) ; la moins-value se déprécie au 590 par le 6795,
 * « sans compensation avec les plus-values latentes » (d'un titre à l'autre),
 * reprise au 7795 (§ 4.2) · seul l'ÉCART avec la dépréciation en place se
 * passe.
 */

export const RACINE_TITRES = '50';
/**
 * Les sous-comptes du 50 qui ne sont pas des titres · les intérêts courus
 * (506, aux deux plans) et, au SYSCOHADA seul, les actions ou parts propres
 * (5021, ch. 19 · le SYCEBNL n'ouvre aucun 5021, son 502 « Actions » ne
 * portant que 5022, 5023, 5025 et 5026). Un numéro, deux plans · refuser le
 * 5021 au SYCEBNL refuserait un sous-compte d'actions que le cabinet y ouvre.
 */
export const RACINES_EXCLUES = { SYSCOHADA: ['506', '5021'], SYCEBNL: ['506'] } as const;
/** Les sous-comptes des frais d'acquisition (§ 2.3.2) · au cinquième chiffre « 6 » de leur division. */
export const RACINES_FRAIS = ['5016', '5026', '5036'] as const;
export const COMPTE_DEPRECIATION = '59000000';
export const COMPTE_DOTATION = '67950000';
export const COMPTE_REPRISE = '77950000';
export const COMPTE_GAIN = '77700000';
export const COMPTE_PERTE = '67710000';

export const NATURES_VALEUR = ['COURS_MOYEN_DERNIER_MOIS', 'VALEUR_PROBABLE_NEGOCIATION'] as const;
export type NatureValeur = (typeof NATURES_VALEUR)[number];

const MICRO = 1_000_000;
const enMicro = (q: number) => Math.round(q * MICRO);
const enCentimes = (x: number) => Math.round(x * 100);

export function motifRefusCompteTitre(numero: string, referentiel: 'SYSCOHADA' | 'SYCEBNL'): string | null {
  if (!numero.startsWith(RACINE_TITRES)) return `Un titre de placement va au compte 50 (AUDCIF Titre VIII ch. 13 § 2.3) · ${numero} n'y est pas.`;
  if (RACINES_EXCLUES[referentiel].some((r) => numero.startsWith(r))) {
    return numero.startsWith('506') ? `Le ${numero} porte des intérêts courus (506), pas un titre de placement.` : `Le ${numero} porte les actions ou parts propres de la société (5021, AUDCIF Titre VIII ch. 19), pas un titre de placement.`;
  }
  if (RACINES_FRAIS.some((r) => numero.startsWith(r))) return `Le ${numero} est un compte de frais d'acquisition · choisissez le compte du titre, et ce compte comme compte des frais.`;
  return null;
}

export function motifRefusCompteFrais(numero: string): string | null {
  if (!RACINES_FRAIS.some((r) => numero.startsWith(r))) return `Les frais d'acquisition vont au sous-compte du 50 qui leur est réservé (${RACINES_FRAIS.join(', ')}) · ${numero} ne l'est pas.`;
  return null;
}

const estUnJour = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00.000Z`).toISOString().slice(0, 10) === v;
const auCentime = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) < 1e15 && Math.round(x * 100) / 100 === x;
// Moins d'un milliard de parts · au-delà, les micro-parts dépasseraient les entiers exacts d'un nombre JavaScript (2^53).
const quantiteLisible = (q: unknown): q is number => typeof q === 'number' && Number.isFinite(q) && q > 0 && q < 1e9 && Math.round(q * MICRO) / MICRO === q;

export function motifRefusTitre(t: { code: unknown; intitule: unknown }): string | null {
  const code = typeof t.code === 'string' ? t.code.trim() : '';
  if (!/^[A-Za-z0-9._-]{1,20}$/.test(code)) return 'Le code du titre · lettres, chiffres, point, tiret, vingt au plus.';
  const i = typeof t.intitule === 'string' ? t.intitule.trim() : '';
  if (i.length === 0 || [...i].length > 100) return "L'intitulé du titre (nom du fonds ou de la valeur) · de un à cent caractères.";
  return null;
}

export function motifRefusMouvement(m: { date: unknown; quantite: unknown; prix: unknown; frais: unknown; reference: unknown }, objet: 'acquisition' | 'cession'): string | null {
  if (!estUnJour(m.date)) return `La date de l'${objet} doit être un jour (AAAA-MM-JJ).`;
  if (!quantiteLisible(m.quantite)) return 'La quantité · un nombre de parts strictement positif, six décimales au plus.';
  if (!auCentime(m.prix) || m.prix <= 0) return `Le prix ${objet === 'acquisition' ? "d'achat" : 'de cession'} · un montant strictement positif, au centime, celui de l'avis d'opéré.`;
  if (m.frais !== undefined && m.frais !== null && (!auCentime(m.frais) || m.frais < 0)) return 'Les frais · un montant positif ou nul, au centime.';
  const ref = typeof m.reference === 'string' ? m.reference.trim() : '';
  if (ref.length === 0 || [...ref].length > 100) return "La référence de l'avis d'opéré de la banque est exigée (AUDCIF art. 17, 3°) · cent caractères au plus.";
  if (objet === 'cession' && enCentimes((m.frais as number | null) ?? 0) >= enCentimes(m.prix as number)) return 'Les frais de cession dépassent le prix · vérifiez l’avis d’opéré.';
  return null;
}

export function motifRefusEvaluation(e: { valeurUnitaire: unknown; nature: unknown; source: unknown }): string | null {
  if (typeof e.valeurUnitaire !== 'number' || !Number.isFinite(e.valeurUnitaire) || e.valeurUnitaire < 0 || e.valeurUnitaire >= 1e12 || Math.round(e.valeurUnitaire * MICRO) / MICRO !== e.valeurUnitaire) {
    return 'La valeur unitaire · positive ou nulle, six décimales au plus.';
  }
  if (!NATURES_VALEUR.includes(e.nature as NatureValeur)) return 'La nature de la valeur · cours moyen du dernier mois avant la clôture (titre coté) ou valeur probable de négociation (non coté).';
  const s = typeof e.source === 'string' ? e.source.trim() : '';
  if (s.length === 0 || [...s].length > 200) return 'La source de la valeur (bulletin de la cote, valeur liquidative publiée, attestation) est exigée · deux cents caractères au plus.';
  return null;
}

/** La nature attendue d'un titre · coté, le cours moyen du dernier mois ; non coté, la valeur probable de négociation (§ 3.2). */
export const natureAttendue = (cote: boolean): NatureValeur => (cote ? 'COURS_MOYEN_DERNIER_MOIS' : 'VALEUR_PROBABLE_NEGOCIATION');

// ---- P.E.P.S. ----------------------------------------------------------------

export interface MouvementLu {
  nature: 'ACQUISITION' | 'CESSION';
  quantite: number;
  prix: number;
  frais: number;
}
export interface Lot {
  /** Rang de l'acquisition, dans l'ordre d'entrée. */
  rang: number;
  quantite: number;
  /** Ce qui reste du prix et des frais du lot, en centimes · la dernière unité les prend entiers. */
  prixCentimes: number;
  fraisCentimes: number;
}

/**
 * LES LOTS DÉTENUS après une suite de mouvements, rejoués dans l'ordre
 * d'inscription. Une cession au-delà de ce qui est détenu est une erreur du
 * module (la porte l'a refusée), jamais une quantité négative.
 */
export function lotsDetenus(mouvements: readonly MouvementLu[]): Lot[] {
  const lots: Lot[] = [];
  let rang = 0;
  for (const m of mouvements) {
    if (m.nature === 'ACQUISITION') {
      lots.push({ rang: rang++, quantite: enMicro(m.quantite), prixCentimes: enCentimes(m.prix), fraisCentimes: enCentimes(m.frais) });
    } else {
      consommer(lots, enMicro(m.quantite));
    }
  }
  return lots.filter((l) => l.quantite > 0).map((l) => ({ ...l, quantite: l.quantite / MICRO }));
}

/** Retire la quantité des lots les plus anciens et rend le coût sorti, en centimes (prix, frais). */
function consommer(lots: Lot[], quantiteMicro: number): { prixCentimes: number; fraisCentimes: number } {
  let reste = quantiteMicro;
  let prix = 0;
  let frais = 0;
  for (const lot of lots) {
    if (reste === 0) break;
    if (lot.quantite === 0) continue;
    if (reste >= lot.quantite) {
      prix += lot.prixCentimes;
      frais += lot.fraisCentimes;
      reste -= lot.quantite;
      lot.quantite = 0;
      lot.prixCentimes = 0;
      lot.fraisCentimes = 0;
    } else {
      const p = Math.round((lot.prixCentimes * reste) / lot.quantite);
      const f = Math.round((lot.fraisCentimes * reste) / lot.quantite);
      prix += p;
      frais += f;
      lot.prixCentimes -= p;
      lot.fraisCentimes -= f;
      lot.quantite -= reste;
      reste = 0;
    }
  }
  if (reste > 0) throw new Error('Cession au-delà des parts détenues · refusée à la porte.');
  return { prixCentimes: prix, fraisCentimes: frais };
}

export const quantiteDetenue = (mouvements: readonly MouvementLu[]) => lotsDetenus(mouvements).reduce((s, l) => s + enMicro(l.quantite), 0) / MICRO;
export const coutDetenu = (mouvements: readonly MouvementLu[]) => lotsDetenus(mouvements).reduce((s, l) => s + l.prixCentimes + l.fraisCentimes, 0) / 100;

/** Le coût sorti d'une cession nouvelle, au P.E.P.S. · prix et frais du lot, chacun sur son compte. */
export function coutDeLaCession(mouvements: readonly MouvementLu[], quantite: number): { prix: number; frais: number } {
  const lots = lotsDetenus(mouvements).map((l) => ({ ...l, quantite: enMicro(l.quantite) }));
  const c = consommer(lots, enMicro(quantite));
  return { prix: c.prixCentimes / 100, frais: c.fraisCentimes / 100 };
}

export interface LignePropose {
  role: 'BANQUE' | 'TITRE' | 'FRAIS' | 'GAIN' | 'PERTE' | 'DEPRECIATION' | 'DOTATION' | 'REPRISE';
  debit: number;
  credit: number;
}
const ligne = (role: LignePropose['role'], debit: number, credit: number): LignePropose => ({ role, debit: Math.round(debit * 100) / 100, credit: Math.round(credit * 100) / 100 });
const garder = (l: LignePropose[]) => l.filter((x) => enCentimes(x.debit) !== 0 || enCentimes(x.credit) !== 0);

/** L'ACQUISITION, au journal de banque · D 50 (prix), D 50x6 (frais) / C 52. Sans compte de frais, les frais vont au compte du titre. */
export function pieceAcquisition(prix: number, frais: number): LignePropose[] {
  return garder([ligne('TITRE', prix, 0), ligne('FRAIS', frais, 0), ligne('BANQUE', 0, prix + frais)]);
}

/**
 * LA CESSION, au journal de banque · D 52 (prix moins frais de cession),
 * D 6771 (perte) / C 50 (prix sorti), C 50x6 (frais sortis), C 777 (gain).
 */
export function pieceCession(prixCession: number, fraisCession: number, cout: { prix: number; frais: number }): { lignes: LignePropose[]; resultat: number } {
  const net = enCentimes(prixCession) - enCentimes(fraisCession);
  const sorti = enCentimes(cout.prix) + enCentimes(cout.frais);
  const ecart = net - sorti;
  return {
    resultat: ecart / 100,
    lignes: garder([
      ligne('BANQUE', net / 100, 0),
      ligne('PERTE', ecart < 0 ? -ecart / 100 : 0, 0),
      ligne('TITRE', 0, cout.prix),
      ligne('FRAIS', 0, cout.frais),
      ligne('GAIN', 0, ecart > 0 ? ecart / 100 : 0),
    ]),
  };
}

/** La dépréciation nécessaire d'un titre · la moins-value seule, jamais compensée par une plus-value (§ 3.2). */
export function depreciationNecessaire(cout: number, quantite: number, valeurUnitaire: number): number {
  // EN ENTIERS EXACTS · parts et valeur en millionièmes, le produit en 10^-12, arrondi au centime le plus proche
  // (demi vers le haut). En flottant, 3 × 1,005 rendait 301,4999… centimes, soit 301 au lieu de 302.
  const produit = BigInt(enMicro(quantite)) * BigInt(Math.round(valeurUnitaire * MICRO));
  const valeurCentimes = Number((produit + 5_000_000_000n) / 10_000_000_000n);
  return Math.max(0, enCentimes(cout) - valeurCentimes) / 100;
}

/** L'écart avec la dépréciation en place · dotation D 6795 / C 590, reprise D 590 / C 7795, rien s'il est nul. */
export function pieceEcartDepreciation(necessaire: number, enPlace: number): LignePropose[] {
  const ecart = enCentimes(necessaire) - enCentimes(enPlace);
  if (ecart > 0) return [ligne('DOTATION', ecart / 100, 0), ligne('DEPRECIATION', 0, ecart / 100)];
  if (ecart < 0) return [ligne('DEPRECIATION', -ecart / 100, 0), ligne('REPRISE', 0, -ecart / 100)];
  return [];
}
