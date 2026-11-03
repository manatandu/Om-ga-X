# Avancement · reprise du design, lot 2 (socle téléphone)

Branche de sauvegarde `travail/design-lot2`. Gel levé pour la reprise de l'interface
(CLAUDE.md § 5, entrée du 2026-11-03, « Lot 2 go »). Correctifs et présentation :
aucune fonction nouvelle, le bureau ne change pas d'un pixel.

## Fait
- A. `h-screen` remplacé par `h-dvh` (AppShell), `min-h-screen` par `min-h-svh` (pages de porte) ; `.modale-bornee` garde `vh` puis `dvh` (voulu).
- B. Champs à 16 px sous `@media (pointer: coarse)` seulement (index.css, bloc « socle téléphone »).
- C. Zone de toucher 44 px sous `pointer: coarse` : `.cible-44::after` (aide « ? », boutons du chrome, titres de menu, croix de la barre des fenêtres, œil), `.btn { min-height: 44px }`, entrées de menu, barre de titre et boutons de fenêtre, onglets et fonctions de l'accueil.
- D. `viewport-fit=cover`, `interactive-widget=resizes-content` ; marges `env(safe-area-inset-*)` sur le corps (côtés), la barre de titre (haut), la barre d'état (bas). Un seul `theme-color` : l'interface n'a pas de thème sombre.
- E. `-webkit-tap-highlight-color`, `overscroll-behavior: none` sur html et body, `overscroll-contain` sur les conteneurs défilants, `touch-action: manipulation`.
- F. Sous 640 px, fenêtres en plein écran de la zone de travail (`useSous640`), sans déplacement, sans poignées, sans agrandir/restaurer ; géométrie mémorisée jamais réécrite.
- G. Sous 640 px : bouton « ☰ » (même contenu, Échap, retour du focus), Déconnexion en icône nommée, nom du dossier tronqué avec `title`, barre latérale de l'accueil repliée derrière un bouton « Fonctions » (icône grille).
- I. Connexion : pas d'`autoFocus` au doigt, `autoComplete`, œil nommé et atteignable au clavier.

## Reste
- H. Cartes sous 640 px : journal, grand livre, balance (JournalPage).
- Spec de source `socle-telephone.spec.ts`, preuves visuelles, bloc § 3, tests navigateur.

## Vérification
`npx tsc --noEmit`, `npx jest`, `npm run build` à la racine ; `npx tsc --noEmit`, `npm test`, `npm run build` dans `client/`.
