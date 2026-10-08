/**
 * LE RÉSULTAT DE L'EXERCICE, LU UNE FOIS POUR TOUT LE LOGICIEL.
 *
 * Jusqu'au 2026-09-27, cinq modules le lisaient chacun à sa façon : tout le
 * 13 (états SYCEBNL, Système minimal SYSCOHADA, consolidation), 131 à 139
 * (états SYSCOHADA), 131 et 139 seulement (résultat fiscal). Sur une même
 * balance, l'impôt et le bilan pouvaient donc partir de deux résultats
 * différents, sans qu'aucun total ne cesse de boucler (audit du serveur, I5).
 *
 * LA RÈGLE · 131 À 139, ET JAMAIS LE 130.
 *
 *  · AUDCIF Titre VII, COMPTE 13 : le compte est crédité de la classe 7 et
 *    débité de la classe 6 « à la clôture de l'exercice […] pour solde ».
 *    Titre VIII ch. 19 § 2.4 : il « peut être obtenu par virement successif
 *    des charges et des produits afférents aux soldes intermédiaires », et
 *    « chacun des soldes visés est obtenu par virement du solde
 *    intermédiaire précédent (solde du compte 132 Marge commerciale viré au
 *    compte 133 Valeur ajoutée, par exemple) ». Chaque virement est une
 *    écriture équilibrée À L'INTÉRIEUR du 13 · la somme 131 + 132 + … + 139
 *    vaut donc le résultat, que la cascade soit achevée ou non. Lire le 131
 *    et le 139 seuls rendrait zéro sur une cascade arrêtée au 137.
 *  · Même fiche : « À la réouverture des comptes de l'exercice suivant, les
 *    entités ont la possibilité d'utiliser un compte spécial "Résultat en
 *    instance d'affectation" (130) ». Le 130 porte le résultat de
 *    l'exercice PRÉCÉDENT · le compter ici présenterait le résultat N-1
 *    comme résultat N, et ferait payer l'impôt deux fois sur le même
 *    bénéfice. Au 31 décembre il doit être soldé (« en fin d'exercice, le
 *    résultat de l'exercice précédent non affecté […] est viré au compte de
 *    report à nouveau ») · un résidu est une erreur d'inventaire, signalée
 *    comme compte sans poste, jamais fondue dans le résultat.
 *
 * Le plan SYCEBNL n'ouvre que 131 et 139 sous son 13 · la règle y rend
 * exactement ce que « tout le 13 » rendait, et elle vaut des deux côtés.
 */
export const COMPTES_RESULTAT_DE_L_EXERCICE = ['131', '132', '133', '134', '135', '136', '137', '138', '139'] as const;

/** Le compte porte-t-il le résultat de l'exercice en cours (131 à 139) ? */
export function estCompteDuResultatDeLExercice(numero: string): boolean {
  return COMPTES_RESULTAT_DE_L_EXERCICE.some((p) => numero.startsWith(p));
}

/** Le 130 · résultat de l'exercice PRÉCÉDENT, en instance d'affectation. */
export function estResultatEnInstanceDAffectation(numero: string): boolean {
  return numero.startsWith('130');
}

/**
 * LE RÉSULTAT AU BILAN · LE COMPTE 13 ET LES CLASSES 6 À 8, ADDITIONNÉS
 * (passe V1, constat B1, 2026-10-08, tranché par le texte).
 *
 * Le poste « Résultat net de l'exercice » (CH des associations, CC des
 * projets, HB du SMT SYCEBNL, CJ et SP2 du SYSCOHADA) lit le COMPTE 13 ·
 * correspondance des postes, « 13 (131 ou 139) » (SYCEBNL, Partie 4 ch. 2 et
 * ch. 3 ; AUDCIF, Titre IX ch. 7). Deux résultats peuvent s'y trouver à la
 * fois, et aucun n'est le double de l'autre.
 *
 *  · Le résultat de l'exercice PRÉCÉDENT non encore affecté. « L'affectation
 *    du résultat d'un exercice est décidée par les organes compétents au
 *    cours de l'exercice suivant ; le compte 13 est donc soldé lors de la
 *    comptabilisation de cette affectation. En fin d'exercice, le résultat
 *    de l'exercice précédent non affecté [...] est viré au compte de report
 *    à nouveau » (AUDCIF, Titre VII, compte 13 ; SYCEBNL, Partie 2 ch. 3,
 *    compte 13, même règle). Entre la réouverture et l'assemblée, il est au
 *    13, jamais au 12 · le lire au report à nouveau anticiperait un virement
 *    que le texte place en FIN d'exercice (`virement-resultat-non-affecte.ts`).
 *  · Le résultat EN COURS, qui vit dans les classes 6 à 8 tant que l'écriture
 *    qui solde les comptes de gestion n'est pas passée · « le compte 13 est
 *    crédité, à la clôture de l'exercice, par le débit des comptes de la
 *    classe 7 [...] » (même fiche, Fonctionnement). Il appartient au même
 *    poste, puisque la clôture l'y portera.
 *
 * Aucun double compte · avant cette écriture, le 13 ne porte jamais le
 * résultat de l'exercice en cours (il ne s'y porte qu'après) ; après elle,
 * les classes 6 à 8 sont soldées. La somme est la seule lecture qui garde le
 * bilan équilibré dans les deux cas, et dans la situation avant l'assemblée
 * (bilan de N+1 lu avec le résultat de N encore au 13). La lecture « l'une
 * OU l'autre source » qu'elle remplace perdait le résultat de N dès qu'une
 * opération de N+1 était passée (écart de 1 164 000 et de 15 288 000 au banc
 * de la passe V1).
 *
 * Les deux montants sont au sens du passif (crédit moins débit).
 */
