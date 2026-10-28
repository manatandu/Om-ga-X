/**
 * AVANCES, ACOMPTES ET PRÊTS AU PERSONNEL · règles pures, sans Prisma.
 *
 * LA RETENUE EST AUTORISÉE, ET NOMMÉE · Code du travail, art. 112 : « les
 * retenues ci-après sont autorisées : [...] c) retenues à titre d'avances ;
 * [...] f) retenues à titre de prêt ». Une avance et un acompte relèvent du
 * c), un prêt du f).
 *
 * LES DEUX PLANS ÉCRIVENT LE MÊME COMPTE, ET LE MÊME REFUS. Fiche du compte 42
 * (AUDCIF Titre VII · SYCEBNL Partie 2 ch. 3) : 4211 « Personnel, avances »,
 * 4212 « Personnel, acomptes », et en EXCLUSION « les prêts consentis au
 * personnel → 272 (Prêts au personnel) ». Un prêt porté au 421 se lirait
 * comme une créance à court terme sur la paie ; au 272 c'est une immobilisation
 * financière, que la Note annexe ventile par échéance. Numéros relus aux deux
 * semis (42110000, 42120000, 27210000, 27220000, 27280000).
 *
 * LA RETENUE SUR LE BULLETIN VIRE LE 422 VERS LE COMPTE DE L'AVANCE · Guide
 * d'application SYSCOHADA, Partie 1 ch. 3, § 4.3 (« virées de 422 vers 421
 * (avances/acomptes) ») et Application 10 (D/422, C/4212 pour l'acompte).
 *
 * CE QUI N'EST PAS ÉCRIT, ET N'EST DONC PAS CODÉ · un plafond. L'article 112 ne
 * renvoie à l'article 114 (quotité cessible) que pour son litera d), dans le
 * cas où il n'y a pas de cautionnement. Il n'en dit rien pour les avances ni
 * les prêts. OmegaX ne refuse donc aucune retenue d'avance au nom de la
 * quotité · il la MONTRE à côté, pour que le cabinet juge.
 */

export type TypeAvance = 'AVANCE' | 'ACOMPTE' | 'PRET' | 'SAISIE_ARRET';
export type CategoriePret = 'IMMOBILIER' | 'MOBILIER_ET_INSTALLATION' | 'AUTRE';

export const LITTERA_ARTICLE_112: Readonly<Record<TypeAvance, 'c' | 'f' | 'g'>> = {
  AVANCE: 'c',
  ACOMPTE: 'c',
  PRET: 'f',
  SAISIE_ARRET: 'g',
};

/** Le compte crédité par la retenue · le même dans les deux plans. */
export function compteDeLAvance(type: TypeAvance, categorie: CategoriePret | null): { compte: string; intitule: string } {
  // LA SAISIE-ARRÊT NOTIFIÉE (passe O4-C2) · la retenue vire le 422 vers le
  // 4232 « Personnel, saisies-arrêts », ouvert aux deux plans sous ce nom
  // (AUDCIF, Titre VII, et SYCEBNL, Partie 2 ch. 3, fiche du compte 42) ;
  // Guide d'application SYSCOHADA, Partie 1 ch. 3, § 4.3 (« virées de 422
  // vers […] 423 (oppositions/saisies-arrêts) ») et Application 10 (« 4232
  // Personnel, saisies-arrêts »). Le versement au greffe est la seconde
  // écriture, D 4232 / C trésorerie, que le cabinet passe.
  if (type === 'SAISIE_ARRET') return { compte: '42320000', intitule: 'Personnel, saisies-arrêts' };
  if (type === 'AVANCE') return { compte: '42110000', intitule: 'Personnel, avances' };
  if (type === 'ACOMPTE') return { compte: '42120000', intitule: 'Personnel, acomptes' };
  if (categorie === 'IMMOBILIER') return { compte: '27210000', intitule: 'Prêts au personnel · immobiliers' };
  if (categorie === 'MOBILIER_ET_INSTALLATION') return { compte: '27220000', intitule: "Prêts au personnel · mobiliers et d'installation" };
  return { compte: '27280000', intitule: 'Autres prêts au personnel' };
}

