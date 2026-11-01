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

- Conventions de financement · le ferme sans écrit signé a sa mention.
- Second jeu en monnaie fonctionnelle · totaux = somme des lignes servies.
- Quotité saisissable · classe du contrat du mois à défaut de saisie.
- Notes · mouvements non ventilés par nature dits à l'écran.
- Refus en devise d'un lettrage partiel · unité du déjà-réglé dite.
- Registre des retenues · lecture de N-1 en échec, repli dit et consigné.
- Annulation de l'arrêt · liquidation clôturée refusée d'abord.
- Constat d'impôt · visible et annulable quand le calcul refuse.
- Référence de la paie · reprises en négatif nommées.
- Origine des pertes · clé stable, « Retirer » nommé, rien à vide.
- Décompte final · moitié du préavis à la française.

- Reconstitution d'une révision majeure · comptée en mois, plus en 365,25 jours.
- CSRF · exigé dès que le cookie porte le jeton, en-tête Authorization ou non.
- Fonds commercial du prix global · sa date de mise en service se déclare.
- DTO des créances douteuses · comptes, motif, pièces et listes refusés à null.
- Décompte final · le calcul seul nomme l'ancienneté et les mois qui manquent.
- Rejeu sur vraie base à travers la clôture de 2026 ·
  `scripts/rejouer-releves-mineurs.cjs` (second jeu, quotité, registre).

## Reste

- Limites écrites au rapport de fin de ligne (A13 1 à 3, AU3 m2 à m4,
  A8 et A9 écran hors mineur 2 d'A8 et 7 d'A9).

## Vérification

```bash
npx tsc --noEmit && npx jest
DATABASE_URL=postgresql://postgres@127.0.0.1/<base jetable> node scripts/rejouer-releves-mineurs.cjs
cd client && npx tsc --noEmit && npm test && npm run build
```
