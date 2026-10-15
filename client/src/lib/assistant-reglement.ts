import { lireMontant } from './assistant-bien';

/**
 * L'ASSISTANT DE RÈGLEMENT (ligne sage-l2, fonction n° 18, part règlement ·
 * Sage, mode assistant) · les étapes, ce que chacune exige, et le corps
 * envoyé, hors du composant pour se tester. Même patron que l'assistant de
 * création d'un bien (`lib/assistant-bien.ts`).
 *
 * L'ASSISTANT N'A PAS SA ROUTE · il envoie `POST /reglements` avec le corps
 * du formulaire Règlement des tiers, que le serveur juge par les mêmes
 * contrôles (tiers et trésorerie seuls, plus que le dû refusé, imputation de
 * l'art. 154 dite, art. 59 bis averti). Une étape ne dit que ce qui MANQUE
 * pour avancer ; tout refus de fond reste celui du serveur, servi au
 * récapitulatif.
 *
 * UN TIERS À LA FOIS, EN FRANCS · ce qui demande plus qu'un règlement
 * ordinaire reste au formulaire complet · une facture en devise (cours,
 * écart de change réalisé), les parts déclarées de chaque facture, l'escompte
 * et l'écart de règlement, un lot de virements. Un assistant qui les
 * servirait à moitié cacherait ce que le formulaire, lui, demande.
 */

export type Sens = 'FOURNISSEUR' | 'CLIENT';

export type EtapeReglement = 'sens' | 'tresorerie' | 'tiers' | 'factures' | 'montant' | 'recapitulatif';

export const ETAPES_REGLEMENT: readonly { cle: EtapeReglement; libelle: string }[] = [
  { cle: 'sens', libelle: 'Sens' },
  { cle: 'tresorerie', libelle: 'Trésorerie' },
  { cle: 'tiers', libelle: 'Tiers' },
  { cle: 'factures', libelle: 'Factures' },
  { cle: 'montant', libelle: 'Montant' },
  { cle: 'recapitulatif', libelle: 'Récapitulatif' },
];

/** Une facture ouverte, telle que `GET /reglements/echeances` la sert. */
export interface FactureOuverte {
  id: string;
  echeance: string;
  date: string;
  libelle: string;
  montant: number;
  reference?: string | null;
  deviseId?: string | null;
  deviseCode?: string | null;
}

/** Les factures ouvertes d'un compte de tiers. */
export interface TiersARegler {
  compteId: string;
  numero: string;
  intitule: string;
  tiers: string | null;
  lignes: FactureOuverte[];
}

export interface SaisieReglement {
  sens: Sens;
  date: string;
  journalId: string;
  modeReglementId: string;
  ordreVirement: boolean;
  compteId: string;
  ligneIds: string[];
  montant: string;
  reference: string;
}

/**
 * LA DATE PROPOSÉE (second tour de relecture, mineur 7) · le jour de Kinshasa,
 * jamais celui de l'horloge UTC du poste, ramené dans l'exercice · un
 * exercice clos ou futur ne propose pas une date que le serveur refusera.
 */
export function dateProposee(jourKinshasa: string, debut: string, fin: string): string {
  if (jourKinshasa < debut) return debut;
  if (jourKinshasa > fin) return fin;
  return jourKinshasa;
}

export function saisieVierge(aujourdhui: string): SaisieReglement {
  return { sens: 'FOURNISSEUR', date: aujourdhui, journalId: '', modeReglementId: '', ordreVirement: false, compteId: '', ligneIds: [], montant: '', reference: '' };
}

/** Le dû des factures choisies, au centime. */
export function duDesFactures(tiers: TiersARegler | null, ligneIds: readonly string[]): number {
  if (!tiers) return 0;
  const choisies = new Set(ligneIds);
  return Math.round(tiers.lignes.filter((l) => choisies.has(l.id)).reduce((s, l) => s + l.montant, 0) * 100) / 100;
}

/** Le nom d'un tiers dans les listes et le récapitulatif. */
export function nomDuTiers(t: Pick<TiersARegler, 'numero' | 'intitule' | 'tiers'>): string {
  return `${t.numero} · ${t.tiers ?? t.intitule}`;
}

/**
 * Ce qui manque pour quitter l'étape, ou null · jamais une règle de fond,
 * que le serveur tient. `tiers` est le compte choisi, tel que servi.
 */
export function manqueDeLEtape(
  etape: EtapeReglement,
  s: SaisieReglement,
  tiers: TiersARegler | null,
  exercice?: { debut: string; fin: string },
): string | null {
  switch (etape) {
    case 'sens':
      return null;
    case 'tresorerie':
      if (!s.date) return 'Indiquez la date du règlement.';
      // La date dans l'exercice (mineur 7) · le serveur la refuserait au
      // récapitulatif, après cinq étapes.
      if (exercice && (s.date < exercice.debut || s.date > exercice.fin)) {
        return `La date du règlement tombe hors de l'exercice (du ${exercice.debut.split('-').reverse().join('/')} au ${exercice.fin.split('-').reverse().join('/')}).`;
      }
      return s.journalId ? null : 'Choisissez le journal de trésorerie.';
    case 'tiers':
      return s.compteId && tiers ? null : 'Choisissez le tiers à régler.';
    case 'factures': {
      if (s.ligneIds.length === 0) return 'Cochez au moins une facture.';
      const enDevise = (tiers?.lignes ?? []).find((l) => s.ligneIds.includes(l.id) && l.deviseId);
      return enDevise
        ? `La facture « ${enDevise.libelle} » est en ${enDevise.deviseCode ?? 'devise'} · elle se règle dans sa devise, par le formulaire Règlement des tiers.`
        : null;
    }
    case 'montant': {
      const n = lireMontant(s.montant);
      return n !== null && Number.isFinite(n) && n > 0 ? null : 'Indiquez le montant réglé, positif.';
    }
    case 'recapitulatif':
      return null;
  }
}

/**
 * Le corps de `POST /reglements`, celui du formulaire pour un seul tiers en
 * francs · le montant part toujours (prérempli au dû, il dit un partiel s'il
 * est moindre), la référence seulement si elle est saisie, l'ordre de
 * virement seulement pour un fournisseur et un dossier qui le sert.
 */
export function corpsReglement(s: SaisieReglement, exerciceId: string, ordresServis: boolean) {
  return {
    sens: s.sens,
    exerciceId,
    journalId: s.journalId,
    date: s.date,
    ...(s.modeReglementId ? { modeReglementId: s.modeReglementId } : {}),
    ...(s.ordreVirement && ordresServis && s.sens === 'FOURNISSEUR' ? { ordreVirement: true } : {}),
    reglements: [
      {
        compteId: s.compteId,
        ligneIds: s.ligneIds,
        montant: lireMontant(s.montant),
        ...(s.reference.trim() ? { reference: s.reference.trim() } : {}),
      },
    ],
  };
}

/**
 * LE RÈGLEMENT ENCHAÎNÉ · « Régler un autre tiers » repart de l'étape du
 * tiers avec ce qui se répète d'une séance (sens, date, journal, mode, ordre
 * de virement), et vide ce qui est propre au tiers. Convention d'OmegaX,
 * dite dans l'aide.
 */
export function saisieEnchainee(s: SaisieReglement): SaisieReglement {
  return { ...s, compteId: '', ligneIds: [], montant: '', reference: '' };
}
