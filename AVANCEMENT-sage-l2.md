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

### n° 3 · Échéancier du modèle de règlement en saisie (fait)

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

### Scénario sur vraie base · fonctions 1 et 3 à travers une clôture (vert)

Serveur compilé, base PostgreSQL jetable (`l2_e2e`), par l'API seule
(script de la session, `scenario-l2-13.mjs`). N = 2026, fournisseur au
modèle « moitié à 30 jours au virement, le reste à 60 », mode habituel
chèque. Échéancier de la ligne du 10 décembre 2026 de 1 160 000 · 580 000 au
9 janvier 2027 (VIR), 580 000 au 8 février 2027 (CHQ) ; un 401 au débit ne
reçoit rien. Pièce passée découpée, validée, N clôturé · report N+1 du
fournisseur 1 160 000 au crédit ; l'échéancier de N+1 lit les deux
échéances reportées à leurs dates. Règlement de la première au virement le
15 janvier (aucun avertissement), de la seconde en espèces le 10 février ·
AVERTIE au titre de l'art. 59 bis, sur la facture d'origine de 1 160 000.
Chaque ligne des deux pièces porte son mode ; fournisseur soldé (report
1 160 000, débits 1 160 000), banque et caisse créditées de 580 000 chacune,
plus rien à décaisser ; le mode porté ne se supprime pas.

**Défaut trouvé sur vraie base, corrigé et gelé** · la ligne d'à-nouveau de
580 000 réglée en espèces se lisait seule, sous le seuil, et la facture de
1 160 000 de N échappait à l'art. 59 bis · elle se lit désormais sur sa pièce
d'origine (`transactions-art-59-bis.ts`, `originesDesReports`, la règle des
relances), gelé par `transactions-art-59-bis.spec.ts`.

### n° 36 · Escompte et écart de règlement (fait)

- Règles pures (`reglements/ecart-escompte.ts`) · `planDuReglement` dit ce
  que la pièce éteint au compte du tiers (payé, escompte, écart soldé) ou le
  motif du refus ; `compteDuRole` choisit le compte de chaque rôle parmi les
  comptes de détail actifs sous la racine (le compte du plan subdivisé
  s'efface devant ses sous-comptes, plusieurs candidats · choix exigé, jamais
  deviné) ; `lignesAvecEscompteEtEcart` compose la pièce (débits puis crédits).
- `Tenant.seuilEcartReglement` (migration `20270180000300_seuil_ecart_reglement`,
  nullable, SANS défaut) · `PATCH /dossier/seuil-ecart-reglement`
  (administrateur), servi par les paramètres, imprimé à l'édition des
  paramètres ; Paramètres du dossier > Régime fiscal.
- Règlement des tiers · par tiers, `escompte`, `solderEcart`,
  `compteEscompteId`, `compteEcartId` (DTO, `FacultatifNonNul`). Sans
  montant, le payé est le dû moins l'escompte. Tout se juge AVANT la première
  pièce · refus avec la part désignée de chaque facture, en devise, d'un
  compte sans son geste, sans seuil, au-delà du seuil. Lettrage complet
  quand le payé et l'escompte (et l'écart) éteignent le dû ; un lettrage
  partiel complété l'est sur ce que la pièce éteint ; l'ordre de virement
  porte le payé. Résultat · `escompte`, `ecartReglement` par tiers.
- Avertissements, jamais des refus · la TVA que l'escompte ou la remise ne
  régularise pas (sauf dossier déclaré non assujetti), l'escompte consenti
  après l'échéance de la facture.
- `GET /reglements/comptes-escompte-ecart?sens=` · comptes offerts par rôle,
  le proposé ou le motif, et le seuil (liste au régime « texte » de
  `listes-de-comptes.ts`). La route du n° 3
  (`/tiers/echeancier-de-ligne/:compteId`) est rangée parmi les routes qui ne
  sont pas des listes (oubli du commit du n° 3, trouvé par
  `comptes-proposes.spec.ts`).
- Écran · Règlement des tiers, par tiers en francs sans parts · « Escompte »,
  « Solder l'écart » (fermé sans seuil), comptes à choisir quand le serveur
  en offre plusieurs ; le payé proposé suit l'escompte ; sélecteur « Sens du
  règlement » nommé.
- Tests · `ecart-escompte.spec.ts` (17, dont les comptes relus dans les deux
  semis), `reglements.spec.ts` (8 câblages), `client/src/lib/escompte-reglement.spec.ts`
  (7), `e2e/tests/sage-l2-escompte.e2e.ts` (vert sous Chromium).

### Scénario sur vraie base · fonction 36 à travers une clôture (vert)

