import { createHmac, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';

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
 * Au-delà de la limite, le serveur répond 429 SANS faire tourner bcrypt ·
 * même code, même phrase, même durée pour toute adresse. Fenêtre GLISSANTE ·
 * les instants des derniers essais, au plus la limite plus un, sont gardés,
 * et un essai compte tant qu'il a moins de dix minutes.
 *
 * L'APPAREIL RECONNU N'EST PAS FREINÉ. Une limite par adresse se tourne en
 * refus de service · dix essais toutes les dix minutes suffiraient à tenir
 * un comptable dehors, exactement ce que la correction du verrou vient de
 * fermer (`deverrouillage.ts`). L'appareil où la personne s'est déjà
 * connectée garde un JETON D'APPAREIL (signé par le serveur, lié au compte,
 * quatre-vingt-dix jours), que l'écran renvoie avec la connexion · il passe
 * cette limite, jamais le verrou du compte, ni le second facteur, ni la
 * limite par IP. Un inconnu n'en a pas, et une adresse inconnue ne peut pas
 * en avoir · la réponse reste la même pour toutes. C'est la défense que
 * l'OWASP décrit sous le nom de « device cookie » ; elle voyage dans le corps
 * et non dans un témoin, Firebase Hosting retirant des requêtes relayées tout
 * témoin autre que `__session`.
 *
 * LA TABLE EST BORNÉE ET PURGÉE · une ligne par adresse essayée dans la
 * fenêtre, au plus onze instants par ligne, et ce qui est plus vieux que la
 * fenêtre est effacé au plus toutes les dix minutes par instance.
 */
export const LIMITE_ESSAIS_PAR_ADRESSE = 10;
export const FENETRE_ESSAIS_PAR_ADRESSE_MINUTES = 10;
export const JOURS_JETON_APPAREIL = 90;

export const MOTIF_TROP_D_ESSAIS_SUR_L_ADRESSE =
  'Trop d’essais de connexion sur cette adresse ces dernières minutes · patientez une dizaine de minutes avant de recommencer.';

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

/** Ce qui est plus vieux que la fenêtre ne compte plus · effacé. */
export function purgerLesEssaisEchus(client: { $executeRaw: (requete: Prisma.Sql) => Promise<number> }, maintenant: Date): Promise<number> {
  const debut = new Date(maintenant.getTime() - FENETRE_ESSAIS_PAR_ADRESSE_MINUTES * 60_000);
  return client.$executeRaw(Prisma.sql`DELETE FROM "essais_connexion_adresse" WHERE "majLe" <= ${debut}::timestamp(3)`);
}

/** Le déverrouillage par le titulaire repart d'une fenêtre vide. */
export function oublierLesEssaisDeLAdresse(client: { $executeRaw: (requete: Prisma.Sql) => Promise<number> }, empreinte: string): Promise<number> {
  return client.$executeRaw(Prisma.sql`DELETE FROM "essais_connexion_adresse" WHERE "empreinte" = ${empreinte}`);
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

/** Vrai si le jeton a été émis par ce serveur pour CE compte, il y a moins de quatre-vingt-dix jours. */
export function appareilReconnu(jeton: unknown, compteId: string, secret: string, maintenant: Date): boolean {
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
  return age >= -60 && age <= JOURS_JETON_APPAREIL * 86_400;
}