export function resultatAuBilan(resultatClasses678: number, resultatCompte13: number): number {
  return resultatClasses678 + resultatCompte13;
}

/**
 * OÙ EST LE RÉSULTAT DE L'EXERCICE · LA RÈGLE DE LA FISCALITÉ, UNE FOIS
 * POUR LE LOGICIEL (relecture de la passe V1, 2026-10-08, MAJEUR).
 *
 * `FiscaliteService.lireBalance` l'a posée au troisième tour (cas chiffré
 * V3) et l'appelle d'ici. Deux règles, chacune sur ce que la balance montre.
 *  (1) Une gestion qui porte un solde sur un seul de ses comptes N'EST PAS
 *      soldée · son net, même nul, est le résultat de l'exercice (AUDCIF
 *      Titre VII, compte 13, le 13 n'est mouvementé « qu'à la clôture […]
 *      pour solde »).
 *  (2) Un 13 qui ne porte que l'à-nouveau (aucun mouvement propre ni clôture
 *      de l'exercice) tient le résultat d'exercices ANTÉRIEURS · le résultat
 *      de l'exercice est celui des classes 6 à 8, nul s'il n'y a pas de
 *      gestion.
 * Hors de ces deux cas (gestion soldée et 13 mouvementé dans l'exercice), le
 * 13 porte le résultat de l'exercice. La lecture « classes 6 à 8 non nulles,
 * sinon le 13 », qu'elle remplace ici, prenait pour résultat de l'exercice la
 * perte antérieure restée au 13 dès que ventes et achats s'équilibraient
 * (1 000 000 contre 1 000 000, 13 à -300 000 · -300 000 « de l'exercice »,
 * écarts fabriqués aux contrôles du SMT et des liasses).
 */
export function resultatDeLExerciceAuxClassesDeGestion(gestionNonSoldee: boolean, mouvementPropre13: boolean): boolean {
  return gestionNonSoldee || !mouvementPropre13;
}

/** Les champs d'une ligne de balance que la règle lit · solde (débit moins crédit, colonne de clôture retirée) et mouvements propres de l'exercice. */
export interface LigneLueParLaRegleDuResultat {
  solde: number;
  mouvementDebit: number;
  mouvementCredit: number;
}

/** Le poste du résultat partagé entre l'exercice et le résultat antérieur que le 13 porte encore. */
export interface PartsDuResultatAuBilan {
  /** La part que le compte de résultat doit rendre (contrôles de concordance du compte de résultat et des liasses). */
  resultatDeLExercice: number;
  /** Le résultat de l'exercice PRÉCÉDENT que le poste porte encore faute d'affectation · zéro après elle ou après le virement de clôture. */
  resultatAnterieurNonAffecte: number;
}

const EPSILON_RESULTAT = 0.005;

/**
 * LES DEUX PARTS DU POSTE, lues sur les lignes de la balance des états (avant
 * l'écriture qui solde les comptes de gestion). `resultatClasses678` et
 * `resultatCompte13` sont ceux du poste, au sens du passif · les parts
 * s'additionnent exactement en `resultatAuBilan`. Comparer le compte de
 * résultat au poste entier fabriquerait, avant l'assemblée, un écart que rien
 * n'explique (CLAUDE.md § 10 bis).
 */
