import { createHmac, timingSafeEqual } from 'crypto';
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { horsCloisonnement } from '../../common/cloisonnement/contexte-cloisonnement';
import { normaliserCourriel } from '../../common/courriel';

/**
 * LA LIMITE D'ESSAIS NE DÉPEND PLUS DE LA SEULE ADRESSE IP (audit de sécurité
 * du 2026-11-19, constat `omegax-auth-limitation-debit-contournable`).
 *
 * `@Throttle` compte par `requete.ip`, en mémoire, instance par instance. En
 * ligne, deux relais sont de confiance (Firebase Hosting, puis Cloud Run,
 * `sauts-de-confiance.ts`) · un appel DIRECT à `*.run.app` n'en traverse
 * qu'un, et l'adresse lue devient celle que le client écrit dans
 * `X-Forwarded-For`. Fermer cet accès direct est une affaire
 * d'infrastructure (essayée le 2026-10-29 et retirée, elle coupait le relais
 * du site, `essai-ingress-cloud-run.yml`) · c'est la limite qui reste écrite
 * au suivi. Celle-ci tient dans le code.
 *
 * ELLE COMPTE PAR ADRESSE E-MAIL VISÉE, EN BASE · partagée entre toutes les
 * instances, aux mêmes conditions pour une adresse inconnue (la ligne n'a pas
 * de dossier) · une adresse qui existe ne se distingue donc pas d'une autre.
 * Fenêtre GLISSANTE · les instants des derniers essais, au plus la limite plus
 * un, sont gardés, et un essai compte tant qu'il a moins de dix minutes.
 *
 * AU-DELÀ DE LA LIMITE, LE BON MOT DE PASSE PASSE ENCORE (relecture du
 * 2026-11-20, décision C). La limite enfermait le titulaire sans issue sur un
 * appareil jamais reconnu · un tiers qui envoyait dix essais toutes les dix
 * minutes, depuis des adresses IP variées, tenait l'adresse freinée. bcrypt
 * tourne donc toujours (empreinte factice pour une adresse inconnue), et
 * seul le refus change · mot de passe FAUX, 429, et l'échec compte au
 * compteur du compte ; mot de passe JUSTE d'un compte ouvert, la connexion
 * suit son cours (second facteur compris) ; mot de passe JUSTE d'un compte
 * FERMÉ, le même 429 que le faux, mot pour mot (sans quoi la limite
 * redeviendrait l'oracle que le verrou ferme), et le lien de déverrouillage
 * part après la réponse.
 *
 * LA VRAIE BORNE DE LA FORCE BRUTE EST LE VERROU DU COMPTE · cinq échecs, puis
 * des paliers de 1, 5, 15, 30 et 60 minutes, oubliés douze heures après le
 * dernier échec (`verrouillage.ts`) · une trentaine d'essais par jour et par
 * compte, plus strict que les dix essais par dix minutes de cette limite. Ce
 * que la limite par adresse garde · elle double la limite par IP que l'accès
 * direct à `*.run.app` contourne, et elle répond de la même façon à une
 * adresse connue et à une inconnue (une adresse inconnue n'a pas de verrou,
 * elle a la limite).
 *
 * UN COMPTE À DOUBLE AUTHENTIFICATION NE CONSOMME QU'UN ESSAI PAR CONNEXION ·
 * le premier appel (mot de passe seul) compte, l'appel qui porte le code au
 * BON mot de passe relit la fenêtre sans la remplir. Un code joint à un mot
 * de passe faux compte, sans quoi joindre un code au hasard dispenserait de
 * la limite.
 *
 * L'APPAREIL RECONNU N'EST PAS FREINÉ. L'appareil où la personne s'est déjà
 * connectée garde un JETON D'APPAREIL (signé par le serveur, lié au compte,
 * quatre-vingt-dix jours), que l'écran renvoie avec la connexion · il passe
 * cette limite, jamais le verrou du compte, ni le second facteur, ni la
 * limite par IP. Un jeton émis avant la dernière révocation des sessions du
 * compte (mot de passe changé, « Déconnecter mes autres appareils ») ne vaut
 * plus. C'est la défense que l'OWASP décrit sous le nom de « device cookie » ;
 * elle voyage dans le corps et non dans un témoin, Firebase Hosting retirant
 * des requêtes relayées tout témoin autre que `__session`. Depuis la décision
 * C, ce n'est plus la seule issue du titulaire.
 *
 * LA TABLE EST BORNÉE ET PURGÉE · une ligne par adresse essayée dans la
 * fenêtre, au plus onze instants par ligne, et ce qui est plus vieux que la
 * fenêtre est effacé au plus toutes les dix minutes par instance.
 */
export const LIMITE_ESSAIS_PAR_ADRESSE = 10;
export const FENETRE_ESSAIS_PAR_ADRESSE_MINUTES = 10;
export const JOURS_JETON_APPAREIL = 90;

