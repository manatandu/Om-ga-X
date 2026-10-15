# Ligne sage-l7 · éditions et exports

Copie `/home/user/wt-sage-l7`, branche de sauvegarde `travail/sage-l7`.
Migrations `20270182000100_…` et suivantes, bases jetables `l7_ombre`
(ombre), `l7_e2e` (tests navigateur), `l7_scenario` (scénario sur vraie
base) ; serveur 8307, client 4307, tests navigateur `e2e/tests/sage-l7-*.e2e.ts`.

Fonctions (numéros de `docs/comparaison-sage/15-absents-a-trier.md`) · #99
export des seules modifications, puis #59 en trois parties · impression
différée, sélections enregistrées, modèles d'édition et sauts.

## Fait

(rien encore)

## Reste

- #99 · serveur (registre des écritures exportées, export numéroté, fichier
  gardé), fenêtre Fichier > Exporter les modifications, test navigateur,
  scénario sur vraie base à travers une clôture.
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
npx jest <specs touchés> --maxWorkers=1
```
