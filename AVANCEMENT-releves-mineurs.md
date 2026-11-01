# Avancement · ligne releves-mineurs

Gel levé par Manasse le 2026-11-01 (« Enchaîne le point 3 ») pour les
« Relevés en attente » de `docs/suivi-immobilisations-verrouille.md` ·
mineurs de la simulation du 2026-10-08 et entrées qui suivent. Branche de
sauvegarde `travail/releves-mineurs`, partie d'`origin/main`.

## Fait

- Méthode des cotisations · le Système minimal reçoit son propre motif
  (SYCEBNL Partie 4 ch. 4, poste KA, revenus encaissés), plus celui des
  projets de développement.
- Test ISA 240 · écritures de clôture (solde de gestion, report) et
  à-nouveau provisoire hors de la sélection et du décompte.
- Mandat de l'auditeur · le rang se lit aussi sur le registre (même
  inscription, mandat contigu) · un troisième mandat SYCEBNL consécutif sans
  rang dit est refusé (art. 21).
- Registre des provisions · report refusé vers un exercice antérieur, clos
  ou d'un autre dossier (AUDCIF art. 20, al. 3).
- Société dissoute sans liquidation (AUSCGIE art. 201 al. 4) · ni exercice
  de liquidation (refus serveur), ni bouton « Préparer l'exercice de
  liquidation », message des exercices civils adapté.

## Reste

Voir le rapport de fin de ligne (triage relevé par relevé).

## Vérification

```bash
npx tsc --noEmit && npx jest
cd client && npx tsc --noEmit && npm test && npm run build
```
