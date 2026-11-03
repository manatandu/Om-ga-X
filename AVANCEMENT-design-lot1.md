# AVANCEMENT design-lot1

Fait
- 1. Couleurs inexistantes : accent -> sel, success -> positive, success-soft -> positive-soft (quinze fichiers) ; spec `lib/couleurs-declarees.spec.ts`.

- 2. Balance : colonnes de montants 92 -> 140 px (grand livre 136/136/140, journal 136, balance auxiliaire 136), chiffres tabulaires, intitulé borné à 420 px ; 13 chiffres mesurés à 127 px.

- 3. Saisie : paragraphe de la date de versement déplacé dans une bulle Aide (citation mot pour mot) ; l avertissement sur la donnée reste conditionnel.

- 4. Mouvement : liste de comptes de la saisie et palette F7 sans animation ; menu et sous-menu animés seulement à la première ouverture (décision au geste, par référence) ; accueil sans compte à rebours ; barre des fenêtres (scale, `scale` car Tailwind 4 emploie la propriété individuelle) et barre du démarrage guidé en transform ; spec lib/mouvement-des-gestes.spec.ts.

Reste : points 5 à 6 de la demande.

Décisions
- Aucune couleur déclarée ; contrastes mesurés : sel/blanc 8,32:1, sel sur sel/10 7,08:1, positive/blanc 6,12:1, positive sur positive-soft 5,45:1.

Vérification : `cd client && npx tsc --noEmit && npx vitest run && npx vite build`.
