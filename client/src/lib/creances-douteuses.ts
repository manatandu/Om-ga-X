import { montant } from './montants';

/**
 * CRÉANCES DOUTEUSES OU LITIGIEUSES · ce que l'écran calcule pour MONTRER,
 * jamais pour décider (ligne A7). Le serveur rejoue tout et refuse avec son
 * article ; ces fonctions ne font qu'annoncer l'écriture que le clic passera.
 */

export type NatureCreance = 'LITIGIEUSE' | 'DOUTEUSE';

export interface PieceSaisie {
  nature: string;
  reference: string;
  date: string;
}

/** Les comptes que la revue passera, SERVIS par le serveur (relecture « écran », 12). */
export interface ComptesRevue {
  compte491: string;
  dotation: string;
  reprise: string;
}

/**
 * L'écriture de la revue annoncée AVANT le clic · seul l'écart avec la
 * dépréciation en place se passe (fiche du compte 49), et aucune autre
 * donnée n'entre dans le calcul · ni l'âge, ni un pourcentage. Le montant
 * s'écrit par `lib/montants.ts` (relecture adverse, M8). Les comptes sont
 * ceux que le serveur sert pour CETTE créance (le 491 de sa nature), et la
 * date celle qu'il donnera à l'écriture · rien n'est recopié ici.
 */
export function annonceRevue(enPlace: number, necessaire: number | null, comptes: ComptesRevue, dateRevue: string): string | null {
  if (necessaire == null || !Number.isFinite(necessaire)) return null;
  const ecart = Math.round((necessaire - enPlace) * 100) / 100;
  const au = `au ${dateRevue.slice(8, 10)}/${dateRevue.slice(5, 7)}/${dateRevue.slice(0, 4)}`;
  if (ecart > 0) return `Dotation de ${montant(ecart)} · D ${comptes.dotation} / C ${comptes.compte491}, ${au}.`;
  if (ecart < 0) return `Reprise de ${montant(-ecart)} · D ${comptes.compte491} / C ${comptes.reprise}, ${au}.`;
  return 'Dépréciation maintenue · la revue est gardée, aucune écriture.';
}

/**
 * LE MONTANT PRÉREMPLI DANS UN CHAMP (relecture « écran », 11) · arrondi au
 * centime et écrit à deux décimales, point décimal, que `montantSaisi` relit
 * tel quel. `String(0.1 + 0.2)` aurait rempli « 0.30000000000000004 ».
 * `null` laisse le champ vide · vide n'est pas zéro.
 */
export function montantPourChamp(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '';
  return (Math.round(v * 100) / 100).toFixed(2);
}

/**
 * LA DATE D'UN GESTE BORNÉE À L'EXERCICE (relecture « écran », 13) · bornes
 * `min` et `max` du champ ; le serveur refuse de toute façon une date hors de
 * l'exercice.
 */
export function bornesExercice(exercice: { dateDebut: string; dateFin: string } | null | undefined): { min?: string; max?: string } {
  return exercice ? { min: exercice.dateDebut.slice(0, 10), max: exercice.dateFin.slice(0, 10) } : {};
}

/**
 * LE RAPPROCHEMENT D'UNE LISTE TRONQUÉE N'EST PAS CALCULÉ (relecture
 * « échecs silencieux », M6) · le serveur le rend `null`, et l'écran le dit
 * au lieu de se taire, ce qui se lirait comme un écart nul.
 */
export function etatRapprochement(liste: { tronque: boolean; rapprochement: unknown }): 'calcule' | 'non-calcule-tronque' | 'absent' {
  if (liste.rapprochement) return 'calcule';
  return liste.tronque ? 'non-calcule-tronque' : 'absent';
}

/**
 * Le 416 présélectionné pour une créance et une nature · celui que le
 * serveur propose, s'il existe au plan, sinon rien (le choix est demandé).
 */
