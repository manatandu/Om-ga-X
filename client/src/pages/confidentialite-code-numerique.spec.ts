import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * LA POLITIQUE DE CONFIDENTIALITÉ FACE AU CODE DU NUMÉRIQUE CONGOLAIS.
 *
 * Ordonnance-loi n° 23/10 du 13 mars 2023, Livre III. Trois articles la
 * commandent, et la page les nommait tous les trois par leur absence :
 *
 *  · art. 201 · « Les données personnelles sont stockées et/ou hébergées en
 *    République Démocratique du Congo. » OmegaX héberge chez Neon et Google
 *    Cloud, hors RDC. La page le disait déjà · elle ne disait pas SUR QUELLE
 *    BASE, ce qui laissait le lecteur devant un fait sans règle.
 *  · art. 202 · les cas où le transfert reste possible. La page invoquait le
 *    2° (« un contrat entre la personne concernée et le responsable du
 *    traitement »), que le contrat de VMG avec un cabinet ne remplit pas ·
 *    passe D4 (D4-C1), la base est dite en cours de qualification.
 *  · art. 244 · deux obligations · le RESPONSABLE notifie l'Autorité et la
 *    personne (al. 1er), le SOUS-TRAITANT avertit le responsable (al. 2).
 *    Passe D4 (D4-C2) · la page les confondait.
 *
 * Ce que la page NE DIT PAS, et c'est délibéré · que l'autorisation préalable
 * de l'art. 201 n'a pas été obtenue. Publier un aveu de non-conformité est une
 * décision de VMG, pas un geste de développement. Voir
 * docs/code-du-numerique-et-omegax.md, qui l'écrit en interne.
 */

const page = readFileSync(join(__dirname, '..', '..', 'src/pages/ConfidentialitePage.tsx'), 'utf8');
const serveur = (f: string) => readFileSync(join(__dirname, '..', '..', '..', f), 'utf8');
const deplie = page.replace(/\s+/g, ' ');

describe('la politique cite le Code du numérique', () => {
  it('nomme le texte, son numéro et sa date', () => {
    expect(deplie).toContain('ordonnance-loi n° 23/10 du 13 mars 2023');
  });

  it('dit la règle de localisation, et la base du transfert comme une question ouverte', () => {
    // Passe D4 (D4-C1) · le 2° de l'art. 202 vise un contrat entre la
    // personne concernée et le responsable ; le contrat de VMG lie un cabinet.
    // Pour les dossiers, l'instruction du transfert revient à l'entité
    // responsable (art. 229). Rien n'est tranché avant le juriste.
    expect(deplie).toContain('hébergées hors de la République démocratique du Congo');
    expect(deplie).toContain('article 201');
    expect(deplie).toContain('article 202');
    expect(deplie).toContain('l’autorisation préalable de l’Autorité de protection des données');
    expect(deplie).toContain('La base juridique du transfert opéré ici est en cours de qualification.');
    expect(deplie).toContain('VMG Consulting agissant pour son compte (article 229)');
  });

  it('distingue les deux obligations de l’article 244 · responsable et sous-traitant', () => {
    // Passe D4 (D4-C2) · al. 1er au responsable (Autorité ET personne),
    // al. 2 au sous-traitant (avertir le responsable).
    expect(deplie).toContain('article 244');
    expect(deplie).toContain('dont VMG Consulting est responsable, nous notifierons <strong>sans délai</strong>, à l’Autorité de protection des données et à vous-même');
    expect(deplie).toContain('VMG Consulting, sous-traitant, vous avertira <strong>sans délai</strong>');
    expect(deplie).toContain('il revient alors à votre entité de notifier l’Autorité et les personnes concernées');
  });

  it('renvoie à la restitution complète pour le droit de portabilité', () => {
    // Elle existe depuis G2b · une politique qui promet un export sans dire
    // par où passer promet à moitié.
    expect(deplie).toContain('Restituer le dossier complet');
  });

  it('n’affirme aucune conformité qu’OmegaX ne tient pas', () => {
    // Ni « conforme au Code du numérique », ni « autorisé par l'Autorité ».
    expect(page).not.toMatch(/conforme au Code du numérique|autorisation de l’Autorité a été/i);
  });

  it('donne le courriel et la ville que VMG a arrêtés, sans inventer une adresse de rue', () => {
    // Donnés par Manasse le 2026-10-17 · « Mets juste Kinshasa/RDC » · aucune rue n'est publiée.
    expect(deplie).toContain('href="mailto:admin@vmgconsulting.net"');
    expect(deplie).toContain('Le cabinet est établi à Kinshasa, en République démocratique du Congo');
    expect(deplie).toContain('l’adresse de la rue n’étant pas encore publiée');
    // Aucune rue n'est publiée · l'inventer dirigerait les demandes vers le vide.
    expect(deplie).not.toMatch(/\b(avenue|boulevard|quartier)\b/i);
  });

  it('numérote ses sections sans doublon', () => {
    // Deux « 7. » se suivaient après l'insertion · un document juridique qui
    // se renvoie à lui-même par numéro ne peut pas en avoir deux.
    const numeros = [...page.matchAll(/<Titre id="[a-z-]+">(\d+)\./g)].map(([, n]) => Number(n));
    expect(numeros.length).toBeGreaterThan(10);
    expect(numeros).toEqual([...Array(numeros.length).keys()].map((i) => i + 1));
  });
});

