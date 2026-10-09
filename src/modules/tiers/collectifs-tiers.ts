import { Referentiel, TypeTiers } from '@prisma/client';

/**
 * COMPTE COLLECTIF ET COMPTE INDIVIDUEL DE TIERS (point 13 de la comparaison
 * Sage i7).
 *
 * Sage propose à la création d'un tiers le compte général de son type
 * (support Sage 100 : « Compte générale selon le type des tiers .client
 * (3421) 4411(fournisseurs) », numéros du plan marocain). OmegaX garde un
 * compte INDIVIDUEL par tiers, créé sous ce collectif · choix de Manasse du
 * 2026-09-25 : le lettrage, les relances, la balance âgée et les règlements
 * lisent tous un compte, et aucun texte OHADA n'impose l'un ou l'autre
 * modèle. Le collectif regroupe ses comptes individuels à la balance générale
 * (`regrouperSurCollectifs`) et la balance auxiliaire les rend tiers par tiers.
 *
 * AUCUN NUMÉRO N'EST ÉCRIT AILLEURS QU'ICI, ET AUCUN SANS SON RÉFÉRENTIEL · le
 * 411 est « Adhérents » au SYCEBNL et « Clients » au SYSCOHADA, le 412
 * « Clients-usagers » d'un côté et « effets à recevoir » de l'autre (voir les
 * deux semis, et `collectifs-tiers.spec.ts`, qui les relit).
 *
 * DEUX TYPES N'ONT PAS DE COLLECTIF PROPOSÉ, et c'est voulu. SALARIÉ · la
 * paie passe le net au 422 global (passation-paie.ts), et un compte par
 * salarié serait un second chemin pour la même dette. AUTRE · un débiteur ou
 * un créditeur divers (4711 ou 4712) : le sens n'est pas connu à la création,
 * et le deviner rangerait une dette en créance. Le compte se rattache à la
 * main, comme avant.
 */
/**
 * LA PANOPLIE D'UN TIERS (décision de Manasse du 2026-10-09, gel levé pour
 * elle · « chaque client doit avoir dans un arsenal tous les sous comptes du
 * compte 41 », « pas seulement client mais tout tiers avec sa panoplie de
 * fonctions logiques »). Un client a des factures à établir, peut verser une
 * avance, devenir douteux ; un fournisseur a des factures non parvenues et
 * des avances versées. Chaque rôle a son compte INDIVIDUEL, né sous le
 * collectif du plan qui porte ce rôle, rattaché au tiers · sans lui, l'avance
 * d'un client tombait au 41910000 commun, et ni la balance des tiers, ni le
 * lettrage, ni les relances ne savaient à qui elle appartenait.
 *
 * LE PREMIER RÔLE EST LE PRINCIPAL, les autres sont rattachés sans l'être.
 * Chaque numéro est LU dans le semis de son référentiel, sous l'intitulé qui
 * le justifie (`collectifs-tiers.spec.ts`) · un numéro, deux sens :
 *
 *   FOURNISSEUR, aux deux plans · 4011 Fournisseurs, 4081 (sous 408
 *     « Fournisseurs, factures non parvenues »), 4091 « avances et acomptes
 *     versés » (fiche du compte 40 des deux plans).
 *   CLIENT, SYSCOHADA · 4111 Clients, 4181 « Clients, factures à établir »,
 *     4191 « Clients, avances et acomptes reçus », 4161 « Créances
 *     litigieuses », 4162 « Créances douteuses » (AUDCIF, Titre VII, compte
 *     41 · le 416 dit la NATURE, litigieuse ou douteuse).
 *   CLIENT-USAGER, SYCEBNL · 412, 4182 « Clients-usagers, factures à
 *     établir », 4192 « Clients-usagers, avances et acomptes reçus », 4162
 *     « Créances litigieuses ou douteuses » (Partie 2 ch. 2 et fiche du
 *     compte 41 · le 416 y dit le DÉBITEUR, E3 de la ligne A7).
 *   ADHÉRENT, SYCEBNL · 411, 4181 « Adhérents, appels de fonds à établir »,
 *     4191 « Adhérents, avances reçues », 4161 « Adhérents cotisations
 *     litigieuses ou douteuses ».
 *
 * Le 4181 est donc « factures à établir » d'un client SYSCOHADA et « appels
 * de fonds » d'un adhérent SYCEBNL, le 4161 « litigieuses » d'un côté et
 * « cotisations » de l'autre · jamais une table servie à l'autre référentiel.
 * Ni les comptes « groupe » (4082, 4092, 4112, 4192 SYSCOHADA), ni les
 * sous-traitants, ni les intérêts courus, ni les emballages · ils ne
 * décrivent pas chaque tiers, et se rattachent à la main quand il le faut.
 */
