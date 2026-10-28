/**
 * LIGNE MICROFINA M4 · LE DÉTENTEUR D'UN BIEN · les règles pures.
 *
 * Idée 4 de la comparaison avec Microfina++ (manuel, p. 284 à 289 ·
 * « Affectations », « Transfert », « Libération », reçu imprimé, état de suivi
 * des affectations). C'est la GESTION MATÉRIELLE du bien · qui le détient,
 * depuis quand, jusqu'à quand.
 *
 * AUCUN TEXTE LU NE L'IMPOSE, ET AUCUNE ÉCRITURE N'EN NAÎT. Ni l'AUDCIF ni
 * l'Acte uniforme SYCEBNL ne régissent la détention matérielle d'un bien par
 * un salarié · l'inventaire physique (AUDCIF art. 42) recense le bien, il ne
 * dit pas qui l'a en main. Tout ce qui suit est une CONVENTION D'OMEGAX,
 * écrite comme telle ; rien ici ne touche le livre-journal, la balance ni les
 * états.
 *
 * LES RÈGLES (conventions d'OmegaX) :
 *  · UNE DÉTENTION À LA FOIS PAR BIEN, DANS L'ORDRE DES DATES · une remise ne
 *    se date jamais avant la fin de la détention précédente du même bien
 *    (jamais antidatée sous une détention existante) ; le jour même de la
 *    fin est admis (le bien rendu le matin, remis l'après-midi) ;
 *  · LE BIEN EST À L'ENTITÉ · ni remis avant son acquisition (ou son entrée
 *    par un transfert du groupe), ni remis une fois SORTI (cession, rebut,
 *    vol, transfert hors du dossier · tout statut autre qu'en service) ;
 *  · LE DÉTENTEUR EST UN SALARIÉ SOUS CONTRAT À LA DATE · entré en vigueur au
 *    plus tard ce jour, pas terminé avant (même lecture que la couverture
 *    d'une absence, `absences.service.ts`) ;
 *  · AUCUN ACTE DANS LE FUTUR · le reçu dit ce qui a été fait, au jour de
 *    Kinshasa (`common/echeance.ts`) ;
 *  · LE REÇU EST UN DOCUMENT INTERNE · numéroté par dossier, daté, son texte
 *    figé à l'acte ; il ne se prétend ni contrat ni décharge au sens d'un
 *    texte, et il ne vaut que par les signatures qu'il porte, DÉCLARÉES
 *    (qui, quel jour), jamais présumées.
 */

export type NatureActeDetention = 'AFFECTATION' | 'TRANSFERT' | 'LIBERATION';

/** Une date AAAA-MM-JJ lue en jour UTC, ou null si elle ne se lit pas. */
export function jourDepuisIso(iso: unknown): Date | null {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : d;
}

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Ce que les règles lisent du bien. */
export interface BienADetenir {
  designation: string;
  statut: 'EN_SERVICE' | 'CEDEE' | 'MISE_HORS_SERVICE';
  dateAcquisition: Date;
  dateEntreeGroupe: Date | null;
  dateSortie: Date | null;
}

/** Ce que les règles lisent d'une détention déjà enregistrée du même bien. */
export interface DetentionLue {
  dateDebut: Date;
  dateFin: Date | null;
  detenteur: string;
}

export interface ContratLu {
  dateEntreeEnVigueur: Date;
  dateFin: Date | null;
}

/** Le jour (UTC) à partir duquel le bien est à l'entité. */
function premierJourDuBien(b: BienADetenir): Date {
  const acq = new Date(Date.UTC(b.dateAcquisition.getUTCFullYear(), b.dateAcquisition.getUTCMonth(), b.dateAcquisition.getUTCDate()));
  if (!b.dateEntreeGroupe) return acq;
  return b.dateEntreeGroupe.getTime() > acq.getTime() ? b.dateEntreeGroupe : acq;
}

/** Le salarié a-t-il un contrat en cours ce jour ? */
export function contratEnCoursA(contrats: readonly ContratLu[], jour: Date): boolean {
  return contrats.some(
    (c) => jourSeul(c.dateEntreeEnVigueur).getTime() <= jour.getTime() && (!c.dateFin || jourSeul(c.dateFin).getTime() >= jour.getTime()),
  );
}

