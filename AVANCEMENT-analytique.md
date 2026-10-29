# Avancement · ligne analytique

Gel levé par Manasse le 2026-10-29 (`docs/plan-gel-leve-2026-10-29.md`, § 4).
Fonctions 48, 51, 52, 53 de `docs/comparaison-sage/15-absents-a-trier.md`.
Branche de sauvegarde `travail/analytique`, partie de `origin/main`
(02a55d497).

## Décision par la loi, avant le code

La comptabilité analytique n'a pas de règle à elle · « L'usage des comptes 92
à 99 est laissé à l'initiative des entités qui utilisent les découpages
convenant le mieux à leur structure, à leur politique des coûts, à leur
organisation » (SYCEBNL, Partie 2 ch. 3, classe 9, sous-section 2 ; AUDCIF,
Titre VII ch. 3, classe 9, sous-section 2, « qui les subdivise à sa
convenance »). Aucun texte lu ne régit une grille, un budget par compte, un
journal analytique ni un filtre de balance · ce sont des CONVENTIONS
D'OMEGAX, dites dans la bulle, et rien ne touche au livre-journal ni aux
états financiers. Ce qui ne se discute pas vient des règles déjà codées ·
sections Détail actives, classe ventilée par le plan, une ligne ventilée en
totalité sur un plan ou pas du tout (`EcritureService.verifierSectionsVentilees`),
réalisé lu en mouvement hors écriture qui solde les comptes de gestion
(`filtresDesTroisColonnes`, audit final F4), jamais une écriture de situation.

## Fait

- 53 · filtres de la balance analytique (`filtres-balance-analytique.ts`) ·
  toutes, mouvementées, non soldées ; le filtre masque, les totaux restent
  ceux de toutes les feuilles, le nombre masqué est dit ; zéro au centime ;
  filtre inconnu refusé en 400.
- 52 · journal analytique (`GET /analytique/etats/journal`, toutes ou OD
  seules) et grand livre des lignes non ventilées
  (`GET /analytique/etats/non-ventilees`) · écrans de travail, tranche de
  deux mille dite, totaux et décompte par la base ; le périmètre des non
  ventilées est celui du contrôle des cumuls (`perimetreDuPlan`,
  `sansRepartitionSur`, filtres nommés de `lectures-hors-situation.spec.ts`).
  Onglet Journal et choix « Lignes non ventilées de l'axe » du grand livre.

## Reste

- 48 · grille analytique du compte
- 51 · budget par compte général
- relecture, rejeu sur vraie base à travers une clôture

## Vérification

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
```
