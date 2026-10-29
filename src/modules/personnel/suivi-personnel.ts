/**
 * LIGNE MICROFINA-M3, LOT 2 · DEMANDES DE CONGÉ, ÉCHÉANCIER DES CONTRATS,
 * FORMATION ET DÉCLARATION ANNUELLE DE LA MAIN-D'ŒUVRE · règles pures, sans
 * Prisma. Chaque règle cite son texte (Code du travail, loi n° 015/2002
 * modifiée par la loi n° 16/010, compétence `droit-travail-congolais`).
 */
import { ajouterMois } from '../../common/ajouter-mois';

const MS_PAR_JOUR = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const jourUtc = (s: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10))) return null;
  const d = new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

// ──────────────────────────────────────────────────────────────────────────
// IDÉE 7 · LA DEMANDE DE CONGÉ ET SON ACCORD.
//
// ART. 140, AL. 4 · « La date du congé est fixée de commun accord, sans
// toutefois que la prise effective du congé puisse dépasser de six mois la
// date prévue pour son ouverture. » Le Code exige l'ACCORD des deux parties,
// pas un circuit · la demande du travailleur, datée, et l'accord de
// l'employeur, daté et nommé, en sont la preuve. C'est un CIRCUIT FACULTATIF ·
// le congé se pose toujours directement (`CongesService.creerConge`), et un
// dossier à un seul utilisateur n'est jamais enfermé.
//
// AUTEUR ET VALIDATEUR DISTINCTS (modèle de `tiers/visa-rib.ts`) · l'utilisateur
// qui a saisi la demande ne l'accorde pas · convention d'OmegaX, aucun texte
// lu ne l'impose ; l'accord crée le congé par la route ordinaire, avec tous
// ses refus (absence, solde, bulletin émis).
//
// « SIX MOIS APRÈS LA DATE PRÉVUE POUR SON OUVERTURE » (décision par la loi
// du 2026-10-28) · la seule date que l'article FIXE est celle de l'al. 3, où
// « le droit au congé naît à l'expiration d'une année de services comptée de
// date à date » ; l'accord de l'al. 4 fixe la date du congé, et lire « la date
// prévue » comme cette date même ferait borner l'accord par lui-même. La date
// d'ouverture est donc la naissance du droit, et c'est aussi la lecture qui
// protège le travailleur (règle de protection, P5) · le congé se prend dans
// les six mois de la naissance du droit. C'est la lecture que le compteur des
// congés acquis sert déjà (`compteurConges`, signal des jours nés non pris six
// mois après) ; le dépassement est DIT, jamais refusé · refuser un congé
// tardif priverait le travailleur du congé auquel il ne peut renoncer (al. 2).
// ──────────────────────────────────────────────────────────────────────────

export type StatutDemandeConge = 'DEMANDEE' | 'ACCORDEE' | 'REFUSEE' | 'RETIREE';

export function motifRefusDemandeConge(d: { du: string; au: string; demandeLe: string }): string | null {
  const du = jourUtc(d.du);
  const au = jourUtc(d.au);
  const le = jourUtc(d.demandeLe);
  if (!du || !au || !le) return 'Les dates de la demande se lisent AAAA-MM-JJ.';
  if (au < du) return 'Le congé ne peut finir avant de commencer.';
  return null;
}

/** L'accord et le refus · auteur distinct, une décision une fois. */
export function motifRefusDecision(
  d: { statut: StatutDemandeConge; saisiePar: string },
  decideur: string,
): { statut: 403 | 409; motif: string } | null {
  if (d.statut !== 'DEMANDEE') return { statut: 409, motif: `Cette demande est déjà ${libelleStatut(d.statut).toLowerCase()} · elle ne se décide plus.` };
  if (d.saisiePar.trim().toLowerCase() === decideur.trim().toLowerCase()) {
    return {
      statut: 403,
      motif:
        "La demande a été saisie par vous · son accord ou son refus revient à un autre utilisateur du dossier. Sans second utilisateur, posez le congé directement (onglet Congés), il n'attend aucun circuit.",
    };
  }
  return null;
}

export const libelleStatut = (s: StatutDemandeConge) =>
  s === 'DEMANDEE' ? 'En attente' : s === 'ACCORDEE' ? 'Accordée' : s === 'REFUSEE' ? 'Refusée' : 'Retirée';