describe('la politique nomme tous ceux qui reçoivent des données, et dit l’installation sur site (audit final F176)', () => {
  it('nomme l’archive des sauvegardes et la messagerie, sans inventer le nom du prestataire SMTP', () => {
    expect(deplie).toContain('<strong>GitHub</strong> (service GitHub Actions) produit chaque nuit la sauvegarde');
    expect(deplie).toContain('<strong>Le prestataire de messagerie</strong> (SMTP)');
    expect(deplie).toContain('Son nom doit être arrêté par VMG Consulting et porté ici avant toute publication');
  });

  it('écrit le cloisonnement là où il vit · aucune règle de la base ne le porte', () => {
    expect(deplie).toContain('cloisonné des autres au niveau de chaque requête du serveur');
  });

  it('sur site, dit que rien ne part chez un hébergeur, d’après l’état public du poste', () => {
    expect(page).toContain(".get<EtatSurSite>('/sur-site/etat')");
    expect(deplie).toContain('{surSite ? (');
    expect(deplie).toContain('installée sur un ordinateur de votre entité');
    expect(deplie).toContain('ne sont confiés à aucun hébergeur');
    expect(deplie).toContain('chiffrée</strong> par une phrase secrète que choisit l’administrateur');
  });
});

describe('la politique décrit le logiciel tel qu’il est (passe D4)', () => {
  it('donne les deux durées de session que tient session-longue.ts (D4-A2, B2, C5, D2)', () => {
    // Lues dans le serveur, jamais recopiées · la phrase « expire au bout de
    // huit heures » avait survécu à F270 parce que rien ne la reliait au code.
    const session = serveur('src/modules/auth/session-longue.ts');
    const jours = (nom: string) => Number(new RegExp(`${nom} = (\\d+) \\* SECONDES_PAR_JOUR`).exec(session)?.[1]);
    const enLettres: Record<number, string> = { 7: 'sept', 30: 'trente' };
    expect(deplie).toContain(`dure ${enLettres[jours('DUREE_MAXIMALE_SESSION_LONGUE_S')]} jours au plus depuis la connexion`);
    expect(deplie).toContain(`se ferme après ${enLettres[jours('DUREE_INACTIVITE_SESSION_LONGUE_S')]} jours sans utilisation`);
    // Session courte · cookie de session, et l'échéance du jeton.
    expect(serveur('src/modules/auth/auth.module.ts')).toContain("config.get<string>('JWT_EXPIRES_IN', '8h')");
    // La durée vient de JWT_EXPIRES_IN, que la production reçoit par un secret
    // (`API_JWT_EXPIRES_IN`) · huit heures n'est que la valeur PAR DÉFAUT, et
    // la page le dit (relecture de la ligne pages-legales, mineur 12).
    expect(serveur('.github/workflows/deploy-cloud-run.yml')).toContain('JWT_EXPIRES_IN: ${{ secrets.API_JWT_EXPIRES_IN }}');
    expect(deplie).toContain(
      'il se ferme avec le navigateur, et la session prend fin au plus tard au terme de la durée de session du service, huit heures par défaut, après la connexion',
    );
  });

  it('dit que le stockage local n’est transmis à aucun tiers, pas qu’il ne quitte jamais l’appareil (relecture, mineur 8)', () => {
    // Le jeton qui protège les envois part au serveur d'OmegaX à chaque
    // écriture (en-tête X-CSRF-Token) · « rien ne quitte l'appareil » était faux.
    expect(readFileSync(join(__dirname, '..', 'lib', 'api.ts'), 'utf8')).toContain('X-CSRF-Token');
    expect(deplie).toContain('Rien de cela n’est transmis à un tiers ;');
  });

  it('dit « chiffrés en transit », et le http du réseau local sur site (D4-A3, C7, D1)', () => {
    // La section de la protection suit la même branche `surSite` que les sections 3 et 4.
    const section5 = deplie.slice(deplie.indexOf('<Titre id="protection">'), deplie.indexOf('<Titre id="violation">'));
    expect(section5.length).toBeGreaterThan(100);
    expect(section5).toContain('{surSite ? (');
    expect(section5).toContain('<strong>http, sur le réseau local</strong> de votre entité : OmegaX ne les chiffre pas');
    expect(section5).toContain('<strong>chiffrés en transit (HTTPS)</strong>');
    expect(section5).toContain('Ce n’est pas un chiffrement de bout en bout');
    // Le relais est bien celui que firebase.json déclare.
    expect(readFileSync(join(__dirname, '..', '..', 'firebase.json'), 'utf8')).toContain('"source": "/api/**"');
  });

  it('borne les quatre-vingt-dix jours à GitHub et nomme la copie Cloud Storage (D4-B3, C6)', () => {
    const flux = serveur('.github/workflows/sauvegarde-base.yml');
    expect(flux).toContain('retention-days: 90');
    expect(flux).toContain('gcloud storage cp');
    expect(deplie).toContain('conservé quatre-vingt-dix jours par GitHub');
    expect(deplie).toContain('Une copie de ce fichier chiffré est déposée chaque nuit dans');
    expect(deplie).toContain('<strong>europe-west1</strong> (Belgique)');
    expect(deplie).toContain('La durée de conservation de cette copie doit être arrêtée par VMG Consulting');
  });

  it('nomme l’adresse IP et le second facteur, et dit leur conservation (D4-B5, C8)', () => {
    expect(deplie).toContain('<strong>adresse réseau (adresse IP)</strong> d’où chaque acte a été fait');
    expect(deplie).toContain('le secret de l’application d’authentification et l’empreinte des codes de secours');
    expect(deplie).toContain('ne sont soumis à aucune purge');
    expect(deplie).toContain('Leur durée de conservation doit être arrêtée par VMG Consulting');
    // Et la limite de l'effacement, art. 216, al. 4, 2°.
    expect(deplie).toContain('L’effacement cède devant une obligation légale qui impose de conserver les données (article 216)');
  });

  it('informe du droit de réclamation et des directives après la mort (D4-C9)', () => {
    expect(deplie).toContain('introduire une réclamation auprès de l’autorité chargée de la protection des données à caractère personnel et de former un recours juridictionnel (articles 220 et 239)');
    expect(deplie).toContain('les modalités de la gestion de vos données personnelles après votre mort (article 208)');
  });
});

