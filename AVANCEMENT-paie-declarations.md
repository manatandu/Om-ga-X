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

3. **Avance de mission, régularisation, répartition par projet**
   (`personnel/avance-mission.ts`, `avances-mission.service.ts`, migration
   `20270246001100_avances_mission`, `AvanceMissionPaie.tsx`). Avance ·
   D 4213 / C trésorerie au brouillard (fiche du compte 42 des deux plans),
   caisse provisionnée jugée. Régularisation au retour (fin constatée) ·
   D 6384 des frais justifiés / C 4213 de l'avance entière, écart ·
   complément (C trésorerie), trop-versé rendu (D trésorerie) ou retenu sur
   la paie · reclassé D 4211 puis repris par une avance du registre (Code du
   travail, art. 112, c). Le 4213 se solde dans les quatre issues. Une mission avancée
   ne porte plus ses frais justifiés au bulletin, le forfait imposable y reste.
   Pièces retenues (`detenteurs-ecriture.ts`), annulation motivée (brouillard
   retiré, validée en négatif, AUDCIF art. 20, al. 2). Répartition des frais
   par plan, 100 %, sections Détail actives, part au centime par le plus fort
   reste, appliquée au 6384 de la régularisation · refusée sans avance active.

4. **Relecture du 2026-11-01** · 4213 (décision par la loi, ci-dessous) ;
   répartition refusée sans avance (MAJEUR 1) ; registre des retenues réduit
   aux natures de la paie pour le gestionnaire, filtré au serveur
   (`retenues/vue-de-la-paie.ts`, MAJEUR 2) ; exercice du geste jugé (du
   dossier, ouvert, date dans ses bornes) ; ordre des gestes nommé à
   l'annulation d'une mission régularisée ; abstention CNSS d'un bulletin ·
   totaux des points 6 et 7 nuls, nommés ; point 5 tranché (toutes les sommes
   payées) ; répartitions bornées et dites ; modules relus avant d'activer la
   paie ; motif trop court dit ; pièce introuvable refusée, nommée.

## Scénario sur vraie base

`DATABASE_URL=<base jetable locale> node scripts/rejouer-paie-declarations.cjs`
après `npm run build` et `prisma migrate deploy` · 49 contrôles verts à travers
la clôture de 2026 (4213 reporté 200 000 en 2027 puis soldé par la
régularisation, 50 000 reclassés au 4211 et soldés par la retenue de janvier, 6384 de 2026 = 380 000,50, ventilation 210 000,30 / 140 000,20,
cotisations CNSS de décembre 162 000 = 18 % de 900 000).

## Limites écrites (non faites, et pourquoi)

- La répartition par projet ne s'applique qu'au 6384 de la RÉGULARISATION.
  Les frais d'une mission SANS avance passent par le bulletin, dont la
  passation ventile par la répartition du SALARIÉ
  (`ventilation-analytique-paie.ts`) · y substituer celle de la mission
  touche la passation de la paie, que la ligne parallèle (paie en lot) modifie.
- La passation reste au brouillard · le module ne valide rien.

## Décisions prises, avec leur texte

- Énonciations de la déclaration · arrêté n° 146/2018, art. 23 (Mod. DC). Le
  point 8 (travailleurs occupés au dernier jour) se lit au REGISTRE (contrat en
  vigueur ce jour), pas au nombre de bulletins. Le point 9 (enfants
  bénéficiaires) se lit sur l'entrée figée du bulletin
  (`enfantsBeneficiairesAllocations`) · un bulletin qui ne le dit pas rend le
  total `null`, jamais zéro (les personnes à charge ne sont pas des enfants
  bénéficiaires, P5). Le point 10 (date et mode de paiement) est un fait du
  versement · laissé au cabinet.

- DÉCISION PAR LA LOI (2026-11-01, relecture) · le compte de l'avance est le
  4213 « Frais avancés et fournitures au personnel », aux deux référentiels.
  Fiche du compte 42 (AUDCIF Titre VII ; SYCEBNL Partie 2 ch. 3) · le 421 se
  subdivise en 4211 « Personnel, avances », 4212 « Personnel, acomptes »,
  4213 « Frais avancés et fournitures au personnel ». L'avance de mission
  n'est pas une avance sur la rémunération (art. 112, c) du Code du travail,
  4211 et 4212) · ce sont des frais avancés pour une dépense de l'entité.
  Semé aux deux plans (`compte-seed.ts`, `compte-seed-syscohada.ts`). Au
  trop-versé retenu, la créance change de nature · reclassée D 4211 / C 4213,
  reprise par l'avance du registre au 4211.
- Point 5 de la déclaration · « sommes payées », pas la rémunération (point 6,
  art. 17, point 1 ; Code du travail, art. 7, point 8) · toutes les sommes
  payées, remboursements de frais compris (le total versé figé).
- Le trop-versé retenu est une avance de l'art. 112, c) · aucun plafond (le
  texte ne renvoie à l'art. 114 que pour son litera d), la retenue jamais
  au-delà du solde (mécanique existante).

## Questions ouvertes (le corpus ne tranche pas)

- Conventions d'OmegaX · une seule avance non annulée par mission ; l'avance
  versée au plus tard au retour prévu ; régularisation après la fin constatée.

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
