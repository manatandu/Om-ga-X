# Avancement · ligne CAS-IS (cas chiffrés de l'impôt sur les sociétés)

Méthode décidée par Manasse le 2026-10-04 · partir des CALCULS. Aucune
correction du code (`src/` et `client/` intacts) · constat seulement.

## Fait

- Étape 1 · lecture du module `src/modules/fiscalite/` (service, catalogue,
  paramètres, arrondi, écriture A11, constat), relevé des hypothèses tues avec
  fichier et ligne.
- Étape 2 · quinze situations chiffrées à la main (`docs/cas-chiffres/is.md`),
  chaque ligne avec son article lu dans `fiscalite-rdc` (compilation DGI au
  19/07/2026 · `code-general-2026/references/04-…titre2…`, `05-…titre3…`,
  `06-…titre4-7…`, `19-procedures-titre3-recouvrement.md`,
  `17-procedures-titre1…`) et `fiscalite-rdc-socle` (`parametres-2026.md`).
- Étape 3 · rejeu sur vraie base par l'API du serveur compilé
  (`scripts/cas-chiffres/rejeu-is.mjs`), clôtures 2026 à 2029 traversées au
  cas C04. Seize dossiers, tous rejoués.

## Écarts relevés (détail dans le document)

- C05 · montant faux · 177 000 au lieu de 150 000 (fenêtre du report qui
  oublie le déficit le plus ancien déjà imputé).
- C09 · montant faux · 1 530 000 au lieu de 1 800 000, et acomptes de 2027
  dits « non dus » (art. 12, al. 3, de la loi n° 23/053 non appliqué).
- Hypothèses non dites · C01-bis (brouillard), C02 (chiffre d'affaires
  « déclaré » lu sur les 701 à 707), C12a (arrondi avant comparaison, compte
  891 contre 895), C15 (déficit 2025 recalculé sous la loi de 2026, sans
  réserve dans la vue 2026).
- À trancher (corpus muet sur la transition) · C10, C15.

## Reste

- Relecture par Manasse du document.

## Vérification

```bash
# base jetable sur la grappe partagée, serveur compilé sur 8118
createdb -h 127.0.0.1 -p 55439 -U postgres casis_1
DATABASE_URL=postgresql://postgres@127.0.0.1:55439/casis_1 npx prisma migrate deploy
DATABASE_URL=… JWT_SECRET=… PORT=8118 INSCRIPTION_PUBLIQUE=true node dist/main.js
OMEGAX_API=http://localhost:8118 node scripts/cas-chiffres/rejeu-is.mjs rejeu-is.json
dropdb -h 127.0.0.1 -p 55439 -U postgres casis_1
```
