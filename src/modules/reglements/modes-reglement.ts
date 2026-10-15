import { NatureModeReglement } from '@prisma/client';

/**
 * MODES DE RÈGLEMENT · règles pures, sans Prisma (ligne sage-l2, fonction 1).
 *
 * Sage 100, table P_REGLEMENT · trente modes au plus par dossier, chacun son
 * intitulé, son « mode de paiement » (chèque, virement, espèces…) et son code
 * interbancaire. Le tiers porte son mode habituel, chaque échéance d'un
 * modèle de règlement le sien, et la ligne d'écriture celui de l'échéance
 * attendue ou du paiement fait.
 *
 * UNE SEULE RÈGLE DE DROIT S'Y ATTACHE, et c'est la nature qui la porte.
 * O.-L. n° 10/001, art. 59 bis (créé par l'O.-L. n° 13/007 du 23 février
 * 2013) · « Toute transaction entre assujettis à la taxe sur la valeur
 * ajoutée d'un montant d'au moins 1.000.000,00 de Francs congolais doit être
 * payée par chèque, par virement ou par carte bancaire. » Art. 74 bis · « Tout
 * manquement à l'obligation prévue à l'article 59 bis [...] est sanctionné
 * par la perte du droit à déduction de la taxe sur la valeur ajoutée
 * supportée. » La sanction frappe CELUI QUI DÉDUIT, donc le dossier qui paie
 * son fournisseur · le règlement d'un client en espèces ne coûte rien au
 * dossier qui l'encaisse, et rien ne se dit côté client.
 *
 * Le contrôle AVERTIT, il ne refuse jamais · l'écriture doit dire ce qui
 * s'est passé (un paiement en espèces enregistré autrement serait un faux),
 * et la perte du droit à déduction est une conséquence fiscale que le module
 * de TVA ne calcule pas encore (lacune nommée au § 6 de CLAUDE.md, passe
 * F2b). Le code interbancaire est LIBRE · aucune nomenclature bancaire lue au
 * corpus ne s'applique en RDC (décision D11 de la reproduction).
 */

/** Les trois modes que l'art. 59 bis admet, et eux seuls · liste FERMÉE du texte. */
export const NATURES_ADMISES_ART_59_BIS: ReadonlySet<NatureModeReglement> = new Set<NatureModeReglement>([
  NatureModeReglement.CHEQUE,
  NatureModeReglement.VIREMENT,
  NatureModeReglement.CARTE_BANCAIRE,
]);

/** Le seuil de l'art. 59 bis, al. 1er · modifiable par arrêté (al. 2), aucun arrêté lu au corpus. */
export const SEUIL_ART_59_BIS = 1_000_000;

/**
 * L'ENTRÉE EN VIGUEUR · « Les dispositions ci-dessus sont appliquées dans un
 * délai de trois mois à compter de la date du 27 février 2013 conformément à
 * l'article 5, alinéa 2, de l'Ordonnance-Loi n° 13/007 » (note de la
 * compilation DGI au 19/07/2026). Un règlement antérieur ne se voit rien
 * reprocher en son nom (CLAUDE.md § 10 bis, l'entrée en vigueur).
 */
export const ENTREE_EN_VIGUEUR_ART_59_BIS = new Date(Date.UTC(2013, 4, 27));

/** Sage, P_REGLEMENT · trente modes au plus · c'est aussi la borne de la liste servie. */
export const PLAFOND_MODES_REGLEMENT = 30;

export const LIBELLES_NATURES: Readonly<Record<NatureModeReglement, string>> = {
  ESPECES: 'Espèces',
  CHEQUE: 'Chèque',
  VIREMENT: 'Virement',
  CARTE_BANCAIRE: 'Carte bancaire',
  MONNAIE_ELECTRONIQUE: 'Monnaie électronique',
  EFFET_DE_COMMERCE: 'Effet de commerce',
  PRELEVEMENT: 'Prélèvement',
  AUTRE: 'Autre',
};

/**
 * LES MODES USUELS que le cabinet peut créer d'un geste · rien n'est créé
 * d'office (une lecture n'écrit pas). Codes et intitulés d'OmegaX, jamais
 * repris de Sage.
 */