describe('la politique dit la télémétrie telle qu’elle est (2026-10-07)', () => {
  it('nomme les deux services, leur région, ce qui part et ce qui ne part jamais', () => {
    expect(deplie).toContain('<strong>Sentry</strong>, dans sa région de données de l’<strong>Union européenne</strong>');
    expect(deplie).toContain('<strong>PostHog</strong>, dans sa région de données de l’<strong>Union européenne</strong>');
    expect(deplie).toContain('reçoit les erreurs techniques du serveur et, avec votre accord seulement (section 4), de l’interface');
    expect(deplie).toContain('reçoit les pages vues de l’interface, sans votre nom ni le contenu de vos dossiers et avec votre accord seulement (section 4)');
    expect(deplie).toContain('Ni Sentry ni PostHog ne reçoivent <strong>jamais</strong> de donnée de vos dossiers : aucun montant, aucun nom, aucune adresse de courriel, aucun contenu saisi');
    expect(deplie).toContain('Sept prestataires interviennent');
    expect(deplie).toContain('le fil des dernières requêtes réduit à leur méthode, leur adresse sans identifiants ni paramètres et leur statut, les écrans ouverts juste avant, et la version publiée du logiciel');
    expect(deplie).toContain('le système d’exploitation, le fuseau horaire, le type d’appareil, l’adresse du site et des identifiants de session tirés au hasard');
    // Les hôtes nommés par la page sont ceux que le code ouvre.
    expect(serveur('src/common/telemetrie/nettoyage-telemetrie.ts')).toContain("'https://*.ingest.de.sentry.io', 'https://eu.i.posthog.com'");
  });

  it('sur site, dit que rien ne part, et ne prétend plus à l’absence de mesure en ligne', () => {
    expect(deplie).toContain('Aucune erreur technique ni aucune page vue ne quitte cette installation');
    expect(deplie).toContain('Il peut mesurer la fréquentation de son interface, sans votre nom ni le contenu de vos dossiers, et signaler ses erreurs techniques (section 6), seulement si vous l’acceptez');
    expect(deplie).toContain('un identifiant tiré au hasard, sans lien avec votre compte ni avec votre dossier');
  });
});

