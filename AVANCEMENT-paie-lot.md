# AVANCEMENT · ligne paie-lot

Gel levé par Manasse le 2026-11-01 (« Fais tout le point 1 »). Branche de
sauvegarde `travail/paie-lot`, partie d'`origin/main` (d3212cc47).

## Fait

1. **Paramètres de paie du dossier** · `Tenant.paieNatureEmployeurInpp`,
   `paieEffectifInpp`, `paieInppDepuisMois` (mois d'effet, exigé avec la
   nature ou l'effectif, jamais repris pour un mois antérieur),
   `paieRegimeSalarial` (barème ou salariés d'une micro-entreprise seulement ·
   le personnel domestique, qualité du travailleur, reste à la simulation du
   salarié, loi n° 23/053, art. 121, al. 2 lu), nullables sans défaut (null =
   pas encore dit), bornes en CHECK
   (`20270246500000_parametres_de_paie_du_dossier`). Routes
   `GET|PUT /personnel/parametres-paie` (classe ouverte au gestionnaire de
   paie, PUT sous `@Roles` admin et comptable). Journal d'audit par `Tenant`.
   Onglet « Paramètres de paie ». Ils PRÉREMPLISSENT seulement · la
   simulation unitaire remplit ses champs VIDES à l'ouverture de l'onglet, le
   calcul serveur (`simulerPaie`) est inchangé, le bulletin fige le corps.
   Classe professionnelle · déjà au contrat (P1b), reprise du contrat.
2. **Salaire du contrat en premier élément** · `paie-en-lot.ts`,
   `corpsPropose` · salaire des jours dus du moteur des absences, dans la
   monnaie du contrat (montantUsd si USD) ; rien de deviné (monnaie absente,
   périodicité autre que le mois, proposition non chiffrée · nommé). Route
   `GET /personnel/salaries/:id/proposition-bulletin/:mois`, posée sur une
   saisie vierge de la simulation unitaire.
3. **Paie du mois en lot** · `GET /personnel/paie-en-lot/:mois` propose
   (200 salariés au plus, `tronque`), verdict de la simulation, déjà émis
   écartés et dits ; onglet « Paie en lot », cases décochées, émission par la
   ROUTE UNITAIRE l'une après l'autre (`emettreLesCoches`), refus nommés.
   Personnes à charge · jamais reprises du registre, saisies sur la ligne,
   recalcul par la simulation.
4. **Soldes de congés** · `GET /personnel/soldes-conges?ala=`, compteur de
   chaque salarié actif (`CongesService.compteur`), onglet « Soldes de
   congés ».
5. **Impression des bulletins du mois** · onglet Bulletins, aperçu des
   bulletins émis relus un à un (`CorpsBulletin`, rendu unique), saut de page
   entre chacun, tout ou rien.

## Vérifié (2026-11-01)

- Bloc § 3 · serveur `tsc` vert, `jest` 1 047 suites, 15 103 tests ; `nest build`
  vert. Client `tsc` vert, `vitest` 325 fichiers, 2 611 tests ; `vite build`
  vert. `prisma migrate diff` · « No difference detected », code 0.
- Rejeu sur vraie base (PostgreSQL 16 local, serveur compilé, API)
  `scripts/rejouer-paie-lot.cjs` · TOUT VERT. Décembre 2026 puis janvier 2027 ·
  S1 800 000 CDF · CNSS ouvrière 40 000, IRPP 94 600 (barème annuel
  9 120 000 · 58 320 + 1 076 400 = 1 134 720 / 12 = 94 560, centaine de
  l'art. 150 · 94 600), net 665 400, calculés à la main dans le script ;
  S2 1 300 000 avec une absence non autorisée · 1 250 000 (25/26), IRPP
  158 700 ; S3 600 USD au cours 2 800 · 1 680 000 FC ; S4 au jour · non
  émissible, dit ; un salarié sans contrat compté ; déjà émis écartés ;
  numérotation continue n° 3 en janvier 2027 ; une personne à charge retenue
  réduit l'IRPP ; soldes de congés au 15 janvier 2027 (un jour né, décembre
  seul payé) ; cloisonnement (404 chez le voisin). Aucune clôture traversée ·
  le parcours de la ligne n'écrit aucune écriture comptable (la passation
  reste la ligne P9, inchangée).
- Relecture « échecs silencieux » faite par la session (l'outil d'agents
  n'est pas disponible dans cette session) · corrigés · reprise du salaire
  d'un autre mois laissée en silence sur la saisie (désormais remplacée tant
  qu'intacte), bulletin annulé entre la liste et l'impression (refus, rien
  imprimé), lecture des bulletins actifs bornée par les salariés lus, jour de
  lecture des soldes dit même sans salarié.

## Relecture indépendante du 2026-11-01 (traitée)

- B1 · les jours payés ne sont plus un paramètre du dossier · ceux du salarié
  et du mois, lus sur la proposition des absences (jours payés à plein et
  jours de congé), rien envoyé un mois entier, rien et dit avec des jours aux
  deux tiers.
- B2 · une allocation de congé du mois non chiffrée ou d'une autre monnaie
  rend la ligne non émissible, motif nommé.
- M1 · mois d'effet de la nature et de l'effectif INPP ; la ligne du lot dit
  ce qu'elle a repris, « déclaré au dossier depuis ».
- M2 · régime domestique refusé au dossier (DTO, base).
- M3 · impression · mois figé au clic, liste relue juste avant et confrontée
  au nombre affiché, bulletins d'un autre mois refusés.
- Mineurs · lecture des bulletins actifs refusée si elle se coupe, recalculs
  périmés jetés, mois proposé de Kinshasa, journal du serveur sans message
  brut (nom et code).

## Questions ouvertes (corpus lu, non tranché)

- Les jours payés aux deux tiers (mention 17) comptent-ils au SMIG des jours
  payés du plancher CNSS (décret n° 18/041, art. 8) pour un jour, une
  fraction ou pas du tout ? Le corpus ne le dit pas · la proposition
  n'envoie rien et le cabinet les déclare dans la Simulation.

- Le personnel domestique (art. 121, al. 2) se déclare à la simulation de
  chaque bulletin · un régime enregistré par salarié serait plus commode ;
  non fait (hors du périmètre).
- L'effectif de la tranche INPP est un champ distinct d'`effectifPermanent`
  (dont le zéro par défaut ne dit pas « pas encore dit »). Les arrêtés INPP
  disent « occupant entre 1 à 50 travailleurs » sans définir la date ni la
  méthode de décompte · déclaré par le cabinet, jamais tiré du registre.

## Vérification

```
npx tsc --noEmit && npx jest
cd client && npx tsc --noEmit && npm test && npm run build
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <base jetable> --exit-code
```
