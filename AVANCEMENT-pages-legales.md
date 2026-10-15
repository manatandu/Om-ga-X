# AVANCEMENT · ligne pages-legales

Demande de Manasse (levée du gel pour elle seule, CLAUDE.md § 5) : « Tu pourras
mettre aussi un forum aux questions, politique de confidentialité, termes du
contrat de licence, indiquer la version, mise en production et langue en te
basant sur des vrais logiciels, je ne veux rien de mémoire. »

Branche de sauvegarde `travail/pages-legales`, partie d'`origin/main` (5e5ebcd).

## Fait

- **Contrat de licence** (`src/modules/conditions-licence/conditions-de-licence.ts`,
  module PUR partagé par le serveur et l'écran) · dix-neuf articles, version
  numérotée et datée (`VERSION_CONDITIONS_LICENCE`, 1 du 15 octobre 2026),
  langue du contrat (français), texte brut identique à l'écran et en pièce
  jointe. Ce que nul texte ne fixe et que VMG Consulting n'a pas arrêté est
  écrit « (à arrêter par VMG Consulting) », surligné à l'écran, jamais un blanc
  ni une valeur inventée.
- **Acceptation en ligne** (`acceptation-conditions.ts`, `conditions-licence.service.ts`,
  `GET /conditions-licence`, `POST /conditions-licence/acceptation`
  administrateur seul) · version, date et auteur sur `Tenant` (trois colonnes
  nullables, migration `20270176000000_acceptation_conditions_licence`, diff
  Prisma « No difference detected »), donc au journal d'audit ; verrou par
  dossier, mise à jour unitaire, idempotente sur la même version ; accusé de
  réception à l'écran et courriel en file avec le texte accepté
  (`ORIGINE_CONDITIONS_LICENCE`), un échec de mise en file ne défait jamais
  l'acceptation. FERMÉE tant que les mentions obligatoires manquent ou que le
  prix n'est pas fixé (motif servi par le serveur), jamais pour le dossier de
  l'éditeur ni pour une démonstration. N'interrompt jamais l'accès.
- **Foire aux questions** (`client/src/lib/questions-frequentes.ts`,
  `QuestionsFrequentesPage.tsx`) · six rubriques, trente et une questions,
  recherche sans accents, chaque délai confronté au code par
  `pages-legales.spec.ts` (verrou, second facteur, sessions, essai et délai
  de paiement, formules).
- **Politique de confidentialité complétée** (`ConfidentialitePage.tsx`) ·
  stockage local du navigateur, VMG n'accède pas aux données des dossiers,
  lien vers l'article 9 du contrat (traitement pour le compte du client),
  date de mise à jour ; une promesse non tenue retirée.
- **À propos** · mise en production de l'interface (date et numéro de
  publication posés par `firebase-hosting-merge.yml` seulement, sinon « non
  renseignée »), langue (français, seule langue disponible), droit d'auteur.