export type RolePanoplie =
  | 'PRINCIPAL'
  | 'FACTURES_NON_PARVENUES'
  | 'AVANCES_VERSEES'
  | 'A_ETABLIR'
  | 'AVANCES_RECUES'
  | 'LITIGIEUSES'
  | 'DOUTEUSES'
  | 'LITIGIEUSES_OU_DOUTEUSES';

export interface ComptePanoplie {
  role: RolePanoplie;
  /** Collectif du plan sous lequel naît le compte du tiers. */
  collectif: string;
  /** Ce que l'intitulé du compte ajoute au nom du tiers · nul pour le principal, qui porte le nom seul. */
  libelle: string | null;
}

const p = (role: RolePanoplie, collectif: string, libelle: string | null): ComptePanoplie => ({ role, collectif, libelle });

const PANOPLIE_FOURNISSEUR: ComptePanoplie[] = [
  p('PRINCIPAL', '40110000', null),
  p('FACTURES_NON_PARVENUES', '40810000', 'factures non parvenues'),
  p('AVANCES_VERSEES', '40910000', 'avances et acomptes versés'),
];

export const PANOPLIES_TIERS: Record<Referentiel, Partial<Record<TypeTiers, readonly ComptePanoplie[]>>> = {
  [Referentiel.SYCEBNL]: {
    [TypeTiers.FOURNISSEUR]: PANOPLIE_FOURNISSEUR,
    [TypeTiers.ADHERENT]: [
      p('PRINCIPAL', '41100000', null),
      p('A_ETABLIR', '41810000', 'appels de fonds à établir'),
      p('AVANCES_RECUES', '41910000', 'avances reçues'),
      p('LITIGIEUSES_OU_DOUTEUSES', '41610000', 'cotisations litigieuses ou douteuses'),
    ],
    [TypeTiers.CLIENT]: [
      p('PRINCIPAL', '41200000', null),
      p('A_ETABLIR', '41820000', 'factures à établir'),
      p('AVANCES_RECUES', '41920000', 'avances et acomptes reçus'),
      p('LITIGIEUSES_OU_DOUTEUSES', '41620000', 'créances litigieuses ou douteuses'),
    ],
  },
  // Pas d'adhérent · le type est refusé hors SYCEBNL (TiersService).
  [Referentiel.SYSCOHADA]: {
    [TypeTiers.FOURNISSEUR]: PANOPLIE_FOURNISSEUR,
    [TypeTiers.CLIENT]: [
      p('PRINCIPAL', '41110000', null),
      p('A_ETABLIR', '41810000', 'factures à établir'),
      p('AVANCES_RECUES', '41910000', 'avances et acomptes reçus'),
      p('LITIGIEUSES', '41610000', 'créances litigieuses'),
      p('DOUTEUSES', '41620000', 'créances douteuses'),
    ],
  },
};

export function panoplieDuTiers(referentiel: Referentiel, type: TypeTiers): readonly ComptePanoplie[] {
  return PANOPLIES_TIERS[referentiel][type] ?? [];
}

/** Le collectif du compte PRINCIPAL de chaque type · le premier rôle de sa panoplie. */
export const COLLECTIFS_TIERS: Record<Referentiel, Partial<Record<TypeTiers, string>>> = {
  [Referentiel.SYCEBNL]: principaux(Referentiel.SYCEBNL),
  [Referentiel.SYSCOHADA]: principaux(Referentiel.SYSCOHADA),
};

function principaux(referentiel: Referentiel): Partial<Record<TypeTiers, string>> {
  const sortie: Partial<Record<TypeTiers, string>> = {};
  for (const [type, panoplie] of Object.entries(PANOPLIES_TIERS[referentiel])) {
    if (panoplie?.[0]) sortie[type as TypeTiers] = panoplie[0].collectif;
  }
  return sortie;
}

