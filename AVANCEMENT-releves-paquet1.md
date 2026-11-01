# AVANCEMENT · releves-paquet1

Gel levé par Manasse le 2026-11-01 (« Enchaîne le point 3 ») pour les
« Relevés en attente » de `docs/suivi-immobilisations-verrouille.md`. Périmètre
de cette ligne · PAQUET 1, LIGNE A ; LIGNE C ; LIGNE B. Le suivi n'est pas
retouché ici (l'intégrateur le fera depuis le rapport).

## Fait (un commit par étape, branche `travail/releves-paquet1`)

### Ligne B
- MAJEUR B7 · le bilan d'ouverture importé (`reference === 'IMPORT'`,
  `estGenereeParCloture`) arrête la chaîne des reports et EST l'origine
  (`estImportDOuverture`, trois appelants). Rejeu vraie base rouge sans,
  vert avec.
- Mineur 1 · fiche et PV relisent la campagne sous le verrou du dossier puis
  `FOR SHARE` dans leur transaction.
- Mineur 2 · `caissesNonComptees` somme par `groupBy`.
- Mineur 3 · caisse comptée AVANT la clôture · valeur à porter = solde du
  livre-journal à la clôture + écart du PV (AUDCIF art. 42 ; CPCC § VI).
- Mineurs 4 à 8 · infobulles (relance, prorata), refus qui retire l'ancien
  état (balance âgée, échéancier, deux SMT), motifs en miroir client/serveur,
  en-têtes nommés, blocs JSDoc replacés.
- Voisins · campagne mixte (rapprochement refusé sans fiche de la caisse au
  PV à écart) ; 631 nommé par `CHARGE_SANS_TIERS` (fiche des comptes 62 et
  63) ; balance âgée et notes exportées disent les groupes lus ligne à ligne.

### Ligne C
- M1 · proposition des retenues bornée par `centimesRetenablesAuPlus`.
- M2 · règle des centimes figés écrite (`docs/paie-p3-passation-comptable.md` § 11).
- M3 · le refus dit le maximum retenable.
- M4 · totaux des cotisations cumulés par charge.
- m2 · montants de paie au centime (DTO, SMIG du cabinet) ; passation au
  centime loin de zéro sur la valeur exacte.
- m3 · art. 63, al. 2, 1° non servi à une entreprise déclarée du portefeuille
  de l'État (loi n° 08/010, art. 3).
- R3 · joué sur vraie base, refusé, rien écrit.

### Ligne A
- MAJEUR · postes vides du TFT laissés vides au livre d'inventaire, motif dit.
- Mineurs 3, 4, 5 · écran SYSCOHADA, clé d'une date illisible, conversions.
- Voisins A9, A10 · solde XC dit sans verdict ; écart de clôture et nature
  non ventilée dits à l'écran des notes.

## Reste (voir rapport)

A3 (comparatif sur l'ouverture, tranché par la loi mais d'ampleur), A4, A7,
m2 (raisonné), G1 de la ligne A ; limites écrites gardées.

## Commandes de vérification

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
DATABASE_URL=postgresql://postgres:<mot-de-passe>@127.0.0.1:5432/<base jetable migrée> node scripts/rejouer-releves-paquet1.cjs
```
