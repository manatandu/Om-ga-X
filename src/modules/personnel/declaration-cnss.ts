/**
 * LA DÉCLARATION DES COTISATIONS SOCIALES D'UN MOIS, PRÉPARÉE DEPUIS LES
 * BULLETINS ÉMIS (ligne paie-declarations, gel levé par Manasse le
 * 2026-11-01, « Fais tout le point 1 »). Règles pures, sans Prisma.
 *
 * CE N'EST PAS L'IMPRIMÉ DE LA CAISSE. L'arrêté n° 146/2018 (affiliation,
 * immatriculation, perception des cotisations, liquidation des prestations)
 * nomme deux formulaires · la « déclaration mensuelle unique des impôts,
 * cotisations sociales et contributions patronales sur les rémunérations »
 * du guichet unique, et le formulaire « Modèle DC » remis à la représentation
 * de la Caisse (art. 21). Aucun des deux gabarits n'est au corpus · OmegaX
 * PRÉPARE, en reprenant une à une les énonciations que l'arrêté exige, et le
 * cabinet recopie sur l'imprimé qu'il dépose. Rien ne part d'ici.
 *
 * LES ÉNONCIATIONS SONT CELLES DE L'ART. 23 (Mod. DC), dix points, lus
 * mot pour mot · « 1. nom ou raison sociale de l'employeur ; 2. numéro
 * d'affiliation qui lui a été attribué ; 3. adresse du (des) siège (s)
 * d'exploitation pour le (s) quel (s) la déclaration est établie ; 4. période
 * à laquelle la déclaration se rapporte ; 5. montant total brut des sommes
 * payées aux travailleurs ; 6. montant total des sommes payées aux
 * travailleurs qui sont prises en considération pour le calcul des
 * cotisations ; 7. montant total des cotisations dues ; 8. nombre de
 * travailleurs occupés au dernier jour de la période dans le siège
 * d'exploitation auxquels la déclaration se rapporte ; 9. nombre d'enfants
 * bénéficiaires des prestations aux familles au dernier jour de la période
 * […] ; 10. date et mode de paiement du montant des cotisations dues ».
 * L'art. 22 (déclaration unique) en porte d'autres (sigle, forme juridique,
 * secteur d'activités, adresse physique, régime fiscal, « cotisations sociales
 * pour toutes les branches », ventilation des montants par province) · celles
 * qu'OmegaX ne tient pas sont NOMMÉES dans la réserve, jamais remplies.
 *
 * LES MONTANTS SONT CEUX DES BULLETINS FIGÉS · aucun recalcul. Le total
 * versé (`totalVerseFc`), la base de la CNSS (l'assiette de ses lignes de
 * cotisation, plancher de l'art. 8 du décret n° 18/041 compris) et chaque
 * branche (décret n° 18/041, art. 2 à 4) se lisent sur le calcul que
 * l'émission a figé. Un bulletin dont le calcul ne se lit pas rend le total
 * `null` et il est nommé · un total amputé d'un bulletin serait une
 * déclaration minorée sous un chiffre plausible.
 *
 * CE QUE LE REGISTRE NE TIENT PAS EST NOMMÉ, JAMAIS DEVINÉ · le numéro
 * d'affiliation de l'employeur (point 2), l'adresse (point 3), le numéro
 * d'immatriculation d'un travailleur (art. 25, mention 3 de la feuille de
 * paie), les enfants bénéficiaires qu'un bulletin ne déclare pas (point 9),
 * la date et le mode de paiement (point 10, un fait du versement).
 *
 * L'ÉCHÉANCE · « dans les quinze jours suivant le mois civil auquel elles se
 * rapportent » (art. 21, déclaration ; art. 31, versement), régularisation
 * « dans les cinq jours qui suivent » (mêmes articles, al. 2). Le texte ne
 * reporte pas une échéance tombée un jour non ouvrable · rien n'est reporté,
 * comme pour la CNSS du registre des retenues (`correspondance-retenues.ts`).
 */

export const RESERVE_DECLARATION_CNSS =
  "État de préparation d'OmegaX · ce n'est pas l'imprimé de la Caisse. L'arrêté n° 146/2018 nomme la déclaration mensuelle unique " +
  '(art. 21, 1° et 22) et le formulaire Modèle DC (art. 21, 2° et 23), dont les gabarits ne sont pas au corpus d’OmegaX · ' +
  "l'état reprend les énonciations de l'art. 23, à recopier sur l'imprimé déposé.";

/** Les énonciations de l'art. 22 que le Modèle DC ne porte pas et qu'OmegaX ne tient pas, nommées. */
export const RESERVE_ARTICLE_22 =
  "La déclaration mensuelle unique (art. 22) porte en plus le sigle, la forme juridique, le secteur d'activités, le régime fiscal, " +
  'les renseignements complémentaires (nature, référence) et la ventilation des montants déclarés par province de provenance · ' +
  'OmegaX ne les remplit pas.';

