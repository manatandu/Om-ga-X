# Avancement · ligne sage-l2 (tiers et règlements)

Branche de sauvegarde `travail/sage-l2`, copie `/home/user/wt-sage-l2`.
Fonctions de la ligne (architecture.md), dans l'ordre · n° 1, n° 3, n° 36
(« must »), puis n° 24, n° 31, n° 32, n° 27, n° 18 (part règlement).
Migrations dans la plage `20270180000100` et suivantes.

## Fait

### n° 1 · Modes de règlement (fait)

- Table `ModeReglement` (migration `20270180000100_modes_reglement`) · code
  (1 à 10, majuscules), intitulé (35, unique), nature (`NatureModeReglement`,
  huit valeurs), code interbancaire libre (17), journal de trésorerie
  proposé, actif. Trente au plus (Sage, P_REGLEMENT), compté sous verrou du
  dossier. Journal d'audit, cloisonnement, index qui commencent par
  `tenantId`, borne de restitution (`lecture-bornee.spec.ts`).
- Le mode se pose sur le tiers (`Tiers.modeReglementId`), sur le modèle de
  règlement et chacune de ses échéances, sur la ligne d'écriture (saisie,
  modification au brouillard, négatif, réimputation) et sur le règlement des
  tiers (`modeReglementId` du lot, porté sur chaque ligne de la pièce). Toutes
  les clés en RESTRICT. Toujours relu dans le dossier (`modeDuDossier`), refusé
  en sommeil, gardé s'il est déjà posé.
- Routes · `GET/POST /modes-reglement`, `POST /modes-reglement/usuels`
  (espèces, chèque, virement, carte, monnaie électronique · ceux déjà pris ne
  sont pas recréés, et c'est dit), `PATCH` et `DELETE /modes-reglement/:id`,
  administrateur seul. Suppression refusée tant qu'une structure ou une ligne
  le porte (relations lues dans le schéma), renvoi à la mise en sommeil.
- Art. 59 bis · un règlement FOURNISSEUR dont une facture fait au moins
  1 000 000 FC, payé par un mode hors chèque, virement, carte (mode déclaré,
  ou compte 57 / 55 du journal), est AVERTI (art. 59 bis et 74 bis cités),
  jamais refusé ; rien côté client, rien pour un dossier déclaré non assujetti,
  rien avant le 27 mai 2013 (`modes-reglement.ts`).
- Écrans · Structure > Paramètres de saisie > Modes de règlement
  (`ModesReglementPage`, administrateur) ; fiche du tiers (modèle et mode
  désormais modifiables), création du tiers, modèle de règlement (mode du
  modèle, mode de chaque échéance) ; Règlement des tiers (mode du lot, qui
  présélectionne son journal) ; saisie (zone « Échéance » et « Mode de
  règlement » sur un compte de classe 4, `lib/echeance-saisie.ts`).
- Tests · `modes-reglement.spec.ts` (serveur, 20), `reglements.spec.ts` (mode
  du lot), `brouillard.spec.ts` (ligne recréée avec son mode, refus d'un mode
  étranger ou en sommeil), `client/src/lib/modes-reglement.spec.ts` (miroir
  des natures et libellés, relu dans le schéma et le serveur),
  `e2e/tests/sage-l2-modes.e2e.ts` (vert sous Chromium).
- Commits · 5bca551 (serveur), et le commit de l'écran.

## Reste

1. n° 3 · échéance calculée par le modèle de règlement du tiers en saisie, fenêtre multi-échéance, validation automatique.
2. n° 36 · écart de règlement sous un seuil, escompte financier.
3. n° 24 · qualité du tiers.
4. n° 31 · lieux de livraison des clients.
5. n° 32 · duplication d'un tiers.
6. n° 27 · modèles d'impression propres au tiers.
7. n° 18 · assistant de règlement.
8. Scénarios sur vraie base (n° 1, 3, 36), tests navigateur, bloc du § 3.

## Décisions par la loi

- **n° 1 · art. 59 bis.** O.-L. n° 10/001, art. 59 bis (« Toute transaction
  entre assujettis à la taxe sur la valeur ajoutée d'un montant d'au moins
  1.000.000,00 de Francs congolais doit être payée par chèque, par virement
  ou par carte bancaire ») et art. 74 bis (perte du droit à déduction de la
  TVA supportée). La sanction frappe celui qui DÉDUIT · l'avertissement ne
  vise que le paiement d'un fournisseur. Entrée en vigueur · trois mois après
  le 27 février 2013 (note de la compilation DGI), soit le 27 mai 2013. Le
  module de TVA n'est pas touché (la perte de déduction reste la lacune
  nommée de la passe F2b).
- **n° 1 · code interbancaire libre.** Aucune nomenclature bancaire du corpus
  ne s'impose en RDC (décision D11 de la reproduction).

## Questions à Manasse

- **Monnaie électronique et art. 59 bis.** Le texte nomme chèque, virement et
  carte bancaire, et lui seul ; un paiement par monnaie électronique (M-Pesa,
  Orange Money) n'y figure pas. OmegaX l'avertit comme les espèces. Aucun
  arrêté d'application lu ne l'assimile au virement ; si la DGI l'admet, il
  suffit d'ajouter la nature à `NATURES_ADMISES_ART_59_BIS`.

## Pour CLAUDE.md

(paragraphe du § 6, écrit à la fin)

## Pour build-log.md

| # | Date | Ligne | État | Ce qui manque | Plus dur que prévu |
|---|---|---|---|---|---|
| 1 | 2026-10-15 | L2 | fait | le mode ne suit pas encore le report à-nouveau au détail | la modification au brouillard remplace les lignes · le mode devait être rendu au client pour ne pas s'effacer |

## Pour features.csv

- n° 1 → yes · modes de règlement (structure, tiers, modèles, saisie, règlement), avertissement de l'art. 59 bis.

## Commandes de vérification

```bash
cd /home/user/wt-sage-l2
npx tsc --noEmit && (cd client && npx tsc --noEmit)
npx jest src/modules/reglements src/modules/tiers src/modules/comptabilite/brouillard.spec.ts --maxWorkers=1
(cd client && npx vitest run src/lib/modes-reglement.spec.ts)
# e2e · serveur sur 8302 (base l2_e2e), aperçu sur 4302
(cd e2e && PW_CHROMIUM=/opt/pw-browsers/chromium OMEGAX_APP=http://localhost:4302 OMEGAX_API=http://localhost:4302/api npx playwright test tests/sage-l2-modes.e2e.ts)
```