/**
 * Le 429 ne promet aucune durée (relecture du 2026-11-20, C4) · la fenêtre
 * glisse, et un tiers qui continue la tient remplie. Il dit ce qui reste vrai
 * pour toute adresse · le bon mot de passe ouvre une session même ici, sauf
 * compte fermé, et un compte fermé a ses deux issues.
 */
export const MOTIF_TROP_D_ESSAIS_SUR_L_ADRESSE =
  'Connexion refusée · trop d’essais sur cette adresse ces dernières minutes. Vérifiez votre mot de passe · le bon mot de passe ' +
  'ouvre la session même ici, sauf si le compte est fermé après plusieurs essais manqués ; il se rouvre alors par le lien de ' +
  'déverrouillage reçu par courriel, ou par l’administrateur du dossier.';

/**
 * Le secret de session · `validate-env.ts` en garantit la présence au
 * démarrage. Absent ici, c'est un serveur mal monté · une clé vide signerait
 * des empreintes et des jetons d'appareil que tout le monde sait refaire.
 */
export function secretDeSession(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET absent · ni empreinte d’adresse ni jeton d’appareil ne se calculent sans lui.');
  return secret;
}

/** La clé des deux empreintes, dérivée du secret de session · jamais le secret lui-même. */
function cle(usage: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(`omegax:${usage}`).digest();
}

/** L'adresse ne se garde jamais en clair · un HMAC, que nul ne renverse sans le secret. */
export function empreinteAdresse(adresseNormalisee: string, secret: string): string {
  return createHmac('sha256', cle('limite-par-adresse', secret)).update(adresseNormalisee, 'utf8').digest('hex');
}

/**
 * Compte un essai sur l'adresse et rend le nombre d'essais dans la fenêtre,
 * celui-ci compris. UNE requête, atomique · `ON CONFLICT DO UPDATE` verrouille
 * la ligne, et des essais simultanés ne repartent pas du même état.
 */
export async function compterEssaiSurLAdresse(
  client: { $queryRaw: <T>(requete: Prisma.Sql) => Promise<T> },
  empreinte: string,
  maintenant: Date,
): Promise<number> {
  const debut = new Date(maintenant.getTime() - FENETRE_ESSAIS_PAR_ADRESSE_MINUTES * 60_000);
  const lignes = await client.$queryRaw<{ n: number }[]>(Prisma.sql`
    INSERT INTO "essais_connexion_adresse" ("empreinte", "instants", "majLe")
    VALUES (${empreinte}, ARRAY[${maintenant}::timestamp(3)], ${maintenant}::timestamp(3))
    ON CONFLICT ("empreinte") DO UPDATE SET
      "instants" = (
        SELECT COALESCE(array_agg(x ORDER BY x), ARRAY[]::timestamp(3)[]) FROM (
          SELECT x FROM unnest(COALESCE("essais_connexion_adresse"."instants", ARRAY[]::timestamp(3)[]) || ${maintenant}::timestamp(3)) AS x
          WHERE x > ${debut}::timestamp(3)
          ORDER BY x DESC
          LIMIT ${LIMITE_ESSAIS_PAR_ADRESSE + 1}
        ) AS recents
      ),
      "majLe" = ${maintenant}::timestamp(3)
    RETURNING COALESCE(cardinality("instants"), 0)::int AS n`);
  return lignes[0]?.n ?? 1;
}

/**
 * Le nombre d'essais dans la fenêtre, SANS en ajouter un · l'appel qui porte
 * le code d'une double authentification au bon mot de passe (un seul essai
 * par connexion). Une adresse jamais essayée en compte zéro.
 */
export async function lireEssaisSurLAdresse(
  client: { $queryRaw: <T>(requete: Prisma.Sql) => Promise<T> },
  empreinte: string,
  maintenant: Date,
): Promise<number> {
  const debut = new Date(maintenant.getTime() - FENETRE_ESSAIS_PAR_ADRESSE_MINUTES * 60_000);
  const lignes = await client.$queryRaw<{ n: number }[]>(Prisma.sql`
    SELECT COALESCE((SELECT count(*) FROM unnest("instants") AS x WHERE x > ${debut}::timestamp(3)), 0)::int AS n
    FROM "essais_connexion_adresse" WHERE "empreinte" = ${empreinte}`);
  return lignes[0]?.n ?? 0;
}

/** Ce qui est plus vieux que la fenêtre ne compte plus · effacé. */
export function purgerLesEssaisEchus(client: { $executeRaw: (requete: Prisma.Sql) => Promise<number> }, maintenant: Date): Promise<number> {
  const debut = new Date(maintenant.getTime() - FENETRE_ESSAIS_PAR_ADRESSE_MINUTES * 60_000);
  return client.$executeRaw(Prisma.sql`DELETE FROM "essais_connexion_adresse" WHERE "majLe" <= ${debut}::timestamp(3)`);
}