Script `scenario-l2-36.mjs` (serveur compilé, base `l2_e2e`). N = 2026 ·
facture fournisseur de 1 160 000 (échéance 31 janvier 2027), facture client
de 500 000, validées, N clôturé. N+1 · la facture reportée payée le 15
janvier avec un escompte de 12 000 (1 148 000 payés, lettrage complet, TVA
dite) ; sans seuil, l'écart refusé, le geste nommé ; seuil de 1 000 fixé, la
créance reportée encaissée pour 499 400 se solde (600 au 6588) ; une facture
de N+1 de 300 000 payée 300 500 se solde (500 au 6588) ; un client qui paie
trop est refusé (art. 252). Soldes de N+1 après validation, contre le calcul
à la main · 401 soldé (report 1 160 000 + 300 000, débits 1 460 000), 4111
reste 200 000 (la facture de N+1), 773 créditeur de 12 000, 6588 débiteur de
1 100, banque -949 100 ; l'échéancier ne garde que la facture client de N+1.
Aucun défaut trouvé.

### n° 24 · Qualité du tiers (fait)

- `Tiers.qualite` (migration `20270180000400_qualite_tiers`, 35 caractères,
  nullable) · libellé DESCRIPTIF (Sage, « Qualité », « société,
  indépendant… »), proposé dans une liste (`tiers/qualite-tiers.ts`,
  `QUALITES_PROPOSEES`) et libre ; rangé sans blancs de bord, vide ou `null`
  l'efface. Il ne décide rien · aucun contrôle ni taux ne le lit.
- Création et modification (DTO bornés à 35), fusion (comble le vide comme
  une coordonnée, jamais n'écrase), édition du plan des tiers (colonne
  « Qualité »).
- Écran · fiche du tiers, champ « Qualité » avec liste proposée,
  enregistré à la sortie du champ (administrateur), bulle d'aide.
- Tests · `qualite-tiers.spec.ts` (serveur, 6), `client/src/lib/qualite-tiers.spec.ts`
  (miroir relu dans le serveur), `editions-structures.spec.ts`,
  `e2e/tests/sage-l2-qualite.e2e.ts` (vert sous Chromium).

### n° 31 · Lieux de livraison des clients (fait)

- Table `LieuLivraison` (migration `20270180000500_lieux_livraison`) ·
  intitulé (35), adresse, complément, boîte postale, ville, pays, contact,
  téléphone, courriel, principal, actif ; par dossier (cloisonnée, index
  `tenantId, tiersId`), au journal d'audit, supprimée avec le tiers
  (Cascade, comme ses RIB, retirée dans la transaction de suppression),
  reportée par la fusion (sans principal si la fiche gardée en a un ; un
  intitulé déjà pris suivi du code du doublon, `intituleRenomme`).
- Règles (`tiers/lieux-livraison.ts`) · un CLIENT seulement ; intitulé rangé,
  exigé, unique chez le client sans égard à la casse ; un seul principal, le
  premier actif d'office, jamais un lieu en sommeil (mis en sommeil, il perd
  la marque, le client reste sans principal, comme le RIB principal) ; la
  marque se pose dans la transaction qui retire les autres.
- Routes · `GET /tiers/:tiersId/lieux-livraison` (liste bornée à 200, total
  et `tronque`), `POST` idem, `PATCH` et `DELETE /lieux-livraison/:id`
  (administrateur ; retrait refusé si une relation le porte un jour).
- Écran · volet « Lieux de livraison » de la fiche d'un client
  (`VoletLieuxLivraison`, administrateur), ajouter, modifier, rendre
  principal, mettre en sommeil, retirer ; boutons nommés par lieu.
- Tests · `lieux-livraison.spec.ts` (9), `fusion-tiers-service.spec.ts`
  (lieux reportés, renommés), `client/src/lib/lieux-livraison.spec.ts` (3,
  champs relus dans le DTO), `ecriture-masquee.spec.ts`,
  `e2e/tests/sage-l2-livraison.e2e.ts` (vert sous Chromium).

### n° 32 · Duplication d'un tiers (fait)

- `GET /tiers/:id/duplication` (lecture, `tiers/duplication-tiers.ts`) · le
  corps du formulaire de création · type, nom, qualité, coordonnées (adresse,
  boîte postale, ville, pays, téléphone, courriel, contact), modèle et mode
  de règlement actifs, échéancier d'office ; code vide. Rien n'est écrit ;
  la création passe par `POST /tiers` (mêmes contrôles, même panoplie).
