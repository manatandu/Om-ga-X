# Avancement · passe V1 (banc rejouable des trois dossiers types)

Branche de sauvegarde · `travail/passe-v1`. Plan · `docs/plan-version-1.md`.
Gel des nouveautés · AUCUN code de production touché (src/, client/, prisma/).

## Fait
- `scripts/passe-v1/lib.mjs` · client HTTP (cookie, CSRF, adresse par dossier),
  registre des contrôles (concorde / écart, erreurs HTTP, notes), lectures.
- `scripts/passe-v1/passe.mjs` · lanceur, bilan final, sortie JSON.
- Scénario PROJET (`scenario-projet.mjs`) · 2026 et 2027, clôtures comprises.

## Reste
- Scénario ASSOCIATION, scénario SARL, README, lanceur de base et de serveur.

## Commandes
- `OMEGAX_API=http://localhost:8745 PASSE_SCENARIOS=projet node scripts/passe-v1/passe.mjs /tmp/passe.json`
