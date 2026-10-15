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

## Reste

- #99 · scénario sur vraie base à travers une clôture.
- #59 · impression différée (Fichier > Impressions différées), sélections
  enregistrées, modèles d'édition et sauts de ligne ou de page.
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
npx jest src/modules/exports/modifications --maxWorkers=1
(cd client && npx vitest run src/lib/export-modifications.spec.ts)
(cd e2e && PW_CHROMIUM=/opt/pw-browsers/chromium OMEGAX_APP=http://localhost:4307 \
  OMEGAX_API=http://localhost:4307/api npx playwright test tests/sage-l7-export-modifications.e2e.ts)
```
