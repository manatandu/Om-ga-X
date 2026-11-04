# AVANCEMENT · design lot 3 (grilles, clavier, focus)

Branche de sauvegarde `travail/design-lot3`, depuis `origin/main` (cf2630cc5). Retirée à l'intégration.

## Fait

- A. Journal, grand livre, balance, balance auxiliaire, balance âgée, plan comptable : rôles de tableau (`table`, `row`, `columnheader`, `cell`, `grid` pour le plan), en-têtes figés (`.grille-longue` + `.entete-fixe`), pied de totaux figé (journal, balance), `aria-sort` et bouton de tri sur balance, balance auxiliaire, balance âgée, plan comptable ; filtre sur balance et balance âgée. Tri et filtre à l'écran seulement (`lib/grille.ts`), mention de tranche (`mentionTranche`).
- B. Balance et balance auxiliaire : ligne atteignable (`tabIndex=0`), Entrée ouvre le grand livre, double-clic gardé.
- C. `PortailModale` : piège de focus (`lib/piege-focus.ts`), retour au déclencheur (lu au rendu), `aria-modal` et `aria-labelledby` posés s'ils manquent.
- D. `Aide` : `aria-describedby`, bulle focalisable (flèche bas), Échap rend le focus au « ? ».
- E. 37 champs de montant, de cours et de taux en `inputMode="decimal"` ; relevé gelé par `lib/montants-clavier.spec.ts`.
- F. Anneau de focus à l'encre (`--sel`), blanc sur bandeau, en-têtes pleins et ligne choisie ; contraste mesuré par `focus-visible.spec.ts`.
- G. Titre de la fenêtre Journal : NON modifié, décision ci-dessous.

## Décisions

- Le journal n'a pas de tri : une pièce est un bloc de lignes que le tri défairait. Le grand livre non plus : chronologie d'un livre obligatoire (AUDCIF art. 22, 6°).
- Champs signés (« Débit + / crédit − », variations) laissés au clavier complet : le pavé décimal d'iOS n'a pas de signe moins.
- G : le titre « Journal · Grand livre · Balance » nomme la fenêtre à trois onglets, il n'est pas figé par erreur ; les onglets disent l'actif.

## Commandes

```
cd client && npx tsc --noEmit && npm test && npm run build
cd .. && npx tsc --noEmit && npx jest && npm run build
cd e2e && PW_CHROMIUM=... npx playwright test tests/clavier-grilles.e2e.ts --project=chromium
```

## Vérifications

- Client : tsc, vitest 2772 tests (345 fichiers), build verts. Racine : tsc, build verts ; jest entier 15538 tests, 2 échecs (spec de la balance âgée et `montants-clavier`, lus par jest racine) corrigés puis repassés seuls au vert.
- e2e Chromium seul (`tests/clavier-grilles.e2e.ts`, 3 parcours) verts ; WebKit non rejoué.
- Mesure avant/après (Playwright 1440x900 et 390x844, dossier vide) : journal 15 px, plan comptable 533 px (ancrage des lignes en div), balance 34 000 px (champ de filtre et en-têtes), mobile 2 à 1324 px.
- Relevé à la mesure : le focus initial de la modale tombait sur le « ? » et ouvrait sa bulle · corrigé (saute les éléments `aria-expanded`).

## Relectures (M1 à M4, m1 à m7)

Cadre de grille borné par la fenêtre (page colonne flex `page-a-grille`, plancher de page 26 rem, aucune borne vh/dvh) ; tabulation itinérante et flèches au plan comptable, sixième cellule ; totaux dits « balance entière » sous filtre (balance âgée, carte téléphone) ; tri et filtre remis à zéro avec la lecture ; filtre numérique (virgule, espaces fines et insécables, échappements) ; focus tardif des modales ; aide en `region` étiquetée ; bandeau de compte figé au grand livre ; un seul pied figé par grille. Bloc complet relancé : tsc, vitest 2782, jest racine 15543 (1083 suites), builds, e2e Chromium 5 parcours.