export function compte416Initial(
  propose: Partial<Record<NatureCreance, string | null>> | undefined,
  nature: NatureCreance,
  comptes416: readonly { id: string; numero: string }[],
  propre?: Partial<Record<NatureCreance, string | null>>,
): string {
  // Le 416 du client lui-même (panoplie des tiers) passe avant le premier
  // compte de la racine, qui est le collectif commun.
  const sien = propre?.[nature];
  if (sien && comptes416.some((c) => c.id === sien)) return sien;
  const racine = propose?.[nature];
  if (racine) return comptes416.find((c) => c.numero.startsWith(racine))?.id ?? '';
  return comptes416.length === 1 ? comptes416[0].id : '';
}

/** Les pièces envoyées · une ligne sans nature ou sans référence est écartée (le serveur exige au moins une pièce). */
export function piecesAEnvoyer(pieces: readonly PieceSaisie[]) {
  return pieces
    .filter((p) => p.nature.trim() && p.reference.trim())
    .map((p) => ({ nature: p.nature.trim(), reference: p.reference.trim(), ...(p.date ? { date: p.date } : {}) }));
}

/**
 * POURQUOI LA LISTE DES 651 EST VIDE, ET QUOI FAIRE (§ 9 ter, relecture
 * adverse M8) · `null` tant qu'elle n'est pas lue, et rien à dire si elle
 * propose quelque chose.
 */
export function motifListe651Vide(comptes: readonly unknown[] | null): string | null {
  if (comptes === null || comptes.length > 0) return null;
  return (
    'Aucun compte 651 personnalisé au plan · personnalisez-le (ou ouvrez-le) dans Plan comptable, sous « Pertes sur créances », ' +
    'puis rouvrez ce formulaire.'
  );
}

/** Le motif d'annulation d'une revue, de 3 à 500 caractères (même borne que le serveur). */
export function motifAnnulationValide(motif: string): boolean {
  const m = motif.trim();
  return m.length >= 3 && m.length <= 500;
}

/**
 * LE MOUVEMENT PROPOSÉ À L'ANNULATION (K4) · le plus récent, celui qu'une
 * revue n'a le plus probablement pas encore compté ; le cabinet en choisit un
 * autre dans la modale. `null` sans mouvement.
 */
export function mouvementAAnnulerParDefaut(mouvements: readonly { id: string; date: string }[]): string | null {
  if (mouvements.length === 0) return null;
  // Pas de `.at(-1)` · la cible du client (lib ES2020) ne le connaît pas, et
  // le typage du déploiement l'a refusé (Hosting 634) quand un poste local le
  // laissait passer.
  const tries = [...mouvements].sort((a, b) => a.date.localeCompare(b.date));
  return tries[tries.length - 1].id;
}

/**
 * m5 · LE 491 SE CHOISIT SOUS LA RACINE DE SA NATURE · 4911 pour une créance
 * litigieuse, 4912 pour une douteuse (fiche du compte 49, aux deux plans) ;
 * le serveur refuse toute autre racine. Un choix unique se présélectionne.
 */
export function racine491(nature: NatureCreance): string {
  return nature === 'LITIGIEUSE' ? '4911' : '4912';
}

export function comptes491DeLaNature<T extends { numero: string }>(nature: NatureCreance, comptes: readonly T[]): T[] {
  return comptes.filter((c) => c.numero.startsWith(racine491(nature)));
}

export function compte491Initial(nature: NatureCreance, comptes: readonly { id: string; numero: string }[]): string {
  const possibles = comptes491DeLaNature(nature, comptes);
  return possibles.length === 1 ? possibles[0].id : '';
}

export const LIBELLE_NATURE: Record<NatureCreance, string> = {
  LITIGIEUSE: 'Litigieuse (le client conteste)',
  DOUTEUSE: 'Douteuse (le client se dérobe)',
};

/** Le rapprochement servi par le serveur (A7 ter, m10 · toujours calculé, par agrégat). */
export interface RapprochementCreances {
  provisoire: boolean;
  /** B1 · l'exercice n'a qu'un report à-nouveau PROVISOIRE, qui ne fait pas foi. */
  reportProvisoire?: boolean;
  solde416: number;
  resteModule: number;
  solde491: number;
  depreciationModule: number;
  /** m8 · la part du 491 passée hors du module dans l'EXERCICE (mineur 5, jamais la chaîne), en positif. */
  horsModule491?: number;
}

