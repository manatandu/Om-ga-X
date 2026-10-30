/**
 * LIGNE commercial-l8, fonction 30 · L'ENCOURS MAXIMUM DU CLIENT, AVERTI À LA
 * VENTE (Sage, « encours maximum autorisé » de la fiche du client).
 *
 * AUCUN TEXTE LU N'IMPOSE NI NE BORNE LE CRÉDIT CONSENTI À UN CLIENT · c'est
 * une règle de gestion que le dossier se donne. OmegaX AVERTIT, il ne refuse
 * JAMAIS · une vente au-delà de l'encours reste une vente, que le texte
 * oblige à facturer (loi de procédures fiscales, art. 23 · une facture
 * « pour chaque transaction effectuée »).
 *
 * L'ENCOURS EST CE QUE LE CLIENT DOIT, en francs, monnaie de tenue (loi
 * n° 23/053, art. 141, 1° ; AUDCIF art. 17, 1°) · le solde débiteur net de
 * ses comptes (débit moins crédit, brouillard compris, ni simulation ni
 * à-nouveau provisoire), plus les factures de vente ENREGISTRÉES et pas encore
 * passées au journal (elles ne sont encore dans aucun solde), plus la vente en
 * cours. Une ligne en devise compte pour sa contrevaleur en francs au cours
 * historique, et c'est dit. Un solde illisible n'est JAMAIS zéro · l'encours
 * est alors « non calculé », avec son motif.
 */

export interface EncoursLu {
  encoursMaximum: number | null;
  /** Solde net des comptes du client, en francs · `null` s'il n'a pas pu être lu. */
  soldeComptable: number | null;
  motifSolde: string | null;
  /** TTC des factures de vente enregistrées et non passées au journal. */
  facturesNonComptabilisees: number;
  nombreFacturesNonComptabilisees: number;
  /** La vente en cours, quand elle n'est pas encore enregistrée. */
  venteEnCours: number;
  encours: number | null;
  depassement: number | null;
  /** Le texte à afficher, ou `null` quand rien n'est à dire. */
  avertissement: string | null;
}

const fr = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Somme en centimes entiers, rendue en francs. */
const somme = (...v: number[]) => v.reduce((a, x) => a + Math.round(x * 100), 0) / 100;

export function jugerEncours(p: {
  encoursMaximum: number | null;
  soldeComptable: number | null;
  motifSolde: string | null;
  facturesNonComptabilisees: number;
  nombreFacturesNonComptabilisees: number;
  venteEnCours: number;
  aDesLignesEnDevise: boolean;
}): EncoursLu {
  const base = {
    encoursMaximum: p.encoursMaximum,
    soldeComptable: p.soldeComptable,
    motifSolde: p.motifSolde,
    facturesNonComptabilisees: p.facturesNonComptabilisees,
    nombreFacturesNonComptabilisees: p.nombreFacturesNonComptabilisees,
    venteEnCours: p.venteEnCours,
  };
  if (p.encoursMaximum === null) {
    return { ...base, encours: p.soldeComptable === null ? null : somme(p.soldeComptable, p.facturesNonComptabilisees, p.venteEnCours), depassement: null, avertissement: null };
  }
  if (p.soldeComptable === null) {
    return {
      ...base,
      encours: null,
      depassement: null,
      avertissement: `Encours du client non calculé · ${p.motifSolde ?? 'solde illisible'}. L'encours maximum de ${fr(p.encoursMaximum)} n'a pas pu être confronté.`,
    };
  }
  const encours = somme(p.soldeComptable, p.facturesNonComptabilisees, p.venteEnCours);
  const depassement = Math.round(encours * 100) > Math.round(p.encoursMaximum * 100) ? somme(encours, -p.encoursMaximum) : null;
  const devise = p.aDesLignesEnDevise ? ' Les lignes en devise y comptent pour leur contrevaleur en francs au cours historique.' : '';
  return {
    ...base,
    encours,
    depassement,
    avertissement:
      depassement === null
        ? null
        : `Encours maximum dépassé · ce client devrait ${fr(encours)} (solde ${fr(p.soldeComptable)}, factures non passées ${fr(p.facturesNonComptabilisees)}${p.venteEnCours ? `, vente en cours ${fr(p.venteEnCours)}` : ''}) pour un encours maximum de ${fr(p.encoursMaximum)}, soit ${fr(depassement)} au-delà. La vente n'est pas refusée.${devise}`,
  };
}

/** L'encours maximum · positif ou nul, au centime ; il ne vaut que pour un client ou un adhérent. */
export function motifRefusEncoursMaximum(v: number | null | undefined, typeTiers: string): string | null {
  if (v === null || v === undefined) return null;
  if (typeTiers !== 'CLIENT' && typeTiers !== 'ADHERENT') {
    return 'Un encours maximum se pose sur un client ou un adhérent · ce tiers ne reçoit pas de vente à crédit du dossier.';
  }
  if (!Number.isFinite(v) || v < 0) return 'L’encours maximum est un montant positif ou nul, en francs.';
  if (Math.abs(Math.round(v * 100) - v * 100) > 1e-6) return 'L’encours maximum se saisit au centime.';
  return null;
}