- Non repris, et nommés avec leur motif · code, comptes, Numéro Impôt,
  coordonnées bancaires, documents, lieux de livraison, cellule du groupe,
  autorisation aux débits, exclusion des relances, modèle ou mode en
  sommeil. `CreerTiersDto` reçoit `validationAutomatiqueEcheances`.
- Écran · fiche du tiers, « Dupliquer… » (administrateur) · la fenêtre
  « Copie de CODE » remplie, la ligne « Non repris · … ».
- Tests · `duplication-tiers.spec.ts` (5, dont le corps passé au DTO de
  création en liste blanche), `client/src/lib/duplication-tiers.spec.ts` (3),
  `e2e/tests/sage-l2-duplication.e2e.ts` (vert sous Chromium).

### n° 27 · Modèles d'impression propres au tiers (fait)

- Table `ModeleImpressionTiers` (migration `20270180000600`) · nature
  (extrait de compte, avis de règlement, rappel), intitulé unique dans sa
  nature sans égard à la casse, texte ; cent par dossier ; au journal
  d'audit, cloisonnée. Trois zones sur la fiche du tiers
  (`modeleImpressionExtraitId`, `…ReglementId`, `…RappelId`, RESTRICT) ·
  modèle du dossier et de la nature de sa zone, sinon refus nommé.