export function numeroCollectif(referentiel: Referentiel, type: TypeTiers): string | null {
  return COLLECTIFS_TIERS[referentiel][type] ?? null;
}

/** La racine sous laquelle naissent les comptes individuels · 40110000 → 4011. */
export function racineCollectif(numero: string): string {
  return numero.replace(/0+$/, '');
}

/**
 * Premier numéro libre sous le collectif, à la longueur du dossier · 40110001,
 * 40110002… Le numéro tout-à-zéro est celui du collectif lui-même et n'est
 * jamais pris. Rend null quand la racine ne laisse aucune place (longueur trop
 * courte, ou toutes les positions prises) · jamais un numéro plus long que
 * `Tenant.longueurCompte`, que la création de compte refuserait.
 */
export function prochainNumeroIndividuel(racine: string, longueur: number, existants: string[]): string | null {
  const largeur = longueur - racine.length;
  if (largeur < 1) return null;
  const pris = new Set(existants.filter((n) => n.length === longueur && n.startsWith(racine)));
  const max = 10 ** largeur - 1;
  for (let i = 1; i <= max; i++) {
    const numero = racine + String(i).padStart(largeur, '0');
    if (!pris.has(numero)) return numero;
  }
  return null;
}

/**
 * MÊME RANG SOUS CHAQUE COLLECTIF QUAND IL EST LIBRE · le client 41110005 a
 * son avance au 41910005 et ses factures à établir au 41810005, ce qui se lit
 * d'un coup d'œil. Pris, le rang cède au premier numéro libre · le rang n'est
 * qu'une commodité de lecture, le lien du tiers à son compte est le
 * rattachement, jamais le numéro.
 */
export function numeroIndividuelAligne(
  racine: string,
  longueur: number,
  rang: number | null,
  existants: string[],
): string | null {
  const largeur = longueur - racine.length;
  if (rang !== null && largeur >= 1 && rang >= 1 && rang < 10 ** largeur) {
    const numero = racine + String(rang).padStart(largeur, '0');
    if (!existants.includes(numero)) return numero;
  }
  return prochainNumeroIndividuel(racine, longueur, existants);
}

/** Le rang d'un compte individuel sous sa racine · 41110005 → 5 ; nul hors de la racine. */
export function rangSousRacine(numero: string, racine: string): number | null {
  if (!numero.startsWith(racine) || numero.length <= racine.length) return null;
  const rang = Number(numero.slice(racine.length));
  return Number.isInteger(rang) && rang >= 1 ? rang : null;
}

/**
 * LE NUMÉRO QUE LE CABINET CHOISIT POUR LE COMPTE PRINCIPAL D'UN TIERS
 * (décision de Manasse du 2026-10-09, « Choisi à la création ») · OmegaX
 * propose le premier numéro libre sous le collectif, le cabinet le garde ou
 * le remplace, et les sous-comptes de la panoplie prennent son rang. Quatre
 * règles, chacune avec sa raison.
 *
 *  · DES CHIFFRES SEULS · la codification des comptes est décimale (AUDCIF
 *    art. 18, al. 1er, et Titre VII, « Structure décimale des comptes » ;
 *    SYCEBNL, Partie 2 ch. 2, section 1, « principe de la décimalisation »,
 *    l'art. 18 de l'AUDCIF étant écarté par l'art. 3 du SYCEBNL). Un
 *    « 401SONEL » à la manière de Sage n'y a pas de place · le CODE du tiers
 *    l'identifie déjà.
 *  · SOUS LA RACINE DU COLLECTIF · « Le numéro d'un compte divisionnaire
 *    commence toujours par celui du compte principal ou sous-compte dont il
 *    est une subdivision » (AUDCIF, Titre VII) ; le SYCEBNL complète son plan
 *    « en respectant l'arborescence » (même section). Hors de sa racine, le
 *    compte ne se fondrait pas sur son collectif et changerait de poste.
 *  · DISTINCT DU COLLECTIF · des zéros seuls après la racine redonnent le
 *    collectif, ou un numéro qui ne s'en distingue que par sa longueur.
 *  · À LA LONGUEUR DU DOSSIER (`Tenant.longueurCompte`), comme les numéros
 *    qu'OmegaX ouvre lui-même · convention d'OmegaX, aucun texte ne fixe la
 *    longueur d'une subdivision. Deux numéros de même longueur ne sont
 *    jamais le début l'un de l'autre. LIMITE ÉCRITE · un dossier dont les
 *    numéros ont été élargis garde ses comptes plus courts (« élargir ne
 *    renumérote rien »), et l'un d'eux peut être le début d'un numéro neuf,
 *    choisi ou proposé, comme le collectif l'est déjà de ses premiers
 *    individuels · une recherche par racine les lirait ensemble (relevé en
 *    attente au suivi).
 *
 * Rend le motif du refus, ou null. L'unicité dans le dossier se juge à part,
 * sous le verrou de la panoplie.
 */