/**
 * LE TITRE DE CONGÉ · le document remis au travailleur. Le modèle de
 * Microfina++ cite « l'article 158 », qui est en RDC celui du règlement
 * d'entreprise · le titre d'OmegaX cite les articles qui régissent le congé
 * (140 et 141), et rien n'y est présumé.
 */
export const FONDEMENT_TITRE_CONGE =
  "Code du travail, art. 140 (droit au congé, date fixée de commun accord) et art. 141 (durée du congé ; la durée du voyage n'y est pas comprise).";

// ──────────────────────────────────────────────────────────────────────────
// IDÉE 10 · L'ÉCHÉANCIER DES FINS DE CONTRAT À DURÉE DÉTERMINÉE ET DE
// PÉRIODE D'ESSAI.
//
// ART. 69 · « Le contrat à durée déterminée prend fin à l'expiration du terme
// fixé par les parties. » ART. 42 · le CDD conclu pour un EMPLOI PERMANENT
// « est réputé conclu pour une durée indéterminée ». ART. 43, AL. 3 ET 4 ·
// l'essai ne peut dépasser « un mois pour le travailleur manœuvre sans
// spécialité ni six mois pour les autres », et « la prolongation des services
// au-delà de cette durée maximale entraîne automatiquement la confirmation du
// contrat de travail ».
//
// DATE À DATE, COMME LE PLAFOND DE L'ART. 41 (`regles-contrat-travail.ts`) ·
// le plafond de l'essai se compte en MOIS de date à date (un essai commencé
// le 15 mars plafonne le 14 avril inclus), jamais en jours de trente ; la
// durée STIPULÉE, saisie en jours, se compte en jours. L'échéance retenue est
// la plus proche des deux. Le contrôle `verdictEssai` compte de même depuis
// la décision par la loi du 2026-10-28 (`plafondEssaiEnJours`).
//
// LA CONTINUATION DE SERVICE APRÈS LE TERME (décision par la loi du
// 2026-10-28) · art. 41, al. 3, « la continuation de service en dehors des
// cas prévus à l'alinéa précédent » (travaux saisonniers, ouvrages bien
// définis, travaux fixés par arrêté) « constitue[nt] de plein droit
// l'exécution d'un contrat de travail à durée indéterminée ». Un terme passé
// sur un contrat qui court est donc dit avec cette formule, sans requalifier
// en base (règle du registre, P1).
//
// L'ÉCHÉANCIER DIT, IL NE TRANCHE RIEN · il ne termine aucun contrat ni ne
// requalifie en base (règle du registre, P1). L'horizon de soixante jours est
// une convention d'OmegaX.
// ──────────────────────────────────────────────────────────────────────────

export const HORIZON_ECHEANCIER_JOURS = 60;

export type ContratPourEcheancier = {
  id: string;
  salarieId: string;
  type: string;
  dateEntreeEnVigueur: Date;
  dateFin: Date | null;
  dateFinPrevue: Date | null;
  emploiPermanent: boolean;
  clauseEssai: boolean;
  essaiDureeJours: number | null;
  manoeuvreSansSpecialite: boolean;
};

export type EcheanceContrat = {
  contratId: string;
  salarieId: string;
  objet: 'FIN_CDD' | 'FIN_ESSAI';
  echeance: string;
  joursRestants: number;
  depassee: boolean;
  article: string;
  consequence: string;
};

/** Le dernier jour de l'essai opposable · le plus proche de la durée stipulée et du plafond de date à date. */
export function finEssaiOpposable(c: ContratPourEcheancier): { echeance: Date; parLePlafond: boolean } | null {
  if (!c.clauseEssai) return null;
  const plafond = new Date(ajouterMois(c.dateEntreeEnVigueur, c.manoeuvreSansSpecialite ? 1 : 6).getTime() - MS_PAR_JOUR);
  if (c.essaiDureeJours === null || !(c.essaiDureeJours > 0)) return { echeance: plafond, parLePlafond: true };
  const stipulee = new Date(c.dateEntreeEnVigueur.getTime() + (c.essaiDureeJours - 1) * MS_PAR_JOUR);
  return stipulee <= plafond ? { echeance: stipulee, parLePlafond: false } : { echeance: plafond, parLePlafond: true };
}