- LE MODÈLE HABILLE LE DOCUMENT, IL NE LE REMPLACE JAMAIS
  (`tiers/modeles-impression.ts`) · le jeton {document} exigé une fois et une
  seule, aucun jeton inconnu (il s'imprimerait tel quel) ; jetons {tiers},
  {code}, {qualite}, {contact}, {adresse}, {entite}, {date} remplacés en une
  passe sur le seul texte du modèle (un libellé de facture qui écrit
  « {tiers} » reste tel quel).
- Où il sert · relances préventives et rappels (modèle de rappel) et relevé
  (modèle d'extrait), à l'émission (`RelancesService.emettre`, lettre du
  niveau habillée, l'historique et le courriel portent le même texte) et au
  relevé de compte à l'écran (cadre coupé autour du tableau) ; avis de
  règlement d'un ordre de virement IMPRIMÉ (`GET
  /ordres-virement/:id/avis-reglement`, `reglements/avis-reglement.ts`), un
  par fournisseur, l'imputation déclarée en payant transmise telle que
  l'ordre l'a recopiée, signé du dossier et de ses mentions, en-tête par
  défaut sans modèle ; aucun avis pour un salaire (compté).
- Duplication · les modèles sont repris ; fusion · ceux du doublon ne
  comblent que les zones vides.
- Écrans · Structure > Paramètres de saisie > Modèles d'impression
  (administrateur ; refus du serveur dit, garde de fermeture) ; volet de la
  fiche du tiers ; Rappel et relevé (modèle nommé sur la lettre, cadre du
  relevé) ; ordre de virement, « Avis de règlement » puis « Imprimer les
  avis » (un par page, à la place de l'ordre).
- Tests · `modeles-impression.spec.ts` (19), `modele-impression-relances.spec.ts`
  (3), `avis-reglement.spec.ts` (8), duplication et fusion,
  `client/src/lib/modeles-impression.spec.ts` (miroir du schéma et du
  serveur), `e2e/tests/sage-l2-modeles-impression.e2e.ts` (vert sous
  Chromium).

### n° 18 · Assistant de règlement, part règlement (fait)

- `client/src/lib/assistant-reglement.ts`, `AssistantReglement.tsx` · six
  étapes (sens, trésorerie, tiers, factures, montant, récapitulatif) sur le
  corps du formulaire Règlement des tiers, envoyé à `POST /reglements` ·
  aucune route ni règle à lui ; une étape ne dit que ce qui manque, le refus
  du serveur se dit au récapitulatif, ses avertissements une fois passé.
- Un tiers à la fois, en francs · une facture en devise renvoie au
  formulaire complet (cours, écart réalisé), comme les parts déclarées,
  l'escompte, l'écart de règlement et les lots. Montant prérempli au dû
  (`montantPourChamp`), lu avec ses espaces (`lireMontant` de l'assistant
  d'un bien). Mode de règlement qui présélectionne son journal ; ordre de
  virement pour un fournisseur seulement.
- « Régler un autre tiers » garde sens, date, journal, mode et ordre, et
  relit les factures ouvertes. Bouton « Assistant de règlement… » de la
  fenêtre Règlement des tiers (`peutEcrire`).
- Tests · `client/src/lib/assistant-reglement.spec.ts` (9, dont chaque champ
  envoyé relu dans le DTO du serveur),
  `e2e/tests/sage-l2-assistant-reglement.e2e.ts` (vert sous Chromium · partiel
  lettré, pièce lue, montant au-delà du dû refusé et dit).

### Relecture « échecs silencieux », premier tour (corrigée, 2026-10-15)

Aucun BLOQUANT, trois MAJEUR, neuf MINEUR, chacun corrigé avec le test qui
l'aurait attrapé, un commit signé par correction ou groupe cohérent.

- **M1** · `SaisiePage.tsx`, `lib/echeance-saisie.ts` · la réponse de
  l'échéancier pouvait arriver après l'enregistrement, le retrait de la ligne
  ou l'abandon de la pièce. Échéanciers attendus COMPTÉS, « Enregistrer la
  pièce » désactivé et refusé tant qu'il en reste
  (`motifEcheanciersEnAttente`), réponse appliquée et annoncée sur une ligne
  encore là et intacte seulement (`etatDeLaLigneAttendue` · absente, rien ;
  changée, dit) ; l'abandon ferme la fenêtre des échéances.
- **M2** · `EcritureService.controlesDEntree` · un mode mis en sommeil après
  la saisie enfermait le brouillard · `modesDejaPortes` (lu par `modifier` et
  `modifierPieceDuModule`) admet le mode déjà porté, refuse le nouveau.
- **M3** · `reglements/transactions-art-59-bis.ts` · la ligne se juge seule
  (une facture ou l'une de ses échéances) ; la pièce qui ne passe le seuil
  que par ses autres lignes au compte est avertie SOUS CONDITION (« si ses
  lignes au compte sont les échéances d'une même facture ») ; l'à-nouveau
  sans facture d'origine retrouvée (bilan d'ouverture, report au solde,
  origine elle-même un à-nouveau) est NOMMÉ « seuil de l'art. 59 bis non
  jugé », jamais compté pour une transaction (`classerTransactions`) ; la
  facture se lit dans son sens, jamais nette d'un avoir de la même pièce.
- **m1** · échéances nulles écartées (`echeancesNonNulles`), découpage
  d'office passé par `motifEcheancesSaisies`, la fenêtre s'ouvrant sinon.
- **m2** · Ctrl+D donne un repère neuf à la copie.
- **m3** · la fenêtre des échéances reçoit la liste des modes (`null` tant
  que non lue) et son échec ; le mode servi se nomme par son code
  (`EcheanceSaisie.modeCode`), repris au découpage.
- **m4** · fermer la fenêtre dit « ligne gardée entière, sans échéance ».
- **m5** · l'assistant de règlement reçoit et dit l'échec de lecture des modes.
- **m6** · `lib/geste-puis-relecture.ts` · un geste réussi reste réussi quand
  la relecture échoue, dite à part (Modes de règlement, Modèles d'impression).
- **m7** · tout ce qui est entre accolades est un jeton · « {montant total} »,
  « { tiers } » et « {} » refusés en les nommant.
- **m8** · lieux de livraison jugés sous un verrou consultatif par client dans
  leur transaction · lieu relu, homonyme par requête ciblée (sans égard à la
  casse, confirmé par la règle pure), lieux actifs comptés.
- **m9** · prélèvement, effet de commerce, monnaie électronique et autre mode
  avertis SOUS RÉSERVE (le texte ne nomme que chèque, virement et carte).
- Vérifié · `npx tsc --noEmit` des deux côtés, construction du serveur et du
  client ; Jest `--maxWorkers=1` sur les specs touchées (brouillard,
  pièce du module en place, lectures hors situation, ligne lettrée, report
  verrouillé, casse en silence, changement de mois, comptes personnalisés,
  transactions de l'art. 59 bis, modes de règlement, règlements, écart de
  change réalisé, modèles d'impression, lieux de livraison) ; Vitest sur les
  38 fichiers qui relisent les sources touchées (511 tests) ; sous Chromium,
  `sage-l2-echeances`, `-modes`, `-livraison`, `-modeles-impression` et
  `-assistant-reglement` (5 verts) contre le serveur reconstruit.

### Relecture du code serveur et des écrans, second tour (corrigée, 2026-10-15)

Dernier tour (CLAUDE.md § 11). Serveur · aucun BLOQUANT, aucun MAJEUR, huit
MINEUR. Écrans · aucun BLOQUANT, quatre MAJEUR, seize MINEUR. Tous corrigés,
chacun avec le test qui l'aurait attrapé ; aucun ne part aux relevés en
attente.

Écrans (quatre commits) ·
- **M1** · `SaisiePage.tsx`, `lib/echeance-saisie.ts` · la réponse d'une
  seconde ligne écrasait la fenêtre ouverte de la première (« Appliquer »
  posait les échéances de A sur B) · les découpages attendus font une FILE
  (`enfiler`, `fenetresPresentes`), la fenêtre porte la clé de sa ligne et
  ne s'ouvre que sur « Ouvrir les échéances » (mineur 2).
- **M2** · une pièce sans date sortait sans échéancier et sans un mot · la
  ligne retient la date de son échéancier (`echeancierDu`), une pièce sans
  date le dit et le calcule quand la date arrive, les lignes calculées pour
  une autre date sont nommées (`lignesAEcheancierDecale`,
  `motifEcheanciersDecales`) et l'enregistrement se confirme.
- **M3** · `TiersPage.tsx` · les modèles de règlement partaient de [] et un
  échec de lecture disait « Aucun modèle » · null et erreur, sélecteur sur
  liste lue seulement.
- **M4** · `AssistantReglement.tsx`, `ReglementsPage.tsx` · « aucun journal,
  créez-le » sur un échec ou avant la lecture · null et erreur transmis,
  le seul choix présélectionné à l'arrivée.
- Mineurs · 1 (avis de l'ordre ouvert seul), 3 (attente par ligne, purgée),
  4 (motif et mode joints, mode sur la facture seule), 5 (proposition de
  TVA par la clé de sa ligne), 6 (focus au récapitulatif), 7 (date au jour
  de Kinshasa, bornée à l'exercice), 8 (échec des modes dit à l'échéance du
  modèle), 9 (qualité refusée rétablie), 10 (« Repris de » complet), 11
  (formulaire d'échéance à l'étroit), 12 (lieu · focus, envoi unique,
  relecture dite), 13 (modèles d'impression lus une fois, « modèle non
  lu »), 14 (seuil non lu n'est pas « aucun seuil »), 15 (seuil prérempli
  par `montantPourChamp`), 16 (Entrée valide la ligne ; brouillon de modèle
  d'impression gardé avant d'écraser).

Serveur (quatre commits) ·
- **m1** · `lignesAvecEscompteEtEcart` reçoit escompte et écart avec leur
  compte (`MontantAuCompte`, ou null) et le plan rendu par
  `planDuReglement`, jamais un objet refait.
- **m2** · le mode du règlement sur le tiers et la trésorerie seuls
  (`avecLeMode(mode, [tiers, trésorerie], lignes)`), jamais sur l'escompte,
  l'écart ni le change ; JSDoc de `motifANouveauProvisoire` rendue.
- **m3** · intitulé d'un mode unique sans égard à la casse, sous le verrou du
  dossier, création et retouche (`refuserIntitulePris`).
- **m4** · `@Max(SEUIL_ECART_REGLEMENT_MAX)` nommé (DECIMAL(18,2)).
- **m5** · la fusion prend le verrou des lieux des deux clients, ordre fixe ;
  un renommé déjà pris prend un rang (`renommagesALaFusion`).
- **m6** · la doc du mode au-dessus de `model ModeReglement`.
- **m7** · P2003 entre contrôle et écriture · 409 qui nomme la référence
  (`tiers/reference-retiree.ts`), tiers, modèles de règlement, échéances,
  modes.
- **m8** · index sur `tiers.modeReglementId`, les trois modèles d'impression
  du tiers, `modeles_reglement.modeReglementId` et
  `echeances_reglement.modeReglementId` · migrations 20270180000100 et
  20270180000600 COMPLÉTÉES (jamais appliquées hors des bases jetables,
  absentes de `main`) ; `prisma migrate diff` contre une base d'ombre
  jetable · aucune différence ; `index-des-references-sage-l2.spec.ts`.
- Vérifié · `npx tsc --noEmit` des deux côtés ; Jest `--maxWorkers=1` sur
  `src/modules/reglements`, `src/modules/tiers`, le DTO du seuil, comptes
  personnalisés, cadratins, citations, fichiers sans appelant, DTO hors
  contrôleurs, décimales, facultatif non nul, transaction journalisée,
  borne par la valeur, casse en silence, index du dossier, lecture bornée
  (tout vert) ; Vitest entier (277 fichiers, 2165 tests) ; serveur et client
  reconstruits, base e2e recréée et migrée, les huit tests navigateur de la
  ligne verts sous Chromium, serveur et aperçu arrêtés par leur pid.

## Reste

1. Bloc du § 3 · passés · `npx tsc --noEmit` des deux côtés, `npm test` et
   `npm run build` du client (277 fichiers, 2165 tests après le second tour),
   construction du serveur, les huit tests navigateur de la ligne et le
   balayage des menus (`ecrans.e2e.ts`, deux référentiels), sous Chromium.
   RESTE · la suite serveur complète, que le coordinateur passe lui-même
   avant l'intégration (les tranches lancées ici ont été arrêtées faute de
   mémoire · tranche 1, quatre spécifications du client en échec sous la
   charge, vertes seules ; tranche 2, 44 vertes au moment de l'arrêt).
2. Avis de règlement · ni mise en file par courriel, ni avis d'un règlement
   sans ordre de virement (chèque, espèces).

## Relevés en attente

Aucun du second tour · les quatre MAJEUR et les seize MINEUR des écrans, les
huit MINEUR du serveur sont corrigés. Restent hors relecture, déjà au point 2
de « Reste » · l'avis de règlement ni mis en file par courriel, ni servi sans
ordre de virement.

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
- **n° 1 · ce que l'art. 59 bis mesure (relecture M3).** « Toute
  transaction [...] d'un montant d'au moins 1.000.000,00 » · la transaction
  est la facture. OmegaX ne l'affirme que sur ce que la pièce dit · la ligne
  de facture (ou d'échéance) seule ; la pièce à plusieurs lignes au compte,
  sous condition ; l'à-nouveau sans facture retrouvée, non jugé. Les modes
  que le texte ne nomme pas (prélèvement, effet de commerce, monnaie
  électronique, autre) sont avertis sous réserve, jamais dits en infraction.
- **n° 1 · code interbancaire libre.** Aucune nomenclature bancaire du corpus
  ne s'impose en RDC (décision D11 de la reproduction).

- **n° 36 · escompte de règlement.** AUDCIF, Titre VII, compte 67 (« 673 ·
  montant des réductions que l'entité consent sous forme d'escompte de
  règlement aux clients qui s'acquittent de leurs factures [...] avant le
  terme normal d'exigibilité ») ; fiches des comptes 40 et 41 des deux plans ·
  obtenu, D 40 / C 773 ; accordé, D 673 / C 41. Au SYCEBNL, la fiche du 41
  crédite « le compte 412 · CLIENTS-USAGERS » des escomptes accordés · un
  adhérent (411) n'en reçoit pas, refus nommé. Comptes relus dans les deux
  semis (77300000, 67300000).
- **n° 36 · l'écart de règlement se tranche par le Code civil, Livre III.**
  Le reste qu'un client ne paie pas peut être REMIS par le dossier créancier
  (art. 132, « par la remise volontaire ») · charge ; le trop-payé à un
  fournisseur est sujet à répétition et le dossier peut y renoncer (art. 133)
  · charge ; le trop-perçu d'un client s'oblige à restitution (art. 252) ·
  REFUSÉ, jamais un produit ; le dossier qui paie moins ne force pas son
  fournisseur à recevoir en partie (art. 142) et n'est libéré que par sa
  remise · REFUSÉ, le règlement reste partiel. Sage passe aussi l'écart
  « en produit » · non reproduit, la source primant sur Sage.
- **n° 36 · compte de l'écart.** Le résidu des charges diverses · 6588
  « Autres charges diverses » au SYSCOHADA (AUDCIF, Titre VII, compte 65,
  son 658 étant un total), 658 « Charges diverses » au SYCEBNL, non
  subdivisé (même lecture que D2 de la ligne A6). Ni le 651 (créances
  irrécouvrables), ni le 673 (aucune avance sur le terme).
- **n° 24 · la qualité ne décide rien.** Aucun texte du corpus ne fait
  dépendre une règle d'une « qualité » libre du tiers · la liste est
  proposée, jamais fermée, pour ne pas passer pour une qualification
  juridique vérifiée.
- **n° 31 · aucun texte ne régit le lieu de livraison.** Sage n'en donne que
  la table (F_LIVRAISON) · client seulement, intitulé unique, un principal
  sont des règles d'OmegaX, dites dans la bulle ; aucun effet comptable.
- **n° 32 · ce qui identifie une personne ne se copie pas.** Le Numéro Impôt
  (la liste annuelle des fournisseurs l'exige pour chacun, LPF art. 47 ter),
  le RIB, l'autorisation aux débits (décision nominative, O.-L. n° 10/001,
  art. 26) restent sur le tiers d'origine.
- **n° 27 · l'avis transmet l'imputation du débiteur.** Code civil, Livre
  III, art. 151 (« Le débiteur de plusieurs dettes a le droit de déclarer,
  lorsqu'il paye, quelle dette il entend acquitter ») · l'avis porte les
  factures et les parts que la ligne de l'ordre a recopiées, sans rien
  recalculer. Sans parts déclarées, il n'en dit rien (aucune imputation de
  l'art. 154 n'est affirmée au créancier).
- **n° 27 · le modèle ne peut pas retirer la signature.** La correspondance
  de l'entité porte ses mentions (AUDCG art. 59 ; AUSCGIE art. 17) · elles
  sont dans le DOCUMENT (`{entite}` des relances, signature de l'avis), que
  le modèle habille ; d'où {document} exigé. Le reste (jetons, avis après
  l'impression de l'ordre seulement) est convention d'OmegaX, dite dans la
  bulle.
- **n° 36 · seuil sans défaut.** Aucun texte n'en fixe · `null`, aucun écart
  ne se passe, et le refus le dit.
- **n° 36 · TVA.** L'escompte et la remise ne sortent de la base que s'ils
  figurent sur une facture initiale ou rectificative (O.-L. n° 10/001,
  art. 29, point 1 ; décret n° 011/42, art. 79) · la pièce du règlement ne
  porte aucune ligne de taxe, l'avertissement le dit. Limite écrite · sous le
  régime de l'encaissement, le moteur de TVA ne lit que la trésorerie du
  règlement ; la part de taxe de l'escompte ou de l'écart reste en attente
  (le moteur n'est pas touché).

## Questions à Manasse

- **Monnaie électronique, prélèvement et effet de commerce face à l'art. 59
  bis** (question portée par le coordinateur). Le texte nomme chèque,
  virement et carte bancaire, et eux seuls ; les autres modes n'y figurent
  pas. OmegaX les avertit SOUS RÉSERVE (relecture m9), les espèces sans
  réserve. Aucun arrêté d'application lu ne les assimile ; s'ils sont admis,
  il suffit d'ajouter leur nature à `NATURES_ADMISES_ART_59_BIS`.

## Pour CLAUDE.md

À placer au § 6, après « Règlement des tiers (2026-09-25) » :

**Ligne sage-l2 · tiers et règlements (2026-10-15).** MODES DE RÈGLEMENT
(`reglements/modes-reglement.ts`, trente au plus, P_REGLEMENT) · sur la
fiche du tiers, le modèle de règlement et ses échéances, la ligne de saisie
et le règlement ; un paiement d'au moins 1 000 000 FC à un fournisseur hors
chèque, virement ou carte est AVERTI (O.-L. n° 10/001, art. 59 bis et 74
bis, dès le 27 mai 2013), jamais refusé · la transaction est la ligne de
facture seule, la pièce à plusieurs lignes SOUS CONDITION, l'à-nouveau sans
facture retrouvée NON JUGÉ, les modes que le texte ne nomme pas SOUS
RÉSERVE ; un mode mis en sommeil reste admis sur le brouillard qui le
portait. L'ÉCHÉANCIER DU MODÈLE découpe la ligne de facture en saisie
(fenêtre des échéances, ou d'office sur la fiche, par la même règle,
échéances nulles écartées) ; la pièce ne part pas avant lui, et sa réponse
ne vaut que pour une ligne encore là, intacte. ESCOMPTE ET ÉCART (`reglements/ecart-escompte.ts`) · obtenu D 40 /
C 773, accordé D 673 / C 41 (au SYCEBNL, le seul 412) ; l'écart se tranche
par le Code civil, Livre III · remise d'un reste client (art. 132) ou
renonciation au trop-payé fournisseur (art. 133) en charge, 6588 au
SYSCOHADA, 658 au SYCEBNL, sous `Tenant.seuilEcartReglement` SANS défaut ;
trop-perçu d'un client (art. 252) et fournisseur payé en moins (art. 142)
REFUSÉS ; aucune ligne de taxe (art. 29, point 1 ; décret art. 79), dit.
QUALITÉ du tiers, libellé qui ne décide rien ; LIEUX DE LIVRAISON d'un
client (`LieuLivraison`, un principal, jugé sous un verrou du client) ; DUPLICATION vers le formulaire de
création, sans Numéro Impôt, RIB, documents, lieux, cellule, autorisation aux
débits ni exclusion des relances, nommés. MODÈLES D'IMPRESSION
(`tiers/modeles-impression.ts`, F_COMPTETMODELE) · extrait, avis de
règlement, rappel, choisis sur la fiche dans la zone de leur nature ; le
modèle HABILLE le document ({document} exigé une fois, tout ce qui est
entre accolades sans être un jeton admis refusé), jamais il ne le remplace ni n'en retire la signature ; il habille
relances, relevé et l'avis de règlement d'un ordre IMPRIMÉ, qui transmet
l'imputation déclarée en payant (art. 151). L'ASSISTANT DE RÈGLEMENT envoie
le corps du formulaire, un tiers en francs, sans règle propre.

## Pour build-log.md

| # | Date | Ligne | État | Ce qui manque | Plus dur que prévu |
|---|---|---|---|---|---|
| 1 | 2026-10-15 | L2 | fait | le mode ne suit pas encore le report à-nouveau au détail | la modification au brouillard remplace les lignes · le mode devait être rendu au client pour ne pas s'effacer |
| 3 | 2026-10-15 | L2 | fait | une ligne en devise ne se découpe pas d'elle-même (dit à l'écran) | le découpage en échéances passait une facture sous le seuil de l'art. 59 bis · la transaction se relit sur la pièce |
| 18 | 2026-10-15 | L2 | fait (part règlement) | un tiers à la fois, en francs · devise, parts, escompte, écart et lots au formulaire | rien |
| 24 | 2026-10-15 | L2 | fait | la qualité n'est pas reprise sur les lettres de relance | rien |
| 31 | 2026-10-15 | L2 | fait | aucun document ne lit encore le lieu (la gestion commerciale le reprendra) | le bouton « Mettre en sommeil » du lieu se confondait avec celui du tiers · boutons nommés par lieu |
| 32 | 2026-10-15 | L2 | fait | rien | rien |
| 27 | 2026-10-15 | L2 | fait | l'avis de règlement ne part pas en courriel, et rien pour un règlement sans ordre de virement | un appel de forme `composer(…});` gelé par un test de structure · la lettre composée d'abord, habillée ensuite |
| 36 | 2026-10-15 | L2 | fait | ni escompte ni écart sur un règlement en devise ou à parts désignées (refus nommés) ; l'écart en produit de Sage n'est pas repris (art. 252) | la part de taxe de l'escompte reste en attente sous l'encaissement, dite plutôt que régularisée |

## Pour features.csv

- n° 1 → yes · modes de règlement (structure, tiers, modèles, saisie, règlement), avertissement de l'art. 59 bis.
- n° 3 → yes · échéancier du modèle du tiers appliqué en saisie, fenêtre des échéances, échéancier appliqué d'office.
- n° 18 → partial (L1 et L4 ont leurs parts) · L2 · assistant de règlement d'un tiers, six étapes, même route que le formulaire.
- n° 24 → yes · qualité du tiers, libellé proposé et libre, sur la fiche et l'édition du plan des tiers.
- n° 31 → yes · lieux de livraison d'un client, un principal, sur la fiche du tiers.
- n° 32 → yes · duplication d'un tiers vers le formulaire de création, ce qui n'est pas repris nommé.
- n° 27 → yes · modèles d'impression du dossier (extrait, avis de règlement, rappel) choisis sur la fiche du tiers, qui habillent relances, relevé et avis de règlement.
- n° 36 → yes · escompte obtenu ou accordé au règlement, écart de règlement soldé en charge sous le seuil du dossier (jamais en produit).

## Commandes de vérification

```bash
cd /home/user/wt-sage-l2
npx tsc --noEmit && (cd client && npx tsc --noEmit)
npx jest src/modules/reglements src/modules/tiers src/modules/relances src/modules/tenant/seuil-ecart-reglement-dto.spec.ts src/common/cloisonnement/index-du-dossier.spec.ts src/modules/comptabilite/brouillard.spec.ts src/modules/comptabilite/piece-du-module-en-place.spec.ts src/modules/comptes/comptes-proposes.spec.ts --maxWorkers=1
# migrations · contre une base d'ombre JETABLE, jamais la production
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "<base d'ombre jetable>" --exit-code
(cd client && npx vitest run src/lib/modes-reglement.spec.ts src/lib/escompte-reglement.spec.ts src/lib/modeles-impression.spec.ts src/lib/assistant-reglement.spec.ts src/lib/comptes-retenus-ecrans.spec.ts src/lib/echeance-saisie.spec.ts src/lib/geste-puis-relecture.spec.ts)
# e2e · serveur sur 8302 (base l2_e2e), aperçu sur 4302
(cd e2e && PW_CHROMIUM=/opt/pw-browsers/chromium OMEGAX_APP=http://localhost:4302 OMEGAX_API=http://localhost:4302/api npx playwright test tests/sage-l2-modes.e2e.ts tests/sage-l2-echeances.e2e.ts tests/sage-l2-escompte.e2e.ts tests/sage-l2-qualite.e2e.ts tests/sage-l2-livraison.e2e.ts tests/sage-l2-duplication.e2e.ts tests/sage-l2-modeles-impression.e2e.ts tests/sage-l2-assistant-reglement.e2e.ts)
```