function jourSeul(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Pourquoi le bien ne se remet pas à ce jour (affectation, ou remise au
 * nouveau détenteur d'un transfert), ou null. `enCours` est la détention en
 * cours du bien, s'il y en a une · une affectation la refuse, un transfert
 * l'exige et la termine ce jour-là.
 */
export function motifRefusRemise(
  p: {
    bien: BienADetenir;
    jour: Date;
    aujourdhui: Date;
    detentions: readonly DetentionLue[];
    nature: 'AFFECTATION' | 'TRANSFERT';
    contratsDuDetenteur: readonly ContratLu[];
    nomDuDetenteur: string;
    memeDetenteurQueLEnCours?: boolean;
  },
): string | null {
  const { bien, jour } = p;
  if (bien.statut !== 'EN_SERVICE') {
    const quand = bien.dateSortie ? ` le ${iso(bien.dateSortie)}` : '';
    return `Le bien « ${bien.designation} » est sorti du registre${quand} · il ne se remet plus à un salarié.`;
  }
  if (jour.getTime() > p.aujourdhui.getTime()) {
    return `La date ${iso(jour)} est postérieure à aujourd'hui (${iso(p.aujourdhui)}) · le reçu dit une remise faite, jamais une remise à venir.`;
  }
  const debutBien = premierJourDuBien(bien);
  if (jour.getTime() < debutBien.getTime()) {
    return `Le bien n'est à l'entité que depuis le ${iso(debutBien)} · il ne se remet pas le ${iso(jour)}.`;
  }
  const enCours = p.detentions.find((d) => d.dateFin === null) ?? null;
  if (p.nature === 'AFFECTATION' && enCours) {
    return (
      `Le bien est détenu par ${enCours.detenteur} depuis le ${iso(enCours.dateDebut)} · transférez-le ou libérez-le d'abord ` +
      '(une détention à la fois par bien).'
    );
  }
  if (p.nature === 'TRANSFERT') {
    if (!enCours) return "Le bien n'est détenu par personne · il s'affecte, il ne se transfère pas.";
    if (p.memeDetenteurQueLEnCours) return `Le bien est déjà détenu par ${enCours.detenteur} · un transfert change de détenteur.`;
  }
  // JAMAIS ANTIDATÉE SOUS UNE DÉTENTION EXISTANTE · ni avant le début de la
  // détention en cours, ni avant la fin de la plus récente.
  const derniere = p.detentions.reduce<Date | null>((m, d) => {
    const borne = d.dateFin ?? d.dateDebut;
    return !m || borne.getTime() > m.getTime() ? borne : m;
  }, null);
  if (derniere && jour.getTime() < derniere.getTime()) {
    return (
      `Le bien a une détention enregistrée jusqu'au ${iso(derniere)} · une remise ne se date pas avant (les détentions ` +
      "s'enregistrent dans l'ordre des dates, jamais l'une sous l'autre)."
    );
  }
  if (!contratEnCoursA(p.contratsDuDetenteur, jour)) {
    return `${p.nomDuDetenteur} n'a pas de contrat de travail en cours le ${iso(jour)} · le bien ne lui est pas remis.`;
  }
  return null;
}

/** Pourquoi la détention en cours ne se libère pas à ce jour, ou null. */
export function motifRefusLiberation(p: { enCours: DetentionLue | null; jour: Date; aujourdhui: Date }): string | null {
  if (!p.enCours) return "Le bien n'est détenu par personne · il n'y a rien à libérer.";
  if (p.jour.getTime() > p.aujourdhui.getTime()) {
    return `La date ${iso(p.jour)} est postérieure à aujourd'hui (${iso(p.aujourdhui)}) · le reçu dit un retour fait, jamais un retour à venir.`;
  }
  if (p.jour.getTime() < p.enCours.dateDebut.getTime()) {
    return `${p.enCours.detenteur} détient le bien depuis le ${iso(p.enCours.dateDebut)} · il ne le rend pas avant.`;
  }
  // Un bien SORTI pendant qu'il était détenu se libère quand même · sans
  // quoi sa détention resterait ouverte pour toujours. Aucune borne par la
  // date de sortie · le retour matériel peut suivre la sortie comptable
  // (un bien mis au rebut rendu le lendemain), et la date est déclarée.
  return null;
}

/** Pourquoi la signature ne se déclare pas, ou null. */
export function motifRefusSignature(p: {
  dejaDeclaree: boolean;
  signataires: unknown;
  jour: Date | null;
  dateActe: Date;
  aujourdhui: Date;
}): string | null {
  if (p.dejaDeclaree) return 'La signature de ce reçu est déjà déclarée · elle ne se redéclare pas.';
  if (typeof p.signataires !== 'string' || p.signataires.trim().length < 2 || p.signataires.trim().length > 300) {
    return 'Nommez qui a signé le reçu (deux à trois cents caractères).';
  }
  if (!p.jour) return 'La date de la signature se lit AAAA-MM-JJ.';
  if (p.jour.getTime() < p.dateActe.getTime()) return `Le reçu est daté du ${iso(p.dateActe)} · il n'a pas été signé avant.`;
  if (p.jour.getTime() > p.aujourdhui.getTime()) return "La signature ne se déclare pas pour un jour à venir.";
  return null;
}

/** Le nom du détenteur tel que le reçu l'écrit · nom, post-nom, prénoms, matricule s'il existe. */
export function nomDuSalarie(s: { nom: string; postNom: string | null; prenoms: string | null; matricule: string | null }): string {
  const nom = [s.nom, s.postNom, s.prenoms].filter((x) => x && x.trim()).join(' ');
  return s.matricule?.trim() ? `${nom} (matricule ${s.matricule.trim()})` : nom;
}

const MENTION =
  "Document interne établi par OmegaX. Il ne vaut que par les signatures qui y sont portées et ne crée par lui-même aucune " +
  "obligation au-delà de la remise qu'il constate.";

/** Le texte du reçu, figé à l'acte · rien d'autre que ce qui a été déclaré. */
export function texteDuRecu(p: {
  numero: number;
  nature: NatureActeDetention;
  jour: Date;
  dossier: string;
  bien: { designation: string; numeroInventaire: string | null };
  remisA: string | null;
  rendPar: string | null;
  lieu: string | null;
  observation: string | null;
}): string {
  const bien = `« ${p.bien.designation} »${p.bien.numeroInventaire?.trim() ? ` (n° d'inventaire ${p.bien.numeroInventaire.trim()})` : ''}`;
  const titre =
    p.nature === 'AFFECTATION' ? 'REÇU DE REMISE D’UN BIEN' : p.nature === 'TRANSFERT' ? 'REÇU DE TRANSFERT D’UN BIEN' : 'REÇU DE RETOUR D’UN BIEN';
  const lignes = [`${p.dossier}`, `${titre} · N° ${p.numero}`, `Date : ${iso(p.jour)}`, ''];
  if (p.nature === 'AFFECTATION') lignes.push(`Le bien ${bien} est remis ce jour à ${p.remisA}.`);
  if (p.nature === 'TRANSFERT') lignes.push(`Le bien ${bien}, détenu par ${p.rendPar}, est remis ce jour à ${p.remisA}.`);
  if (p.nature === 'LIBERATION') lignes.push(`Le bien ${bien}, détenu par ${p.rendPar}, est rendu ce jour à l'entité.`);
  if (p.lieu) lignes.push(`Lieu : ${p.lieu}.`);
  if (p.observation?.trim()) lignes.push(`Observation : ${p.observation.trim()}`);
  lignes.push('', MENTION, '');
  if (p.nature === 'AFFECTATION') lignes.push('Signature du détenteur :', '', 'Signature pour l’entité :');
  if (p.nature === 'TRANSFERT') lignes.push('Signature de celui qui remet :', '', 'Signature de celui qui reçoit :', '', 'Signature pour l’entité :');
  if (p.nature === 'LIBERATION') lignes.push('Signature de celui qui rend :', '', 'Signature pour l’entité :');
  return lignes.join('\n');
}

/** Le premier numéro libre de la suite du dossier · la suite continue, jamais réutilisée. */
export function numeroSuivant(plusGrand: number | null): number {
  return (plusGrand ?? 0) + 1;
}

/** Une détention touche-t-elle la période [du, au] ? Les deux bornes comprises. */
export function touchePeriode(d: { dateDebut: Date; dateFin: Date | null }, du: Date, au: Date): boolean {
  return d.dateDebut.getTime() <= au.getTime() && (!d.dateFin || d.dateFin.getTime() >= du.getTime());
}

/** Au-delà, une liste se tronque et le dit · convention d'OmegaX (CLAUDE.md § 8 bis). */
export const PLAFOND_DETENTIONS_LUES = 500;
