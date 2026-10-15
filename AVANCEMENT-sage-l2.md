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

### n° 3 · Échéancier du modèle de règlement en saisie (fait, scénario sur vraie base à passer)

- Calcul unique en centimes entiers (`tiers/echeancier-modele.ts`) · servi au
  simulateur du modèle et à la saisie ; la dernière échéance prend le reste,
  l'Équilibre se calcule en dernier, aucune échéance négative.
- Route `GET /tiers/echeancier-de-ligne/:compteId?date&montant&sens&typeJournal`
  (lecture, compte jugé dans le dossier) · rend tiers, modèle, mode habituel,
  `applicable`, échéances (montant, date, mode actif) et le motif quand rien
  ne s'applique. La ligne qui reçoit l'échéancier · facture sur un 40
  (crédit) ou un 41 (débit), hors 408, 409, 416, 418, 419 et hors journal de
  trésorerie (`motifSansEcheancierDuModele`).
- `Tiers.validationAutomatiqueEcheances` (migration
  `20270180000200_echeancier_du_tiers`, faux par défaut) · case
  « Échéancier appliqué d'office » de la fiche.
- Saisie · une ligne de tiers sans échéance tapée demande l'échéancier ; une
  échéance · posée et annoncée ; plusieurs · fenêtre « Échéances de la ligne »
  (`FenetreEcheances`, montants, dates, modes retouchables, refus d'un
  découpage qui ne refait pas la ligne au centime) ou découpage direct si le
  tiers le demande ; sans modèle, le mode habituel du tiers ; ligne en devise
  non découpée, et c'est dit. Chaque ligne garde un repère local (`cle`) que
  la réponse retrouve.
- Art. 59 bis relu · la transaction est la FACTURE entière (lignes de la
  pièce au compte du tiers), pas l'échéance · une facture de 1 200 000 en
  deux échéances de 600 000 payée en espèces reste avertie, nommée une fois.
- Tests · `echeancier-modele.spec.ts` (18), `reglements.spec.ts` (pièce
  entière), `client/src/lib/echeance-saisie.spec.ts` (6),
  `modele-reglement-aide.spec.ts` (garantie négative vieillie, la bulle du
  simulateur ne dit plus « aucune saisie ne l'applique »),
  `e2e/tests/sage-l2-echeances.e2e.ts` (vert sous Chromium).

## Reste

1. Scénario sur vraie base des fonctions 1 et 3 à travers une clôture.
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
| 3 | 2026-10-15 | L2 | fait | une ligne en devise ne se découpe pas d'elle-même (dit à l'écran) | le découpage en échéances passait une facture sous le seuil de l'art. 59 bis · la transaction se relit sur la pièce |

## Pour features.csv

- n° 1 → yes · modes de règlement (structure, tiers, modèles, saisie, règlement), avertissement de l'art. 59 bis.
- n° 3 → yes · échéancier du modèle du tiers appliqué en saisie, fenêtre des échéances, échéancier appliqué d'office.

## Commandes de vérification

```bash
cd /home/user/wt-sage-l2
npx tsc --noEmit && (cd client && npx tsc --noEmit)
npx jest src/modules/reglements src/modules/tiers src/modules/comptabilite/brouillard.spec.ts --maxWorkers=1
(cd client && npx vitest run src/lib/modes-reglement.spec.ts)
# e2e · serveur sur 8302 (base l2_e2e), aperçu sur 4302
(cd e2e && PW_CHROMIUM=/opt/pw-browsers/chromium OMEGAX_APP=http://localhost:4302 OMEGAX_API=http://localhost:4302/api npx playwright test tests/sage-l2-modes.e2e.ts)
```