/** Le déverrouillage repart d'une fenêtre vide. */
export function oublierLesEssaisDeLAdresse(client: { $executeRaw: (requete: Prisma.Sql) => Promise<number> }, empreinte: string): Promise<number> {
  return client.$executeRaw(Prisma.sql`DELETE FROM "essais_connexion_adresse" WHERE "empreinte" = ${empreinte}`);
}

/**
 * LA FENÊTRE DE L'ADRESSE SE VIDE quand le compte est rouvert par quelqu'un
 * qui en répond · le titulaire par son lien, l'administrateur qui déverrouille
 * ou réinitialise, l'opérateur qui réinitialise (relecture du 2026-11-20, C2).
 * Le compte EST rouvert · un échec ici ne doit pas rendre une erreur qui
 * dirait le contraire. La fenêtre s'efface d'elle-même en dix minutes, et
 * l'échec est consigné, avec l'identifiant du compte, jamais l'adresse.
 */
export async function viderLaFenetreDeLAdresse(
  client: { $executeRaw: (requete: Prisma.Sql) => Promise<number> },
  adresse: string | null | undefined,
  compteId: string,
  journal: Logger,
): Promise<void> {
  if (!adresse) return;
  try {
    await horsCloisonnement('connexion · la limite par adresse repart à zéro, compte rouvert', () =>
      oublierLesEssaisDeLAdresse(client, empreinteAdresse(normaliserCourriel(adresse), secretDeSession())),
    );
  } catch (e) {
    journal.warn(`Compte rouvert, limite par adresse non remise à zéro (${compteId}) · ${(e as Error)?.name ?? 'erreur'}`);
  }
}

export function auDelaDeLaLimite(essaisDansLaFenetre: number): boolean {
  return essaisDansLaFenetre > LIMITE_ESSAIS_PAR_ADRESSE;
}

// ── LE JETON D'APPAREIL ──────────────────────────────────────────────────

/**
 * `<compte>.<émis, en secondes>.<HMAC>` · ni un jeton de session (autre clé,
 * autre forme, jamais lu par `JwtStrategy`), ni une preuve d'identité · il
 * n'ouvre RIEN, il dispense seulement de la limite par adresse.
 */
export function jetonAppareil(compteId: string, secret: string, maintenant: Date): string {
  const charge = `${compteId}.${Math.floor(maintenant.getTime() / 1000)}`;
  const signature = createHmac('sha256', cle('appareil-reconnu', secret)).update(charge, 'utf8').digest('base64url');
  return `${charge}.${signature}`;
}

/**
 * Vrai si le jeton a été émis par ce serveur pour CE compte, il y a moins de
 * quatre-vingt-dix jours, et APRÈS la dernière révocation des sessions du
 * compte (`revocation`, à la seconde comme `sessionRevoquee`) · un mot de
 * passe changé ou « Déconnecter mes autres appareils » le révoquent.
 */
export function appareilReconnu(jeton: unknown, compteId: string, secret: string, maintenant: Date, revocation: Date | null = null): boolean {
  if (typeof jeton !== 'string' || jeton.length > 300) return false;
  const morceaux = jeton.split('.');
  if (morceaux.length !== 3) return false;
  const [id, emis, signature] = morceaux;
  if (id !== compteId || !/^\d{1,12}$/.test(emis)) return false;
  const attendue = createHmac('sha256', cle('appareil-reconnu', secret)).update(`${id}.${emis}`, 'utf8').digest();
  // `Buffer.from` ne lève pas sur un base64url mal formé, il en lit ce qu'il peut ·
  // la longueur et la comparaison à temps constant tranchent.
  const recue = Buffer.from(signature, 'base64url');
  if (recue.length !== attendue.length || !timingSafeEqual(recue, attendue)) return false;
  const age = maintenant.getTime() / 1000 - Number(emis);
  // À la seconde, comme `sessionRevoquee` (jwt.strategy.ts), sans l'importer ·
  // ce module pur est lu par les services d'administration.
  if (revocation && Number(emis) < Math.floor(revocation.getTime() / 1000)) return false;
  return age >= -60 && age <= JOURS_JETON_APPAREIL * 86_400;
}

/**
 * La dernière révocation des sessions du COMPTE · la plus tardive des deux
 * colonnes (celle de la personne, celle de la ligne), la lecture la plus
 * sévère · un jeton d'appareil ne survit à aucune des deux.
 */
export function revocationDuCompte(u: { sessionsInvalidesAvant?: Date | null; sessionsDuCompteInvalidesAvant?: Date | null }): Date | null {
  const a = u.sessionsInvalidesAvant ?? null;
  const b = u.sessionsDuCompteInvalidesAvant ?? null;
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}
