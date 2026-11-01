# AVANCEMENT · ligne paie-lot

Gel levé par Manasse le 2026-11-01 (« Fais tout le point 1 »). Branche de
sauvegarde `travail/paie-lot`, partie d'`origin/main` (d3212cc47).

## Fait

1. **Paramètres de paie du dossier** · `Tenant.paieNatureEmployeurInpp`,
   `paieRegimeSalarial`, `paieEffectifInpp`, `paieJoursPayes`, nullables sans
   défaut (null = pas encore dit), bornes en CHECK
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

## Questions ouvertes (corpus lu, non tranché)

- Régime de la retenue (art. 121, al. 2) au DOSSIER · un dossier qui emploie
  à la fois du personnel de droit commun et du personnel domestique devra
  changer le champ dans la simulation du salarié concerné. Un régime par
  salarié serait plus juste ; non fait (hors du périmètre demandé, « au
  dossier »).
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
