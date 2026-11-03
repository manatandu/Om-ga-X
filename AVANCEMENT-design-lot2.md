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

- H. Cartes sous 640 px : journal, grand livre, balance (`CartesComptables.tsx`, une seule présentation dans le DOM par `useSous640`) ; bouton « Grand livre » = le double-clic de la balance.
- Spec de source `client/src/socle-telephone.spec.ts`.

## Décisions prises en lisant le code
- La règle des champs à 16 px porte `:not([data-taille-fixe])` : un sélecteur d'élément (0,0,1) perdait contre `text-[12px]` (0,1,0), mesuré au navigateur.
- `overscroll-contain` sous `pointer-coarse:` seulement : posé au bureau, il changeait l'anticrénelage du texte des conteneurs défilants (4 000 pixels différents).
- Barres de titre et d'état : hauteur `calc(… + env(safe-area-inset-*))` en border-box, un `content-box` ajoutait la bordure (25 px au lieu de 24).
- « Bouton grille existant » : celui du chrome rappelle l'écran des logiciels, il n'ouvre pas la barre de l'accueil ; un bouton « Fonctions » (icône grille) est posé en tête de l'accueil sous 640 px.
- Barre des fenêtres : l'inset du bas est porté par la barre d'état, qui est toujours la dernière ; les côtés par le corps.

## Reste (hors lot, listé)
- Contrôles DANS les fenêtres (Filtrer, Exporter, etc., 30 px), états financiers, saisie des journaux, tous les tableaux autres que les trois ci-dessus : débordent encore à 390 px.
- WebKit, vrai appareil, clavier virtuel : non vérifiés.

## Vérification
`npx tsc --noEmit`, `npx jest`, `npm run build` à la racine ; `npx tsc --noEmit`, `npm test`, `npm run build` dans `client/`.