export const MODES_USUELS: ReadonlyArray<{ code: string; intitule: string; nature: NatureModeReglement }> = [
  { code: 'ESP', intitule: 'Espèces', nature: NatureModeReglement.ESPECES },
  { code: 'CHQ', intitule: 'Chèque', nature: NatureModeReglement.CHEQUE },
  { code: 'VIR', intitule: 'Virement bancaire', nature: NatureModeReglement.VIREMENT },
  { code: 'CB', intitule: 'Carte bancaire', nature: NatureModeReglement.CARTE_BANCAIRE },
  { code: 'MEL', intitule: 'Monnaie électronique', nature: NatureModeReglement.MONNAIE_ELECTRONIQUE },
];

/** Code et intitulé d'un mode · bornes de Sage (intitulé de 35 caractères), code court sans espace. */
export function motifRefusIdentiteMode(code: string, intitule: string): string | null {
  const c = code.trim();
  if (!/^[A-Za-z0-9_-]{1,10}$/.test(c)) {
    return 'Le code d’un mode de règlement compte de 1 à 10 caractères, lettres, chiffres, tiret ou souligné, sans espace.';
  }
  const i = intitule.trim();
  if (i.length === 0) return 'L’intitulé du mode de règlement est obligatoire.';
  if (i.length > 35) return 'L’intitulé d’un mode de règlement compte au plus 35 caractères.';
  return null;
}

/**
 * LA NATURE DU PAIEMENT LUE SUR LE COMPTE DE TRÉSORERIE, quand aucun mode
 * n'est déclaré · « le compte de trésorerie (57, espèces) en dit déjà
 * l'essentiel » (fiche n° 1 du tri). Les fiches de la classe 5 des deux
 * plans · 57 Caisse (espèces), 55 Instruments de monnaie électronique. Une
 * banque (52) ne dit pas si c'est un chèque ou un virement · `null`, rien
 * n'est présumé.
 */
export function natureLueSurLeCompte(numeroTresorerie: string | null): NatureModeReglement | null {
  if (!numeroTresorerie) return null;
  if (numeroTresorerie.startsWith('57')) return NatureModeReglement.ESPECES;
  if (numeroTresorerie.startsWith('55')) return NatureModeReglement.MONNAIE_ELECTRONIQUE;
  return null;
}

/**
 * L'AVERTISSEMENT DE L'ART. 59 BIS sur un paiement à un fournisseur · une
 * facture (la transaction) d'au moins 1 000 000 FC, payée par un mode que le
 * texte n'admet pas, à une date où il s'applique, quand le dossier n'a pas
 * déclaré ne pas être assujetti. L'assujettissement du FOURNISSEUR n'est pas
 * tenu par la fiche · la phrase le dit sous condition.
 */
export function avertissementArt59Bis(p: {
  sens: 'FOURNISSEUR' | 'CLIENT';
  date: Date;
  /** Le fait déclaré du dossier · `false` (déclaré non assujetti) éteint l'avertissement. */
  dossierAssujetti: boolean | null;
  nature: NatureModeReglement | null;
  /** D'où la nature est lue · le mode déclaré, ou le compte de trésorerie du journal. */
  source: 'MODE' | 'COMPTE';
  compte: string;
  /** Chaque facture réglée, son montant entier (la transaction), sa référence. */
  factures: ReadonlyArray<{ reference: string; montant: number }>;
}): string | null {
  if (p.sens !== 'FOURNISSEUR') return null;
  if (p.dossierAssujetti === false) return null;
  if (p.nature === null || NATURES_ADMISES_ART_59_BIS.has(p.nature)) return null;
  if (p.date.getTime() < ENTREE_EN_VIGUEUR_ART_59_BIS.getTime()) return null;
  const visees = p.factures.filter((f) => Math.round(f.montant * 100) >= SEUIL_ART_59_BIS * 100);
  if (visees.length === 0) return null;
  const fmt = (x: number) => x.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mode = LIBELLES_NATURES[p.nature].toLowerCase();
  return (
    `${p.compte} · ${visees.map((f) => `${f.reference} (${fmt(f.montant)})`).join(', ')} ` +
    `${visees.length > 1 ? 'sont des transactions' : 'est une transaction'} d’au moins ${fmt(SEUIL_ART_59_BIS)} FC, ` +
    `payée${visees.length > 1 ? 's' : ''} ${p.source === 'COMPTE' ? 'en caisse ou en monnaie électronique (compte du journal)' : `par ${mode}`} · ` +
    'entre assujettis, l’O.-L. n° 10/001, art. 59 bis, veut un paiement par chèque, par virement ou par carte bancaire, ' +
    'et l’art. 74 bis retire alors le droit à déduction de la TVA supportée. Si le fournisseur est assujetti, ' +
    'la TVA de ces factures n’est pas déductible ; OmegaX ne la retire pas de la déclaration.'
  );
}
