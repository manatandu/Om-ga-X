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

- 48 · grille analytique du compte (`GrilleAnalytique`,
  `LigneGrilleAnalytique`, migration `20270220000100_grilles_analytiques`) ·
  une grille par compte et par axe, pourcentages à deux décimales qui font
  100, sections Détail actives, compte de détail d'une classe que l'axe
  ventile (`motifRefusGrille`). Structure → Analytique → Grilles analytiques
  (administrateur) ; la saisie propose « Grille » quand le compte est choisi,
  la ligne se répartit à l'envoi au centime par le plus fort reste
  (`repartirSelonLaGrille`, recopiée à l'écran, cas partagés
  `cas-grille-analytique.json`) ; une grille suspendue (section en sommeil,
  plan en sommeil) se dit et ne se propose pas. Jamais imposée · ni serveur
  à la saisie, ni modules, ni imports.

- 51 · budget par compte général (`BudgetCompte`, migration
  `20270220000200_budgets_comptes`, index unique NULLS NOT DISTINCT) ·
  compte de détail des classes 6 et 7, dotation annuelle répartie au centime
  sur les mois de calendrier de l'exercice, reliquat au dernier, mois
  retouchable (l'année suit), annuel seul au-delà de douze mois, exercice
  clôturé figé ; état budget / réalisé / N-1 (`GET
  /analytique/etats/budget-comptes`, mois facultatif) · réalisé en
  mouvement, écriture qui solde les comptes de gestion exclue, brouillard
  compris, charge au débit net, produit au crédit net, non doté = `null`
  et « hors budget ». Structure → Analytique → Budgets des comptes
  (dotation), État → Suivi et prévision → Budget des comptes.

- Rejeu sur vraie base (`scripts/rejouer-analytique.cjs`, serveur compilé,
  base jetable) à travers la clôture de 2025 · vert. Lus contre le calcul à
  la main · réalisé 2025 de la charge 1 000 après clôture (ni 0 ni 2 000),
  non ventilées 2025 · le seul produit de 2 000, journal 1 000, budget
  1 200 puis mars à 250 (1 350), clôturé figé ; 2026 · réalisé 800, N-1
  1 000, janvier 125 / 800 / 0, journal trois lignes 900 / 100, OD seules
  deux, balance P1 700, P2 100, P3 masquée, totaux inchangés.
- Relecture adverse (deux tours, aucun agent relecteur dans cette session) ·
  la fusion du journal ne re-trie plus en JavaScript (collation de la base
  gardée, `NULLS LAST`) ; messages des DTO en français ; pourcentage ou
  montant vide refusé à l'écran au lieu de partir à zéro.

## Reste

- Report des budgets des comptes sur l'exercice suivant (les budgets des
  sections ont le leur), non demandé par la ligne.
- Tests navigateur (`e2e/`) non lancés dans cette copie · les fenêtres
  nouvelles s'ouvrent par les chemins du menu, que le job relit.

## Vérification

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
```
