# Ligne sage-l7 · éditions et exports

Copie `/home/user/wt-sage-l7`, branche de sauvegarde `travail/sage-l7`.
Migrations `20270182000100_…` et suivantes, bases jetables `l7_ombre`
(ombre), `l7_e2e` (tests navigateur), `l7_scenario` (scénario sur vraie
base) ; serveur 8307, client 4307, tests navigateur `e2e/tests/sage-l7-*.e2e.ts`.

Fonctions (numéros de `docs/comparaison-sage/15-absents-a-trier.md`) · #99
export des seules modifications, puis #59 en trois parties · impression
différée, sélections enregistrées, modèles d'édition et sauts.

## Fait

### #99 · Export des seules modifications (M8-38, p. 51 et 52) · serveur

- Tables `ExportEcritures` (numéro continu par dossier, mode, portée, auteur,
  décomptes, fichier gardé et son empreinte SHA-256) et `EcritureExportee`
  (registre, une ligne par écriture partie, SANS clé étrangère vers
  l'écriture), migration `20270182000100_export_des_modifications`.
- `exports/modifications/export-modifications.ts` (règles pures · empreinte du
  contenu, mouvement, pièce distincte, libellés) ;
  `export-modifications.service.ts` (inventaire par tranches, production en
  mémoire, rangement en une transaction courte, 409 si un autre export a pris
  le numéro) ; `fichier-en-memoire.ts` (tout ou rien, partagé avec
  l'impression différée).
- Routes `GET /exports-ecritures`, `GET /exports-ecritures/apercu`,
  `POST /exports-ecritures` (`@Roles` admin et comptable,
  `@ReserveAuComptable`), `GET /exports-ecritures/:id/fichier`.
- Refus · export vide (aucun numéro pris), export complet au-delà du plafond
  (« refusé plutôt qu'amputé »), export concurrent (409).
- Fichier · feuille « Écritures » en tête de ligne 1, relue par l'import des
  écritures (spec qui passe le fichier à `ImportService.analyser`), feuilles
  « Supprimées » et « Export » (numéro, portée, auteur, décomptes).
- Listes · audit (`ExportEcritures`, fichier exclu), registre hors audit
  motivé, cloisonnement, restitution (fichier non rendu, manifeste qui le
  dit), décompte de `lecture-bornee.spec.ts` (171), profil de fonctions
  (SAISIE).
- Tests · `export-modifications.spec.ts` (13 avec la liste) · nouvelles, modifiée au
  brouillard, réenregistrée à l'identique, validée depuis, supprimée dite
  une fois, brouillard non compris, situation et à-nouveau provisoire hors
  champ, export concurrent, relecture par l'import, plafond par lots et
  complet refusé, export complet.

### #99 · fenêtre et test navigateur

- Fichier > Exporter les modifications (`ExportModificationsPage.tsx`,
  `lib/export-modifications.ts` et son spec) · aperçu du prochain export
  (case « Brouillard compris »), « Exporter les modifications » et « Export
  complet… » (confirmation) sous `peutValider`, téléchargement aussitôt, un
  échec de téléchargement dit sans défaire l'export (« il se reprend depuis
  la liste »), liste des exports (portée, décomptes, en attente, fichier
  retéléchargeable, empreinte en infobulle), tranche dite.
- Test navigateur `e2e/tests/sage-l7-export-modifications.e2e.ts` (vert sous
  Chromium) · premier export, brouillard modifié et nouvelle pièce, retrait
  dit seul, validation depuis l'envoi, export complet confirmé,
  retéléchargement, refus d'un export vide sans numéro pris.
- DÉFAUT TROUVÉ AU SERVEUR RÉEL · `lister` nommait une variable `exports`,
  qui masquait celui du module compilé en CommonJS (500 « Cannot access
  'exports' before initialization ») · renommée, et le spec appelle
  désormais `lister` (vu tomber sur l'ancien nom avant correction).

### #99 · scénario sur vraie base à travers une clôture (vert le 2026-10-15)

Serveur compilé sur `l7_scenario`, appelé par son API, base relue par psql.
N · E1 validée, E2 et E3 au brouillard · export n° 1 (brouillard compris) ·
3 nouvelles, 6 lignes. E2 corrigée au brouillard (55 000 au lieu de 50 000),
E3 retirée, E4 saisie, tout validé ; N+1 ouvert par les à-nouveaux
provisoires · export n° 2 (brouillard compris) · 1 nouvelle, 1 modifiée,
1 retrait, 4 lignes, aucun à-nouveau provisoire parti. Clôture de N, E5 en
N+1 · export n° 3 (livre-journal) · 3 nouvelles (solde des comptes de
gestion, à-nouveau définitif, E5), 7 lignes ; export n° 4 refusé (« aucune
modification depuis l'export n° 3 »). Relu dans les trois fichiers · chaque
écriture de la base partie à son dernier envoi avec ses lignes et son débit
d'aujourd'hui, rien d'autre que le retrait nommé (E3, au n° 2), E1, E4, E5
et les deux écritures de clôture une fois chacune, E2 deux fois
(« Modifiée · remplace l'envoi n° 1 · validée depuis »), registre à 6
vivantes et 1 retirée ; l'import des écritures d'un second dossier analyse
les trois fichiers sans colonne exigée manquante.

### #59, partie 1 · impression différée (Fichier > Impressions différées)

- Table `ImpressionDifferee` (numéro continu par dossier, livre, critères
  relus, libellé figé, état EN_ATTENTE, EN_COURS, PRETE, ECHOUEE, dates de
  demande, de début et de production, motif, fichier et empreinte, fichier
  retirable), migration `20270182000200_impression_differee`.
- `exports/impression-differee/` · règles pures (`criteresOuMotif`,
  `libelleDemande`, `motifEchecDe`, `estInterrompue`, délai de trente
  minutes), service (demande sous verrou par dossier ; `traiter` déclare
  interrompues les productions tombées, prend la plus ancienne demande, une
  à la fois par dossier, la produit HORS transaction par le moteur de
  l'export du même livre via `produireEnMemoire`, et ne range que si la
  demande est encore celle prise, relue `FOR UPDATE`), contrôleur
  (`GET`, `POST`, `POST traiter` ouverts à la lecture seule comme
  l'impression du journal, `POST :id/retirer-fichier` au comptable,
  `GET :id/fichier`).
- Trois livres · journal (journal, dates, brouillard ; le journal entier
  produit s'enregistre comme imprimé au nom du demandeur), grand livre
  (présentation du cabinet ou à plat), balance (avec ou sans grands livres).
- La production se fait DANS une requête · Cloud Run n'alloue le processeur
  que pendant les requêtes ; la fenêtre relance `traiter` après la demande
  et tant qu'il en reste, relit la liste pendant qu'une production tourne.
- Listes · audit (fichier exclu, libellé), cloisonnement, profil de fonctions
  (hors profil, motif), restitution (fichier non rendu, manifeste qui le
  dit, colonnes binaires relues), décompte de `lecture-bornee.spec.ts` (172).
- Tests · `impression-differee.spec.ts` (15) · numéro et libellé, refus
  avant tout numéro, production et empreinte, journal au nom du demandeur,
  refus de volume tel quel, panne en route sans fichier partiel, une à la
  fois, interruption lue puis déclarée, production finie après son
  interruption non rangée, fichier retiré, liste ; client
  `lib/impressions-differees.spec.ts` ; navigateur
  `e2e/tests/sage-l7-impressions-differees.e2e.ts` (vert sous Chromium).

### #59, partie 2 · sélections enregistrées

- Table `SelectionEdition` (édition JOURNAL ou IMPRESSION_DIFFEREE, nom
  unique par édition et dossier, critères relus, auteur, dates), migration
  `20270182000300_selections_edition`.
- `exports/selections/` · règles pures (`CRITERES_PAR_EDITION`,
  `criteresSelectionOuMotif` · clé inconnue, type faux et exercice refusés,
  valeur vide non gardée ; `nomOuMotif`), service (liste bornée qui dit son
  total, journal retiré DIT au rappel, nom en double refusé avec ses deux
  issues, remplacer et supprimer unitaires), contrôleur (`GET ?edition=`,
  `POST`, `PUT :id`, `DELETE :id` au comptable et à l'administrateur).
- Écran · `components/SelectionsEnregistrees.tsx` dans les filtres du
  journal (rappel appliqué aussitôt) et dans le formulaire des impressions
  différées ; enregistrer, remplacer (même nom) et supprimer sous
  `peutEcrire`.
- Listes · audit et libellé, cloisonnement, profil de fonctions (hors
  profil, motif), décompte de `lecture-bornee.spec.ts` (173).
- Tests · `selections-edition.spec.ts` (7, dont les critères du journal
  relus dans `JournalPage.tsx`, `interface Filtres`), client
  `lib/selections-edition.spec.ts`, navigateur
  `e2e/tests/sage-l7-selections.e2e.ts` (vert sous Chromium).

### #59, partie 3 · modèles d'édition et sauts (décision L7-1)

- Table `ModeleEdition` (édition PLAN_COMPTABLE, PLAN_TIERS ou
  PLAN_ANALYTIQUE, nom unique par édition et dossier, colonnes facultatives
  gardées, saut AUCUN, LIGNE ou PAGE), migration
  `20270182000400_modeles_edition`. Aucun modèle pour un état financier ni
  un livre obligatoire.
- `exports/modeles-edition/` · catalogue des colonnes par édition (deux
  colonnes qui identifient, jamais retirées), `modeleOuMotif` (nom, «
  Standard » réservé, colonne inconnue ou en double, saut), service et
  contrôleur (`GET ?edition=`, `POST`, `PUT :id`, `DELETE :id` au comptable
  et à l'administrateur).
- Écran · `lib/modeles-edition.ts` (catalogue en MIROIR, relu par le spec du
  serveur ; `appliquerModele` · colonnes tues, tri stable par groupe, un
  bloc par groupe, aucune ligne retirée), `EditionStructure` sous un modèle
  (ligne blanche, ou une table par groupe avec l'en-tête repris et
  `.edition-saut-page` à l'impression ; le périmètre nomme le modèle),
  `ChoixModeleEdition` (Standard ou modèle du dossier ; « Personnaliser… »
  sous `peutEcrire`, boîte en `PortailModale`) au plan comptable (groupe ·
  classe, lue par `classeDuNumero`, AUDCIF Titre VII ch. 2), au plan des
  tiers (groupe · type) et au plan analytique, qui gagne son édition
  imprimée (`editionAnalytique`, groupe · rubrique de premier niveau).
- Listes · audit et libellé, cloisonnement, profil de fonctions (hors
  profil, motif), décompte de `lecture-bornee.spec.ts` (174).
- Tests · `modeles-edition.spec.ts` (6, dont le miroir), client
  `lib/modeles-edition.spec.ts` (6), navigateur
  `e2e/tests/sage-l7-modeles-edition.e2e.ts` (vert sous Chromium, rendu
  relu sous le média d'impression).

### Largeurs et relance

- `e2e/tests/sage-l7-largeurs.e2e.ts` · les trois fenêtres à 390 et à
  1440 px, aucune page qui défile de côté, la commande principale dans
  l'écran. Il a trouvé la barre du plan comptable (et celle du plan des
  tiers) qui sortait de l'écran par la gauche à 390 px · elle passe
  désormais à la ligne.
- Impressions différées · une demande restée en attente derrière la
  production d'un autre poste est relancée par la relecture de la liste,
  sans attendre une nouvelle ouverture de la fenêtre.
- Balayage de tous les menus (`ecrans.e2e.ts`) vert dans les deux
  référentiels avec les nouvelles fenêtres.

### Relecture « échecs silencieux », premier tour (2026-10-15)

- **M6 · un livre ne se lit plus par un curseur qui peut disparaître.** Le
  `cursor` de Prisma relit la ligne-curseur en base · retirée pendant la
  production (brouillard supprimé, entrée du registre remplacée), la tranche
  suivante revenait vide et le livre sortait tronqué, ses totaux bouclant.
  `common/lecture-par-lots.ts` · `idApres` et `apresLaCle` (pagination par
  la CLÉ, valeurs de la dernière ligne rendue, nuls en dernier comme
  PostgreSQL, identifiant en dernier) · journal exporté (date, pièce,
  identifiant), inventaire de l'export des modifications (registre par
  identifiant, écritures par date et identifiant). Le grand livre (à plat
  et présentation du cabinet) se trie sur des champs d'autres tables · il
  garde le curseur et se CONFRONTE au décompte pris au départ sur le même
  filtre (`confronterAuDecompte`) · un écart refuse le livre (connexion
  détruite au téléchargement, demande ÉCHOUÉE en différé). Doublures
  alignées sur Prisma (un curseur absent ne rend rien). Specs ·
  `lecture-par-lots`, `journal-en-flux`, `grand-livre-complet-en-flux`,
  `export-fpm`, `export-modifications`.
- **M2 · l'inventaire ne parcourt plus la table des lignes.** Les lignes se
  comptent par `ligneEcriture.groupBy` sur les écritures de la tranche, du
  dossier ; au-delà du plafond, ce qui attend se compte par la base
  (`jamaisPartiesDepuis`, NOT EXISTS sur le registre), sans lire la suite.
- **M3 · l'import refuse l'envoi qu'il ne sait pas relire.**
  `motifEnvoiNonRelu` · une colonne « Mouvement » autre que « Nouvelle »,
  ou une feuille « Supprimées » non vide (`Tableau.lignesSupprimees`), et
  l'import des écritures refuse le fichier ENTIER en 400 nommé, avant toute
  lecture du dossier. Le récapitulatif ne dit plus que le fichier « se
  relit » (`MENTION_RELECTURE`).
- **m3 · la pièce qu'aucun export ne peut porter est nommée** (journal,
  numéro, date, lignes, plafond · `motifHorsPlafond`), à l'aperçu et au
  refus, jamais « aucune modification ».
- **m8 · le brouillard envoyé puis modifié hors de la portée se compte**
  (`brouillardModifieHorsPortee`, aperçu, récapitulatif, résultat).
- **M4 · le journal produit en différé ne se marque imprimé qu'une fois
  RANGÉ.** Le moteur est appelé sans auteur ; `ranger` enregistre
  l'impression du journal (`ExportService.impressionDuJournal`,
  `enregistrerImpressionDans`) dans SA transaction, après la mise à PRÊTE ·
  ensemble ou pas du tout.
- **m4 · un rangement qui échoue rend la demande ÉCHOUÉE**, motif nommé
  (`MOTIF_NON_RANGEE`), consigné · elle ne reste plus « en cours ».
- **M5 · le motif d'interruption n'affirme plus un redémarrage** (« non
  terminée dans le délai de requête du serveur »). Le délai par défaut de
  Cloud Run n'a pas pu être LU (documentation officielle inaccessible depuis
  le poste, politique réseau) · trente minutes restent, écrit en
  commentaire ; le délai réel et le processeur hors requête vont à Manasse
  par le coordinateur. Workflow de déploiement non touché.
- **m1, m2 · `produireEnMemoire`** · un moteur qui rend la main sans fermer
  son fichier est une panne (plus d'archive inachevée rangée) ; plus de
  rejet non traité quand le tuyau tombe (`fichier-en-memoire.spec.ts`,
  le test m2 vérifié rouge sans la correction).
- **m5 · listes paginées par le numéro** (`pagination-par-numero.ts`,
  `?avant=`, `plusAnciensAvant`) · un ancien export ou une ancienne
  impression se retrouve et se retélécharge.
- **M1 · un refus n'a plus de message vide** (`lib/message-refus.ts` ·
  `messageDuRefus`, phrase d'état VIDE en HTTP/2, rabat sur le code ;
  `messageOuDefaut` dans les quatre composants). L'export qui échoue sur une
  panne du réseau ou un 5xx relit la liste et l'aperçu et dit « un export a
  pu être rangé malgré l'erreur, vérifiez la liste » ; un aperçu en échec ne
  grise plus le bouton (M2, `rienAExporter` ne lit qu'un aperçu LU).
- **M5 (écran) · un échec réseau de `traiter` relit la liste**, sans dire que
  la production n'a pas été lancée ; la demande dont l'issue est incertaine
  le dit de même.
- **m6 · plan analytique** · sections à `null` au changement d'axe, réponse
  périmée jetée par jeton, « Aucune section » sur une liste LUE seulement,
  périmètre de l'édition « Sections de l'axe … non lues · rien n'est
  imprimé » (`perimetreDesSections`).
- **m9 · le modèle enregistré reste choisi si la relecture tombe**
  (`avecLeModele`) ; la troncature de la liste des modèles se dit.
- **m10 · licence échue** · `LicenceGuard` inchangé (lecture seule = GET et
  HEAD) ; le refus d'une demande ou d'une production le dit et renvoie vers
  l'export direct du livre (`messageLicenceEchue`), l'aide aussi. LIMITE
  écrite · un dossier échu ne produit plus d'impression différée.
- **m5 (écran) · « Exports plus anciens », « Impressions plus anciennes »**
  (`poursuivreListe`, `poursuivreImpressions`, `garderLesPlusAnciennes` · la
  relecture pendant une production garde les pages chargées).
- **m7 · la restitution sort les fichiers des exports et des impressions
  prêtes** à côté des tables (`exports-ecritures/`,
  `impressions-differees/`), le manifeste le dit exactement · la phrase qui
  disait que les tables les rendaient était fausse d'un brouillard modifié
  ou retiré.
- **Vérifié sur vraie base (2026-10-15, serveur compilé, PostgreSQL 16).**
  Scénario du n° 99 à travers la clôture rejoué vert, plus l'import ·
  l'envoi n° 2 (une pièce modifiée, une retirée) refusé ENTIER en 400 nommé,
  les n° 1 et 3 (« Nouvelle » seulement) importés. Volume · 1 100 écritures
  (plus de deux tranches de 500), journal exporté complet (2 200 lignes,
  1 100 pièces, débit au franc), grand livre à plat (2 200 lignes) et du
  cabinet produits, aperçu de l'export (1 100 nouvelles) ; l'impression
  différée du journal ne marque le journal imprimé qu'une fois rangée (une
  impression de plus, pas à la demande) ; liste paginée (50, puis 2 et 1),
  `?avant=x` refusé en 400. Plafond à 4 lignes (second serveur,
  `EXPORT_MAX_LIGNES=4`) · attente comptée par la base (3, puis 1, puis 0),
  pièce de six lignes nommée à l'aperçu et refusée en 413, aucun numéro
  pris. Tests navigateur de la ligne (5) verts sous Chromium.

### Relecture TypeScript, second tour (2026-10-15)

Coordinateur · 1 BLOQUANT, 2 MAJEUR, 8 MINEUR, le BLOQUANT et M1 reproduits
par lui sur base jetable. Chaque correction a son test, rouge sans elle.

- **B1 · une pièce jamais partie retenue deux fois.** Sa date avançait
  pendant l'inventaire (brouillard corrigé sur un autre poste) · la clé
  (date, identifiant) la relisait dans une tranche suivante, le fichier la
  portait deux fois sous la même clé de pièce, « Nouvelle » deux fois, et
  l'import fondait les deux en UNE pièce aux montants doublés, équilibrée
  donc admise. L'inventaire tient l'ensemble des écritures déjà vues, la
  production saute une pièce déjà écrite. Test à tranches de deux
  (`LOT_LECTURE` remplacé par `jest.doMock`), aperçu et fichier relu.
- **M1 · l'empreinte suivait l'ordre physique des lignes.** L'ordre canonique
  ne départageait que sens, compte, montants et libellé · deux lignes à
  échéances (ou cours, ou devise) différentes restaient dans l'ordre rendu
  par la base, qu'un lettrage change. La pièce repartait « Modifiée » sans
  avoir changé, contre L7-4, et l'import refusait l'envoi entier. Ordre
  TOTAL sur tout le contenu de la ligne, comparé caractère par caractère
  (jamais `localeCompare`, qui suit la version d'ICU).
- **M2 · le journal exporté omettait ou doublait une pièce dont la date
  change en route.** Le journal paginé par la clé relisait une pièce dont la
  date avance (lignes en double, totaux faux qui bouclaient) et ne relisait
  jamais celle dont la date recule (livre amputé). Décompte des lignes au
  départ SUR LE FILTRE MÊME DE LA LECTURE (celui de `verifierVolume` arrête
  le statut hors situation, et le livre d'un journal de situation se serait
  refusé), ensemble des pièces écrites, confrontation au décompte avant la
  ligne des totaux · 409 nommé, téléchargement coupé, impression différée
  échouée.
- **Mineur 1 · l'inventaire relisait tout le dossier à chaque aperçu.** Les
  écritures jamais parties se lisent par une anti-jointure sur le registre
  (NOT EXISTS, par tranches, clé (date, identifiant)), et le regroupement
  des lignes ne porte que sur elles ; les supprimées par une anti-jointure
  sur les écritures, statut par statut ; le registre ne se relit que pour
  le brouillard parti (tout, statut par statut, à l'export complet). Index
  du registre prolongé de l'identifiant (`ecritures_exportees_a_relire_idx`,
  migration `20270182000500`, `migrate diff` sans écart) et lectures
  rangées dans l'ordre ENTIER de l'index · PostgreSQL ne lit pas `IS NULL`
  comme une égalité, et « par l'identifiant » seul triait la tranche ou
  parcourait la clé primaire de tous les cabinets. Plans relus sur base
  jetable à 400 000 entrées · supprimées en parcours d'index ordonné et
  anti-jointure par boucle (5 000 en 14 ms) ; relecture du brouillard par
  l'index (tri d'une tranche de 5 000 choisi par le coût, parcours ordonné
  sans tri à 90 000). Les écritures jamais parties restent une lecture du
  dossier par la base (aucun index (dossier, date, identifiant)), une seule
  tranche quand l'envoi est à jour · dit, non changé. Le statut est écrit
  en clair dans chaque requête brute, comme le filet le relit.
- **Mineur 2 · le correctif m2 ne couvrait pas un tuyau tombé en cours
  d'écriture.** La fermeture du fichier en mémoire recevait son
  gestionnaire au retour du moteur seulement · un tuyau tombé pendant que
  le moteur lisait encore laissait un rejet non traité, qui fait tomber le
  processus. Le gestionnaire est posé à la naissance de la promesse, et
  `await fermee` relit toujours le rejet (test rouge sans, attente de 30 ms
  dans le moteur).
- **Mineur 3 · le refus d'un livre qui n'avait rien envoyé coupait la
  connexion.** `envoyerXlsxEnFlux` (sorti du contrôleur dans
  `exports/envoi-en-flux.ts`) décidait sur « le fichier est ouvert » · le 409
  de `confronterAuDecompte` devenait un téléchargement interrompu sans
  motif. Le moteur écrit dans une RETENUE (256 Kio, convention d'OmegaX),
  qui ne part qu'une fois pleine ou à la fin ; l'échec avant tout envoi
  (`res.headersSent` faux) retire les en-têtes du classeur et remonte au
  filtre de Nest, au-delà la connexion est détruite comme avant. Le poste
  qui ferme le téléchargement détruit la retenue, et `attendreLeTuyau`
  refuse un tuyau fermé (il ne demandait plus jamais de « drain », et le
  moteur lisait la base jusqu'au bout, puis attendait sans fin). Test sur
  une vraie application Express · 409 et motif sans en-têtes de classeur,
  connexion coupée après le premier octet, moteur arrêté par la fermeture ;
  deux rouges sous l'ancien envoi.
- **Mineur 4 · le journal d'audit gardait un export sans numéro.** La
  création ne rendait que l'identifiant, et l'extension d'audit garde ce
  que la création rend. Elle rend l'export entier sans son fichier
  (`EXPORT_SANS_FICHIER`, que la liste reprend, dossier excepté).
- **Mineur 5 · un remplacement sans saut effaçait le saut du modèle.** Le
  service posait AUCUN quand le champ manquait, et `@IsOptional()` laissait
  passer `null` (CLAUDE.md § 9). Absent, le saut enregistré est gardé ;
  `null` est refusé par `@FacultatifNonNul` à la porte, et par le service.
- **Mineur 6 · un second export attendait le verrou du premier.** Le
  rangement prenait `pg_advisory_xact_lock` · un second export du dossier
  retenait une connexion jusqu'à la fin du premier (délai de 120 s) pour un
  refus certain. `pg_try_advisory_xact_lock`, et un 409 nommé aussitôt,
  rien rangé, aucun numéro pris.
- **Mineur 7 · typage.** `apresLaCle` et `CleDePage` sont génériques sur les
  champs du filtre du modèle lu (`NoInfer`), l'identifiant exigé en dernier
  par le type (`@ts-expect-error` gelé au spec, champ mal orthographié
  compris) ; `traiter` relit les critères gardés par `criteresOuMotif` au
  lieu d'une conversion · des critères qui ne se relisent plus rendent la
  demande ÉCHOUÉE, motif dit, sans appeler le moteur ; `estInterrompue`
  prend l'énumération.
- **Mineur 8 · le fichier rendu était recopié.** `fichier()` (export des
  modifications, impression différée) rend le tampon de Prisma tel quel
  (`toBe` au spec). MÉMOIRE MESURÉE (2026-10-15, base jetable PostgreSQL 16,
  serveur compilé lancé avec `--max-old-space-size=460`, 100 000 écritures
  validées de deux lignes, soit 200 000 lignes, le plafond ; pic de mémoire
  résidente `VmHWM`, remis à zéro avant chaque geste, serveur relancé entre
  les mesures) · journal en flux direct, pour comparaison, 296 Mio (34,6 s,
  18,6 Mo) ; impression différée du même journal, produite en mémoire,
  677 Mio (37,8 s) ; export complet des modifications 688 Mio (49,6 s,
  15,3 Mo) ; premier export des modifications, sur des lignes fraîchement
  insérées et après un aperçu de 4,6 s, 670 Mio (123,8 s) ;
  retéléchargement 1,6 s. Transaction de rangement la plus longue observée
  11 s (délai 120 s). Le tas V8 borné à 460 Mio a tenu à chaque fois ; la
  mémoire résidente le dépasse (tampons hors tas, moteur de Prisma, fichier
  en mémoire puis passé en paramètre). Aucune comparaison avec la mémoire
  de Cloud Run, non lue ici.

### Relecture des écrans, second tour (2026-10-15)

Coordinateur · aucun BLOQUANT ni MAJEUR, 14 MINEUR.

- **1 et 2 · la relance de la production.** Elle partait toutes les quatre
  secondes même quand une production tournait déjà (un autre poste, ou le
  serveur qui finit après un 504) ou après un refus nommé (sous licence
  échue, un 403 toutes les quatre secondes), et « tourne » se lisait sur la
  liste entière, pages anciennes jamais relues comprises. La règle
  `doitFaireProduire` (rien ne tourne, il reste à produire, aucune
  suspension) décide de chaque relance ; un refus nommé SUSPEND la relance
  jusqu'au prochain geste (demander, « Relancer la production ») ; « tourne »
  se lit sur la première page relue. La boucle s'arrête au démontage
  (`monte.current` à chaque tour et dans la minuterie) · elle survivait à la
  fermeture, et une réouverture en lançait une seconde. Aide · la production
  commencée se termine au serveur, les demandes en attente reprennent à la
  prochaine ouverture.

## Reste
- Premier tour de relecture « échecs silencieux » (coordinateur, 6 MAJEUR,
  10 MINEUR) · les seize corrigés, voir « Relecture, premier tour »
  ci-dessus. La suite serveur complète est passée par le coordinateur avant
  l'intégration · ici, seulement les specs touchées (`--maxWorkers=1`), la
  suite client entière (`vitest`, deux ouvriers), les typages et les
  constructions. Délai de requête de Cloud Run et processeur hors requête ·
  décision de Manasse, portée par le coordinateur.
- Avant la relecture · typage serveur et client verts, client `npm test`
  (270 fichiers, 2 104 tests) et `npm run build` verts, construction du
  serveur verte, tranches 1/6 (149 suites, 1 777 tests) et 2/6 (149
  suites, 2 070 tests) vertes ; tranches 3 à 6 arrêtées par le
  coordinateur (mémoire du poste, résultats dépassés par les corrections).
  WebKit non lancé (absent du poste).

## Décisions par la loi

- **L7-1 · Ce qui se personnalise, et ce qui ne se personnalise pas.**
  AUDCIF Titre IX ch. 2, conditions de recevabilité · l'entreprise qui
  produit ses états à l'aide de l'outil informatique doit « reproduire à
  l'identique la contexture des imprimés normalisés » et « ne créer aucune
  rubrique » ; ch. 1 § 2.4 · nom, date d'arrêté, période et unité monétaire
  « dans chacune des pages » ; SYCEBNL Partie 4 ch. 1 § 1.4 · « établis et
  présentés conformément aux modèles du Système comptable », et art. 16, 6°
  · « la présentation des états financiers est identique d'un exercice à
  l'autre ». LES ÉTATS FINANCIERS N'ONT AUCUN MODÈLE PERSONNALISÉ. Les livres
  obligatoires (AUDCIF art. 19, non écarté par l'art. 3 du SYCEBNL pour ses
  trois premiers tirets) « doivent être tenus sans blanc ni altération
  d'aucune sorte » (art. 20, al. 1) et leurs données restituées avec
  « l'origine, le contenu et l'imputation » (art. 22, 1°) · un saut de ligne
  est un blanc, une colonne retirée une donnée perdue · journal, grand livre
  et balance gardent leur présentation, aucun modèle ne s'y applique. Le
  modèle personnalisé et les sauts ne valent que pour les ÉDITIONS DE
  TRAVAIL (listes du plan comptable, du plan des tiers, du plan analytique),
  dont le périmètre se dit toujours et dont les colonnes qui identifient la
  ligne (numéro, intitulé) ne se retirent pas.
- **L7-2 · L'impression différée est numérotée et datée, et jamais amputée.**
  AUDCIF art. 22, 7° · « les états périodiques fournis soient numérotés et
  datés ». Chaque demande prend un numéro de la suite du dossier et garde sa
  date de demande et sa date de production ; l'édition est produite par le
  moteur de l'export du même livre, qui refuse au-delà du plafond mesuré
  (CLAUDE.md § 8 bis) avant le premier octet · un refus ou une panne rend
  l'impression ÉCHOUÉE, motif dit, jamais un fichier partiel.
- **L7-3 · L'export des modifications est numéroté, daté, et dit ce qu'il
  retire.** AUDCIF art. 22, 7° · états numérotés et datés, et « chaque donnée
  entrée par transmission d'un autre système doit être appuyée d'une pièce
  justificative probante » · le fichier remis porte son numéro, sa date, son
  auteur, et son empreinte (SHA-256) est gardée au serveur, pour que le
  système qui le reçoit puisse citer l'envoi. Une écriture du brouillard
  retirée depuis son envoi est NOMMÉE dans l'export suivant ; une écriture
  modifiée au brouillard après son envoi repart entière, marquée « modifiée,
  remplace l'envoi n° k ».
- **L7-4 · Ce que « modifiée » veut dire pour une écriture validée.** AUDCIF
  art. 22, 2° · la validation rend le traitement irréversible et « interdit
  toute suppression, addition ou modification ultérieure ». Le fichier
  d'échange porte ce que l'art. 22, 1° nomme · origine, contenu, imputation
  (date, journal, pièce, référence, compte, libellé, montants, devise, statut,
  date de valeur de l'art. 22, 4°). Le LETTRAGE et le POINTAGE n'en sont pas ·
  ce sont des rapprochements de lignes, défaits et refaits jusqu'à la clôture
  de période, qui ne changent ni l'origine, ni le contenu, ni l'imputation de
  l'écriture. Une écriture validée n'est donc « modifiée » qu'une fois · par
  sa validation même, quand elle était partie au brouillard. Envoyée validée,
  elle ne repart plus ; sa correction (inscription en négatif, art. 20,
  al. 2) part comme une écriture nouvelle.

- **L7-5 · Une sélection enregistrée se garde au DOSSIER, jamais au poste
  (décision de la ligne · aucun texte ne la régit).** Elle nomme des objets
  du dossier (un journal, des dates) qui n'ont de sens que là ; un dossier
  se travaille à plusieurs et sur plusieurs postes, et le réviseur reprend
  la sélection du comptable pour refaire la même édition ; le stockage du
  navigateur se perd (données effacées, fenêtre privée, autre poste) et ne
  porte que des commodités propres au poste (CLAUDE.md, stockage du
  navigateur). Elle ne garde jamais l'exercice · elle se rappelle sur
  l'exercice choisi.

## Questions à Manasse

- Aucune question de droit · L7-1 à L7-4 sont tranchées par les textes lus,
  L7-5 (sélections au dossier) est un choix d'organisation d'OmegaX qu'aucun
  texte ne régit · à revoir s'il préfère des sélections propres à chaque
  utilisateur.
- À savoir · Cloud Run n'alloue le processeur que pendant les requêtes (le
  déploiement ne demande pas l'inverse) ; l'impression différée se produit
  donc DANS une requête que la fenêtre relance. Une demande faite puis la
  fenêtre fermée avant que la requête ne parte attend la prochaine
  ouverture de la fenêtre ; si une production « à fond de cale », sans
  fenêtre ouverte, est voulue, il faudrait un processeur alloué en
  permanence (`--no-cpu-throttling`) ou une tâche planifiée · décision
  d'exploitation, non prise ici.
- À savoir · les fichiers des exports et des impressions différées sont
  rangés en base (Neon) · le retrait du fichier d'une impression est servi,
  celui d'un export des modifications ne l'est pas (sa pièce est celle que
  la receveuse cite) ; le volume reste à surveiller.

## Pour CLAUDE.md

**Ligne sage-l7 · éditions et exports (2026-10-15).** EXPORT DES SEULES
MODIFICATIONS (fonction 99, Fichier > Exporter les modifications,
`exports/modifications/`) · numéro continu par dossier, date, auteur et
empreinte SHA-256 du fichier, gardé en base et retéléchargeable (AUDCIF
art. 22, 7°) ; un REGISTRE par écriture partie (`EcritureExportee`, SANS clé
étrangère · une écriture du brouillard retirée y laisse sa trace) ; part ce
qui n'est jamais parti, le brouillard modifié depuis son envoi (« Modifiée ·
remplace l'envoi n° k »), et les retraits, nommés sur la feuille
« Supprimées » ; « modifiée » se lit sur l'origine, le contenu et
l'imputation (art. 22, 1°), jamais le lettrage ni le pointage, et une
écriture validée ne change plus (art. 22, 2°) · partie validée, elle ne
repart pas, sa correction en négatif part comme une écriture nouvelle
(décisions L7-3, L7-4). Ni simulation ni à-nouveau provisoire. Au-delà du
plafond, par lots dans l'ordre des dates, ce qui attend dit ; le complet
refusé plutôt qu'amputé ; un export vide ne prend aucun numéro ; deux
exports concurrents, 409. Feuille « Écritures » relue par l'import des
écritures (en-tête en ligne 1, une pièce par écriture, identifiant et
mouvement en colonnes · la porte de la fonction 102). JAMAIS `exports` COMME
NOM DE VARIABLE dans un fichier qui exporte · compilé en CommonJS, il masque
celui du module (500 au premier serveur réel, vert sous les tests).
IMPRESSION DIFFÉRÉE (fonction 59, Fichier > Impressions différées,
`exports/impression-differee/`) · journal, grand livre ou balance demandés
maintenant, numérotés et datés, produits par le moteur de leur export et sous
son plafond (`produireEnMemoire`, tout ou rien), retrouvés plus tard ; un
refus ou une panne rend la demande ÉCHOUÉE, motif dit, jamais un fichier
partiel ; une à la fois par dossier ; produite DANS une requête (Cloud Run
n'alloue le processeur que pendant les requêtes), la fenêtre relançant
`traiter` ; au-delà de trente minutes une production tombée est déclarée
interrompue, et un processus qui finit après ne range rien (relu
`FOR UPDATE`) ; le journal entier produit s'enregistre comme imprimé au nom
du demandeur ; le fichier se retire, la demande reste (décision L7-2).
SÉLECTIONS ENREGISTRÉES (`exports/selections/`) · au DOSSIER, jamais au
poste (décision L7-5), critères relus clé par clé, jamais l'exercice, un
journal retiré dit au rappel ; filtres du journal et formulaire des
impressions différées. MODÈLES D'ÉDITION ET SAUTS (`exports/modeles-edition/`)
· les ÉDITIONS DE TRAVAIL seules (plan comptable, plan des tiers, plan
analytique) · jamais un état financier (AUDCIF Titre IX ch. 2, contexture à
l'identique) ni un livre obligatoire (art. 20, al. 1, sans blanc ; art. 22,
1°) (décision L7-1) ; les colonnes qui identifient la ligne ne se retirent
pas, les autres se taisent dans l'ordre de l'édition ; le saut sépare les
groupes (classe, type de tiers, rubrique) par une ligne blanche ou une page,
l'en-tête repris ; catalogue tenu en MIROIR serveur et écran.

## Pour build-log.md

| 99 | 2026-10-15 | L7 | fait | rien au périmètre · la reprise par l'expert-comptable (n° 102, L9) n'est pas faite, sa porte reste ouverte (identifiant et mouvement de chaque écriture, feuille des supprimées, fichier relu par l'import) | dire un retrait sans clé étrangère vers l'écriture ; décider ce que « modifiée » veut dire d'une écriture validée (art. 22, 1° et 2°) ; une variable `exports` qui masquait le module compilé, vue au seul serveur réel |
| 59 | 2026-10-15 | L7 | fait | rien au périmètre | trancher ce qui se personnalise (états financiers et livres obligatoires exclus) ; produire dans une requête parce que Cloud Run n'alloue le processeur que pendant les requêtes, avec l'interruption d'une production tombée ; la barre du plan comptable qui sortait de l'écran à 390 px |

## Pour features.csv

```
59,"Modèles d'édition, sauts de ligne ou de page, impression différée, sélections enregistrées",M2-34 M1-27 M1-50 M1-68 M10-62 M1-132 M8-57,L7,should,yes,"modèles et sauts des éditions de travail (jamais états financiers ni livres obligatoires) ; impression différée numérotée, produite par le moteur de l'export, jamais partielle ; sélections au dossier"
99,Export des seules modifications depuis le dernier export,M8-38,L7,should,yes,"export numéroté, fichier gardé et empreinte ; registre par écriture, retraits nommés, brouillard modifié renvoyé ; relu par l'import"
```

## Commandes de vérification

```bash
npx tsc --noEmit && (cd client && npx tsc --noEmit)
npx jest src/modules/exports --maxWorkers=1
(cd client && npx vitest run src/lib/export-modifications.spec.ts)
(cd e2e && PW_CHROMIUM=/opt/pw-browsers/chromium OMEGAX_APP=http://localhost:4307 \
  OMEGAX_API=http://localhost:4307/api npx playwright test tests/sage-l7-*.e2e.ts)
# suite serveur entière, une tranche après l'autre
for k in 1 2 3 4 5 6; do npx jest --shard=$k/6 --maxWorkers=1 --workerIdleMemoryLimit=800MB; done
# relecture « échecs silencieux », specs touchées
npx jest src/common/lecture-par-lots.spec.ts src/modules/exports src/modules/import \
  src/modules/journaux/impressions-journal.spec.ts src/modules/comptabilite/lectures-hors-situation.spec.ts --maxWorkers=1
(cd client && npx vitest run --maxWorkers=2)
# scénarios sur vraie base (scratchpad de la session) · scenario-99.cjs,
# scenario-m6.cjs (volume), scenario-plafond.cjs (serveur EXPORT_MAX_LIGNES=4)
```