export function echeancesDuContrat(c: ContratPourEcheancier, aujourdhui: Date, horizonJours = HORIZON_ECHEANCIER_JOURS): EcheanceContrat[] {
  if (c.dateFin !== null) return [];
  const sorties: EcheanceContrat[] = [];
  // Un essai passé depuis plus que l'horizon ne s'annonce plus · le contrat est
  // confirmé par la loi (art. 43, al. 4), il ne reste rien à décider. Un terme
  // de CDD passé, lui, reste nommé tant que le contrat court · les services
  // poursuivis au-delà du terme relèvent de l'art. 41, al. 3.
  const poser = (objet: EcheanceContrat['objet'], echeance: Date, article: string, consequence: string) => {
    const joursRestants = Math.round((echeance.getTime() - aujourdhui.getTime()) / MS_PAR_JOUR);
    if (joursRestants > horizonJours) return;
    if (objet === 'FIN_ESSAI' && joursRestants < -horizonJours) return;
    sorties.push({ contratId: c.id, salarieId: c.salarieId, objet, echeance: iso(echeance), joursRestants, depassee: joursRestants < 0, article, consequence });
  };
  if (c.type === 'DUREE_DETERMINEE' && c.dateFinPrevue) {
    const termePasse = c.dateFinPrevue.getTime() < aujourdhui.getTime();
    poser(
      'FIN_CDD',
      c.dateFinPrevue,
      termePasse ? 'art. 69 et 41, al. 3' : 'art. 69',
      termePasse
        ? "Le terme fixé est passé et le contrat court encore · hors travaux saisonniers, ouvrages bien définis ou travaux fixés par arrêté (art. 41, al. 2), « la continuation de service » constitue de plein droit l'exécution d'un contrat à durée indéterminée (art. 41, al. 3). Déclarez le renouvellement ou la fin au registre."
        : c.emploiPermanent
        ? "Le contrat prend fin au terme fixé (art. 69) · mais il est conclu pour un emploi permanent, et l'art. 42 le répute conclu pour une durée indéterminée."
        : 'Le contrat prend fin au terme fixé par les parties (art. 69) · un renouvellement se déclare au registre, dans les limites de l’art. 41.',
    );
  }
  const essai = finEssaiOpposable(c);
  if (essai) {
    poser(
      'FIN_ESSAI',
      essai.echeance,
      'art. 43, al. 3 et 4',
      `Fin de la période d'essai${essai.parLePlafond ? ' au plafond légal, compté de date à date' : ''} · la prolongation des services au-delà de la durée maximale entraîne automatiquement la confirmation du contrat (art. 43, al. 4).`,
    );
  }
  return sorties;
}

// ──────────────────────────────────────────────────────────────────────────
// IDÉE 8 · LE PLAN ET LE SUIVI DE LA FORMATION.
//
// ART. 8 · « Tout employeur public ou privé a l'obligation d'assurer la
// formation, le perfectionnement ou l'adaptation professionnelle des
// travailleurs qu'il emploie. » Le Code ne fixe ni forme ni contenu du plan ·
// OmegaX tient le PRÉVU et le RÉALISÉ, sans juger l'obligation remplie.
//
// L'INPP · ordonnance n° 84/186, art. 1er, al. 2 · « dans le cas où
// l'employeur assure lui-même la formation de son personnel, le département
// du Travail et de la Prévoyance sociale peut accorder une réduction du taux
// de cette cotisation », sur avis de la délégation syndicale et de l'INPP,
// jamais plus du quart. LA RÉDUCTION EST UN ACTE, ELLE NE SE PRÉSUME PAS · le
// registre des formations INTERNES réalisées est une pièce du dossier de
// demande ; la réduction accordée se DÉCLARE au bulletin avec la référence de
// son acte (`cotisations-paie.ts`), jamais déduite de ce registre.
//
// LE COÛT · il se passe par la facture du formateur au journal (633 « Frais
// de formation » des deux plans) · le module ne passe aucune écriture.
// ──────────────────────────────────────────────────────────────────────────

export type StatutFormation = 'PREVUE' | 'REALISEE' | 'ANNULEE';

