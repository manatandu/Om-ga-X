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

## Reste

- Les tests navigateur ne tournent pas dans ce conteneur (Chromium absent) ·
  `e2e/tests/sage-l5-feuilles-temps.e2e.ts` et
  `e2e/tests/sage-l4-transfert-groupe.e2e.ts` à éprouver par le job.

## Vérification

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
```