- **Accès** · trois pages publiques sans session (liens de l'écran
  d'ouverture, cadre imprimable), trois fenêtres du menu « ? » au registre,
  rappel d'une ligne pour l'administrateur quand l'acceptation est due.
- **Tests** · `conditions-licence.spec.ts` (25), `pages-legales.spec.ts`,
  ajouts à `version.spec.ts`, `confidentialite-code-numerique.spec.ts`,
  `libelles-et-titres.spec.ts`, `ecriture-masquee.spec.ts` ;
  `e2e/tests/pages-legales.e2e.ts` (deux tests, verts en local sous Chromium) ;
  balayage `ecrans.e2e.ts` vert en local dans les deux référentiels.
- **Relecture « échecs silencieux », premier tour (2026-10-15)** · 1 BLOQUANT,
  4 MAJEUR, 14 MINEUR, tous corrigés, chacun avec son test.
  - B1 · politique, FAQ et contrat (art. 9) disent la PRATIQUE · VMG ne
    consulte pas le contenu des dossiers, ses accès techniques se limitent
    à la sauvegarde chiffrée (clé détenue par VMG), à sa restauration de
    contrôle (décomptes seulement) et aux requêtes de maintenance
    (identifiants et nombres) ; les specs nomment chaque accès à côté de son
    workflow.
  - M1 · l'écran envoie le numéro et l'empreinte du texte de SON code ; un
    texte différent de celui du service n'offre pas l'acceptation et
    demande de recharger la page ; le serveur refuse (409).
  - M2 · `empreinte.ts` (SHA-256 pur, les deux côtés), `versions-publiees.ts`
    et `versions/version-1.ts` (texte archivé mot pour mot, empreinte
    1a878fe6…c75d), `versions-publiees.spec.ts` (empreinte gelée, générateur
    = texte archivé, une seule version tant que la bascule n'est pas servie),
    `Tenant.conditionsLicenceEmpreinte` (migration 20270176000100, diff
    Prisma sans écart), accusé portant l'empreinte et le texte archivé,
    versions antérieures téléchargeables. Délais de l'art. 34 modélisés
    (`delais-article-34.ts`) et tenus par chaque version.
  - M3 · art. 53, 6°, 16° et 20° écrits « (à arrêter par VMG Consulting) »
    aux articles 7, 13 et 12, et dans `mentionsAArreter` (neuf mentions).
  - M4 · en ligne, hors éditeur et démonstration, l'acceptation se ferme
    sans abonnement (motif nommé) et sur une licence PERPETUEL_SAAS ; une
    cellule lit l'abonnement de son siège.
  - Mineurs · chemin de la clôture, Personnaliser réservé à l'administrateur,
    impression nuancée, lecture seule exacte (impression numérotée du
    journal refusée, téléchargements ouverts), accusé en erreur au journal
    avec dossier et version et « Renvoyer l'accusé », auteur absent dit,
    jour de Kinshasa pour la mise en production, « rien n'est transmis à un
    tiers », périmètre du journal d'audit, cinq réserves de la restitution,
    spec nommé, huit heures « par défaut », échec de lecture du rappel dit,
    accusé sans messagerie dit.
  - Vérifié · specs touchées serveur (conditions de licence, routes,
    rôles, restitution, audit, cadratins, règlement intérieur), `npm test`
    client (267 fichiers, 2 122 tests), `tsc` des deux côtés, `npm run
    build` serveur, tests navigateur `pages-legales`, `ecrans` (deux
    référentiels) et `rester-connecte` verts sous Chromium. La suite Jest
    complète n'a pas été relancée pour ce tour (consigne du coordinateur).
- **Bloc du § 3, 2026-10-15** · serveur · `tsc` sans erreur, Jest en six
  tranches (884 suites, 12 887 tests ; 21 suites du client qui n'avaient pas
  démarré sous la charge de la machine, quatre tranches en parallèle, rejouées
  à part et vertes), `npm run build` ; client · `tsc`, `npm test` (267
  fichiers, 2 113 tests), `npm run build`.

- **Second et dernier tour de relecture, 2026-10-15** (serveur · 2 MAJEUR,
  3 MINEUR ; écrans · 2 MAJEUR, 10 MINEUR ; tous corrigés, aucun reporté).
  - Serveur M-a · l'écran envoie l'empreinte de l'abonnement AFFICHÉ
    (`empreinteCommande`, formule, options, périodicité, dates, lignes,
    total, siège, dans un ordre fixe), le service relit dossier, licence et
    abonnement DANS la transaction, APRÈS le verrou du dossier, et refuse
    en 409 un abonnement qui n'est plus celui affiché (art. 55, al. 1er) ;
    la commande acceptée est gardée avec l'acte
    (`Tenant.conditionsLicenceCommande`, JSONB, migration
    20270176000200, diff Prisma sans écart), au journal d'audit avec lui,
    relue nulle si elle n'a pas sa forme, et recopiée dans l'accusé
    (`lignesDeLaCommande`, art. 55, al. 2).
  - Serveur M-b · un accusé en ÉCHEC ne se renvoie plus · la file le
    retente d'elle-même (`filtreEligibles`, relu par le spec) ; seuls
    l'abandonné et le jamais mis en file se renvoient.
  - Serveur m-1 · le renvoi passe sous le même verrou, dans
    `transactionJournalisee`, l'accusé relu dedans et écrit par
    `ecrireEnFileSansTenter(tx, …)` ; m-2 · trois écarts, trois messages
    (page plus ancienne · recharger ; page plus récente · « le service
    n'est pas encore à jour » ; même numéro, autre texte) ; m-3 · types
    générés par Prisma, surcharge de `jour`, unions littérales
    (`TYPES_LICENCE`, `STATUTS_MESSAGE`, `StatutAccuse` avec
    `NON_MIS_EN_FILE`) confrontées aux enums par `satisfies` dans les deux
    sens, plus de `as number` dans `empreinte.ts`.
  - Écrans M1 · dans une fenêtre, le lien de la politique vers le contrat
    ouvre la fenêtre du contrat par la navigation de l'espace de travail
    (`LienPageLegale`, `lib/lien-page-legale.ts`, contexte posé par
    `CorpsFenetreLegale`) · la page publique garde son lien public.
  - Écrans M2 · la recherche de la FAQ lit apostrophes (droite et
    typographique), traits d'union et ponctuation comme une espace, des deux
    côtés, et cherche le titre de la rubrique (`filtrerQuestions`,
    `normaliserRecherche`).
  - Écrans mineurs · FAQ imprimée dépliée (`flushSync` au `beforeprint`) ;
    rappel lisible en entier à 390 px ; refus d'acceptation qui relit l'état
    et décoche la case, cas « service pas encore à jour » avec « Réessayer » ;
    un seul instant, au jour de Kinshasa, pour la construction et la mise en
    production ; tableau de l'abonnement à en-têtes, dates en toutes
    lettres ; consignes adressées au rôle (l'administrateur accepte et
    renvoie, les autres lisent) ; focus sur l'accusé, résultat vide de la
    FAQ annoncé ; pages publiques chargées à la demande ; assertion
    d'absence du test navigateur placée après la lecture de l'état, objet
    de l'appel découpé par sa structure ; « À propos » en boîte de dialogue
    (Échap, focus sur « Fermer »).
  - Vérifié · serveur `tsc`, `npm run build`, specs touchées
    (`conditions-licence`, cloisonnement, audit, cadratins) avec
    `--maxWorkers=1` ; client `tsc`, `npm test` (268 fichiers, 2 142
    tests), specs touchées aussi sous le jest de la racine ; tests
    navigateur `pages-legales`, `rester-connecte` et `ecrans` (deux
    référentiels) verts sous Chromium. Sur VRAIE base (serveur compilé,
    base jetable) · la commande JSONB se relit à l'identique, le renvoi
    passe sous le verrou dans une transaction réelle (SANS_TRANSPORT), le
    second renvoi est refusé (409), l'accusé en file recopie la commande,
    le renvoi sur ÉCHEC est refusé et celui sur ABANDON passe.

## Reste

- Les décisions de Manasse ci-dessous ; tant qu'elles manquent, l'acceptation
  en ligne reste fermée, et c'est voulu (art. 54, al. 2).
- À l'intégration · WebKit des tests navigateur (non lancé en local),
  déploiement à relire (la ligne touche `src/**` et `prisma/**`).
- Date de déploiement du SERVEUR dans « À propos » · non servie (seule celle
  de l'interface a une source réelle, le workflow de publication).
- La bascule d'une version du contrat à la suivante (art. 34) · non servie
  tant qu'une seule version existe, et `versions-publiees.spec.ts` le tient.
- Relevés en attente · aucun (le second tour est clos, tout corrigé).

## Sources réelles lues (le 2026-10-15)

Les sites commerciaux (odoo.com, sage.com, pennylane.com) ont répondu 403 ou
ne se résolvaient pas depuis le conteneur ; seules les sources ci-dessous ont
été LUES.

- Odoo, *Enterprise Subscription Agreement*, version 13 du 2026-09-24, anglais
  et français · https://github.com/odoo/documentation/blob/18.0/content/legal/terms/enterprise.rst
  et https://github.com/odoo/documentation/blob/18.0/content/legal/terms/i18n/enterprise_fr.rst
  (commit 0a1cba2 du 2026-10-14). Structure retenue · définitions, durée,
  services, prix, données, garanties, responsabilité (plafond), résiliation,
  droit applicable.
- Basecamp, *Terms of Service* (dernière mise à jour 6 janvier 2023) et
  *Privacy policy* (20 avril 2023), avec les listes de sous-traitants ·
  https://github.com/basecamp/policies (commit 05fb1f9 du 2026-10-06),
  `terms/index.md`, `privacy/index.md`, `privacy/basecamp-subprocessors/`.
- Odoo, documentation d'administration · `content/administration/odoo_accounts.rst`,
  `content/administration/odoo_online.rst` (même dépôt) ; écran « À propos »
  d'Odoo · https://github.com/odoo/odoo/blob/18.0/addons/base_setup/static/src/views/res_config_edition.xml
  (version du serveur, édition, expiration).
- Firefly III, FAQ par thème · https://github.com/firefly-iii/docs (commit
  9f2c60f), `docs/docs/references/faq/general.md`,
  `faq/firefly-iii/general.md`, `faq/firefly-iii/using.md`.
- Frappe, boîte « About » · https://github.com/frappe/frappe/blob/develop/frappe/public/js/frappe/ui/toolbar/about.js.
- Sage · *Formation Sage Comptabilité 100 / i7* (Drive de Manasse,
  744696676-Sage-Comptabilite-100.pdf, fenêtre « A propos de » et
  « Paramètre société ») ; *Les fonctions de Sage 100 Immobilisations i7*
  (Drive, 138224421-les-fonctions-de-sage-100-immobilisation-pdf.pdf).

Corpus juridique lu (compétences) · Code du numérique, ordonnance-loi n° 23/10
du 13 mars 2023, art. 2, 15°, 3, 29, 30, 31, 34, 37, 47, 51 à 56, 61, 64,
201, 202, 229 ; ordonnance-loi n° 86-033 (droit d'auteur), art. 1er, 4, 8,
al. 2, 10, 33, 34, 36, 96 ; Code civil, Livre III, art. 7, 8, 33, 46, 48, 82 ;
loi n° 23/053, art. 141, 1°. Les notes de cours de propriété intellectuelle
remises par Manasse sont un témoin, jamais une source, et ne sont pas
recopiées au dépôt.

## Décisions prises par la loi

1. **Le logiciel est une œuvre protégée** · Code du numérique, art. 47 (les
   logiciels et plateformes sont protégés par la loi n° 82-001 et
   l'ordonnance-loi n° 86-033) ; droit exclusif, art. 1er de l'ordonnance-loi
   n° 86-033 ; contrefaçon, art. 96. Article 4 du contrat et « À propos ».
2. **Acceptation en ligne exigée et tracée** · art. 55 (acceptation, accusé
   de réception électronique), art. 56, al. 1er (copie remise), art. 53,
   al. 2 et 9° (archivage et accès) · version, date et auteur au journal
   d'audit, courriel portant le texte.
3. **Acceptation FERMÉE tant que l'offre est incomplète** · art. 54, al. 2
   (l'information précède la commande) avec art. 52 (identité de l'éditeur)
   et art. 53, 13° et 14° (réclamations) ; prix fixé exigé, art. 53, 5°, et
   art. 55, al. 1er.
4. **Aucune interruption faute d'acceptation** · art. 30, al. 3 ; le rappel ne
   ferme rien.
5. **Conditions publiques, imprimables, téléchargeables** · art. 53, al. 1er,
   et art. 31.
6. **Langue du contrat · français** · art. 53, 8° ; tenue en francs, loi
   n° 23/053, art. 141, 1°. Aucune autre langue promise.
7. **Modification** · art. 34 (préavis de trente jours ouvrables, résiliation
   sans pénalité dans les soixante jours ouvrables).
8. **Traitement pour le compte du client** · art. 229 (instruction documentée,
   sous-traitants ultérieurs avec opposition) ; transferts, art. 201 et 202 ;
   confidentialité, art. 37.
9. **Responsabilité** · art. 51 (responsabilité de plein droit du
   prestataire) ; Code civil, art. 46 et 48 (force majeure).
10. **Durée et fin** · Code civil, art. 33 et 82 ; **droit applicable** · art. 3
    du Code du numérique, Code civil, art. 7.
11. **Mise en production** · lue sur la chaîne de publication seule, jamais
    inventée (CLAUDE.md § 9 ter, « À propos » dit ce qui est installé),
    au jour de Kinshasa.
12. **L'offre dit aussi** les modalités de paiement (art. 53, 6°), l'existence
    ou l'absence d'un droit de rétractation (16°) et les garanties légales
    (20°) · tant que l'un manque, l'acceptation reste fermée (art. 54, al. 2).
13. **Pas d'acceptation en ligne sans prix** · art. 53, 5° et art. 55,
    al. 1er · un dossier en ligne sans abonnement, ni à lui ni à son siège,
    et une licence perpétuelle hébergée (que le contrat ne décrit pas) ne
    l'ouvrent pas.
14. **Une version publiée ne se réécrit pas** (contrat, art. 15 ; art. 53,
    9°) · texte archivé, empreinte gelée, empreinte enregistrée avec
    l'acceptation. Compléter une mention « à arrêter » change le texte · c'est
    PUBLIER UNE VERSION 2, la version 1 restant archivée.
15. **Les jours ouvrables de l'art. 34** · le Code ne les définit pas ;
    OmegaX les compte du lundi au vendredi, sans les jours fériés de
    l'ordonnance n° 23-042, la lecture qui rend le délai le plus long pour
    l'utilisateur (règle de protection, CLAUDE.md P5).

## Décisions à prendre par Manasse

1. Identité de l'éditeur (art. 52) · siège, courriel, téléphone, RCCM, forme,
   identification nationale, numéro d'impôt, capital.
2. Réclamations (art. 53, 13° et 14° ; art. 29, 5°) · adresse, modalités, et
   si le délai de 72 heures de l'art. 65, al. 3 s'applique à OmegaX.
3. Plafond de responsabilité (Odoo · 50 % des sommes des douze derniers mois ;
   Basecamp · exclusion presque totale), à confronter à l'art. 51 par un
   juriste.
4. Juridiction compétente (Odoo · droit belge, tribunaux de Nivelles).
5. Résiliation, préavis, reconduction (Odoo · trente jours ; Basecamp ·
   résiliation à tout moment, sans prorata).
6. Sort des données après la fin du contrat (Basecamp · trente puis soixante
   jours ; Odoo · restitution ou suppression).
7. Raisons de modification que le contrat admet (art. 34, 1°).
8. Moyen de publication des interruptions prévues (art. 29, 4°).
9. Assistance · canal et horaires.
10. Publication des prix (art. 31) et politique de changement de prix au
    regard de l'art. 34.
11. Dépôt de garantie (art. 30, al. 2) · aucun, ou lequel.
12. Droit de rétractation (art. 61) · le client cabinet est-il un
    professionnel ; qualification par un juriste.
13. Garanties légales (art. 53, 20°) selon la nature du contrat.
14. Titularité des droits sur OmegaX · œuvre de salariés (ordonnance-loi
    n° 86-033, art. 8, al. 2), œuvre collective (art. 10), cession écrite
    (art. 34) ; et si la licence d'utilisation est une « cession » au sens
    des art. 33 à 36 (art. 36, 4°, la part de 10 %).
15. Art. 229 « instruction documentée » face à l'autorisation de l'art. 201 ·
    à faire qualifier par un juriste.
16. Les factures d'abonnement de VMG viennent d'un système de facturation non
    homologué (décret n° 23/10, art. 22) · effet sur la facture de l'art. 56,
    al. 3.
17. Le programme d'installation sur site doit-il faire accepter le contrat
    avant l'installation.
18. Date de déploiement du serveur dans « À propos » ; menu « ? » du
    gestionnaire de paie (il n'en a pas aujourd'hui, les pages restent
    publiques depuis l'écran d'ouverture).
19. Licence perpétuelle hébergée (PERPETUEL_SAAS) · ses conditions et son
    prix ; le contrat ne connaît que l'abonnement et le sur site, et
    l'acceptation en ligne de ces dossiers reste fermée.
20. Modalités de paiement (art. 53, 6°) · les moyens de paiement acceptés.
21. Droit de rétractation (art. 53, 16°) · son existence ou son absence pour
    le présent contrat, et ses conditions d'exercice (voir le point 12).
22. Garanties légales de conformité, des vices cachés et d'éviction (art. 53,
    20°) · leur énoncé (voir le point 13).
23. Dossiers d'un paquet Cabinet et anciens dossiers sans abonnement · le
    rattachement d'un abonnement depuis la console, sans quoi leur
    acceptation reste fermée.
24. Compléter les mentions publiera la version 2 · fixer sa date de
    communication et d'entrée en vigueur (art. 34), et faire coder avant elle
    la bascule de la version 1 à la 2 (acceptation de la 1 maintenue jusqu'à
    la prise d'effet de la 2), que `versions-publiees.spec.ts` exige.
25. Relevé · l'art. 53, 7° (modalités et délais de fourniture du service)
    n'est pas dans la garde · à relire avec VMG (accès ouvert à la création du
    dossier, essai).
26. Abonnement modifié APRÈS l'acceptation (formule, option, prix) · la
    commande acceptée reste celle gardée avec l'acte, et rien ne redemande
    l'acceptation. Lu · art. 55, al. 1er (le client vérifie « les détails
    de sa commande » avant d'accepter) et al. 2 (accusé de « la commande »).
    Le texte ne dit pas si un changement de formule par l'opérateur est une
    commande nouvelle à accepter, ou l'exécution du contrat accepté (art. 34
    pour une modification à l'initiative de l'éditeur) · à trancher avec un
    juriste, puis à coder (relire l'empreinte de la commande en vigueur
    contre celle gardée, et rouvrir l'acceptation au besoin).

## Paragraphe prêt pour CLAUDE.md

À insérer au § 6 par l'intégrateur (cette ligne ne touche pas CLAUDE.md) :

> **Pages légales et aide (ligne pages-legales, 2026-10-15, demande de
> Manasse).** Contrat de licence, foire aux questions et politique de
> confidentialité sont PUBLICS (écran d'ouverture, cadre imprimable) et
> ouverts en fenêtre par le menu « ? ». LE CONTRAT EST UN MODULE PUR
> (`conditions-licence/conditions-de-licence.ts`), une seule rédaction pour
> l'écran et la pièce jointe ; ce que nul texte ne fixe et que VMG n'a pas
> arrêté s'écrit « (à arrêter par VMG Consulting) », jamais un blanc. UNE
> VERSION PUBLIÉE NE SE RÉÉCRIT PAS (contrat, art. 15 ; art. 53, 9°) · son
> texte est archivé mot pour mot (`versions-publiees.ts`, `versions/`), son
> empreinte SHA-256 (`empreinte.ts`, pur, les deux côtés) gelée par
> `versions-publiees.spec.ts`, qui exige que le générateur rende le texte de
> la version en vigueur · compléter une mention, c'est publier une version
> nouvelle, aux délais de l'art. 34 (`delais-article-34.ts`, jours ouvrables
> du lundi au vendredi sans les fériés, la lecture la plus longue), et le
> spec refuse une seconde version tant que la bascule n'est pas servie.
> L'ACCEPTATION EN LIGNE (art. 55, 56) est tenue par le serveur · version,
> EMPREINTE, date, auteur ET COMMANDE ACCEPTÉE (`conditionsLicenceCommande`)
> sur le dossier, au journal d'audit, accusé à l'écran et courriel portant
> la commande et le texte archivé, par l'administrateur seul. L'écran envoie
> le numéro et l'empreinte du texte de SON code, et l'empreinte de
> l'abonnement qu'il AFFICHE (`empreinteCommande`) · le service relit tout
> SOUS LE VERROU du dossier et refuse en 409 un texte ou un abonnement qui
> ne sont plus ceux affichés ; une page plus ancienne se recharge, une page
> plus récente que le service attend le service. L'ACCUSÉ SE RENVOIE sous
> le même verrou, dans la transaction, s'il n'a jamais pu entrer en file ou
> si la file l'a ABANDONNÉ · jamais en ÉCHEC (la file le retente d'elle-même)
> ni en file ou parti, ce qui ferait un doublon. Dans une fenêtre, un lien
> entre pages légales ouvre la fenêtre de l'autre page, jamais la route
> publique, qui démonterait l'espace de travail (`LienPageLegale`). FERMÉE tant que l'identité de l'éditeur (art. 52), le
> paiement, les réclamations, la rétractation ou les garanties légales
> (art. 53, 6°, 13°, 14°, 16°, 20°) manquent (art. 54, al. 2), et en ligne
> sans abonnement (une cellule lit celui de son siège) ou sous une licence
> perpétuelle hébergée (art. 53, 5°) ; jamais pour le dossier de l'éditeur
> ni une démonstration ; elle n'interrompt jamais l'accès (art. 30, al. 3).
> Le logiciel est une œuvre protégée (art. 47 ; ordonnance-loi n° 86-033,
> art. 1er et 96). VMG DIT SA PRATIQUE, jamais une impossibilité · elle ne
> consulte pas le contenu des dossiers, et chacun de ses accès techniques
> (sauvegarde, restauration de contrôle, requêtes de maintenance) est nommé
> à côté de son workflow. La FAQ ne dit un délai que confronté au code
> (`pages-legales.spec.ts`). « À propos » dit la mise en production de
> l'interface que la publication pose (`OMEGAX_MISE_EN_PRODUCTION`,
> `firebase-hosting-merge.yml`, jour de Kinshasa), sinon « non
> renseignée », et la langue (français, seule).

## Commandes de vérification

```bash
# Serveur (racine)
npx tsc --noEmit
npx jest --shard=1/6 --maxWorkers=1 --workerIdleMemoryLimit=800MB   # … jusqu'à 6/6
npx jest src/modules/conditions-licence --maxWorkers=1   # conditions, commande, accusé, versions publiées
npm run build
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "<base jetable>" --exit-code

# Client (client/)
npx tsc --noEmit
npx vitest run src/pages/pages-legales.spec.ts src/lib/version.spec.ts src/lib/acceptation-conditions-ecran.spec.ts src/pages/confidentialite-code-numerique.spec.ts
npm test
npm run build

# Navigateur (e2e/, montage du § 10)
npx playwright test tests/pages-legales.e2e.ts tests/ecrans.e2e.ts tests/rester-connecte.e2e.ts
```