export function motifRefusFormation(f: { intitule?: string; prevueDu: string; prevueAu: string; coutPrevuFc?: number | null }): string | null {
  if (!f.intitule?.trim()) return "L'intitulé de la formation est obligatoire.";
  const du = jourUtc(f.prevueDu);
  const au = jourUtc(f.prevueAu);
  if (!du || !au) return 'Les dates prévues se lisent AAAA-MM-JJ.';
  if (au < du) return 'La formation ne peut finir avant de commencer.';
  if (f.coutPrevuFc != null && !(f.coutPrevuFc >= 0)) return 'Le coût prévu ne peut être négatif.';
  return null;
}

export function motifRefusRealisation(
  f: { statut: StatutFormation },
  r: { realiseeDu: string; realiseeAu: string; coutReelFc?: number | null; presents: number },
): string | null {
  if (f.statut !== 'PREVUE') return `Cette formation est déjà ${f.statut === 'REALISEE' ? 'réalisée' : 'annulée'}.`;
  const du = jourUtc(r.realiseeDu);
  const au = jourUtc(r.realiseeAu);
  if (!du || !au) return 'Les dates réelles se lisent AAAA-MM-JJ.';
  if (au < du) return 'La formation ne peut finir avant de commencer.';
  if (r.coutReelFc != null && !(r.coutReelFc >= 0)) return 'Le coût réel ne peut être négatif.';
  if (r.presents < 1) return "Une formation réalisée a au moins un participant présent · sinon, annulez-la.";
  return null;
}

