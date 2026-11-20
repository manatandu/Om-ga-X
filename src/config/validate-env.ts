/**
 * Validation du démarrage · pas une simple lecture avec repli silencieux.
 *
 * Trouvé lors de l'audit de la brique Export Excel (2026-08-28) :
 * `jwt.strategy.ts` repliait `JWT_SECRET` sur la valeur littérale
 * `'change-me'` si la variable d'environnement était absente. Le côté
 * signature (`auth.module.ts`) ne le fait PAS · sans `JWT_SECRET`, signer un
 * jeton échoue déjà. Mais le côté VÉRIFICATION acceptait silencieusement
 * n'importe quel jeton signé avec cette chaîne bien connue, publiée dans ce
 * dépôt (`.env.example`). En production, sans cette variable positionnée,
 * n'importe qui aurait pu forger un jeton valide pour N'IMPORTE QUEL
 * tenant · ce qui aurait annulé toutes les garanties d'étanchéité
 * multi-tenant (chaque requête filtre bien par `tenantId`, encore faut-il
 * que ce `tenantId` vienne d'un jeton authentique).
 *
 * Corrigé en refusant de démarrer plutôt qu'en repliant sur une valeur
 * connue : une vérification insuffisante doit échouer bruyamment au
 * déploiement, jamais silencieusement en production.
 */
/**
 * LA RÈGLE DU SECRET DE SESSION, UNE SEULE (audit de sécurité du 2026-11-19,
 * constat `omegax-auth-secret-jwt-faible-seulement-averti`). Elle sert le
 * démarrage du serveur ci-dessous ET l'étape « Contrôle du secret de session »
 * de `deploy-cloud-run.yml`, qui la recopie mot pour mot (le spec le tient) ·
 * un secret faible doit arrêter le DÉPLOIEMENT avec un message clair, avant
 * qu'un conteneur ne refuse de démarrer.
 *
 * Absent, connu (`.env.example`, valeurs de développement publiées dans ce
 * dépôt) ou de moins de 32 caractères · quiconque le devine signe un jeton de
 * session pour n'importe quel utilisateur de n'importe quel dossier, et toute
 * l'étanchéité entre cabinets tombe avec lui.
 */
export const VALEURS_CONNUES_JWT_SECRET: readonly string[] = ['change-me', 'dev-secret-change-me'];
export const LONGUEUR_MINIMALE_JWT_SECRET = 32;

/** Le motif du refus, jamais la valeur ni sa longueur · `null` si le secret convient. */
export function motifSecretFaible(secret: unknown): string | null {
  if (typeof secret !== 'string' || secret.trim().length === 0) return 'absent';
  if (VALEURS_CONNUES_JWT_SECRET.includes(secret)) return 'valeur de développement connue';
  if (secret.length < LONGUEUR_MINIMALE_JWT_SECRET) return `moins de ${LONGUEUR_MINIMALE_JWT_SECRET} caractères`;
  return null;
}

export const MOTIF_SECRET_FAIBLE_EN_PRODUCTION =
  `JWT_SECRET refusé en production · il ne doit valoir ni ${VALEURS_CONNUES_JWT_SECRET.join(' ni ')}, ` +
  `ni compter moins de ${LONGUEUR_MINIMALE_JWT_SECRET} caractères (validate-env.ts). Générez une valeur aléatoire ` +
  '(par exemple `openssl rand -base64 48`), posez-la dans la variable de déploiement, puis relancez · ' +
  'toutes les sessions ouvertes seront fermées une fois.';

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const secret = config.JWT_SECRET;

  if (typeof secret !== 'string' || secret.trim().length === 0) {
    throw new Error(
      "JWT_SECRET est obligatoire et doit être défini dans l'environnement (.env en local, " +
        'variable de déploiement en production) · aucun repli silencieux, voir validate-env.ts.',
    );
  }

  // EN PRODUCTION, UN REFUS (audit de sécurité du 2026-11-19). Jusque-là un
  // simple avertissement · une valeur faible arrivée en production n'aurait
  // rien empêché. Le message nomme la règle, JAMAIS la valeur ni sa longueur.
  // Hors production (local, tests), l'avertissement reste · les specs et les
  // postes de développement démarrent avec des valeurs jetables.
  const motif = motifSecretFaible(secret);
  if (motif !== null) {
    if (config.NODE_ENV === 'production') {
      throw new Error(`${MOTIF_SECRET_FAIBLE_EN_PRODUCTION} (motif · ${motif})`);
    }
    // eslint-disable-next-line no-console
    console.warn(
      'JWT_SECRET utilise une valeur de développement ou trop courte (< 32 caractères). ' +
        'Refusée en production (NODE_ENV=production) · générez une valeur aléatoire dédiée par environnement.',
    );
  }

  return config;
}
