/**
 * REPRISE AUTOMATIQUE D'UN CONFLIT DE SÉRIALISATION (ligne k6-defauts, test
 * de charge § 4.4).
 *
 * Le serveur rejoue lui-même une transaction sérialisable qui se heurte à
 * une autre (`avecRetrySerialisable`), puis, à bout de tentatives, rend un
 * 409 au code `CONFLIT_SERIALISATION` · ce 409 ne laisse RIEN d'écrit par
 * cette transaction, annulée entière. Jusqu'ici l'interface le montrait tel
 * quel, et c'était à la personne de recommencer · à vingt cabinets
 * simultanés, 0,4 à 0,7 % des gestes d'écriture le recevaient, et un lettrage
 * refusé laissait des lignes ouvertes. L'interface rejoue donc le même appel,
 * deux fois au plus, après un délai aléatoire · aléatoire, pour que deux
 * reprises reparties ensemble ne se percutent pas à nouveau. Même traitement
 * pour le 409 `DOSSIER_OCCUPE` (verrou du dossier tenu par une opération longue,
 * transaction annulée) et le 503 `SERVEUR_SATURE` (pool épuisé, rien n'a commencé).
 *
 * SEULEMENT SUR DEMANDE DE L'APPEL (relecture « échecs silencieux », B1).
 * Le 409 garantit que SA transaction n'a rien écrit, pas que la REQUÊTE n'a
 * rien écrit · le règlement des tiers crée une pièce par tiers, chacune dans
 * sa transaction commise ; un 409 sur le second tiers rejoué entier aurait
 * payé le premier deux fois, écriture équilibrée, balance bouclée, sans un
 * mot. Un écran ne pose `rejouerConflit` que sur une route qui tient dans
 * UNE transaction (saisie, modification et correction d'une écriture,
 * lettrage manuel) · `reprise-conflit.spec.ts` tient la liste fermée de ces
 * appels, et interdit la reprise sur les règlements.
 *
 * LE CODE, JAMAIS LE TEXTE (M4) · un 409 reconnu à « au même instant » aurait
 * été rejoué le jour où un refus à effet déjà commis aurait porté ces mots.
 */
export const REPRISES_MAX = 2;
const DELAI_BASE_MS = 300;
const DELAI_ALEATOIRE_MS = 700;

/** Les codes que le serveur pose sur un refus qui n'a rien écrit · liste fermée, en miroir du serveur. */
export const CODES_A_REPRENDRE: ReadonlyArray<string> = ['CONFLIT_SERIALISATION', 'DOSSIER_OCCUPE', 'SERVEUR_SATURE'];

/** Le refus que le serveur rend sans avoir rien écrit, et lui seul · reconnu à son CODE. */
export function estConflitAReprendre(status: number, code: string | null): boolean {
  return (status === 409 || status === 503) && code !== null && CODES_A_REPRENDRE.includes(code);
}

/** Délai avant la reprise n° `tentative` (1, puis 2) · croissant et aléatoire. */
export function delaiDeReprise(tentative: number, aleatoire: () => number = Math.random): number {
  return DELAI_BASE_MS * tentative + Math.floor(aleatoire() * DELAI_ALEATOIRE_MS * tentative);
}