/** Le prévu contre le réalisé d'une année, en centimes entiers · null n'est jamais zéro. */
export function suiviFormation(
  formations: readonly { statut: StatutFormation; coutPrevuFc: number | null; coutReelFc: number | null; inscrits: number; presents: number }[],
) {
  const c = (n: number) => Math.round(n * 100);
  const retenues = formations.filter((f) => f.statut !== 'ANNULEE');
  const realisees = formations.filter((f) => f.statut === 'REALISEE');
  const coutPrevuInconnu = retenues.filter((f) => f.coutPrevuFc === null).length;
  const coutReelInconnu = realisees.filter((f) => f.coutReelFc === null).length;
  return {
    prevues: retenues.length,
    realisees: realisees.length,
    annulees: formations.length - retenues.length,
    coutPrevuFc: retenues.reduce((s, f) => s + c(f.coutPrevuFc ?? 0), 0) / 100,
    coutPrevuIncomplet: coutPrevuInconnu > 0,
    coutReelFc: realisees.reduce((s, f) => s + c(f.coutReelFc ?? 0), 0) / 100,
    coutReelIncomplet: coutReelInconnu > 0,
    inscrits: retenues.reduce((s, f) => s + f.inscrits, 0),
    presents: realisees.reduce((s, f) => s + f.presents, 0),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// IDÉE 11 · LA DÉCLARATION ANNUELLE DE LA MAIN-D'ŒUVRE, CHIFFRES SEULS.
//
// ART. 218 · « Toute entreprise ou tout établissement fait parvenir, au moins
// une fois par an, au service compétent du ministère ayant l'emploi, le
// travail et la prévoyance sociale dans ses attributions et à l'Office
// national de l'emploi, une déclaration sur la situation de la main-d'œuvre
// nationale et étrangère employée. En outre, l'entreprise ou l'établissement
// fournit chaque année son bilan social aux services précités. » ART. 219 ·
// le Ministre « détermine, par arrêté, les modalités des déclarations ».
//
// L'ARRÊTÉ DE L'ART. 219 EST L'ARRÊTÉ MINISTÉRIEL n° 005/CAB/PVPM/ETPS/2010
// du 1er avril 2010 (J.O. RDC, première partie, n° 7 ; lu sur le scan fourni
// le 2026-10-29, `docs/sources/arretes-005-006-008-2010-declarations-main-oeuvre.md`).
// Art. 1er · à la Division provinciale de l'Inspection du travail et au Bureau
// provincial de l'ONEM « au plus tard le 31 janvier de chaque année » ;
// art. 2 · quatre exemplaires sur le formulaire annexé, deux à l'Inspecteur
// du travail du ressort (recommandé avec accusé de réception, ou déposés
// contre accusé), un à l'ONEM du ressort, le quatrième gardé pour le
// contrôle ; art. 4 · peines de l'art. 321 du Code. Le formulaire compte le
// « personnel permanent au premier janvier de l'année en cours » · la
// déclaration de l'année N, déposée en janvier N+1, lit donc l'effectif au
// 1er janvier N+1, et les mouvements de l'année N.
//
// TROIS ANOMALIES DU TEXTE, DITES, NON CORRIGÉES · l'art. 1er renvoie à
// « l'article 216 » (déclaration d'ouverture et de fermeture) quand le visa
// et le formulaire citent l'art. 218 ; le NB du formulaire inverse la
// répartition des exemplaires de l'art. 2 (l'article prime) ; aucun report
// au jour ouvrable n'est écrit, le 31 janvier reste le 31 janvier.
//
// OmegaX ne remplit pas le formulaire · il sert les CHIFFRES de l'effectif
// que le registre porte (section II, sans la ventilation par catégorie ni la
// distinction du personnel non permanent, que le registre ne tient pas), la
// date limite et les destinataires, et il le dit. Ni la masse salariale, ni
// la durée hebdomadaire, ni les besoins en main-d'œuvre et en formation
// (sections III à VI), ni le bilan social de l'art. 218, al. 2, dont l'arrêté
// ne fixe aucune modalité. Nationalité · même lecture que l'effectif
// (`effectif-registre.ts`) ; une nationalité absente rend la répartition NON
// CALCULÉE, jamais devinée.
// ──────────────────────────────────────────────────────────────────────────

export const RESERVE_DECLARATION_MAIN_OEUVRE =
  "Chiffres de l'effectif seuls · le formulaire annexé à l'arrêté ministériel n° 005/CAB/PVPM/ETPS/2010 du 1er avril 2010 demande aussi la répartition par catégorie professionnelle, le personnel non permanent, la masse salariale, la durée hebdomadaire et les besoins en main-d'œuvre et en formation, que le registre ne porte pas. Tous les contrats en vigueur sont comptés, permanents ou non. Le bilan social de l'art. 218, al. 2 du Code du travail n'est pas servi, et l'arrêté n'en fixe aucune modalité.";

/**
 * L'ÉCHÉANCE ET LES EXEMPLAIRES · arrêté n° 005/CAB/PVPM/ETPS/2010, art. 1er
 * et 2. La déclaration de l'année N se dépose au plus tard le 31 janvier N+1,
 * sans report au jour ouvrable (l'arrêté n'en écrit aucun).
 */
export function dateLimiteDeclarationMainOeuvre(annee: number): string {
  return `${annee + 1}-01-31`;
}

export const DESTINATAIRES_DECLARATION_MAIN_OEUVRE =
  "en quatre exemplaires datés et signés sur le formulaire officiel · deux à l'Inspecteur du travail du ressort (Division provinciale de l'Inspection du travail), par pli recommandé avec accusé de réception ou déposés contre accusé de réception, un au Bureau provincial de l'Office national de l'emploi, le quatrième conservé pour le contrôle (arrêté n° 005/CAB/PVPM/ETPS/2010, art. 1er et 2 ; le NB du formulaire, qui inverse la répartition, cède devant l'article). Infraction punie des peines de l'art. 321 du Code du travail (art. 4).";

/**
 * La règle des mouvements, dite à l'écran avec les chiffres · l'art. 218 ne
 * nomme ni entrée ni sortie, l'art. 217 déclare l'ENGAGEMENT et le DÉPART de
 * l'entreprise · un renouvellement ou un contrat qui en suit un autre sans
 * interruption n'est ni l'un ni l'autre.
 */
export const REGLE_MOUVEMENTS_MAIN_OEUVRE =
  "Entrées et sorties au sens de l'art. 217 du Code du travail (engagement, départ de l'entreprise) · une entrée est un contrat pris d'effet dans l'année sans autre contrat du salarié en vigueur la veille ; une sortie, un contrat fini dans l'année sans autre contrat en vigueur le lendemain. Un CDD renouvelé, ou suivi d'un CDI, ne compte ni l'une ni l'autre ; un salarié parti puis réengagé compte deux mouvements. Chaque embauche et chaque départ se déclarent aussi, dans les quinze jours, à l'Inspection du travail et à l'ONEM (art. 217, réécrit par la loi n° 16/010 du 15 juillet 2016, qui prime sur les quarante-huit heures de l'arrêté n° 006/CAB/PVPM/ETPS/2010), sauf le travailleur engagé au jour le jour qui n'a pas accompli vingt-deux journées de travail sur deux mois (arrêté n° 006, art. 4).";
