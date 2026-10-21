/**
 * VISA D'UN RIB PAR UN SECOND UTILISATEUR (décision de Manasse du 2026-10-21,
 * « Lève le gel pour le visa d'un RIB », vu chez Microfina++ · le visa de
 * l'enrôlement d'un client avant toute opération).
 *
 * POURQUOI. Un RIB modifié en silence détourne un paiement · c'est la fraude
 * la plus courante sur les virements, et la raison pour laquelle les RIB sont
 * déjà une STRUCTURE écrite par l'administrateur seul et au journal d'audit
 * (`ribs-tiers.ts`). Le journal d'audit dit APRÈS coup qu'un RIB a changé ;
 * le visa met un second regard AVANT que l'argent parte.
 *
 * PAR LA LOI · aucun texte lu n'impose un tel visa. L'AUDCIF art. 69 laisse à
 * l'entité « les procédures nécessaires » de contrôle interne (SYSCOHADA) ; le
 * SYCEBNL demande par son art. 16, 2) « la mise en place de procédures […]
 * permettant un contrôle interne fiable », l'art. 69 lui étant exclu par son
 * art. 3. C'est donc une OPTION du dossier (`Tenant.visaRibs`), désactivée
 * par défaut, comme le double regard à la validation (CLAUDE.md, § 10 ter) ·
 * l'imposer d'office fermerait les virements du cabinet à un seul
 * utilisateur, au nom d'une règle que personne n'a écrite.
 *
 * CINQ RÈGLES.
 * (1) LE VISA PORTE SUR LES COORDONNÉES, et sur elles seules · banque,
 *     titulaire, codes, numéro, clé, IBAN, BIC et devise. Le commentaire et la
 *     marque de principal ne déplacent pas l'argent vers un autre compte · ils
 *     ne font pas tomber le visa.
 * (2) TOUTE SAISIE DES COORDONNÉES LE FAIT TOMBER et nomme son auteur
 *     (`saisiPar`, `saisiLe`) · la création comprise.
 * (3) L'AUTEUR NE VISE PAS SON PROPRE RIB · même lecture que le double regard,
 *     le logiciel contrôle l'IDENTITÉ, jamais l'indépendance. Un RIB d'avant la
 *     règle n'a pas d'auteur connu · tout utilisateur admis le vise, et la
 *     réponse le DIT, rien n'étant présumé ni visé d'office.
 * (4) LE VISA VISE CE QUI A ÉTÉ LU · l'écran renvoie l'instant de la saisie
 *     qu'il a montrée, et le serveur refuse (409) un RIB changé depuis.
 * (5) L'OPTION NE JOUE QU'À L'ORDRE DE VIREMENT, et sur le RIB PRINCIPAL de
 *     chaque bénéficiaire, tiers ou salarié (`OrdresVirementService`) · c'est
 *     le seul geste d'OmegaX qui envoie des coordonnées à une banque. L'ordre
 *     RECOPIE le RIB lu au moment où il naît (ribs-tiers.ts, règle 4), donc ce
 *     qui part est exactement ce qui a été visé. Le RIB du DONNEUR (Structure
 *     > Banques) n'est pas visé · le changer ne détourne rien vers un tiers.
 * (6) UN RIB QUI CHANGE DE BÉNÉFICIAIRE PERD SON VISA · la fusion de deux
 *     tiers reporte les RIB du doublon sur la fiche conservée ; elle les tient
 *     pour saisis par l'auteur de la fusion (`TiersService.fusionner`), sans
 *     quoi un RIB visé pour un tiers créé à dessein payait un autre tiers.
 *
 * LIMITES ÉCRITES. Le visa porte sur les coordonnées et le tiers qui les
 * porte, pas sur le rattachement des comptes au tiers (un compte rattaché à un
 * tiers dont le RIB est visé paie ce RIB) ; l'option se retire par
 * l'administrateur seul, au journal d'audit, comme le double regard.
 */

/** Les coordonnées que le visa couvre · un changement de l'une d'elles le fait tomber. */
export const COORDONNEES_VISEES = [
  'banque',
  'titulaire',
  'codeBanque',
  'codeGuichet',
  'numeroCompte',
  'cle',
  'iban',
  'codeBic',
  'devise',
] as const;

type Coordonnees = Record<(typeof COORDONNEES_VISEES)[number], string | null>;

export interface EtatVisa {
  saisiPar: string | null;
  saisiLe: Date | null;
  visePar: string | null;
  viseLe: Date | null;
}

/** Un changement des coordonnées, la valeur absente lue comme vide (règle 1). */
export function coordonneesChangees(avant: Partial<Coordonnees>, apres: Partial<Coordonnees>): boolean {
  return COORDONNEES_VISEES.some((c) => (avant[c] ?? null) !== (apres[c] ?? null));
}

/**
 * Visé · les deux traces posées, jamais l'une sans l'autre. Une trace ABSENTE
 * (champ non lu par une requête trop étroite) n'est pas un visa · comparer à
 * `null` seul aurait laissé passer `undefined`, et l'ordre serait parti.
 */