describe('la politique complétée le 15 octobre 2026 (ligne pages-legales)', () => {
  it('dit la règle de la console telle que session-longue.ts la tient · huit heures après la connexion complète', () => {
    expect(serveur('src/modules/auth/session-longue.ts')).toContain('export const DELAI_CONSOLE_DEPUIS_AUTHENTIFICATION_S = 8 * 3600;');
    expect(deplie).toContain('La console de l’éditeur redemande le mot de passe et le code huit heures après la dernière connexion complète.');
  });

  it('dit ce que le navigateur garde, au nombre de dossiers près', () => {
    expect(readFileSync(join(__dirname, '..', 'lib', 'dossiersRecents.ts'), 'utf8')).toContain('const MAXIMUM = 5;');
    expect(deplie).toContain('la liste des cinq dossiers ouverts le plus récemment (nom du dossier, adresse de connexion, date)');
  });

  it('dit la PRATIQUE de VMG Consulting et nomme chacun de ses accès techniques que les workflows ouvrent vraiment, et l’article 37', () => {
    // Relecture « échecs silencieux » de la ligne pages-legales, B1 · la page
    // disait que VMG « n'accède pas » aux données, quand la sauvegarde de
    // chaque nuit lit toute la base et la restaure pour contrôle, et qu'une
    // requête de production la lit aussi. Une impossibilité technique
    // affirmée à tort est opposable · la page dit ce que VMG fait, et chaque
    // accès que le dépôt ouvre est nommé à côté de son workflow.
    expect(deplie).toContain('VMG Consulting ne consulte pas le contenu de vos dossiers.');
    const sauvegarde = serveur('.github/workflows/sauvegarde-base.yml');
    expect(sauvegarde).toContain('pg_dump');
    expect(sauvegarde).toContain('pg_restore');
    expect(deplie).toContain('Ses accès techniques à la base se limitent à la sauvegarde chiffrée de chaque nuit, dont elle détient la clé, à la restauration de contrôle automatique');
    expect(serveur('.github/workflows/requetes-production.yml')).toContain('docs/requetes-production-paquet-1.md');
    expect(deplie).toContain('aux requêtes de maintenance, qui ne rendent que des identifiants et des nombres');
    expect(deplie).toContain('sauf réquisition judiciaire (Code du numérique, article 37)');
  });

  it('renvoie au contrat pour le traitement pour compte (article 229), et la modification suit l’article 34', () => {
    // Par LienPageLegale · dans la fenêtre, il ouvre la fenêtre du contrat sans
    // quitter l'espace de travail (second tour, M1).
    expect(deplie).toContain('<LienPageLegale chemin="/contrat-de-licence">contrat de licence</LienPageLegale>');
    expect(deplie).toContain('comme le veut l’article 229 du Code du numérique');
    expect(deplie).toContain('l’article 34 du Code du numérique');
    // La promesse d'un signal dans l'application, qu'aucun code ne tenait, est retirée.
    expect(deplie).not.toContain('vous sera signalée dans l’application');
  });

  it('se lit aussi dans une fenêtre, sans son titre de page', () => {
    expect(page).toContain('export function ConfidentialiteFenetre()');
    const fenetre = page.slice(page.indexOf('export function ConfidentialiteFenetre()'), page.indexOf('export function ContenuConfidentialite()'));
    expect(fenetre).not.toContain('<h1');
    expect(fenetre).toContain('<ContenuConfidentialite />');
  });
});