export function partsDuResultatAuBilan(
  resultatClasses678: number,
  resultatCompte13: number,
  lignes678: readonly Pick<LigneLueParLaRegleDuResultat, 'solde'>[],
  lignes13: readonly Pick<LigneLueParLaRegleDuResultat, 'mouvementDebit' | 'mouvementCredit'>[],
): PartsDuResultatAuBilan {
  const gestionNonSoldee = lignes678.some((l) => Math.abs(l.solde) > EPSILON_RESULTAT);
  const mouvementPropre13 = lignes13.some(
    (l) => Math.abs(l.mouvementDebit) > EPSILON_RESULTAT || Math.abs(l.mouvementCredit) > EPSILON_RESULTAT,
  );
  if (resultatDeLExerciceAuxClassesDeGestion(gestionNonSoldee, mouvementPropre13)) {
    return { resultatDeLExercice: resultatClasses678, resultatAnterieurNonAffecte: resultatCompte13 };
  }
  return { resultatDeLExercice: resultatAuBilan(resultatClasses678, resultatCompte13), resultatAnterieurNonAffecte: 0 };
}

/**
 * UN EXERCICE CLÔTURÉ QUI PORTE ENCORE LE RÉSULTAT PRÉCÉDENT NON AFFECTÉ SE
 * DIT (relecture de la passe V1, 2026-10-08, BLOQUANT).
 *
 * « En fin d'exercice, le résultat de l'exercice précédent non affecté [...]
 * est viré au compte de report à nouveau » (AUDCIF, Titre VII, compte 13 ;
 * SYCEBNL, Partie 2 ch. 3, compte 13). La clôture d'OmegaX le fait depuis le
 * 2026-10-08 (`virement-resultat-non-affecte.ts`) ; un exercice clôturé AVANT
 * garde ce résultat au 13, aucune migration ne retouchant l'existant (AUDCIF
 * art. 22, 2°, une écriture validée ne se modifie pas). Le poste l'additionne
 * au résultat de l'exercice (`resultatAuBilan`) · le bilan s'équilibre, mais
 * il présente deux résultats sous l'intitulé « Résultat net de l'exercice »,
 * et la colonne N-1 de l'exercice suivant en hérite. Rien n'est corrigé
 * d'office · le montant est NOMMÉ (bilan, écran, liasse), et le contrôle de
 * la liasse qui compare le compte de résultat au poste le laisse en écart
 * (`resultatDeLExerciceLogeAuBilan`). Sur un exercice OUVERT, le même
 * montant est la situation légitime d'avant l'assemblée · rien n'est dit.
 */
export interface ResultatAnterieurNonVire {
  /** Au sens du passif (crédit moins débit) · négatif pour une perte. */
  montant: number;
  /** Le poste du bilan qui le présente (CH, CC, HB, CJ, SP2). */
  poste: string;
  /** Le texte qui dit le montant, le poste, la règle et l'issue. */
  motif: string;
}

const MONTANT_FR = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function resultatAnterieurNonVire(
  exerciceCloture: boolean,
  resultatAnterieurNonAffecte: number,
  poste: string,
  referentiel: 'SYSCOHADA' | 'SYCEBNL',
): ResultatAnterieurNonVire | null {
  if (!exerciceCloture || Math.abs(resultatAnterieurNonAffecte) <= EPSILON_RESULTAT) return null;
  const montant = Math.round(resultatAnterieurNonAffecte * 100) / 100;
  const fiche = referentiel === 'SYCEBNL' ? 'SYCEBNL, Partie 2 ch. 3, compte 13' : 'AUDCIF, Titre VII, compte 13';
  // Le mot de chaque plan · déficit et excédent au SYCEBNL, perte et bénéfice au SYSCOHADA.
  const sens =
    referentiel === 'SYCEBNL' ? (montant < 0 ? 'un déficit' : 'un excédent') : montant < 0 ? 'une perte' : 'un bénéfice';
  return {
    montant,
    poste,
    motif:
      `Exercice clôturé sans le virement du résultat de l'exercice précédent non affecté · ${sens} de ` +
      `${MONTANT_FR.format(Math.abs(montant))} reste au compte 13, et le poste ${poste} l'additionne au résultat de l'exercice, ` +
      `alors que ce résultat antérieur est viré au report à nouveau en fin d'exercice (${fiche}). Rien n'est corrigé d'office · ` +
      "l'exercice suivant le reprend au compte 13 à l'ouverture, et sa clôture le vire au report à nouveau si l'affectation ne l'a pas soldé avant.",
  };
}