const c = (n: number) => Math.round(n * 100);

export function motifRefusAvance(a: {
  type: TypeAvance;
  categoriePret?: CategoriePret | null;
  montantFc: number;
  retenueMensuelleFc?: number | null;
  objet?: string;
  pieceJustificative?: string;
  referenceActe?: string | null;
  greffe?: string | null;
  destinataire?: string | null;
}): string | null {
  if (!(a.montantFc > 0)) return 'Le montant consenti doit être positif.';
  const refusSaisie = motifRefusSaisieArret(a);
  if (refusSaisie) return refusSaisie;
  if (a.type !== 'PRET' && a.categoriePret) return "Une catégorie de prêt ne s'applique qu'à un prêt (compte 272).";
  if (a.type === 'PRET' && !a.categoriePret) {
    return 'La catégorie du prêt (immobilier, mobilier et d’installation, autre) choisit la subdivision du 272 · elle est obligatoire.';
  }
  if (a.retenueMensuelleFc != null && (a.retenueMensuelleFc <= 0 || c(a.retenueMensuelleFc) > c(a.montantFc))) {
    return 'La retenue mensuelle doit être positive et ne peut dépasser le montant consenti.';
  }
  if (!a.objet?.trim()) return "L'objet de l'avance ou du prêt est obligatoire.";
  if (!a.pieceJustificative?.trim()) {
    return "La pièce justificative (reconnaissance de dette, contrat de prêt) est obligatoire · les deux plans la nomment parmi les éléments de contrôle du compte 42.";
  }
  return null;
}

/**
 * Le SOLDE restant dû · le montant moins ce que les bulletins NON ANNULÉS ont
 * retenu. Un bulletin annulé rend sa retenue : l'argent n'a pas été retenu.
 */
export function soldeAvance(montantFc: number, retenues: readonly { montantFc: number; bulletinAnnule: boolean }[]): number {
  const retenu = retenues.filter((r) => !r.bulletinAnnule).reduce((s, r) => s + c(r.montantFc), 0);
  return (c(montantFc) - retenu) / 100;
}

/** Refus d'une retenue de bulletin · elle ne peut solder plus que ce qui reste dû. */
export function motifRefusRetenue(montantFc: number, soldeFc: number, libelle: string): string | null {
  if (!(montantFc > 0)) return `${libelle} · la retenue doit être positive.`;
  if (c(montantFc) > c(soldeFc)) {
    return `${libelle} · la retenue (${montantFc.toFixed(2)} FC) dépasse le solde restant dû (${soldeFc.toFixed(2)} FC). Un trop-retenu serait une réduction de rémunération que l'article 112 n'autorise pas.`;
  }
  return null;
}

export const RESERVE_QUOTITE_AVANCES =
  "AUCUN PLAFOND N'EST OPPOSÉ AUX RETENUES D'AVANCE ET DE PRÊT · l'article 112 du Code du travail ne renvoie à l'article 114 " +
  "(quotité cessible) que pour son litera d). La quotité est montrée pour comparaison ; le jugement appartient au cabinet.";

/**
 * LA SAISIE-ARRÊT NOTIFIÉE · ce que l'acte porte, recopié, jamais calculé
 * (passe O4-C2).
 *
 * AUPSRVE, livre 2, titre 5. Le greffier notifie l'acte de saisie à
 * l'employeur (art. 183) ; l'acte contient « le décompte distinct des sommes
 * pour lesquelles la saisie est pratiquée » et « le mode de calcul de la
 * fraction saisissable et les modalités de son règlement » (art. 184, 2° et
 * 3°) ; sa notification « frappe d'indisponibilité la quotité saisissable du
 * salaire » (art. 187) ; l'employeur « adresse tous les mois au greffe ou à
 * l'organisme spécialement désigné à cet effet par chaque État partie » les
 * sommes retenues, « sans excéder la portion saisissable », avec une note qui
 * porte « les références éventuelles de l'acte de saisie » (art. 188) ; s'il
 * omet de verser, il est déclaré « personnellement débiteur » (art. 189).
 *
 * D'où les trois champs exigés · la RÉFÉRENCE de l'acte, le GREFFE qui l'a
 * notifié, et le DESTINATAIRE des versements (le greffe, ou l'organisme que
 * l'État a désigné · l'art. 188 laisse les deux). Le montant est le décompte
 * de l'acte, la retenue mensuelle celle que son mode de calcul donne · OmegaX
 * ne les déduit de rien. Ces champs n'ont aucun sens sur une avance ou un
 * prêt, et y sont refusés plutôt que stockés en silence.
 *
 * LA CESSION DES RÉMUNÉRATIONS N'EST PAS TENUE ICI, et c'est une abstention ·
 * aucun des deux textes comptables ne lui désigne un compte (le 423 porte
 * « la fraction du salaire soumise à saisie, en cas d'opposition de tiers »,
 * fiche du compte 42), et une cession n'est pas une retenue de la liste de
 * l'art. 112 (retenues-autorisees.ts). Elle reste passée à la main.
 */