export function estVise(rib: Partial<EtatVisa>): boolean {
  return typeof rib.visePar === 'string' && rib.visePar !== '' && rib.viseLe instanceof Date;
}

/** Ce qu'une saisie des coordonnées écrit sur le RIB (règle 2). */
export function saisieDesCoordonnees(utilisateurId: string, maintenant: Date) {
  return { saisiPar: utilisateurId, saisiLe: maintenant, visePar: null, viseLe: null };
}

export const MOTIF_VISA_PAR_SON_AUTEUR =
  "Vous avez saisi ou changé ces coordonnées en dernier · un autre administrateur ou comptable du dossier doit les viser. C'est le second regard que l'option « Visa des RIB » demande avant qu'un virement parte.";

export const MOTIF_RIB_CHANGE_DEPUIS_LA_LECTURE =
  "Ce RIB a été changé depuis que vous l'avez ouvert · relisez-le avant de le viser.";

/**
 * Le refus de viser, ou `null` · le RIB déjà visé, l'auteur qui se vise
 * (règle 3), le RIB lu qui n'est plus le RIB en base (règle 4). `saisiLeLu`
 * est l'instant que l'écran a montré, `null` pour un RIB sans saisie connue.
 */
export function motifRefusVisa(rib: EtatVisa, utilisateurId: string, saisiLeLu: string | null): string | null {
  const enBase = rib.saisiLe === null ? null : rib.saisiLe.toISOString();
  if (enBase !== saisiLeLu) return MOTIF_RIB_CHANGE_DEPUIS_LA_LECTURE;
  if (estVise(rib)) return "Ce RIB est déjà visé · il ne se vise qu'une fois par saisie de ses coordonnées.";
  if (rib.saisiPar !== null && rib.saisiPar === utilisateurId) return MOTIF_VISA_PAR_SON_AUTEUR;
  return null;
}

/** La phrase qui accompagne le visa d'un RIB dont l'auteur n'est pas connu (règle 3). */
export const AVERTISSEMENT_AUTEUR_INCONNU =
  "Ce RIB a été saisi avant le visa des RIB · son auteur n'est pas connu d'OmegaX, qui n'a donc pas pu vérifier que vous n'en êtes pas l'auteur.";

/** Le nom d'un bénéficiaire dont le RIB principal n'est pas visé, pour le refus de l'ordre. */
export function refusOrdreRibsNonVises(noms: readonly string[], ou: string): string {
  return (
    `Ordre de virement impossible · le RIB principal de ${noms.join(', ')} n'est pas visé, et le dossier exige le visa des RIB ` +
    `(Paramètres du dossier). Un administrateur ou un comptable autre que celui qui l'a saisi le vise dans ${ou}, ` +
    `ou décochez l'ordre de virement.`
  );
}

/** La façon dont l'écran nomme l'auteur d'une saisie ou d'un visa. */
export function nommerUtilisateur(id: string | null | undefined, courriels: ReadonlyMap<string, string>): string | null {
  // `== null` · un champ absent (requête trop étroite) n'est pas un utilisateur retiré.
  if (id == null) return null;
  return courriels.get(id) ?? 'utilisateur retiré du dossier';
}

/** Ce que l'écran reçoit du visa d'un RIB · les auteurs en courriel, un auditeur ne lisant pas un identifiant. */
export interface VisaPresente {
  /** L'option du dossier · l'ordre de virement exige-t-il ce visa ? */
  exige: boolean;
  vise: boolean;
  visePar: string | null;
  viseLe: Date | null;
  saisiPar: string | null;
  saisiLe: Date | null;
  /** L'utilisateur de la session a saisi ces coordonnées en dernier (règle 3). */
  saisiParVous: boolean;
}

export function presenterVisa(rib: EtatVisa, exige: boolean, utilisateurId: string, courriels: ReadonlyMap<string, string>): VisaPresente {
  // Une trace ABSENTE (select trop étroit) ferait offrir le visa à l'auteur et
  // perdre l'instant lu · on refuse de présenter plutôt que de mentir.
  if (rib.saisiPar === undefined || rib.saisiLe === undefined || rib.visePar === undefined || rib.viseLe === undefined) {
    throw new Error('presenterVisa · le RIB est lu sans ses traces de saisie et de visa');
  }
  return {
    exige,
    vise: estVise(rib),
    visePar: nommerUtilisateur(rib.visePar, courriels),
    viseLe: rib.viseLe,
    saisiPar: nommerUtilisateur(rib.saisiPar, courriels),
    saisiLe: rib.saisiLe,
    saisiParVous: rib.saisiPar !== null && rib.saisiPar === utilisateurId,
  };
}

/** Les identifiants à résoudre en courriel, sans doublon. */
export function auteursDesVisas(ribs: readonly EtatVisa[]): string[] {
  const ids = new Set<string>();
  for (const r of ribs) {
    if (r.saisiPar) ids.add(r.saisiPar);
    if (r.visePar) ids.add(r.visePar);
  }
  return [...ids];
}