export const RESERVE_ARTICLE_27 =
  "OmegaX ne distingue pas les sièges d'exploitation · l'état couvre le dossier entier. Une déclaration centralisée détaille les " +
  "cotisations par centre de gestion de la Caisse ou siège d'exploitation (art. 27).";

/** Art. 24 et 28 · les feuilles de paie se joignent, leur défaut vaut défaut de déclaration. */
export const RESERVE_FEUILLES_DE_PAIE =
  "Joindre une copie des feuilles de paie des travailleurs occupés (art. 24) · ne pas joindre les annexes de l'art. 25 vaut défaut de " +
  'déclaration (art. 28). La feuille « Bulletins » de l’export les recense, elle ne les remplace pas.';

/** Au-delà de vingt-cinq travailleurs, la transmission est électronique (art. 24, al. 2). */
export const SEUIL_TELEDECLARATION = 25;

export const ARTICLE_23: readonly string[] = [
  "nom ou raison sociale de l'employeur",
  "numéro d'affiliation qui lui a été attribué",
  "adresse du (des) siège (s) d'exploitation pour le (s) quel (s) la déclaration est établie",
  'période à laquelle la déclaration se rapporte',
  'montant total brut des sommes payées aux travailleurs',
  'montant total des sommes payées aux travailleurs qui sont prises en considération pour le calcul des cotisations',
  'montant total des cotisations dues',
  "nombre de travailleurs occupés au dernier jour de la période dans le siège d'exploitation auxquels la déclaration se rapporte",
  "nombre d'enfants bénéficiaires des prestations aux familles au dernier jour de la période",
  'date et mode de paiement du montant des cotisations dues',
];

/** Les quatre lignes de la CNSS que le moteur des cotisations pose (`cotisations-paie.ts`). */
export const BRANCHES_CNSS = [
  { cle: 'cnss-pf', libelle: 'Prestations aux familles', charge: 'EMPLOYEUR', article: 'décret n° 18/041, art. 2' },
  { cle: 'cnss-pension-employeur', libelle: 'Pensions, part employeur', charge: 'EMPLOYEUR', article: 'décret n° 18/041, art. 3' },
  { cle: 'cnss-pension-travailleur', libelle: 'Pensions, quote-part ouvrière', charge: 'TRAVAILLEUR', article: 'décret n° 18/041, art. 3' },
  { cle: 'cnss-rp', libelle: 'Risques professionnels', charge: 'EMPLOYEUR', article: 'décret n° 18/041, art. 4' },
] as const;

export type CleBrancheCnss = (typeof BRANCHES_CNSS)[number]['cle'];

export type BulletinDeclare = {
  readonly numero: number;
  readonly nature: 'MOIS' | 'DECOMPTE_FINAL';
  readonly nomComplet: string;
  readonly matricule: string | null;
  readonly emploi: string | null;
  readonly categorieProfessionnelle: string | null;
  readonly numeroAffiliationCnss: string | null;
  readonly totalVerseFc: number;
  readonly entree: unknown;
  readonly calcul: unknown;
};

export type IdentiteEmployeur = {
  readonly nom: string;
  readonly numeroAffiliationCnssEmployeur: string | null;
  readonly adresse: string | null;
  readonly ville: string | null;
};

export type Enonciation = {
  readonly rang: number;
  readonly libelle: string;
  /** La valeur lue · `null` quand elle manque, jamais un zéro ni un blanc deviné. */
  readonly valeur: string | number | null;
  readonly manque: string | null;
};

export type LigneBulletinDeclare = {
  readonly numero: number;
  readonly nature: 'MOIS' | 'DECOMPTE_FINAL';
  readonly nomComplet: string;
  readonly matricule: string | null;
  readonly numeroImmatriculation: string | null;
  readonly emploi: string | null;
  readonly categorieProfessionnelle: string | null;
  readonly totalVerseFc: number;
  /** La base de la CNSS figée · `null` quand le bulletin ne porte aucune ligne de la CNSS lisible. */
  readonly baseCnssFc: number | null;
  readonly parBranche: Readonly<Record<CleBrancheCnss, number>>;
  readonly enfantsBeneficiaires: number | null;
};

export type DeclarationCnss = {
  readonly mois: string;
  readonly reserve: string;
  /** Un mois sans bulletin émis · rien n'est préparé, et c'est dit. */
  readonly aucunBulletin: string | null;
  readonly enonciations: readonly Enonciation[];
  readonly branches: readonly { cle: CleBrancheCnss; libelle: string; charge: string; article: string; montantFc: number | null }[];
  readonly totalCotisationsFc: number | null;
  readonly bulletins: readonly LigneBulletinDeclare[];
  /** Bulletins illisibles, immatriculations manquantes, enfants non déclarés · chacun nommé. */
  readonly manques: readonly string[];
  readonly echeance: { readonly dateLimite: string; readonly regularisationAvant: string; readonly fondement: string };
  readonly reserves: readonly string[];
};

