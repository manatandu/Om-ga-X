# AVANCEMENT design-lot1

Fait
- 1. Couleurs inexistantes : accent -> sel, success -> positive, success-soft -> positive-soft (quinze fichiers) ; spec `lib/couleurs-declarees.spec.ts`.

- 2. Balance : colonnes de montants 92 -> 140 px (grand livre 136/136/140, journal 136, balance auxiliaire 136), chiffres tabulaires, intitulé borné à 420 px ; 13 chiffres mesurés à 127 px.

Reste : points 3 à 6 de la demande.

Décisions
- Aucune couleur déclarée ; contrastes mesurés : sel/blanc 8,32:1, sel sur sel/10 7,08:1, positive/blanc 6,12:1, positive sur positive-soft 5,45:1.

Vérification : `cd client && npx tsc --noEmit && npx vitest run && npx vite build`.