const auCentime = (x: number) => Math.round(x * 100) / 100;

/**
 * LES ÉCARTS DU RAPPROCHEMENT (A7 ter, m8) · l'écart du 491 se DÉCOMPOSE ·
 * la part passée hors du module (servie), et le reste, qui vient de
 * l'à-nouveau ou d'une écriture du module retouchée. Un écart nu laissait
 * croire que le module se trompait quand un 4912 porte aussi des
 * dépréciations passées à la main.
 */
export function ecartsRapprochement(r: RapprochementCreances) {
  const ecart416 = auCentime(r.solde416 - r.resteModule);
  const ecart491 = auCentime(r.solde491 - r.depreciationModule);
  const horsModule491 = auCentime(r.horsModule491 ?? 0);
  return { ecart416, ecart491, horsModule491, reste491: auCentime(ecart491 - horsModule491) };
}

/**
 * B1 · pourquoi les soldes du rapprochement sont provisoires. Mineur 3 · le
 * module ne lit jamais le report à-nouveau provisoire · le relancer ne change
 * rien, et le libellé ne le propose plus.
 */
export function libelleSoldesProvisoires(r: RapprochementCreances): string | null {
  if (!r.provisoire) return null;
  return r.reportProvisoire
    ? "Soldes du 416 et du 491 provisoires · lus sur l'exercice précédent, le report à-nouveau provisoire n'étant pas lu"
    : 'Soldes du 416 et du 491 provisoires · à-nouveau non passé';
}

/**
 * L'issue du lettrage d'une créance éteinte (A7 ter, B2), servie avec le geste ·
 * `aDesigner` (second tour, B-1) · le reste est à l'à-nouveau, que le cabinet
 * désigne par « Lettrer au 416 ».
 */
export type IssueLettrage416 = { pose: true; code: string } | { pose: false; motif: string; aDesigner?: boolean } | null | undefined;

/** B-1 · ce que « Lettrer au 416 » montre, servi par le serveur. */
export interface PropositionLettrage416 {
  eteinte: boolean;
  compte416: string;
  ouvertes: number;
  aApporter: number;
  aNouveaux: Array<{ id: string; date: string; numeroPiece: number | null; libelle: string | null; montant: number }>;
  tronque: boolean;
  propose: string[];
}

/**
 * B-1 · L'ÉCART qui reste entre ce que l'à-nouveau doit apporter et les lignes
 * cochées · le lettrage ne part qu'à zéro (le serveur pose le groupe SOLDÉ ou
 * pas du tout). Au centime.
 */
export function ecartLettrage416(p: PropositionLettrage416, choisies: ReadonlySet<string>): number {
  const somme = p.aNouveaux.filter((l) => choisies.has(l.id)).reduce((t, l) => t + l.montant, 0);
  return auCentime(p.aApporter - somme);
}

export function messageLettrage416(issue: IssueLettrage416): string | null {
  if (!issue) return null;
  return issue.pose ? `Créance éteinte · ses lignes du 416 sont lettrées (${issue.code}).` : issue.motif;
}

/**
 * « DÉSIGNER LES FACTURES » (ligne A7 bis) · les factures du client que la
 * créance reprend. Le recouvrement du module en devient l'encaissement pour
 * la TVA (O.-L. n° 10/001, art. 25, 2° ; décret n° 011/42, art. 57). Le
 * serveur borne tout (facture ouverte, montant reclassé, autre créance).
 */
export interface FactureCandidate {
  ligneEcritureId: string;
  date: string;
  libelle: string;
  numeroPiece: number | null;
  montant: number;
  ouvert: number;
  aNouveau: boolean;
  /** Son lettrage réunit d'autres factures · non désignable (quatrième reprise). */
  lettragePartage: boolean;
  designeePar: string[];
}
export interface FactureDesignee {
  id: string;
  /** Retirée (« Retirer la désignation ») · date et motif, toujours listée. */
  retireeLe: string | null;
  motifRetrait: string | null;
  ligneEcritureId: string;
  montant: number;
  date: string;
  libelle: string;
  numeroPiece: number | null;
  montantFacture: number;
}
export interface FacturesDeLaCreance {
  tronque: boolean;
  /** Créance annulée · ses désignations passées se lisent, aucune facture n'est proposée. */
  annulee: boolean;
  factures: FactureCandidate[];
  designees: FactureDesignee[];
}

