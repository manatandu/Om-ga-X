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

## Reste

- Les décisions de Manasse ci-dessous ; tant qu'elles manquent, l'acceptation
  en ligne reste fermée, et c'est voulu (art. 54, al. 2).
- À l'intégration · WebKit des tests navigateur (non lancé en local),
  déploiement à relire (la ligne touche `src/**` et `prisma/**`).
- Date de déploiement du SERVEUR dans « À propos » · non servie (seule celle
  de l'interface a une source réelle, le workflow de publication).

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
    inventée (CLAUDE.md § 9 ter, « À propos » dit ce qui est installé).

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

## Paragraphe prêt pour CLAUDE.md

À insérer au § 6 par l'intégrateur (cette ligne ne touche pas CLAUDE.md) :

> **Pages légales et aide (ligne pages-legales, 2026-10-15, demande de
> Manasse).** Contrat de licence, foire aux questions et politique de
> confidentialité sont PUBLICS (écran d'ouverture, cadre imprimable) et
> ouverts en fenêtre par le menu « ? ». LE CONTRAT EST UN MODULE PUR
> (`conditions-licence/conditions-de-licence.ts`), une seule rédaction pour
> l'écran et la pièce jointe, versionnée et datée ; ce que nul texte ne fixe
> et que VMG n'a pas arrêté s'écrit « (à arrêter par VMG Consulting) »,
> jamais un blanc. L'ACCEPTATION EN LIGNE (Code du numérique, art. 55, 56)
> est tenue par le serveur · version, date et auteur sur le dossier, au
> journal d'audit, accusé à l'écran et courriel portant le texte, par
> l'administrateur seul ; FERMÉE tant que l'identité de l'éditeur (art. 52),
> les réclamations (art. 53, 13° et 14°) ou le prix (art. 53, 5°) manquent
> (art. 54, al. 2), jamais pour le dossier de l'éditeur ni une
> démonstration ; elle n'interrompt jamais l'accès (art. 30, al. 3). Le
> logiciel est une œuvre protégée (art. 47 ; ordonnance-loi n° 86-033,
> art. 1er et 96). La FAQ ne dit un délai que confronté au code
> (`pages-legales.spec.ts`). « À propos » dit la mise en production de
> l'interface que la publication pose (`OMEGAX_MISE_EN_PRODUCTION`,
> `firebase-hosting-merge.yml`), sinon « non renseignée », et la langue
> (français, seule).

## Commandes de vérification

```bash
# Serveur (racine)
npx tsc --noEmit
npx jest --shard=1/6 --maxWorkers=1 --workerIdleMemoryLimit=800MB   # … jusqu'à 6/6
npx jest src/modules/conditions-licence
npm run build
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "<base jetable>" --exit-code

# Client (client/)
npx tsc --noEmit
npx vitest run src/pages/pages-legales.spec.ts src/lib/version.spec.ts
npm test
npm run build

# Navigateur (e2e/, montage du § 10)
npx playwright test tests/pages-legales.e2e.ts tests/ecrans.e2e.ts
```