export function motifRefusNumeroChoisi(
  numero: string,
  collectif: string,
  longueur: number,
  referentiel: Referentiel,
): string | null {
  const racine = racineCollectif(collectif);
  if (!/^\d+$/.test(numero)) {
    const source =
      referentiel === Referentiel.SYCEBNL
        ? 'SYCEBNL, Partie 2 ch. 2, section 1'
        : 'AUDCIF art. 18 et Titre VII';
    return (
      `Le numéro de compte « ${numero} » ne doit porter que des chiffres · la codification des comptes est décimale ` +
      `(${source}). Le code du tiers l'identifie déjà.`
    );
  }
  if (!numero.startsWith(racine)) {
    return (
      `Le numéro ${numero} ne commence pas par ${racine}, racine du collectif ${collectif} de ce type de tiers · ` +
      'le compte d\'un tiers est une subdivision de son collectif.'
    );
  }
  if (numero.length !== longueur) {
    return (
      `Le numéro ${numero} compte ${numero.length} chiffres, et les comptes de ce dossier en comptent ${longueur} ` +
      '(Structure > Paramètres du dossier).'
    );
  }
  if (rangSousRacine(numero, racine) === null) {
    return `Le numéro ${numero} ne se distingue pas du collectif ${collectif} · ajoutez un rang après ${racine}.`;
  }
  return null;
}

/** Une ligne de balance, telle que `EcritureService.balance` la rend. */
export interface LigneBalanceRegroupable {
  compteId: string;
  numero: string;
  intitule: string;
  totalDebit: number;
  totalCredit: number;
  reportDebit: number;
  reportCredit: number;
  mouvementDebit: number;
  mouvementCredit: number;
  solde: number;
}

/**
 * BALANCE GÉNÉRALE REGROUPÉE · chaque compte individuel est fondu dans la
 * ligne de son collectif, comme la balance générale de Sage n'affiche que le
 * 4011 et renvoie le détail à la balance des tiers. Le collectif ressort même
 * s'il n'a aucun mouvement propre, et la ligne dit combien de comptes elle
 * regroupe. Les totaux ne bougent pas · c'est un regroupement, pas un calcul.
 */
export function regrouperSurCollectifs<L extends LigneBalanceRegroupable>(
  lignes: L[],
  collectifDe: Map<string, { id: string; numero: string; intitule: string }>,
): Array<L & { regroupe: number }> {
  const sortie = new Map<string, L & { regroupe: number }>();
  const CHAMPS = ['totalDebit', 'totalCredit', 'reportDebit', 'reportCredit', 'mouvementDebit', 'mouvementCredit', 'solde'] as const;
  for (const l of lignes) {
    const collectif = collectifDe.get(l.compteId);
    const cle = collectif?.id ?? l.compteId;
    const existant = sortie.get(cle);
    if (!existant) {
      sortie.set(
        cle,
        collectif
          ? { ...l, compteId: collectif.id, numero: collectif.numero, intitule: collectif.intitule, regroupe: 1 }
          : { ...l, regroupe: 0 },
      );
      continue;
    }
    for (const c of CHAMPS) existant[c] += l[c];
    if (collectif) existant.regroupe += 1;
  }
  return [...sortie.values()].sort((a, b) => a.numero.localeCompare(b.numero));
}