/**
 * Les parts saisies, prêtes à partir · une part vide est ignorée, une part
 * illisible ou nulle se dit (jamais lue comme zéro).
 */
export function partsADesigner(parts: Record<string, string>, lireMontant: (t: string) => number | null):
  | { factures: Array<{ ligneEcritureId: string; montant: number }>; erreur: null }
  | { factures: null; erreur: string } {
  const factures: Array<{ ligneEcritureId: string; montant: number }> = [];
  for (const [ligneEcritureId, texte] of Object.entries(parts)) {
    if (texte.trim() === '') continue;
    const m = lireMontant(texte);
    if (m === null || !(m > 0)) return { factures: null, erreur: `Part illisible ou nulle · « ${texte} ».` };
    factures.push({ ligneEcritureId, montant: Math.round(m * 100) / 100 });
  }
  if (factures.length === 0) return { factures: null, erreur: 'Saisissez la part d’au moins une facture.' };
  return { factures, erreur: null };
}

/**
 * LIGNE A7 BIS, PARTIE 2 · « Récupérer la TVA (art. 52) ». Tout est SERVI ·
 * l'impayé, la taxe récupérable et la mention du duplicata sont calculés par
 * le serveur (`GET /creances-douteuses/:id/recuperation-tva`), jamais ici, et
 * le geste les rejoue.
 */
export interface FactureRecuperable {
  designationId: string;
  libelle: string;
  numeroPiece: number | null;
  dateFacture: string;
  designe: number;
  recouvre: number;
  impayeTtc: number;
  impayeHt: number;
  tvaCorrespondante: number;
  tvaRecuperable: number;
  /**
   * Point D, règle 2 · la taxe d'une prestation à l'encaissement sur
   * l'impayé, jamais exigible · la perte l'annule au 443 sans la déduire.
   * Absente d'une réponse d'avant le point D · lue zéro, rien n'est annulé.
   */
  tvaAnnulable?: number;
  motifs: string[];
  mention: string;
  dejaRecuperee: boolean;
}
export interface RecuperationPassee {
  id: string;
  date: string;
  montantTva: number;
  montantHt: number;
  motif: string;
  ecriture: { id: string; numeroPiece: number | null; statut: string } | null;
  exerciceClos: boolean;
  annuleeLe: string | null;
  motifAnnulation: string | null;
}
export interface PropositionRecuperation {
  factures: FactureRecuperable[];
  ouverte: boolean;
  motif: string | null;
  derniereConstatation: string | null;
  finDuDroit: string | null;
  /** Dernière date d'écriture · la déclaration du mois suivant l'inscrit (art. 126). */
  derniereDateEcriture?: string | null;
  /** La même borne pour une TVA liquidée par trimestre · dite à côté, la cadence n'étant pas connue. */
  derniereDateEcritureTrimestrielle?: string | null;
  finDerniereLiquidation: string | null;
  reserveAncienMoteur: string | null;
  recuperations: RecuperationPassee[];
}
export interface DuplicataSaisi {
  choisie: boolean;
  reference: string;
  dateEnvoi: string;
}

/** Une facture se choisit seulement si elle n'est pas déjà récupérée et porte une taxe récupérable. */
export function factureChoisissable(f: FactureRecuperable): boolean {
  return !f.dejaRecuperee && f.tvaRecuperable > 0;
}

/**
 * Les duplicatas à envoyer · seules les factures cochées, chacune avec sa
 * référence et sa date d'envoi · un manque se DIT avant l'envoi, en nommant
 * la facture (le serveur porte le même refus).
 */