export function motifRefusSaisieArret(a: {
  type: TypeAvance;
  categoriePret?: CategoriePret | null;
  referenceActe?: string | null;
  greffe?: string | null;
  destinataire?: string | null;
}): string | null {
  if (a.type !== 'SAISIE_ARRET') {
    if (a.referenceActe?.trim() || a.greffe?.trim() || a.destinataire?.trim()) {
      return "La référence de l'acte, le greffe et le destinataire ne s'appliquent qu'à une saisie-arrêt notifiée.";
    }
    return null;
  }
  if (a.categoriePret) return "Une catégorie de prêt ne s'applique qu'à un prêt (compte 272).";
  if (!a.referenceActe?.trim()) {
    return "La référence de l'acte de saisie notifié est obligatoire · la note jointe à chaque versement la porte (AUPSRVE, art. 188).";
  }
  if (!a.greffe?.trim()) return "Le greffe qui a notifié l'acte de saisie est obligatoire (AUPSRVE, art. 183).";
  if (!a.destinataire?.trim()) {
    return "Le destinataire des versements est obligatoire · « le greffe ou l'organisme spécialement désigné à cet effet » (AUPSRVE, art. 188).";
  }
  return null;
}

const jourIso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * LE MOIS DE PAIE QU'UNE SAISIE PEUT ATTEINDRE · de la notification (art. 187,
 * l'indisponibilité naît avec elle) à la mainlevée (art. 201). Un mois ENTAMÉ par l'une ou l'autre date reste atteignable · la paie
 * du mois se verse en une fois, et OmegaX ne proratise rien que l'acte ne
 * proratise.
 */
export function motifRefusMoisSaisie(moisDePaie: string, dateNotification: Date, dateFin: Date | null): string | null {
  const [a, m] = moisDePaie.split('-').map(Number);
  const premier = new Date(Date.UTC(a, m - 1, 1));
  const dernier = new Date(Date.UTC(a, m, 0));
  if (dernier < dateNotification) {
    return (
      `La saisie a été notifiée le ${jourIso(dateNotification)} · la quotité n'est indisponible qu'à compter de la ` +
      `notification (AUPSRVE, art. 187), et la paie de ${moisDePaie} ne peut pas la porter.`
    );
  }
  if (dateFin && premier > dateFin) {
    return (
      `La saisie a pris fin le ${jourIso(dateFin)} (mainlevée, AUPSRVE, art. 201) · la paie de ${moisDePaie} ne ` +
      "peut plus la porter."
    );
  }
  return null;
}

/** La fin d'une saisie se déclare une fois, jamais avant sa notification. */
export function motifRefusFinSaisie(
  a: { type: TypeAvance; dateOctroi: Date; dateFin: Date | null },
  dateFin: Date,
): string | null {
  if (a.type !== 'SAISIE_ARRET') return "Seule une saisie-arrêt prend fin par mainlevée · une avance se solde par ses retenues.";
  if (a.dateFin) return `Cette saisie a déjà pris fin le ${jourIso(a.dateFin)}.`;
  if (dateFin < a.dateOctroi) return "La mainlevée ne peut pas précéder la notification de l'acte de saisie.";
  return null;
}

