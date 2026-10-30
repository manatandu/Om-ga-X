import { Prisma } from '@prisma/client';

// Code Prisma d'un échec de sérialisation (conflit d'écriture concurrente).
const CODE_CONFLIT_TRANSACTION = 'P2034';
/**
 * HUIT TENTATIVES, DÉLAI CROISSANT ET LARGEMENT ALÉATOIRE (ligne k6-defauts,
 * test de charge § 4.4). À cinq tentatives espacées de 20 à 130 ms, de 0,4 à
 * 0,7 % des gestes d'écriture de vingt cabinets simultanés gardaient leur
 * 409 · des conflits de prédicat au niveau PAGE des index partagés par tous
 * les dossiers, où deux cabinets sans rapport se percutent, et se
 * repercutent quand leurs reprises repartent au même instant. Trois
 * tentatives de plus, et une part aléatoire qui croît avec la tentative,
 * dispersent les reprises · au pire, de l'ordre de deux secondes d'attente
 * cumulée avant le 409, que l'interface rejoue encore (`reprise-conflit.ts`).
 */
export const TENTATIVES_MAX = 8;
/**
 * LE 409 À BOUT DE TENTATIVES PORTE UN CODE (relecture « échecs silencieux »
 * de la ligne k6-defauts, B1 et M4). L'interface ne rejoue que le refus qui
 * porte ce code, sur les seules routes dont elle sait qu'elles tiennent dans
 * UNE transaction · elle le reconnaissait à son texte (« au même instant »),
 * qu'un 409 à effet déjà commis aurait pu porter un jour sans le vouloir.
 */
export const CODE_CONFLIT_SERIALISATION = 'CONFLIT_SERIALISATION';
export const DELAI_REPRISE_BASE_MS = 20;
export const DELAI_REPRISE_ALEATOIRE_MS = 40;

/** Délai avant la reprise qui suit la tentative n° `tentative` · croissant et aléatoire. */
export function delaiDeReprise(tentative: number, aleatoire: () => number = Math.random): number {
  return DELAI_REPRISE_BASE_MS * tentative + Math.floor(aleatoire() * DELAI_REPRISE_ALEATOIRE_MS * tentative);
}

/**
 * Un échec de sérialisation, où qu'il se loge · P2034 rendu par Prisma, ou
 * l'état SQL 40001 d'une requête brute (P2010), y compris enveloppé comme
 * cause (le maillon d'audit écrit par `$queryRaw` dans la transaction). Sans
 * cela, le conflit du maillon n'était pas rejoué et l'acte finissait en 500
 * (A5, quatrième relecture, mesuré à quatre dossiers simultanés).
 */
export function estConflitDeSerialisation(err: unknown): boolean {
  for (let e: unknown = err, n = 0; e && n < 5; e = (e as { cause?: unknown }).cause, n++) {
    // UN INTERBLOCAGE SE REJOUE COMME UN CONFLIT (relecture TypeScript de la
    // ligne k6-defauts, MAJEUR 2) · PostgreSQL annule la transaction victime
    // (40P01), et Prisma la rend en erreur INCONNUE quand la requête tuée est
    // une requête de modèle dans la transaction interactive, jamais en P2034 ·
    // une clôture ou un lettrage automatique tués par une modification
    // concurrente finissaient en 500 après tout leur travail, au lieu de repartir.
    if (e instanceof Prisma.PrismaClientUnknownRequestError && /40P01|deadlock detected/i.test(e.message)) return true;
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === CODE_CONFLIT_TRANSACTION) return true;
      // 40001 ou 40P01 sur une requête BRUTE (le verrou consultatif du
      // maillon, sa lecture brute) · rendus en P2010 avec l'état SQL en
      // `meta.code` (second tour de relecture, reproduit · la transaction
      // longue qui attendait le verrou du dossier et que PostgreSQL tuait
      // n'était pas rejouée).
      if (e.code === 'P2010' && /^(40001|40P01)$/.test(String((e.meta as { code?: unknown } | undefined)?.code ?? ''))) return true;
    }
  }
  return false;
}

/**
 * LE DOUBLON DU CODE D'UN LETTRAGE SUR SON COMPTE (`@@unique([compteId, code])`)
 * EST UN CONFLIT, JAMAIS UNE DONNÉE FAUSSE (relecture de la ligne
 * lettrage-verrou, 2026-10-29, M1). Une transaction qui lit la lettre suivante
 * sur une image ancienne (clôture, module qui lettre dans sa propre
 * transaction) heurte le code qu'un lettrage, validé entre-temps sous le
 * verrou du dossier, vient de poser · la reprise relit le code suivant. Aucune
 * autre unicité de la table (le groupe reconduit, `lettrageReconduitId`), ni
 * `[compteId, code]` d'une autre table · un doublon de donnée ne se déguise pas
 * en concurrence.
 */
export function estDoublonDeCodeDeLettrage(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return false;
  const meta = err.meta as { modelName?: unknown; target?: unknown } | undefined;
  const cible = meta?.target;
  if (Array.isArray(cible)) return meta?.modelName === 'Lettrage' && cible.length === 2 && cible.includes('compteId') && cible.includes('code');
  return cible === 'lettrages_compteId_code_key';
}

/*
 * LA TRANSACTION SÉRIALISABLE EST RETIRÉE (ligne saisie-suites, point 2,
 * 2026-10-30). `avecRetrySerialisable` portait la numérotation des pièces, le
 * lettrage, la saisie, la clôture, les à-nouveaux provisoires, la dissolution
 * et le rapprochement · tous ont quitté l'isolation sérialisable pour le
 * verrou du dossier (`common/transaction-de-saisie.ts`,
 * `lettrage/transaction-sous-verrou-du-dossier.ts`), dont les conflits ne
 * venaient plus des pages d'index partagées par tous les cabinets. Restent ici
 * ce que ces portes lisent · la reconnaissance d'un conflit, le délai de
 * reprise et celui d'une transaction qui croît avec le volume.
 */

/**
 * LE DÉLAI D'UNE TRANSACTION DONT LE TRAVAIL CROÎT AVEC LE VOLUME (audit final
 * F2). Le défaut de Prisma, cinq secondes, est celui d'un geste unitaire ; un
 * lettrage automatique de deux mille groupes ou la fusion d'un compte chargé
 * le dépassaient, et l'opération échouait entière. Le délai croît avec le
 * nombre d'opérations annoncé, plafonné sous la limite de requête de Cloud Run
 * (300 s) · au-delà, la réponse partirait de toute façon sans le résultat.
 * Convention d'OmegaX : dix secondes de base, et cinquante millisecondes par
 * opération, soit plusieurs allers-retours de marge chacune.
 */
export const DELAI_BASE_MS = 10_000;
export const DELAI_PAR_OPERATION_MS = 50;
export const DELAI_MAX_MS = 240_000;

export function delaiSelonVolume(operations: number): number {
  return Math.min(DELAI_MAX_MS, DELAI_BASE_MS + Math.max(0, operations) * DELAI_PAR_OPERATION_MS);
}
