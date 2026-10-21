# Avancement · ligne visa-rib

Demande de Manasse du 2026-10-21 · « Lève le gel pour le visa d'un RIB »
(idée vue chez Microfina++, visa de l'enrôlement d'un client).

## Décisions prises, avec leur article

- OPTION du dossier, désactivée par défaut (`Tenant.visaRibs`) · aucun texte
  n'impose ce visa · AUDCIF art. 69 (SYSCOHADA), SYCEBNL art. 16, 2) (EBNL,
  l'art. 69 lui étant exclu par son art. 3). Même lecture que le double
  regard à la validation (CLAUDE.md § 10 ter).
- RIB des tiers ET des salariés · les deux partent dans un ordre de virement.
  Le RIB du donneur (Structure > Banques) n'est pas visé.
- Le visa porte sur les coordonnées seules ; auteur exclu ; RIB d'avant la
  règle visable, dit ; le visa vise ce qui a été lu (409 sinon).
- Viser · administrateur ou comptable, refusé aux rôles cantonnés.

## Fait

- Schéma et migration `20270189000100_visa_des_ribs`.
- `tiers/visa-rib.ts` (règles pures), services des RIB (tiers, salariés),
  routes `POST /ribs-tiers/:id/viser`, `POST /personnel/ribs-salaries/:id/viser`,
  option `PATCH /dossier/visa-ribs`, refus dans `OrdresVirementService`.
- CLAUDE.md § 5 (gel) et § 6 (règle).

## Reste

- Specs serveur (règles, services, ordres sous l'option, audit).
- Écrans · volet RIB du tiers, paiement du salarié, Paramètres du dossier.
- Relectures (typescript-reviewer, react-reviewer, silent-failure-hunter).
- Bloc § 3, scénario sur vraie base à travers une clôture, e2e.
- Intégration sur main, déploiement vérifié, fiche retirée.

## Vérification

    npx tsc --noEmit && npx jest src/modules/tiers src/modules/reglements src/modules/personnel
    (cd client && npx tsc --noEmit && npm test)
