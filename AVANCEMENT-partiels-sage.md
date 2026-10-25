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
- **B · n° 78, feuilles de temps** · à construire (choix d'organisation de
  Manasse). Code du travail, art. 119 (45 h par semaine, 8 h par jour, heures
  au-delà majorées), art. 120 (arrêtés absents), art. 121 (repos le
  dimanche), art. 124 (nuit de 19 h à 5 h, majorée).
- **C · n° 73, transfert d'un bien entre deux dossiers du groupe** ·
  SYSCOHADA seul. AUDCIF Titre VII, fiche du compte 18 ; art. 35 et 36.
  SYCEBNL · refus nommé et question à Manasse.

## Fait

- A · suivi (Q2 close), journal de construction.

## Reste

- B · feuilles de temps et compteurs libres.
- C · transfert d'un bien dans le groupe.
- Rejeu sur vraie base à travers une clôture, relectures, documents
  (build-log, parity, features.csv, CLAUDE.md § 6).

## Vérification

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
```
