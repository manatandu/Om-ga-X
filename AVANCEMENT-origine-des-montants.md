# Avancement · ligne origine-des-montants

« D'où vient ce chiffre » · gel levé par Manasse le 2026-11-01 (« Enchaîne le
point 3 et 4 »). Branche de sauvegarde `travail/origine-des-montants`.

## Modèle retenu

Le ZOOM de Sage 100 Comptabilité · dans ses éditions et états de synthèse, un
double-clic sur un montant ouvre son détail, puis le grand livre du compte,
puis la pièce. Repris tel quel, en trois niveaux dans une fenêtre
(`client/src/components/OrigineMontant.tsx`), double-clic ou Entrée pour
descendre, Échap ou « Précédent » pour remonter.

## Fait

- Serveur, aides communes (`src/modules/etats-financiers/origine-des-montants.ts`) ·
  types, lecteurs de requête (400 nommés), écart au centime, mise en forme.
- Chaque service d'états construit l'origine depuis la MÊME résolution que
  l'état · `bilanDetaille`, `compteDeResultatDetaille`, `tableauFluxDetaille`
  (refactor sans changement de calcul, l'état servi reste identique), aux deux
  référentiels ; notes par `notesDuJeuDetaille` et `origineLigne`.
- Routes `GET` en lecture, exercice requis par `EXERCICE_REQUIS`, mêmes gardes
  et mêmes logiciels que les états (dans leurs contrôleurs) ·
  `/etats-financiers/origine`, `/etats-financiers-syscohada/origine`
  (situation intermédiaire comprise), `/notes-annexes/origine`,
  `/etats-financiers-syscohada/notes/origine`.
- Identifiants des comptes résolus sur le plan du dossier
  (`ComptesDuZoomService`) pour ouvrir le grand livre.
- Grand livre d'un compte · ses lignes portent maintenant `ecritureId`,
  `statut` et `soldeDesComptesDeGestion` (la fenêtre ouvre la pièce et dit les
  lignes que les états ne lisent pas).
- Écran · bilan (Brut, Amortissements, Net N, Net N-1), compte de résultat et
  tableau des flux des deux référentiels (jeu associations au SYCEBNL), notes
  annexes des trois jeux (colonnes Exercice N et N-1).
- Tests · `origine-des-montants.spec.ts` (SYCEBNL), `origine-des-montants-
  syscohada.spec.ts`, bloc `origineLigne` de `note-annexe.service.spec.ts` ·
  TOUT poste de chaque état et toute ligne servie de chaque note, toutes
  colonnes, sur un jeu d'essai à plusieurs exercices · somme des contributions
  égale au montant au centime.
- e2e `e2e/tests/origine-des-montants.e2e.ts` · les deux référentiels, recette
  en N, clôture de N, recette en N+1 · trésorerie N et N-1 calculées à la main,
  toute cellule chiffrée des trois états et des notes balayée par la route,
  puis double-clic montant, compte, ligne jusqu'à la fiche d'imputation, et
  Entrée au clavier.
- Rejeu sur vraie base (2026-11-01, script hors dépôt) · sept écritures en N,
  clôture, quatre en N+1 · SYSCOHADA 308 cellules d'états et 482 de notes,
  SYCEBNL 278 et 276, aucun écart ; banque N 2 590 000,25 et N-1 2 490 000
  égales au calcul à la main. Il a trouvé un défaut, corrigé et gelé · le
  code de note « 16B bis » (espace du texte) était refusé en 400.

## Reste

- Intégration sur `main` (bloc § 3, tests navigateur, retrait de cette fiche).

## Non servi, et pourquoi

- Jeu des projets de développement et SMT (états) · leurs services ne sont pas
  refactorés ; cellules inertes, dit dans le code de la page.
- Colonnes de notes autres que N et N-1 (variations, A/B/C/D, échéances) ·
  elles se calculent par d'autres agrégats que les comptes de la rubrique.

## Vérification

```bash
npx jest src/modules/etats-financiers/origine-des-montants.spec.ts \
  src/modules/etats-financiers-syscohada/origine-des-montants-syscohada.spec.ts \
  src/modules/notes-annexes/note-annexe.service.spec.ts -t "origine"
(cd client && npx vitest run src/lib/origine-montant.spec.ts)
```