describe('la politique présentée sur le modèle des grands éditeurs (2026-10-17)', () => {
  it('ouvre sur un engagement, puis un sommaire dont chaque entrée est un titre de la page, dans l’ordre', () => {
    expect(deplie).toContain('<p className="text-[11.5px] font-bold mb-1">Notre engagement</p>');
    expect(deplie).toContain('Nous ne vendons ni ne louons aucune donnée');
    const entrees = [...page.matchAll(/\{ id: '([a-z-]+)', titre: '([^']+)' \}/g)].map(([, id, t]) => `<Titre id="${id}">${t}`);
    const titres = [...page.matchAll(/<Titre id="([a-z-]+)">\d+\. ([^<]+)<\/Titre>/g)].map(([, id, t]) => `<Titre id="${id}">${t}`);
    expect(entrees.length).toBe(13);
    expect(titres).toEqual(entrees);
    // Un lien « #ancre » ramènerait à l'écran d'ouverture sous HashRouter.
    expect(page).toContain('scrollIntoView');
    expect(page).not.toMatch(/href="#politique-/);
  });

  it('dit le fondement de chaque traitement tel que l’article 192 les borne · consentement ou obligation légale', () => {
    expect(deplie).toContain('n’admet que deux fondements à un traitement de données personnelles');
    expect(deplie).toContain('(article 192)');
    expect(deplie).toContain('Consentement, demandé avant tout envoi et retirable à tout moment (section 4)');
    expect(deplie).toContain('Obligation légale · Acte uniforme relatif au droit comptable, art. 22 ; Code du numérique, article 219, 14°');
  });

  it('dit les délais de réponse du Code (articles 210, 213, 214, 239 à 241) et le mineur (article 247)', () => {
    expect(deplie).toContain('<strong>trente jours</strong> de sa réception (articles 213, 214 et 239)');
    expect(deplie).toContain('prolonger ce délai de soixante jours au plus');
    expect(deplie).toContain('au plus tard soixante jours après la demande (article 210)');
    expect(deplie).toContain('La réponse est gratuite (article 240)');
    expect(deplie).toContain('L’article 247 du Code du numérique');
  });

  it('nomme la demande d’essai et ce qu’elle garde, l’adresse réseau en mémoire seulement', () => {
    expect(deplie).toContain('<strong>La demande d’essai</strong> · le type de l’entité, son nom et l’adresse de courriel donnée');
    // Relecture « échecs silencieux », M4 · le limiteur garde une empreinte tant que l'instance tourne,
    // et Cloud Run journalise l'adresse de toute requête · « une heure, nulle part » était faux.
    expect(deplie).toContain('le serveur d’application ne l’inscrit dans aucune table ; son limiteur en garde une empreinte en mémoire tant que le service tourne');
    expect(deplie).toContain('l’hébergeur (Google Cloud Run) inscrit l’adresse dans ses journaux techniques');
    expect(page).not.toMatch(/de façon anonyme/);
    // Cinq demandes par heure · la durée de la limite est celle que la route porte.
    expect(serveur('src/modules/auth/auth.controller.ts')).toContain('@Throttle({ default: { ttl: 3_600_000, limit: 5 } })');
    // Cent quatre-vingts jours · décision de Manasse du 2026-10-17 (« 180 jours »,
    // jamais « six mois calendaires »). La suppression existe (console de l'éditeur,
    // `plateforme/essais-echus/`) mais c'est un GESTE de l'opérateur, pas une tâche
    // planifiée · la page le DIT, et elle ne promet que ce que le code garantit.
    expect(deplie).toContain('<strong>cent quatre-vingts jours après le terme</strong> de l’essai, puis le supprime');
    expect(deplie).toContain('<strong>au moins trente jours avant</strong> la suppression');
    expect(deplie).toContain('(Fichier &gt; Restituer le dossier complet)');
    expect(deplie).toContain('faite par VMG Consulting depuis sa console, après vérification de ces délais, et non par une tâche automatique');
    expect(deplie).toContain('Les sauvegardes chiffrées de la nuit gardent une trace du dossier jusqu’à leur propre terme');
    expect(deplie).not.toContain('quatre-vingt-dix jours après le terme');
    // Le fond a changé · la politique porte la date de cette modification (le
    // bandeau de consentement se rouvre une fois, c'est voulu).
    const date = readFileSync(join(__dirname, '../lib/date-politique-confidentialite.ts'), 'utf8');
    expect(date).toContain("export const DATE_DE_MISE_A_JOUR = '21 octobre 2026';");
    expect(page).toContain('Dernière mise à jour · ${DATE_DE_MISE_A_JOUR}');
    expect(deplie).not.toContain('n’est pas encore en service');
    // Les deux nombres de la page sont ceux du calendrier du serveur.
    const calendrier = serveur('src/modules/plateforme/essais-echus/essais-echus.ts');
    expect(calendrier).toContain('export const JOURS_CONSERVATION_ESSAI = 180;');
    expect(calendrier).toContain('export const JOURS_RAPPEL_AVANT_SUPPRESSION = 30;');
    // La route de suppression existe, et elle est gardée comme le reste de la console.
    const controleur = serveur('src/modules/plateforme/plateforme.controller.ts');
    expect(controleur).toContain("@Post('essais-echus/:tenantId/supprimer')");
    expect(controleur).toMatch(/@UseGuards\(JwtAuthGuard, OperateurPlateformeGuard\)/);
  });

  it('rouvre le choix des témoins depuis la page, et finit par les coordonnées, sans en inventer', () => {
    expect(deplie).toContain('<LienPreferencesMesure className="text-sel underline" />');
    expect(deplie).toContain('Adresse · Kinshasa, République démocratique du Congo');
  });
});
