import { ConditionEcheance, TypeEcheance, TypeJournal } from '@prisma/client';

/**
 * L'ÉCHÉANCIER D'UN MODÈLE DE RÈGLEMENT · règles pures, sans Prisma (ligne
 * sage-l2, fonction 3). Une seule écriture du calcul, servie au simulateur
 * du modèle (`POST /modeles-reglement/:id/calculer`) et à la saisie, qui
 * applique d'office le modèle du tiers à la ligne de sa facture (Sage,
 * « échéance calculée selon les conditions de règlement du tiers »,
 * « fenêtre multi-échéance »).
 *
 * LE CALCUL SE FAIT EN CENTIMES ENTIERS (CLAUDE.md, « un seuil se juge en
 * centimes entiers ») · la somme des échéances rend le montant de la ligne au
 * centime, la dernière prenant le reste, et aucune n'est négative (un
 * pourcentage ou un montant fixe sont bornés à ce qui reste, l'Équilibre se
 * calcule en dernier quel que soit son rang).
 *
 * Le modèle de règlement n'est régi par aucun texte du corpus · c'est une
 * convention commerciale entre le dossier et son tiers. Les fiches des
 * comptes 40 et 41 des deux plans n'en disent que l'objet (la dette ou la
 * créance née de la facture) ; l'échéance, elle, range la ligne dans la
 * balance âgée, l'échéancier, les relances et les notes par échéance.
 */

export interface ModeleLu {
  delaiJours: number;
  echeance: ConditionEcheance;
  modeReglementId: string | null;
}

export interface EcheanceDuModeleLue {
  ordre: number;
  type: TypeEcheance;
  valeur: { toString(): string } | number | string | null;
  delaiJours: number;
  echeance: ConditionEcheance;
  modeReglementId: string | null;
}

export interface EcheanceCalculee {
  ordre: number;
  type: TypeEcheance | null;
  montant: number;
  dateEcheance: Date;
  modeReglementId: string | null;
}

/** Date de la facture plus le délai (NET), ou fin du mois de la facture plus le délai (FIN_DE_MOIS), en UTC. */
export function dateEcheanceDuModele(dateFacture: Date, delaiJours: number, condition: ConditionEcheance): Date {
  if (condition === ConditionEcheance.NET) {
    const d = new Date(Date.UTC(dateFacture.getUTCFullYear(), dateFacture.getUTCMonth(), dateFacture.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + delaiJours);
    return d;
  }
  const finDeMois = new Date(Date.UTC(dateFacture.getUTCFullYear(), dateFacture.getUTCMonth() + 1, 0));
  finDeMois.setUTCDate(finDeMois.getUTCDate() + delaiJours);
  return finDeMois;
}

const enCentimes = (x: number) => Math.round(x * 100);

/**
 * L'échéancier d'une facture de `montantTotal`, datée `dateFacture`. Sans
 * échéance fractionnée, une seule · 100 % au délai et à la condition du
 * modèle, au mode du modèle. Fractionné, chaque échéance au sien.
 * `modeHabituel` (le mode de la fiche du tiers) vaut quand ni l'échéance ni
 * le modèle n'en disent.
 */
export function echeancierDuModele(
  modele: ModeleLu,
  echeances: readonly EcheanceDuModeleLue[],
  dateFacture: Date,
  montantTotal: number,
  modeHabituel: string | null = null,
): EcheanceCalculee[] {
  const total = enCentimes(montantTotal);
  if (echeances.length === 0) {
    return [
      {
        ordre: 1,
        type: null,
        montant: total / 100,
        dateEcheance: dateEcheanceDuModele(dateFacture, modele.delaiJours, modele.echeance),
        modeReglementId: modele.modeReglementId ?? modeHabituel,
      },
    ];
  }
  const triees = [...echeances].sort((a, b) => a.ordre - b.ordre);
  const equilibre = triees.find((e) => e.type === TypeEcheance.EQUILIBRE);
  const ordreDeCalcul = equilibre ? [...triees.filter((e) => e !== equilibre), equilibre] : triees;
  const montants = new Map<EcheanceDuModeleLue, number>();
  let reste = total;
  ordreDeCalcul.forEach((e, i) => {
    let centimes: number;
    if (e.type === TypeEcheance.EQUILIBRE || i === ordreDeCalcul.length - 1) {
      // La dernière échéance prend toujours le reste · un arrondi sur les
      // pourcentages ne laisse aucun centime non réparti.
      centimes = reste;
    } else if (e.type === TypeEcheance.POURCENTAGE) {
      centimes = Math.min(Math.round((total * Number(e.valeur ?? 0)) / 100), reste);
    } else {
      centimes = Math.min(enCentimes(Number(e.valeur ?? 0)), reste);
    }
    centimes = Math.max(centimes, 0);
    reste -= centimes;
    montants.set(e, centimes);
  });
  return triees.map((e) => ({
    ordre: e.ordre,
    type: e.type,
    montant: (montants.get(e) ?? 0) / 100,
    dateEcheance: dateEcheanceDuModele(dateFacture, e.delaiJours, e.echeance),
    modeReglementId: e.modeReglementId ?? modeHabituel,
  }));
}

/**
 * LA LIGNE QUI REÇOIT L'ÉCHÉANCIER DU MODÈLE · celle de la FACTURE sur le
 * compte du tiers, et elle seule. Fiches des comptes 40 et 41 des deux plans ·
 * le fournisseur est CRÉDITÉ du montant des factures, le client DÉBITÉ ; un
 * avoir (sens inverse) n'a pas d'échéance à tirer d'un modèle. Hors du
 * 408 et du 418 (factures non parvenues ou à établir, dont la date de la
 * facture n'est pas connue), du 409 et du 419 (avances et acomptes, qui
 * n'échoient pas), du 416 (créance douteuse, reclassée depuis la facture qui
 * porte déjà son échéance). Un journal de trésorerie enregistre un
 * règlement, jamais une facture.
 */
export function motifSansEcheancierDuModele(p: {
  numero: string;
  sens: 'DEBIT' | 'CREDIT';
  typeJournal: TypeJournal | null;
}): string | null {
  const n = p.numero;
  if (!n.startsWith('40') && !n.startsWith('41')) return 'Le modèle de règlement ne s’applique qu’à un compte de fournisseur (40) ou de client (41).';
  for (const r of ['408', '409', '416', '418', '419']) {
    if (n.startsWith(r)) return `Le compte ${n} (${r}) ne reçoit pas d’échéance tirée d’un modèle de règlement.`;
  }
  if (p.typeJournal === TypeJournal.TRESORERIE) return 'Un journal de trésorerie enregistre un règlement · l’échéance d’une facture ne s’y calcule pas.';
  const sensDeLaFacture = n.startsWith('40') ? 'CREDIT' : 'DEBIT';
  if (p.sens !== sensDeLaFacture) return 'Une ligne au sens inverse de la facture (avoir, règlement) ne reçoit pas d’échéance tirée du modèle.';
  return null;
}
