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

## Pointeur grossier ET largeur (à consigner au règlement)
Les règles `pointer: coarse` (boutons de boîtes de dialogue à 44 px, entrées de menu `pointer-coarse:h-11`, `.btn` min 44, barre de titre de fenêtre 44 px, champs à 16 px) valent AUSSI sur une tablette tactile de plus de 640 px, où le bureau garde sa disposition : le doigt est le même à 800 px qu'à 390. C'est voulu, écrit en tête du bloc CSS, et PAS doublé d'un `max-sm:`.
`.cible-tactile` (ex `cible-44`) est plafonné à 32 px de pseudo-élément : 44 px recouvrait l'onglet voisin et les libellés autour de l'aide « ? ». La croix d'onglet de la barre des fenêtres prend sa taille réelle (40 x 40) au doigt.

## Reste (hors lot, listé)
- Contrôles DANS les fenêtres (Filtrer, Exporter, etc., 30 px), états financiers, saisie des journaux, tous les tableaux autres que les trois ci-dessus : débordent encore à 390 px.
- WebKit, vrai appareil, clavier virtuel : non vérifiés.

## Vérification
`npx tsc --noEmit`, `npx jest`, `npm run build` à la racine ; `npx tsc --noEmit`, `npm test`, `npm run build` dans `client/`.

## Vérifié (2026-11-03)
- tsc des deux côtés, `npm run build` des deux côtés, jest racine entier (1077 suites, 15 495 tests ; le seul échec, `cadratins.spec`, venait des deux dossiers de construction de la preuve visuelle, retirés), vitest client 338 fichiers, 2 715 tests.
- Tests navigateur sous Chromium (ecrans, parcours, ecran-logiciels, rester-connecte, deconnexion-utilisateur, multi-dossiers, pages-legales, sage-l7-largeurs, cloture, lettrage-cloture, logiciels-refus) : 19 passés.
- Bureau 1440 x 900, avant et après : 0 pixel de différence sur 7 captures sur 9 ; journal 36 px (icône d'export, zone de 10 x 10) et états financiers 102 px, du niveau du bruit de capture à capture mesuré sur origin/main contre lui-même (90 px).
- Non vérifié : WebKit (non installé ici), vrai appareil, clavier virtuel.

## Passe de relecture (2026-11-03)
Onze points des deux relectures corrigés, un commit par étape (zone de toucher, panneau ☰, cartes). Mesure à 390 px, pointeur grossier émulé : l'onglet voisin d'une croix garde 94 à 96 % de sa surface (la croix, de 40 x 40, a sa vraie boîte et ne la recouvre plus) ; le libellé voisin de l'aide « ? » n'en perd que 2 %. Bloc § 3 : tsc des deux côtés, jest racine entier 1 077 suites et 15 504 tests, vitest client 2 724 tests, builds.
