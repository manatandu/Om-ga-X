/**
 * REPRISE AUTOMATIQUE D'UN CONFLIT DE SÉRIALISATION (ligne k6-defauts, test
 * de charge § 4.4).
 *
 * Le serveur rejoue lui-même une transaction sérialisable qui se heurte à
 * une autre (`avecRetrySerialisable`), puis, à bout de tentatives, rend un
 * 409 dont le message dit « au même instant · veuillez réessayer ». Ce 409
 * ne laisse RIEN d'écrit · la transaction entière a été annulée. Jusqu'ici
 * l'interface le montrait tel quel, et c'était à la personne de recommencer ·
 * à vingt cabinets simultanés, 0,4 à 0,7 % des gestes d'écriture le
 * recevaient, et un lettrage refusé laissait des lignes ouvertes. L'interface
 * rejoue donc le même appel, deux fois au plus, après un délai aléatoire ·
 * aléatoire, pour que deux reprises reparties ensemble ne se percutent pas à
 * nouveau. Seul CE conflit se rejoue · un autre 409 (un doublon, un geste en
 * cours) dit une situation qui ne changera pas en attendant.
 */
export const REPRISES_MAX = 2;
const DELAI_BASE_MS = 300;
const DELAI_ALEATOIRE_MS = 700;

/** Le 409 que le serveur rend à bout de tentatives, et lui seul. */
export function estConflitAReprendre(status: number, message: string): boolean {
  return status === 409 && /au même instant/.test(message);
}

/** Délai avant la reprise n° `tentative` (1, puis 2) · croissant et aléatoire. */
export function delaiDeReprise(tentative: number, aleatoire: () => number = Math.random): number {
  return DELAI_BASE_MS * tentative + Math.floor(aleatoire() * DELAI_ALEATOIRE_MS * tentative);
}
