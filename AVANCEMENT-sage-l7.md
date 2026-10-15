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

## Reste
- Bloc du § 3 complet, tests navigateur.

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

(aucune encore)

## Pour CLAUDE.md

(à écrire en fin de ligne)

## Pour build-log.md

(à écrire en fin de ligne)

## Pour features.csv

(à écrire en fin de ligne)

## Commandes de vérification

```bash
npx tsc --noEmit && (cd client && npx tsc --noEmit)
npx jest src/modules/exports --maxWorkers=1
(cd client && npx vitest run src/lib/export-modifications.spec.ts)
(cd e2e && PW_CHROMIUM=/opt/pw-browsers/chromium OMEGAX_APP=http://localhost:4307 \
  OMEGAX_API=http://localhost:4307/api npx playwright test tests/sage-l7-*.e2e.ts)
```
