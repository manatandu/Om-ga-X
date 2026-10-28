# Ligne microfina-m3 · personnel (idées 6, 3, 7, 10, 8, 11)

Plan · `docs/comparaison-microfina/plan-reproduction-microfina.md`, ligne M3.
Branche de sauvegarde · `travail/microfina-m3`. Copie · `/home/user/wt-microfina-m3`.

## Fait

- **Idée 6 · retenue étalée** (`personnel/avances-salaire.ts`, `avances-rubriques.service.ts`)
  · plan d'étalement déclaré (premier mois + durée OU retenue mensuelle),
  échéancier au centime (la dernière prend le reste), retenue proposée du mois
  bornée par le solde, préremplie à l'écran de simulation, écart au plan DIT
  par la simulation (`avertissementsRetenuesPlanifiees`), jamais retenu à la
  place du cabinet. `PATCH /personnel/avances/:id/etalement`. Migration
  `20270195000100_retenue_etalee`.
- **Idée 3 · missions et frais de mission** (`personnel/missions-salarie.ts`,
  `missions.service.ts`, `missions.controller.ts`, onglet Missions) · ordre
  numéroté par dossier, frais qualifiés (remboursement sur pièce, forfait,
  réglé par l'entité), portés au bulletin depuis la simulation (forfait
  imposable, remboursement hors impôt), passés au 6384 (rôle MISSIONS de la
  passation). Migration `20270195000200_missions_salarie`.

- **Lot 2, code écrit** (`personnel/suivi-personnel.ts`, `.service.ts`,
  `.controller.ts`, onglets Demandes de congé, Échéances des contrats,
  Formation, Main-d'œuvre) · idée 7 (demande, accord par un autre utilisateur
  qui pose le congé par la route ordinaire, refus, retrait, titre de congé),
  idée 10 (échéancier CDD et essai, date à date), idée 8 (plan, inscrits,
  réalisation, présents, prévu contre réel), idée 11 (chiffres de l'art. 218).
  Migrations `20270195000300_demandes_conge`, `20270195000400_formations_personnel`.
- **Rejeu lot 1 sur vraie base** (PostgreSQL 16 jetable, serveur compilé,
  `scratchpad/rejeu/rejeu-lot1.mjs`) · décembre 2026 et janvier 2027 à travers
  la clôture de 2026 · solde de l'avance 33 333,34 = 100 000 − 2 × 33 333,33,
  4211 reporté 66 666,67 puis 33 333,34, 6384 = 120 000, assiettes 780 000 et
  810 000 · SANS ÉCART.

## Décisions prises, avec leur texte

- Art. 112 c) et f) · autorise la retenue d'avance et de prêt, ne fixe ni
  durée ni échéance · le plan est une convention déclarée ; « d'office » =
  proposée et préremplie, jamais substituée (aucune réduction de rémunération
  que personne n'a décidée ce mois-là).
- Saisie-arrêt · ne s'étale pas, l'acte fixe le mode de calcul (AUPSRVE,
  art. 184, 3°).
- Frais de mission · remboursement d'une dépense effective hors impôt (loi
  n° 23/053, art. 68, 1°) et hors rémunération (Code du travail, art. 7,
  point 8) ; forfait imposable (art. 68, 1°) hors rémunération sociale ; pièce
  exigée pour le remboursement (AUDCIF art. 17, 3°) ; TVA de l'hébergement, de
  la restauration et du transport non déductible (O.-L. n° 10/001, art. 41,
  1°) ; compte 6384 « Missions » (fiche du compte 66 des deux plans, « en 62 ou
  63 »).

- Idée 7 · art. 140, al. 4 (« date fixée de commun accord ») · demande datée
  du travailleur + accord daté et nommé ; auteur et décideur distincts,
  convention d'OmegaX ; circuit facultatif, le congé se pose aussi directement.
  Le délai de six mois n'est pas calculé (deux lectures, au suivi).
- Idée 10 · art. 69 (fin au terme), 42 (emploi permanent), 43 al. 3 et 4
  (plafond, confirmation automatique), plafond compté de date à date comme
  l'art. 41 ; horizon de 60 jours, convention.
- Idée 8 · art. 8 ; ordonnance n° 84/186, art. 1er, al. 2 · la réduction INPP
  reste un acte déclaré au bulletin, jamais déduite du plan.
- Idée 11 · art. 218 et 219 · chiffres seuls, formulaire absent du corpus, dit.

- **Rejeu lot 2 sur vraie base** (`scratchpad/rejeu/rejeu-lot2.mjs`) · demande
  refusée à son auteur (403), accordée par un autre (congé de 11 jours posé),
  seconde décision 409, titre servi, congé refusé qui laisse la demande en
  attente ; fin de CDD avec l'art. 42 ; essai passé depuis plus que l'horizon
  retiré de l'échéancier (contrat confirmé, art. 43 al. 4) ; formation
  réalisée sans présent refusée, prévu contre réel ; déclaration de
  main-d'œuvre par sexe et nationalité, nationalité absente non calculée ·
  SANS ÉCART.
- Relecture « échecs silencieux » · lien demande / congé manqué consigné avec
  les deux identifiants ; réponse périmée des avances jetée à l'écran (sinon
  la retenue d'un autre mois se préremplissait).
- Questions au suivi · `docs/suivi-reprises.md`, section microfina-m3.

## Reste

- Test navigateur `e2e/tests/microfina-m3-personnel.e2e.ts` (écrit, non joué
  ici · aucun navigateur dans le conteneur), à jouer par `tests-navigateur.yml`.

## Commandes

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
```
