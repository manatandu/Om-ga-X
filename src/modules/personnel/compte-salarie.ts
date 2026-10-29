/**
 * LIGNE PAIE-SUITE, FONCTION 76 · LE COMPTE INDIVIDUEL DU SALARIÉ SOUS LE 422
 * · règles pures, sans Prisma.
 *
 * PAR LA LOI · la fiche du compte 42 des deux plans (AUDCIF, Titre VII ;
 * SYCEBNL, Partie 2 ch. 3) crédite le 42 « des rémunérations brutes à payer
 * au personnel » et le débite « des rémunérations versées », sans dire s'il
 * se tient par salarié ou en un seul compte ; le 422 « Personnel,
 * rémunérations dues » se subdivise (AUDCIF art. 18, al. 3 ; au SYCEBNL,
 * dont l'art. 3 écarte l'art. 18, Partie 2 ch. 2, section 1, « peut être
 * complété par des codes établis en fonction des besoins »). Le compte
 * individuel est donc une ORGANISATION, comme le compte de tiers sous son
 * collectif (`tiers/collectifs-tiers.ts`, décision de Manasse du 2026-09-25) ·
 * le net dû se lit par salarié, la balance générale fond les comptes sur le
 * collectif par leur lien (`Compte.collectifId`), la balance des comptes les
 * rend un par un.
 *
 * UNE OPTION DU DOSSIER, DÉSACTIVÉE PAR DÉFAUT (`Tenant.comptesIndividuelsSalaries`)
 * · c'est le seul choix de cette ligne qu'aucun texte ne tranche, et il a un
 * prix · la paie AGRÉGÉE taisait au journal, que tout le dossier lit
 * (l'aide-comptable compris, à qui le personnel est fermé), le nom et le net
 * de chacun ; le compte individuel les y met. Le cabinet le décide.
 *
 * QUATRE RÈGLES.
 * (1) LE COMPTE NAÎT SOUS LE COLLECTIF DU PLAN (le 422 de `passation-paie.ts`,
 *     même numéro aux deux semis), au premier numéro libre sous sa racine, à
 *     la longueur du dossier, sous le verrou de la numérotation des tiers ·
 *     jamais un numéro deviné, ni le collectif lui-même.
 * (2) IL S'OUVRE AU GESTE (un salarié, ou tout le registre par tranches),
 *     jamais d'office sur l'existant · et naît avec le salarié créé quand
 *     l'option est posée.
 * (3) LA PASSATION CRÉDITE LE BRUT ET DÉBITE LES RETENUES SUR LE COMPTE DU
 *     SALARIÉ (`comptabilisation-paie.ts`), le PAIEMENT le débite du net ·
 *     sur le compte où son bulletin a été PASSÉ, collectif compris pour un
 *     bulletin passé avant l'ouverture · une reprise en négatif suit la même
 *     règle (AUDCIF art. 20, al. 2, « ce qui a été passé »). LIMITE ÉCRITE ·
 *     un bulletin PAYÉ AVANT D'ÊTRE PASSÉ suit l'option du jour du paiement,
 *     et sa passation celle du jour de la passation · l'option changée entre
 *     les deux laisse le compte du salarié et le collectif de sens contraires,
 *     la balance générale bouclée. Passez la paie avant de la payer, ou ne
 *     changez pas l'option entre les deux.
 * (4) UNE FOIS UN COMPTE OUVERT, LA SAISIE MANUELLE NE VA PLUS AU COLLECTIF
 *     (règle des collectifs, `verifierComptesCollectifs`) · un paiement de
 *     salaire saisi à la main se passe sur le compte du salarié ; un solde
 *     déjà au collectif se reporte par une pièce qui ne porte que lui et les
 *     comptes des salariés. Les avances (421) et les prêts (272) restent
 *     tenus au registre des avances, par salarié, sans compte individuel.
 */

export const TRANCHE_OUVERTURE_COMPTES = 100;

/**
 * RÈGLE 3 · LE 422 QUE LE PAIEMENT DÉBITE · celui où le net a été inscrit.
 * Passé · le compte du salarié si la pièce de passation le porte, le collectif
 * sinon (passé avant l'ouverture, ou option retirée depuis). Pas encore passé ·
 * l'option et le compte du jour, comme la passation à venir.
 */
export function compteDuPaiement(b: {
  compteIndividuelId: string | null;
  passe: boolean;
  passeSurSonCompte: boolean;
  option: boolean;
}): 'INDIVIDUEL' | 'COLLECTIF' {
  if (!b.compteIndividuelId) return 'COLLECTIF';
  if (b.passe) return b.passeSurSonCompte ? 'INDIVIDUEL' : 'COLLECTIF';
  return b.option ? 'INDIVIDUEL' : 'COLLECTIF';
}

/** L'intitulé du compte · le nom du salarié, comme le compte d'un tiers porte le nom du tiers. */
export function intituleDuCompteSalarie(s: { nom: string; postNom: string | null; prenoms: string | null; matricule: string | null }): string {
  const nom = [s.nom, s.postNom, s.prenoms].filter(Boolean).join(' ');
  return `${nom}${s.matricule ? ` (${s.matricule})` : ''} · rémunérations dues`.slice(0, 200);
}

export const MOTIF_OPTION_ABSENTE =
  "Le dossier ne tient pas les comptes individuels des salariés · activez l'option dans les Paramètres du dossier (le net de chaque salarié paraîtra alors au journal, que tout le dossier lit).";

export const RESERVE_COMPTE_INDIVIDUEL =
  "Compte individuel sous le 422 · la paie y crédite le brut et y débite les retenues, le paiement y débite le net ; la balance générale le fond sur le collectif. Un bulletin passé avant son ouverture se paie et se reprend sur le collectif, où son net a été inscrit.";
