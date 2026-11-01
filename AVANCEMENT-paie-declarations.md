# Avancement · ligne paie-declarations

Gel levé par Manasse le 2026-11-01 (« Fais tout le point 1 »). Branche de
sauvegarde `travail/paie-declarations`, partie de `origin/main`.

## Fait

1. **Déclaration CNSS préparée** (`personnel/declaration-cnss.ts`, service,
   Excel, onglet « Déclaration CNSS » du registre du personnel). Énonciations
   lues à l'arrêté n° 146/2018, art. 23 (formulaire Mod. DC), mot pour mot ;
   art. 22 (déclaration unique) nommé dans une réserve ; art. 24 à 28 (feuilles
   de paie jointes, télédéclaration au-delà de 25 travailleurs, sièges,
   défaut des annexes). Montants lus sur les bulletins ÉMIS figés
   (`totalVerseFc`, lignes CNSS du calcul figé) · aucun recalcul. Échéance ·
   le 15 du mois suivant, régularisation dans les 5 jours (art. 21 et 31),
   aucun report au jour ouvrable (le texte n'en dit pas). Mois sans bulletin
   · dit, avec l'art. 26.
2. **Gestionnaire de paie** · `GET /retenues/registre` et `/retenues/echeancier`
   ouverts en lecture (`@AccesRolesCantonnes({ gestionnairePaie: true })`
   route par route, liste fermée de `roles-cantonnes.spec.ts`), menu et
   `ADRESSES_UTILES_A_LA_PAIE`. Le registre compte les pièces de paie au
   brouillard (liaison au bulletin) et l'écran Retenues le dit. Amorce
   « Activer la Paie » (`lib/amorce-paie.ts`, `AmorcePaie.tsx`) à l'ouverture
   du registre du personnel et au démarrage guidé.

## Reste

3. Avance de mission et régularisation, ventilation des frais par projet.

## Décisions prises, avec leur texte

- Énonciations de la déclaration · arrêté n° 146/2018, art. 23 (Mod. DC). Le
  point 8 (travailleurs occupés au dernier jour) se lit au REGISTRE (contrat en
  vigueur ce jour), pas au nombre de bulletins. Le point 9 (enfants
  bénéficiaires) se lit sur l'entrée figée du bulletin
  (`enfantsBeneficiairesAllocations`) · un bulletin qui ne le dit pas rend le
  total `null`, jamais zéro (les personnes à charge ne sont pas des enfants
  bénéficiaires, P5). Le point 10 (date et mode de paiement) est un fait du
  versement · laissé au cabinet.

## Questions ouvertes (le corpus ne tranche pas)

- Les gabarits de la déclaration mensuelle unique et du Mod. DC ne sont pas
  au corpus · l'état reste une préparation.
- Deux voies de déclaration (guichet unique, représentation de la Caisse) ·
  l'arrêté n° 146/2018 et l'arrêté interministériel du 12 mai 2015 ne
  s'articulent pas (déjà dit au registre des retenues).

## Vérification

```bash
npx tsc --noEmit && npx jest
cd client && npx tsc --noEmit && npm test && npm run build
```
