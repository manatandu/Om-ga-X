# Avancement · déconnexion d'un utilisateur par l'administrateur

Gel levé par Manasse le 2026-10-21 (« la 2e possibilité. Fais le proprement »),
fonction vue dans le manuel de Microfina++ (p. 18).

## Fait
- Serveur · `UtilisateurService.deconnecter`, route `POST /utilisateurs/:id/deconnecter`
  (contrôleur réservé à l'administrateur). Pose `sessionsInvalidesAvant`, rien d'autre.
  Refus de soi-même (renvoi à Mon compte), 404 hors dossier.
- Écran · bouton « Déconnecter » dans Autorisations d'accès (ni soi, ni compte
  désactivé), confirmation, réussite et refus dits.
- Tests · `deconnexion-utilisateur.spec.ts`, `utilisateurs-refus.spec.ts`,
  e2e `deconnexion-utilisateur.e2e.ts` (vraie base, deux navigateurs).
- CLAUDE.md § 5 (gel) et § 8 (révocation).

## Reste
- Bloc § 3 des deux côtés, relectures (typescript-reviewer, react-reviewer,
  silent-failure-hunter), intégration sur main, déploiement vérifié.

## Vérification
npx tsc --noEmit && npx jest src/modules/utilisateurs
(cd client && npx tsc --noEmit && npx vitest run src/pages/utilisateurs-refus.spec.ts)
