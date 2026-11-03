# AVANCEMENT design-lot1

Fait
- 1. Couleurs inexistantes : accent -> sel, success -> positive, success-soft -> positive-soft (quinze fichiers) ; spec `lib/couleurs-declarees.spec.ts`.

Reste : points 2 à 6 de la demande.

Décisions
- Aucune couleur déclarée ; contrastes mesurés : sel/blanc 8,32:1, sel sur sel/10 7,08:1, positive/blanc 6,12:1, positive sur positive-soft 5,45:1.

Vérification : `cd client && npx tsc --noEmit && npx vitest run && npx vite build`.
