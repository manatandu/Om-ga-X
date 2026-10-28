# Avancement · ligne partiels-sage (n° 78 et n° 73)

Copie partie de `main` à `90a226b`. Branche de sauvegarde
`travail/partiels-sage` (`git push -u origin HEAD:travail/partiels-sage`).
Fiche retirée à l'intégration.

## Décisions prises par la loi (2026-10-25)

- **A · Q2, maternité sans subrogation · CLOSE, aucun code.** Code du
  travail, art. 130, al. 2 (deux tiers de la rémunération), art. 59
  (l'obligation survit à la suspension), art. 131 (nullité de la convention
  contraire) ; loi n° 16/009, art. 48, arrêté n° 146/2018, art. 63
  (indemnité de la Caisse) et art. 139, al. 2 et 3 (subrogation de plein
  droit, totale ou bornée à la partie versée, employeur en règle). Sans
  subrogation, l'employeur doit les deux tiers et ne déduit rien · règle de
  protection (CLAUDE.md, P5). Vérifié · `personnel/absences.ts` le fait déjà,
  aucun message ne disait la question ouverte.
- **B · n° 78, feuilles de temps** · Code du travail, art. 119 (45 h par
  semaine, 8 h par jour, heures au-delà majorées), art. 120 (arrêtés
  absents · aucun taux), art. 121 (repos le dimanche), art. 124 (nuit de
  19 h à 5 h, majorée). Heures supplémentaires PROPOSÉES au bulletin à taux
  déclaré ; compteurs libres sans effet de paie.
- **C · n° 73, transfert d'un bien entre deux dossiers du groupe** ·
  SYSCOHADA seul. AUDCIF Titre VII, fiche du compte 18 ; art. 35 et 36 ;
  Titre IX ch. 5 § 1.3 (aucun flux de trésorerie, neutralisé au TFT).
  SYCEBNL · refus nommé (fiche du compte 58 du SYCEBNL, trésorerie seule) et
  question à Manasse (`docs/suivi-reprises.md`).

## Fait

- A · suivi (Q2 close), journal de construction.
- B · feuilles de temps et compteurs libres (serveur, écran, test navigateur
  écrit), rejeu sur vraie base à travers la clôture de 2026 · vert.
- C · transfert d'un bien entre le siège et une cellule (serveur, onglet
  « Transferts de biens » de la fenêtre Groupe, test navigateur écrit) ;
  neutralisation au tableau des flux et au contrôle 15 bis ; rejeu sur vraie
  base (`scratchpad/partiels/rejeu-c.cjs`) · trois biens nés et amortis en
  2026, 2026 clôturé des deux côtés, transferts en juin 2027, un annulé au
  brouillard, un validé puis annulé par négatifs, liaison égale et de sens
  contraire, aucun 81 ni 82, dotation de juillet à décembre chez la cellule
  (120 000 et 60 000), agrégat du groupe inchangé, TFT FG et FI nuls, 2027
  clôturé des deux côtés, SYCEBNL refusé (403) · vert.
- Défaut trouvé sur `main` par le rejeu et corrigé · la création d'une
  cellule par le siège tombait en 500 (maillon d'audit de `Tenant.update`
  hors du périmètre de la cellule) · `perimetreDeGroupe` et un test.
- Documents · build-log, parity (86,0), features.csv, CLAUDE.md § 6.

- Trois relectures (2026-10-28), corrigées · transfert · B1 (traitement
  d'un exercice qui finit après la date du transfert, refus nommé avec
  l'issue), exercice antérieur ouvert sans sa dotation (refus nommé),
  préparation rejouée sous les deux verrous par le client de la transaction
  (409 si les montants changent), annulation relue sous `FOR UPDATE` de la
  fiche reçue, historique d'un traitement annulé détaché (colonne nullable)
  et non compté, transfert suivant nommé, subvention au seul solde non
  repris, onglet Traitements renvoyant au siège, journaux autorisés jugés à
  l'aperçu, double regard dit en commentaire ; notes 3A et 3B · ÉCART écrit
  (anomalie n° 9 de `correspondance-notes-syscohada-1.ts`, question au
  suivi) · le ch. 6 du Titre IX ne définit pas ses colonnes et la fiche du
  compte 18 ne parle pas du tableau, aucun texte ne range le mouvement aux
  virements de poste à poste ; écran (aperçu périmé, receveur unique,
  annonce, date sans fuseau). Feuilles de temps · jour devenu absence ou
  congé exclu du mois et nommé (et nommé à la pose), reprise des heures qui
  remplace, écran (salarié tenu, confirmation, relecture, compteurs), jour
  inexistant, plafond des compteurs actifs sous verrou, motif d'annulation
  hors du journal d'audit, test navigateur réaligné.
- Rejeu sur vraie base (PostgreSQL 16 jetable, serveur compilé, par l'API ·
  `scratchpad/rejeu/rejeu-transfert.cjs`) · B1 refusé, rien écrit ; M
  refusé ; 2026 doté et clôturé au siège ; transfert du 15 juin 2027 passé
  (120 000 de complément, 360 000 d'amortissements, 840 000 aux liaisons,
  égales et de sens contraire, aucun 81 ni 82) ; cellule dote 120 000 ;
  annulation refusée puis, la dotation annulée chez la cellule, passée sans
  500, historique détaché · vert.

- Bloc § 3 (2026-10-28) · serveur `tsc` vert, `jest` complet 973 suites
  sur 974 et 14 275 tests verts, la 974e
  (`client/src/lib/controles-agregat-groupe.spec.ts`, non touchée) ne se
  charge pas dans le temps sous la charge de la suite entière et passe seule
  (12 sur 12) ; `npm run build` vert. Client `tsc`, `npm test` (307 fichiers,
  2 498 tests) et `npm run build` verts.

## Décisions (2026-10-28)

- Notes 3A et 3B · le transfert reste en acquisition et en cession, écart
  écrit · lu le Titre IX ch. 6 (colonnes non définies) et la fiche du compte
  18 (fonctionnement du compte de liaison seul). La note 3B n'est pas
  touchée · la location-acquisition est refusée au transfert.
- Traitements postérieurs (B1) · dotations et dépréciations de clôture dont
  l'exercice finit après la date, révisions décidées après elle · la
  dépréciation reçue par transfert (TRANSFERT_GROUPE) est antérieure par
  nature.

## Reste

- Les tests navigateur ne tournent pas dans ce conteneur (Chromium absent) ·
  `e2e/tests/sage-l5-feuilles-temps.e2e.ts` et
  `e2e/tests/sage-l4-transfert-groupe.e2e.ts` à éprouver par le job.

## Vérification

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
```
