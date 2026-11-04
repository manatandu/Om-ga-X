# AVANCEMENT · design-lot4 (branche travail/design-lot4)

Ligne : les trois limites laissées par les lots design 2 et 3 (débordement
sous 640 px, boutons de fenêtre à 30 px, test de rendu absent).

## Fait
- Test navigateur `e2e/tests/rendu-telephone.e2e.ts` (Chromium, 390 x 844,
  `hasTouch` + `isMobile`, pointeur grossier) : états financiers (chaque onglet),
  saisie des journaux (choix puis grille), contrôles (chaque onglet), dans les
  deux référentiels. Mesures : page sans défilement de côté (strict), contenu de
  la fenêtre (un pixel de tolérance, dit), rien qui sorte ou soit rogné sans
  défiler, chaque bouton de fenêtre à 32 px au moins (un `.cible-tactile`
  compte avec son pseudo-élément) ; au bureau la règle ne s'applique pas.
- `Fenetre.tsx` : marqueur `data-contenu-fenetre` sur le conteneur défilant.
- `index.css` : (1) boutons de fenêtre `min-height/min-width: 32px` DANS le bloc
  `pointer: coarse` (hors `.cible-tactile`, porte de sortie `data-taille-fixe`) ;
  (2) sous 640 px, `.shadow-posee` défile de côté (`overflow-x: auto`) au lieu de
  rogner (`hidden` gardé au bureau) ; (3) `.grille-saisie-large`.
- `SaisiePage.tsx` : grille de saisie à largeur de colonnes (en-tête, lignes,
  totaux alignés, la carte défile), légende et barre du bas repliables, bouton
  « Ouvrir le journal » sans écrasement, en-tête de pièce repliable.
- `ControlesPage.tsx` : onglets qui défilent au lieu d'être rognés.
- `socle-telephone.spec.ts` : cinq tests de source pour ces règles.

## Constat d'origine reproduit avant correction
Saisie : bouton et légende rognés (droite à 417 px), grille à 680 px sur 388 ;
SYCEBNL états financiers : lignes `min-w-[500px]` rognées par `shadow-posee`
(colonnes de montants perdues) ; contrôles : onglets et aide rognés.

## Vérification
Serveur : `npx tsc --noEmit`, `npx jest`, `npm run build`. Client : `npx tsc
--noEmit`, `npm test`, `npm run build`. E2E local (montage du § 10, PostgreSQL 16
jetable, le portillon éprouve 17 et 18) : `npx playwright test rendu-telephone`.

## Limites
WebKit, vrai appareil, clavier virtuel, lecteur d'écran non vérifiés. Seuls trois
écrans balayés ; les autres fenêtres gardent leurs propres défauts éventuels.