/**
 * « SANS EXCÉDER LA PORTION SAISISSABLE » (AUPSRVE, art. 188) · la retenue de
 * saisie est confrontée à la quotité que le logiciel calcule, et l'écart est
 * DIT, jamais refusé · c'est l'acte qui fixe « le mode de calcul de la
 * fraction saisissable » (art. 184, 3°), et le calcul d'OmegaX peut
 * s'abstenir ou différer du sien (catégorie, logement).
 */
export function reserveQuotiteSaisies(saisiesFc: number, quotiteFc: number | null): string | null {
  if (!(saisiesFc > 0)) return null;
  if (quotiteFc === null) {
    return (
      `Retenue de saisie-arrêt de ${saisiesFc.toFixed(2)} FC · la quotité saisissable n'est pas chiffrée pour ce ` +
      "bulletin, et la retenue n'y est pas confrontée (AUPSRVE, art. 188, « sans excéder la portion saisissable »)."
    );
  }
  if (c(saisiesFc) > c(quotiteFc)) {
    return (
      `La retenue de saisie-arrêt (${saisiesFc.toFixed(2)} FC) dépasse la quotité saisissable calculée ` +
      `(${quotiteFc.toFixed(2)} FC) · l'employeur ne verse au greffe que « sans excéder la portion saisissable » ` +
      "(AUPSRVE, art. 188). Confrontez-la à l'acte notifié."
    );
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// LA RETENUE ÉTALÉE (ligne microfina-m3, idée 6) · durée du prélèvement et
// retenue proposée d'office sur chaque bulletin jusqu'au solde.
//
// CE QUE LA LOI DIT, ET CE QU'ELLE NE DIT PAS. L'article 112 du Code du travail
// AUTORISE les retenues « à titre d'avances » (c) et « à titre de prêt » (f),
// et c'est tout · il ne fixe ni durée, ni échéance, ni plafond (il ne renvoie
// à l'article 114 que pour son litera d). Le plan d'étalement est donc une
// CONVENTION entre l'employeur et le travailleur, que le cabinet DÉCLARE · deux
// formes, l'une ou l'autre · un NOMBRE D'ÉCHÉANCES (la durée du prélèvement,
// l'échéance en découle), ou une RETENUE MENSUELLE (la durée en découle), et
// dans les deux cas le PREMIER MOIS de paie qui retient.
//
// « D'OFFICE » VEUT DIRE PROPOSÉE ET PRÉREMPLIE, JAMAIS SUBSTITUÉE · le serveur
// rend, pour un mois de paie, la retenue que le plan propose (`retenueProposee`),
// l'écran la préremplit, et la simulation DIT la retenue planifiée que le
// bulletin ne porte pas, ou porte en moins (`ecartsAuPlan`). Le bulletin retient
// ce que la saisie porte · une retenue imposée par le logiciel serait une
// réduction de rémunération que personne n'a décidée ce mois-là, et l'art. 112
// frappe de nullité ce qui n'est pas dans sa liste, pas ce qui n'est pas retenu.
//
// LA SAISIE-ARRÊT NE S'ÉTALE PAS ICI · « le mode de calcul de la fraction
// saisissable et les modalités de son règlement » sont dans l'acte notifié
// (AUPSRVE, art. 184, 3°) · un plan d'OmegaX s'y substituerait.
//
// CONVENTIONS D'OMEGAX, dites comme telles · les échéances se calculent en
// centimes entiers, toutes égales, la DERNIÈRE prenant le reste (jamais un
// centime perdu ni ajouté) ; au-delà du plan, tant qu'un solde reste dû (un
// mois sauté, un bulletin annulé), la retenue proposée reste l'échéance
// courante bornée par le solde · un mois sauté n'est JAMAIS rattrapé en
// doublant une échéance ; à la dernière échéance et au-delà, le reliquat
// qu'elle laisse est dit, avec l'issue (porter le solde entier) ; la durée
// est bornée à 120 mois.
// ──────────────────────────────────────────────────────────────────────────

export const ECHEANCES_AU_PLUS = 120;

export type PlanEtalement = {
  readonly montantFc: number;
  readonly premierMois: string;
  readonly nombreEcheances: number | null;
  readonly retenueMensuelleFc: number | null;
};

const MOIS_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const rangDuMois = (mois: string) => {
  const [a, m] = mois.split('-').map(Number);
  return a * 12 + (m - 1);
};
const moisDuRang = (rang: number) => `${Math.floor(rang / 12)}-${String((rang % 12) + 1).padStart(2, '0')}`;

/** Le refus d'un plan d'étalement, ou null. Rien de déclaré = aucun plan. */
export function motifRefusEtalement(a: {
  type: TypeAvance;
  montantFc: number;
  dateOctroi: Date | string;
  premierMoisRetenue?: string | null;
  nombreEcheances?: number | null;
  retenueMensuelleFc?: number | null;
}): string | null {
  const premier = a.premierMoisRetenue?.trim() || null;
  if (a.nombreEcheances != null && !premier) {
    return "Une durée de prélèvement se compte à partir d'un premier mois de paie · déclarez-le (AAAA-MM).";
  }
  if (!premier) return null;
  if (a.type === 'SAISIE_ARRET') {
    return (
      "Une saisie-arrêt ne s'étale pas dans OmegaX · l'acte notifié fixe « le mode de calcul de la fraction saisissable " +
      "et les modalités de son règlement » (AUPSRVE, art. 184, 3°)."
    );
  }
  if (!MOIS_RE.test(premier)) return 'Le premier mois de retenue se lit AAAA-MM.';
  const octroi = typeof a.dateOctroi === 'string' ? a.dateOctroi.slice(0, 7) : a.dateOctroi.toISOString().slice(0, 7);
  if (rangDuMois(premier) < rangDuMois(octroi)) {
    return `Le premier mois de retenue (${premier}) précède le mois de l'octroi (${octroi}) · on ne retient pas une avance qui n'est pas encore consentie.`;
  }
  const n = a.nombreEcheances ?? null;
  const r = a.retenueMensuelleFc ?? null;
  if (n === null && r === null) {
    return "Un plan d'étalement se déclare par sa durée (nombre d'échéances) ou par sa retenue mensuelle · l'une des deux.";
  }
  if (n !== null && r !== null) {
    return "Déclarez la durée OU la retenue mensuelle · la durée fixe l'échéance, la retenue fixe la durée, et les deux ensemble pourraient se contredire.";
  }
  if (n !== null && (!Number.isInteger(n) || n < 1 || n > ECHEANCES_AU_PLUS)) {
    return `La durée du prélèvement est un nombre entier de mois, de 1 à ${ECHEANCES_AU_PLUS} (convention d'OmegaX).`;
  }
  if (n !== null && c(a.montantFc) < n) return "Le montant consenti ne se répartit pas en autant d'échéances d'un centime au moins.";
  if (r !== null && Math.ceil(c(a.montantFc) / c(r)) > ECHEANCES_AU_PLUS) {
    return `Cette retenue mensuelle étalerait l'avance sur plus de ${ECHEANCES_AU_PLUS} mois (convention d'OmegaX) · augmentez-la.`;
  }
  return null;
}

/**
 * L'ÉCHÉANCIER DU PLAN, mois par mois, en centimes entiers · la dernière
 * échéance prend le reste, si bien que leur somme est le montant consenti, au
 * centime (jeu d'essai · 100 000 en trois échéances, 33 333,33 + 33 333,33 +
 * 33 333,34).
 */
export function echeancierAvance(p: PlanEtalement): { mois: string; montantFc: number }[] {
  const total = c(p.montantFc);
  const depart = rangDuMois(p.premierMois);
  const montants: number[] = [];
  if (p.nombreEcheances != null) {
    const base = Math.floor(total / p.nombreEcheances);
    for (let i = 0; i < p.nombreEcheances; i++) montants.push(i === p.nombreEcheances - 1 ? total - base * (p.nombreEcheances - 1) : base);
  } else if (p.retenueMensuelleFc != null) {
    const r = c(p.retenueMensuelleFc);
    let reste = total;
    while (reste > 0 && montants.length < ECHEANCES_AU_PLUS) {
      montants.push(Math.min(r, reste));
      reste -= Math.min(r, reste);
    }
  }
  return montants.map((m, i) => ({ mois: moisDuRang(depart + i), montantFc: m / 100 }));
}

/**
 * LA RETENUE QUE LE PLAN PROPOSE POUR UN MOIS DE PAIE, bornée par le solde.
 * `null` avec un motif quand rien n'est proposé (avant le premier mois, solde
 * nul) · jamais un zéro qui passerait pour une échéance.
 */
export function retenueProposee(
  p: PlanEtalement,
  moisDePaie: string,
  soldeFc: number,
): { montantFc: number | null; motif: string; rang: number | null; auDelaDuPlan: boolean } {
  if (!MOIS_RE.test(moisDePaie)) return { montantFc: null, motif: 'Mois de paie illisible.', rang: null, auDelaDuPlan: false };
  if (c(soldeFc) <= 0) return { montantFc: null, motif: 'Avance soldée · plus rien à retenir.', rang: null, auDelaDuPlan: false };
  const echeances = echeancierAvance(p);
  const rang = rangDuMois(moisDePaie) - rangDuMois(p.premierMois);
  if (rang < 0) {
    return { montantFc: null, motif: `Le plan commence en ${p.premierMois} · rien n'est retenu avant.`, rang: null, auDelaDuPlan: false };
  }
  const auDela = rang >= echeances.length;
  // Au-delà du plan · l'échéance courante (la première, que toutes égalent
  // sauf la dernière), jamais une somme rattrapée.
  const echeance = auDela ? echeances[0]?.montantFc ?? 0 : echeances[rang].montantFc;
  // LE RELIQUAT DE FIN DE PLAN (relecture de la ligne) · un bulletin qui a
  // retenu un centime de moins laissait, après la dernière échéance, une
  // proposition d'un centime le mois suivant, sans un mot. La proposition
  // reste l'échéance (un rattrapage partiel est la règle qu'on refuse), mais
  // à la dernière échéance et au-delà, le reliquat qu'elle laissera est DIT,
  // avec l'issue · retenir le solde entier pour clore l'avance.
  const montant = Math.min(c(echeance), c(soldeFc)) / 100;
  const derniere = auDela || rang === echeances.length - 1;
  const resteApres = c(soldeFc) - c(montant);
  const reliquat =
    derniere && resteApres > 0
      ? ` Un reliquat de ${(resteApres / 100).toFixed(2)} FC restera dû après cette retenue · portez le solde entier (${soldeFc.toFixed(2)} FC) pour clore l'avance.`
      : '';
  return {
    montantFc: montant,
    motif:
      (auDela
        ? `Échéance au-delà du plan (${echeances.length} mois) · un solde de ${soldeFc.toFixed(2)} FC reste dû, la retenue proposée est bornée par lui.`
        : `Échéance ${rang + 1} sur ${echeances.length} du plan.`) + reliquat,
    rang: auDela ? null : rang + 1,
    auDelaDuPlan: auDela,
  };
}

/**
 * CE QUE LE BULLETIN PORTE, CONFRONTÉ AU PLAN · une phrase par avance
 * planifiée dont la retenue proposée n'est pas portée, ou l'est en moins.
 * Un avertissement, jamais un refus (voir l'en-tête).
 */
export function ecartsAuPlan(
  proposees: readonly { avanceId: string; libelle: string; montantFc: number }[],
  portees: readonly { avanceId: string; montantFc: number }[],
): string[] {
  const phrases: string[] = [];
  for (const p of proposees) {
    const porte = portees.find((x) => x.avanceId === p.avanceId)?.montantFc ?? 0;
    if (c(porte) >= c(p.montantFc)) continue;
    phrases.push(
      porte > 0
        ? `${p.libelle} · le plan d'étalement propose ${p.montantFc.toFixed(2)} FC ce mois-ci, le bulletin en retient ${porte.toFixed(2)} FC. L'écart reste dû et se retiendra plus tard.`
        : `${p.libelle} · le plan d'étalement propose une retenue de ${p.montantFc.toFixed(2)} FC ce mois-ci, que le bulletin ne porte pas. Le solde reste dû.`,
    );
  }
  return phrases;
}