type Json = Record<string, unknown> | null;
const objet = (x: unknown): Json => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null);
const nombre = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const c = (n: number) => Math.round(n * 100);

export const moisLisible = (mois: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(mois);

/** Le dernier jour du mois, AAAA-MM-JJ. */
export function dernierJourDuMois(mois: string): string {
  const [a, m] = mois.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

/**
 * Art. 21 et 31 · le quinze du mois qui suit, puis cinq jours de
 * régularisation (« dans les cinq jours qui suivent le délai limite »).
 */
export function echeanceDeclaration(mois: string): { dateLimite: string; regularisationAvant: string } {
  const [a, m] = mois.split('-').map(Number);
  const limite = new Date(Date.UTC(a, m, 15));
  const regul = new Date(Date.UTC(a, m, 20));
  return { dateLimite: limite.toISOString().slice(0, 10), regularisationAvant: regul.toISOString().slice(0, 10) };
}

/** Les lignes de la CNSS d'un bulletin figé · `null` si son calcul ne se lit pas. */
export function lignesCnssDuBulletin(calcul: unknown): { cle: string; assietteFc: number; montantFc: number }[] | null {
  const cotisations = objet(objet(calcul)?.cotisations);
  const lignes = cotisations?.lignes;
  if (!Array.isArray(lignes)) return null;
  const rendues: { cle: string; assietteFc: number; montantFc: number }[] = [];
  for (const brut of lignes) {
    const l = objet(brut);
    if (!l) return null;
    if (l.organisme !== 'CNSS') continue;
    const assiette = nombre(l.assietteFc);
    const montant = nombre(l.montantFc);
    if (typeof l.cle !== 'string' || assiette === null || montant === null) return null;
    rendues.push({ cle: l.cle, assietteFc: assiette, montantFc: montant });
  }
  return rendues;
}

export function declarationCnss(params: {
  readonly mois: string;
  readonly employeur: IdentiteEmployeur;
  readonly bulletins: readonly BulletinDeclare[];
  /** Les travailleurs sous contrat au dernier jour du mois, lus au registre · `null` si non lu. */
  readonly travailleursAuDernierJour: number | null;
}): DeclarationCnss {
  const { mois, employeur, bulletins } = params;
  const manques: string[] = [];
  const echeance = echeanceDeclaration(mois);
  const reserves = [RESERVE_ARTICLE_22, RESERVE_ARTICLE_27, RESERVE_FEUILLES_DE_PAIE];

  const lignes: LigneBulletinDeclare[] = [];
  let illisible = false;
  let enfantsInconnus = false;
  for (const b of [...bulletins].sort((x, y) => x.numero - y.numero)) {
    const nom = `Bulletin n° ${b.numero} (${b.nomComplet})`;
    const cnss = lignesCnssDuBulletin(b.calcul);
    if (cnss === null) {
      illisible = true;
      manques.push(`${nom} · son calcul figé ne se lit pas · les totaux ne sont pas chiffrés, rien n'est recalculé.`);
    }
    const parBranche = Object.fromEntries(BRANCHES_CNSS.map((x) => [x.cle, 0])) as Record<CleBrancheCnss, number>;
    let base: number | null = null;
    for (const l of cnss ?? []) {
      if ((BRANCHES_CNSS as readonly { cle: string }[]).some((x) => x.cle === l.cle)) {
        parBranche[l.cle as CleBrancheCnss] = (c(parBranche[l.cle as CleBrancheCnss]) + c(l.montantFc)) / 100;
      }
      // La base est la même sur toutes les lignes de la CNSS d'un bulletin (plancher compris) · la première suffit.
      if (base === null) base = l.assietteFc;
    }
    if (cnss !== null && cnss.length === 0) {
      manques.push(`${nom} · aucune cotisation de la CNSS n'y est figée · sa base n'entre pas au total, vérifiez le bulletin.`);
    }
    const enfants = nombre(objet(b.entree)?.enfantsBeneficiairesAllocations);
    if (enfants === null) enfantsInconnus = true;
    if (!b.numeroAffiliationCnss?.trim()) {
      manques.push(`${nom} · numéro d'immatriculation du travailleur à la Caisse absent (art. 25, mention 3) · complétez la fiche au registre.`);
    }
    lignes.push({
      numero: b.numero,
      nature: b.nature,
      nomComplet: b.nomComplet,
      matricule: b.matricule,
      numeroImmatriculation: b.numeroAffiliationCnss?.trim() || null,
      emploi: b.emploi,
      categorieProfessionnelle: b.categorieProfessionnelle,
      totalVerseFc: b.totalVerseFc,
      baseCnssFc: cnss === null ? null : base,
      parBranche,
      enfantsBeneficiaires: enfants,
    });
  }

  const somme = (f: (l: LigneBulletinDeclare) => number | null): number | null => {
    if (illisible) return null;
    let t = 0;
    for (const l of lignes) {
      const v = f(l);
      if (v === null) continue;
      t += c(v);
    }
    return t / 100;
  };
  const brut = somme((l) => l.totalVerseFc);
  const base = somme((l) => l.baseCnssFc);
  const branches = BRANCHES_CNSS.map((x) => ({ ...x, montantFc: somme((l) => l.parBranche[x.cle]) }));
  const totalCotisations = illisible ? null : branches.reduce((t, x) => t + c(x.montantFc ?? 0), 0) / 100;
  const enfants = enfantsInconnus ? null : lignes.reduce((t, l) => t + (l.enfantsBeneficiaires ?? 0), 0);
  if (enfantsInconnus && lignes.length > 0) {
    const sans = lignes.filter((l) => l.enfantsBeneficiaires === null).map((l) => `n° ${l.numero}`);
    manques.push(
      `Enfants bénéficiaires des prestations aux familles non déclarés sur ${sans.length === 1 ? 'le bulletin' : 'les bulletins'} ${sans.join(', ')} · ` +
        "le nombre du point 9 n'est pas chiffré (les personnes à charge ne sont pas des enfants bénéficiaires).",
    );
  }

  const adresse = [employeur.adresse?.trim(), employeur.ville?.trim()].filter(Boolean).join(', ') || null;
  const enonciations: Enonciation[] = [
    { rang: 1, libelle: ARTICLE_23[0], valeur: employeur.nom, manque: null },
    {
      rang: 2,
      libelle: ARTICLE_23[1],
      valeur: employeur.numeroAffiliationCnssEmployeur?.trim() || null,
      manque: employeur.numeroAffiliationCnssEmployeur?.trim() ? null : "Non renseigné · saisissez-le dans Paramètres du dossier (numéro d'affiliation de l'employeur à la CNSS).",
    },
    { rang: 3, libelle: ARTICLE_23[2], valeur: adresse, manque: adresse ? null : "Adresse du dossier non renseignée · Paramètres du dossier." },
    { rang: 4, libelle: ARTICLE_23[3], valeur: mois, manque: null },
    { rang: 5, libelle: ARTICLE_23[4], valeur: brut, manque: brut === null ? 'Non chiffré · un bulletin du mois ne se lit pas.' : null },
    { rang: 6, libelle: ARTICLE_23[5], valeur: base, manque: base === null ? 'Non chiffré · un bulletin du mois ne se lit pas.' : null },
    { rang: 7, libelle: ARTICLE_23[6], valeur: totalCotisations, manque: totalCotisations === null ? 'Non chiffré · un bulletin du mois ne se lit pas.' : null },
    {
      rang: 8,
      libelle: ARTICLE_23[7],
      valeur: params.travailleursAuDernierJour,
      manque: params.travailleursAuDernierJour === null ? 'Non lu au registre.' : null,
    },
    { rang: 9, libelle: ARTICLE_23[8], valeur: enfants, manque: enfants === null ? 'Non chiffré · voir les manques.' : null },
    { rang: 10, libelle: ARTICLE_23[9], valeur: null, manque: 'Un fait du versement · à porter par le cabinet au paiement.' },
  ];

  if (lignes.length > SEUIL_TELEDECLARATION) {
    reserves.push(
      `${lignes.length} bulletins · au-delà de ${SEUIL_TELEDECLARATION} travailleurs, la déclaration et les feuilles de paie se transmettent à la Caisse par voie électronique (art. 24, al. 2).`,
    );
  }

  return {
    mois,
    reserve: RESERVE_DECLARATION_CNSS,
    aucunBulletin:
      bulletins.length === 0
        ? `Aucun bulletin émis pour ${mois} · rien n'est préparé. Si des travailleurs ont été occupés, émettez leurs bulletins ; si aucun ne l'a été, ` +
          "l'employeur en fait état dans les quinze jours sur le modèle de la Caisse (arrêté n° 146/2018, art. 26)."
        : null,
    enonciations,
    branches,
    totalCotisationsFc: totalCotisations,
    bulletins: lignes,
    manques,
    echeance: {
      ...echeance,
      fondement:
        "Arrêté n° 146/2018, art. 21 (déclaration) et 31 (versement) · « dans les quinze jours suivant le mois civil auquel elles se rapportent », " +
        'régularisation dans les cinq jours qui suivent ; le défaut entraîne une pénalité.',
    },
    reserves,
  };
}