export function duplicatasAEnvoyer(
  factures: readonly FactureRecuperable[],
  saisis: Record<string, DuplicataSaisi>,
): { duplicatas: Array<{ designationId: string; reference: string; dateEnvoi: string }>; erreur: null } | { duplicatas: null; erreur: string } {
  const duplicatas: Array<{ designationId: string; reference: string; dateEnvoi: string }> = [];
  for (const f of factures) {
    const s = saisis[f.designationId];
    if (!s?.choisie || !factureChoisissable(f)) continue;
    if (!s.reference.trim()) return { duplicatas: null, erreur: `Facture « ${f.libelle} » · la référence du duplicata envoyé est exigée.` };
    if (!s.dateEnvoi) return { duplicatas: null, erreur: `Facture « ${f.libelle} » · la date d’envoi du duplicata est exigée.` };
    duplicatas.push({ designationId: f.designationId, reference: s.reference.trim(), dateEnvoi: s.dateEnvoi });
  }
  if (duplicatas.length === 0) return { duplicatas: null, erreur: 'Cochez au moins une facture dont le duplicata a été envoyé.' };
  return { duplicatas, erreur: null };
}

/** La taxe que le geste passera pour les factures cochées · somme des montants SERVIS. */
export function taxeDesCochees(factures: readonly FactureRecuperable[], saisis: Record<string, DuplicataSaisi>): number {
  const total = factures.filter((f) => saisis[f.designationId]?.choisie && factureChoisissable(f)).reduce((t, f) => t + f.tvaRecuperable, 0);
  return Math.round(total * 100) / 100;
}

/*
  POINT D · LA PERTE QUI RÉCUPÈRE LA TVA (décision de Manasse du 2026-10-08).
  Avec le duplicata surchargé des factures désignées, la perte se passe en
  deux pièces · retour de la créance au compte d'origine (D compte d'origine /
  C 416), puis D 651 (hors taxe) / D 443 (taxe acquittée, déduite le mois
  suivant ; taxe à l'encaissement annulée sans déduction) / C compte
  d'origine. Sans duplicata, la perte reste au TTC entier (D 651 / C 416).
  Montants SERVIS par le serveur, jamais recalculés ici.
*/

/** Une facture se choisit pour la perte si une taxe, récupérée ou annulée, reste sur son impayé. */
export function factureChoisissablePourLaPerte(f: FactureRecuperable): boolean {
  return !f.dejaRecuperee && f.impayeTtc > 0 && f.tvaRecuperable + (f.tvaAnnulable ?? 0) > 0;
}

/**
 * Les duplicatas de la perte · FACULTATIFS (aucune facture cochée = perte au
 * TTC entier), mais une facture cochée exige sa référence et sa date d'envoi,
 * et le manque se DIT en nommant la facture.
 */
export function duplicatasDeLaPerte(
  factures: readonly FactureRecuperable[],
  saisis: Record<string, DuplicataSaisi>,
): { duplicatas: Array<{ designationId: string; reference: string; dateEnvoi: string }>; erreur: null } | { duplicatas: null; erreur: string } {
  const duplicatas: Array<{ designationId: string; reference: string; dateEnvoi: string }> = [];
  for (const f of factures) {
    const s = saisis[f.designationId];
    if (!s?.choisie || !factureChoisissablePourLaPerte(f)) continue;
    if (!s.reference.trim()) return { duplicatas: null, erreur: `Facture « ${f.libelle} » · la référence du duplicata envoyé est exigée.` };
    if (!s.dateEnvoi) return { duplicatas: null, erreur: `Facture « ${f.libelle} » · la date d’envoi du duplicata est exigée.` };
    duplicatas.push({ designationId: f.designationId, reference: s.reference.trim(), dateEnvoi: s.dateEnvoi });
  }
  return { duplicatas, erreur: null };
}

/** La taxe que la perte récupérera et celle qu'elle annulera, pour les factures cochées · sommes des montants SERVIS. */
export function taxeDeLaPerte(factures: readonly FactureRecuperable[], saisis: Record<string, DuplicataSaisi>): { recuperee: number; annulee: number } {
  const cochees = factures.filter((f) => saisis[f.designationId]?.choisie && factureChoisissablePourLaPerte(f));
  const arrondi = (x: number) => Math.round(x * 100) / 100;
  return {
    recuperee: arrondi(cochees.reduce((t, f) => t + f.tvaRecuperable, 0)),
    annulee: arrondi(cochees.reduce((t, f) => t + (f.tvaAnnulable ?? 0), 0)),
  };
}
