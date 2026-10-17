# AVANCEMENT · ligne inscription-essai

Branche de sauvegarde `travail/inscription-essai`. Fiche retirée à l'intégration.

## Fait
- Serveur : `POST /auth/inscription-essai`, `GET /auth/inscription-essai/etat`, `AuthService.inscrireEnEssai`, briques pures `inscription-essai.ts`, DTO, spec (service, contrôleur, briques).
- Workflow : variable `INSCRIPTION_ESSAI` passée à Cloud Run seulement si elle vaut `true`.
- Client : `#/essai` (`EssaiPage`), `lib/essai.ts` (+ spec), lien conditionnel sur l'écran d'ouverture.
- CLAUDE.md § 5 (gel levé pour cette ligne seule, paiement exclu) et § 8 (la porte et ses limites).
- Rejeu sur vraie base (PostgreSQL 16 jetable, puits SMTP) : 33 contrôles sur 33.

## Reste
- Relectures (silent-failure-hunter, typescript-reviewer, react-reviewer).
- Bloc § 3 complet, des deux côtés.
- Intégration sur main, lecture des déploiements, puis variable `INSCRIPTION_ESSAI=true` posée par Manasse.

## Décisions
- Essai = licence ABONNEMENT de trente jours, lecture seule à l'échéance (décision de Manasse du 2026-10-09).
- Paiement en ligne exclu de cette ligne.

## Vérifier
`npx tsc --noEmit && npx jest && npm run build` à la racine ; `npx tsc --noEmit && npm test && npm run build` dans `client/`.
