# Liste verrouillée de traitement · immobilisations

Arrêtée le 2026-10-01 à la demande de Manasse. Elle tient, en un seul
endroit, ce qui est FAIT et ce qui RESTE, dans l'ordre où cela se traite. Le
détail de chaque lot (périmètre, sources, décisions D-1 à D-28) reste dans
`docs/plan-immobilisations-verrouille.md`, dont les règles s'appliquent ici.

## Règles de la liste

1. **L'ordre est fixe dans chaque famille.** Une ligne « À faire » ne
   commence que lorsque la précédente de SA famille est poussée ET vérifiée
   en production (Cloud Run, Hosting, tests navigateur verts). Deux lignes de
   familles différentes avancent ensemble (décision de Manasse du
   2026-10-03) · paie (A8, A9, A18), caisse et inventaire (A10, A19),
   fiscalité (A7 bis, A11, A21), clôture et contrôles (A12, A13, A17),
   immobilisations (A14, A15, A22), seules (A7, A16, A20). Les intégrations
   sur `main` restent une à une.
2. **Une ligne ne passe à « Fait » que vérifiée en production**, avec le
   numéro des trois exécutions. Poussé n'est pas fait.
3. **Rien ne s'ajoute en cours de route.** Ce qu'on découvre va en
   « Relevés en attente » ; Manasse décide s'il entre dans la liste, et où.
4. **Une décision en attente bloque sa ligne**, jamais les suivantes qui
   n'en dépendent pas.
5. **Tout travail d'agent est relu par un relecteur adverse, repris sur ses
   refus, relu par l'intégrateur, puis passe les suites complètes et les
   tests navigateur** avant d'être poussé. Deux tours de relecture au plus ;
   au-delà, seul un BLOQUANT (montant faussé en silence, geste juste refusé
   sans issue, dossier enfermé) fait reprendre la ligne, le reste va aux
   « Relevés en attente » (décision de Manasse du 2026-10-03).
6. **Rien ne se perd à une coupure** (décision de Manasse du 2026-10-03) ·
   l'agent committe à chaque étape finie, pousse aussitôt sur une branche de
   sauvegarde `travail/<ligne>` (aucun workflow ne la déploie, elle se
   supprime après l'intégration) et tient une fiche `AVANCEMENT-<ligne>.md`
   (fait, reste, décisions avec leur article), retirée à l'intégration.

## Fait · vérifié en production

| # | Objet | Vérification |
|---|---|---|
| F1 | Lot 1 · défauts (change 21 à 26, 7951, citation sécurité, projets sans dotation) | journal du plan |
| F2 | Lot 2 · amortissement exceptionnel (art. 36 à 38) | journal du plan |
| F3 | Lot 3 · fin de projet de développement, sortie par le 162, 163 ou 164 | journal du plan |
| F4 | Lot 4 · reprises des fonds (14, 167, 171, 172) | Cloud Run 460, Hosting 583, tests 228 |
| F5 | Lot 5 · subvention en numéraire rattachée au bien | Cloud Run 461, Hosting 584, tests 229 |
| F6 | Lot 6 · barème de l'arrêté n° 013/2025 et comptes, proposés dans les deux sens | Cloud Run 462, Hosting 585, tests 230 |
| F7 | Lot 7 · legs grevé de dettes | Cloud Run 463, Hosting 586, tests 231 |
| F8 | Lot 8 · prix global et partie non identifiée | Cloud Run 464, Hosting 588, tests 233 |
| F9 | Lot 9 · voies parallèles du catalogue, division 20 du SYCEBNL | Cloud Run 465, Hosting 589, tests 234 |
| F10 | Lot 10 · incorporels à durée non limitée | Cloud Run 466, Hosting 590, tests 235 |
| F11 | Lot 11 · révision du plan d'amortissement, dégressif comptable SYCEBNL | Cloud Run 467, Hosting 591, tests 236 |
| F12 | Lot 12 · plafond de reprise d'une dépréciation | Cloud Run 468, Hosting 593, tests 238 |
| F13 | Correctif « Rattacher une subvention » (octroi proposé au choix du 14) et listes vides de la même famille | Cloud Run 469, Hosting 595, tests 240 |
| F14 | Lot 13 · coûts d'emprunt incorporés | Cloud Run 470, Hosting 596, tests 241 |
| F15 | Listes de choix · provisions, fonds 162 à 164 de la sortie de projet, « Réglé par » (ex-E1) | Cloud Run 471, Hosting 598, tests 243 |
| F16 | Immobilisation en cours (219, 229, 239, 249 aux deux référentiels, case décochée par défaut, mise en service D définitif / C en cours) et compte posé au choix de la nature du barème (ex-E2, E3, D5) | Cloud Run 472, Hosting 599, tests 244 |
| F17 | Notes 3A et 3B (SYSCOHADA), 5B et 3A (SYCEBNL) · la mise en service d'un bien en cours n'est ni une acquisition ni une cession · reconnue par `ecritureMiseEnServiceId`, elle va aux colonnes « Virements de poste à poste » (en plus sur le définitif, en moins sur l'en-cours, D inchangé) ; TFT SYCEBNL, crédit lié du 219 et du 229 retranché de FI (ex-E5, D6) | Cloud Run 473, Hosting 601, tests 246 |
| F18 | Coûts d'emprunt incorporés montrés aux Notes annexes en lecture seule (ex-A2, D1), « Réglé par » devenu « Contrepartie » (D2), fonds de projet en sommeil refusé au serveur (D3) | Cloud Run 474, Hosting 603, tests 248 |
| F19 | Comptes retenus · toutes les listes de choix de comptes ne proposent que les comptes retenus et ceux déjà utilisés, un compte prescrit seul jamais retiré (octroi, affectation, 12, 167 et 4861, 29 de la division, 4739 du remboursement), gardé des deux côtés par une table unique (ex-E4) | Cloud Run 475, Hosting 605, tests 250 |
| F20 | Écran Immobilisations rangé en onglets · Biens, Tableaux, Financements, Opérations, Lieux, sans changement de comportement ; ce qui porte sur un bien reste sur sa ligne (échange compris) (ex-A1) | Hosting 607, tests 252 (client seul, Cloud Run non déclenché) |
| F21 | Lot 14 · réévaluation légale ou libre (globale, décision exigée, plafond k′, 106 par défaut, 154 sous neutralité pour les amortissables avec reprise au 861 chaînée, base du coefficient déclarée et convertie, dotation de l'exercice avant (D-38), coefficient converti sous 1 refusé (D-45), tableau des flux et notes par liaison, onglet Opérations) (ex-A3) | Cloud Run 476, Hosting 614, tests 261 |
| F22 | Lot 15 · petits manques de faible valeur · rente viagère et redevances (1681, extinction au 841 bornée au solde de la dette), réserve de propriété (refusée sur un bien sorti ou un exercice clos), matériel récupéré (388 / 378) au compte inscrit, six critères de la R&D, démantèlement et désactualisation, compléments du crédit-bail (ex-A4) | Cloud Run 477, Hosting 620, tests 265 (relancé, première exécution coupée par le délai à l'installation de Playwright) |
| F23 | Pertes de change · la provision (194, 4991, 4997) reprise et ajustée à chaque réévaluation des devises, jamais empilée (AUDCIF art. 54, Titre VIII ch. 22 § 2.3) · relevé CPCC C1 · seul l'écart avec la provision des réévaluations antérieures se passe, dotation de la hausse ou reprise de la baisse au compte de SA famille (7591, 7791, 7971 ; SYCEBNL 194 / 6971 / 7971), réévaluation sans position admise pour reprendre la provision d'une position dénouée (`ajusterProvisions`, `provisionsEnPlace`) ; DÉCISIONS DE MANASSE du 2026-10-02 · (1) reprise du 4997 au 7791 gardée (fiche du compte 77), anomalie des fiches 49 et 679 écrite dans le code ; (2) dossier repris · provision existant à l'ouverture DÉCLARÉE par compte (194, 4991, 4997 ; SYCEBNL 194) en versions datées, source exigée, solde d'ouverture proposé jamais imposé, réserve tant que l'à-nouveau n'est pas expliqué par OmegaX ; après relecture adverse (B1, m1 à m4), QUATRE DÉCISIONS du 2026-10-02 · Q1 la réserve refuse le passage des écritures (fiche du compte 19), Q2 version utilisée gelée, correction par nouvelle version datée avec motif (AUDCIF art. 20, 22, 2°), version admise avant une autre tant qu'aucune réévaluation n'est passée dans sa période (impasse N / N+1 levée en seconde relecture) ; troisième relecture · réévaluation DANS L'ORDRE des exercices ouverts (fiche du compte 19), version dépassant l'ouverture refusée au passage, motif réservé à la correction ; quatrième relecture · ouverture non validée lue comme la provision de clôture précédente (récursive), gestes sérialisés par une ligne de verrou sans connexion retenue (409 immédiat) ; cinquième relecture · tout à-nouveau non provisoire (bilan importé) prime sur la clôture précédente, réserve nommée sur l'écart à la clôture calculée ; sixième relecture · clôture précédente reconstituée de toutes ses écritures et confrontée à la part expliquée (à-nouveau entré après une réévaluation), réserve dite avant « aucune position » ; septième relecture · version comparée à la provision du module, le solde reconstitué ne sert qu'à ouvrir la réserve et borner la déclaration (lecture litige), huitième relecture · une version se lit entre un PLANCHER (provision du module à la clôture précédente, bornée par le solde) et un PLAFOND (le solde), une règle pour les trois chemins, aiguillage retiré, sous le plancher refus nommé sauf contestation expresse de la provision du module (case et motif propres, jamais le motif de correction, montant contesté figé par le serveur et revérifié à chaque passage, Y9), provision du module montrée à l'écran (X1 à X4) ; Q3 date = début d'un exercice (fiche du compte 77), Q4 solde d'ouverture provisoire lu au brouillard ou reconstitué (`lireComptesDuReport`) et dit non validé (`ProvisionChangeOuverture`) (ex-A5) | Cloud Run 478, Hosting 622, tests 267 |
| F24 | Écart de change réalisé au règlement d'une créance ou d'une dette en devise (656/756, 676/776 ; SYCEBNL sans 656/756) (AUDCIF art. 55, ch. 22 § 2.3) · relevé CPCC C2 · règlement en devise au coût historique, écart sur sa ligne (656/756 au SYSCOHADA, compte choisi sous le 65 ou le 75 au SYCEBNL, qui n'en donne aucun), écart PROPOSÉ au lettrage puis passé sur confirmation (`reglements/ecart-change-realise.ts`) ; emprunts lus au 16 du SYSCOHADA et au 18 du SYCEBNL (son 16 est un fonds) ; avec A5, une position ou un groupe partiel soldé dans sa devise n'est plus réévalué, et l'écart déjà repris par une réévaluation est refusé ; relecture adverse reprise (trésorerie en devise déclarée, comptes admis sur une table, débit réel en francs, réalisé total au groupe) ; seconde relecture reprise (réévaluation reconstituée toutes devises, à sa date, refus seulement si elle a lu le groupe, sinon avertissement ; groupe borné à l'exercice ; francs sans devise refusés ; lot sans facture en devise) ; troisième relecture reprise (règlement d'une facture déjà réévaluée refusé en 409, groupes lus tels qu'ils existaient à la réévaluation, à-nouveau recréé lu à sa date) ; quatrième relecture reprise (plus de dispense par la date du dénouement, refus du règlement borné aux devises réellement réévaluées, avertissement au règlement en N+1 quand la réévaluation de N n'est pas contre-passée) ; D2 tranchée (SYCEBNL commercial au 658 et au 7588, résidu des fiches 65 et 75) ; D1 tranchée (réévaluation à la clôture seulement, art. 54) ; D3 tranchée (la clôture refuse un lettrage dénoué dont l'écart réalisé n'est pas passé, art. 55 ; la réévaluation n'est pas bloquée) ; D4 tranchée (anciens règlements au payé signalés en information, `REGLEMENT_DEVISE_SANS_ECART`, corrigés par le cabinet, art. 20 ; un règlement non lettré n'est pas reconnaissable) ; D5 tranchée (cours retenu gardé sur la réévaluation, un cours corrigé depuis dans la devise du groupe refuse l'écart, issue · annuler puis réévaluer ; sans cours gardé, avertissement) ; D6 tranchée (une réévaluation s'annule · brouillard supprimé, validé inscrit en négatif, enregistrement marqué, réévaluation exacte ensuite, art. 20 et 22) ; sixième relecture reprise (annulation refusée sur une ligne lettrée ou pointée, `update` unitaire au journal d'audit, écritures annulées hors de l'alerte « hors réévaluation », refus de clôture lu par tranches avec ses trois issues, règlement reconnu à sa pièce, motif D5 « posé ou corrigé », modale de motif) ; cinquième relecture, acceptée, mineurs repris (refus de l'écart proposé seulement si la devise du groupe a été réellement réévaluée ; avertissement de contre-passation borné à l'à-nouveau, à la réévaluation de l'exercice qui précède immédiatement et aux devises qu'elle a portées, rendu aussi au passage de l'écart et affiché au lettrage) ; non codés, consignés · une ligne délettrée après la réévaluation se lit comme non lettrée alors qu'elle était lettrée (M2) ; une facture tardive incluse dans un à-nouveau recréé après la réévaluation se lit comme si elle y avait été (M5) ; une OD qui règle un tiers en devise sans ligne de trésorerie (5x) ni journal de trésorerie n'est plus examinée par `REGLEMENT_DEVISE_SANS_ECART`, seulement comptée dans `LETTRAGES_DEVISE_NON_EXAMINES` (septième relecture, m5, sans code) ; septième relecture reprise (refus de clôture qui ne fait plus délettrer, lignes relues dans la transaction de l'annulation, issues réelles du rapprochement clos et du lettrage figé, erreur dans la modale, lettrages non examinés en anomalie distincte) (ex-A6) | Cloud Run 479, Hosting 624, tests 270 (le 269 tombait sous WebKit sur deux parcours Devises, test corrigé) |
| F25 | Dépréciation des créances dossier par dossier · 411 vers 416, D 659 / C 491, motif et pièces (AUDCIF Titre VII et SYCEBNL, fiches des comptes 41, 49, 65 et 759 ; Guide SYSCOHADA, Partie 1 ch. 6 § 3.3 et § 3.4, Application 19) · relevé CPCC C3 | Cloud Run 480, Hosting 637 (après le correctif du typage client, 135a14d), tests 282 · livré, à intégrer, SCINDÉ le 2026-10-03 (décision de Manasse après la cinquième relecture · la dépréciation est saine depuis la deuxième relecture, la TVA ne converge pas, elle part en A7 bis) · module `creances-douteuses` (quatre tables, une migration écrite à la main, réécrite pour ne créer que ce qui reste, diff vérifié contre le schéma et contre `main`) · reclassement au 416 (4161 / 4162 selon la nature au SYSCOHADA, selon le débiteur au SYCEBNL, E3), motif et pièces exigés, sans lettrer le 411 et sans exiger de lettrage (dit en commentaire et dans la bulle d'aide) ; revue de la dépréciation à chaque clôture où seul l'écart avec la dépréciation en place du module se passe (D 6594 / C 491, D 491 / C 7594), dans l'ordre des exercices, bornée par le reste au 416, base TTC (E1), aucune dotation au SMT ; annulation de revue (B2) ; perte D 651 / C 416 au TTC ENTIER, toujours, aucune ligne 443 (la bulle dit la récupération par imputation, O.-L. n° 10/001 art. 52, décret n° 011/42 art. 126 et 127, déclarée par le cabinet pour l'instant) ; recouvrement D trésorerie / C 416 ; annulation de mouvement (K4, sans régularisation de TVA) ; B1 à la clôture (dépréciation orpheline), déclaration d'ouverture d'un dossier repris (M3, bornée M-a), verrou par dossier (M6), rapprochement 416 / 491 du module (M-b), mouvement sans revue en information (M-c), perte et annulations réservées au comptable (M-d, M9), E4 (sources) ; fenêtre « Créances douteuses ou litigieuses » sous Traitement > Clôture ; parcours e2e ; `src/modules/tva/` et `EcritureService.valider` identiques à `main` ; sixième relecture reprise (B-α · mouvement et reclassement antidatés bornés par ce qui est postérieur, reste négatif nommé avec son issue à la clôture et à la revue ; m1 borne d'ouverture ; m2 annulation du reclassement ; m3 liste des plus récentes ; m4 416 du module au rapprochement ; m5 491 choisi sous sa nature) ; relectures « échecs silencieux » et « écran » reprises (M1 statut relu dans la transaction des trois annulations, suppression filtrée sur le brouillard sinon 409 ; M2 dépréciations orphelines relues dans la transaction de clôture ; M3 échec du retrait d'écriture consigné, erreur d'origine rendue ; M4 liste des comptes clients tronquée avec son issue, restriction par début de numéro ; M5 annulations des plus récentes, total et `tronque` ; M6 rapprochement non calculé dit ; M7 solde au plus tard sur tous les exercices postérieurs ; M8 message du reste négatif corrigé ; écran 1 à 14) · RESTE OUVERT, non fait dans cette passe · (1) M8, une porte administrateur pour « régulariser » un reste négatif dont les mouvements fautifs sont TOUS dans un exercice clôturé n'est pas simple · aucune fiche lue ne dit quelle écriture passer dans l'exercice ouvert (ni l'art. 22, 4° ni l'art. 20, al. 2 ne visent un mouvement d'un exercice clos), et la contrepartie serait une décision · le refus le dit et renvoie ici ; (2) D3 d'A6 (`ecartsRealisesNonConstates`) reste lu AVANT la transaction de clôture · le relire dedans touche la lecture du report (F185), hors du périmètre d'A7 ; aucune question ouverte sur le reste |
| F26 | Décompte final émis comme un bulletin et passé au journal · indemnités de rupture au 66140000 contre le 422 (AUDCIF Titre VIII ch. 21 § 5.2 ; fiche du compte 66 ; Code du travail art. 103) · relevé CPCC C4 (ex-A8) | Cloud Run, Hosting et tests navigateur verts sur 8e15ce7 (migration 20270119000000) · même table, numérotation et annulation que le bulletin (`BulletinPaie.nature`), remplace le bulletin du dernier mois sous verrou par dossier, impôt au barème du mois avec réserve, ancienneté et mois non couverts exigés, logement et transport ventilés, allocations familiales émises avec avertissement et passation refusée · mineurs du second tour aux relevés |
| F27 | Écriture de l'impôt sur le résultat proposée · D 89110000 ou 89500000 (minimum de l'art. 57) / C 441, imputation décidée des acomptes du 4492, constat qui retient son écriture et s'annule, passage réservé au comptable (AUDCIF Titre VII, compte 89 ; loi n° 23/053 art. 42, 45, 57, 150) · relevé CPCC C7 (ex-A11) | Cloud Run 75dd5c6 (migration 20270122000000), Hosting et tests navigateur verts sur 5d388c0 · 899 nommé et jamais déduit · mineurs et points muets aux relevés |
| F28 | Contrôles · compte de banque à rapprocher avant l'arrêté (fiche du compte 52 ; AUDCIF art. 23, 42), compte fermé couvert par trois faits, et période de plus de trois mois sans clôture informatique (art. 22, 3°) · relevé CPCC (ex-A13) | Cloud Run 3af1315, Hosting et tests navigateur verts sur 5d388c0 · lignes de réévaluation hors « dernière ligne », clôtures de N+1 comptées · mineurs aux relevés |
| F29 | Caisse comptée après le 31 décembre · solde lu au livre-journal à la date du comptage, reconstitution vers la clôture dans le PV, caisse en devise comparée dans sa devise (fiche du compte 57 ; AUDCIF art. 16, 42) · relevé CPCC C6 (ex-A10) | Cloud Run, Hosting et tests navigateur verts sur 5d388c0 (migration 20270123000000) · aperçu, transaction, unité rejouée, négatifs soustraits · mineurs aux relevés |
| F30 | Décompte final · départ à mi-préavis (art. 66, rémunération et allocations jusqu'au terme, au 66140000 sous sa clé) et nouvel emploi (art. 67, reste perdu, seulement avant la moitié · lecture protectrice) ; préavis de l'employeur non observé par le travailleur corrigé (Code du travail art. 63 à 67) · relevé CPCC C5 (ex-A9) | Cloud Run 56bed0e, Hosting et tests navigateur verts sur ab53edc · trois points à trancher remontés à Manasse (départ avant la moitié, avantages en nature du temps restant, date de fin du contrat) |
| F31 | Cas chiffrés IS (loi n° 23/053) · seize cas calculés à la main et rejoués sur vraie base à travers les clôtures (`docs/cas-chiffres/is.md`, `scripts/cas-chiffres/rejeu-is.mjs`) ; report déficitaire borné à la fenêtre de l'art. 51 (« jusqu'au troisième exercice qui suit »), origine déclarée exercice par exercice, perte hors fenêtre refusée ou nommée ; période de création de l'art. 12, al. 3 ; résultat nul d'une gestion non soldée lu sur la gestion, jamais sur l'à-nouveau du 13 (impôt faussé de 240 000 à 60 000 avant correction) ; null jamais écrit 0 au dossier fiscal ; réponse d'un autre exercice jetée à l'écran · trois tours, deux relectures | à relire au déploiement |
| F32 | Six décisions par la loi du 2026-10-04 (`docs/decisions-par-la-loi-2026-10-04.md`) · samedi ouvrable pour un pur paiement (acomptes de l'art. 57 bis LPF et seconde quotité de l'art. 57 quater, décision de l'éditeur) ; fiche R2, cases ZN à ZS déclarées par exercice, Système normal seul ; entreprise du portefeuille de l'État (loi n° 08/010 art. 3 et 4, cinq sociétés commerciales ; O.-L. n° 13/003 art. 112 et 113 · assemblée au 31 mars, PV et affectation ; AUSCGIE art. 140, 269, 288, 306, 345 et AUDCIF art. 71, délais forme par forme) ; notes 20B et 29B à seize colonnes M / F, saisie antérieure gardée telle que saisie et retirable avec motif ; lignes répétables des notes SYSCOHADA 4, 13, 32 et 33 ; liquidation d'une société commerciale (AUSCGIE art. 201 à 241, 266, 902, 903 ; résultat au 1384, anomalie « 1374 » du ch. 40 écrite) · faits déclarés qui lèvent un jalon, hors délai dit, futur jamais tenu pour fait · deux tours de relecture, scénario sur vraie base à 75 vérifications à travers la clôture | à relire au déploiement |
| F33 | Décisions par la loi du 2026-10-07, premier lot (`docs/decisions-par-la-loi-2026-10-07.md`) · procédure collective ouverte à l'associé unique personne morale (AUPCAP art. 53 ; AUSCGIE art. 200, 6°, 203 al. 2) ; dividende prioritaire des entreprises minières du portefeuille (arrêté interministériel du 10 décembre 2025, art. 2, 3, 5) · secteur minier et quote-part déclarés, 15 mai, huit jours de la note, montant lu, provisoire jusqu'à l'arrêté des comptes, réserve légale et art. 143 de l'AUSCGIE dits (l'Acte uniforme prime), aucun après dissolution ; fiche R2 (siège en ZN, contrôle de l'art. 78, ZQ public proposé) ; ZK 00 proposé à une SA du portefeuille ; délais francs (46 et 16 jours) ; PV de la LPF art. 13 bis sous commissaire, « à confirmer » pour une SA ou une forme non dite · L'ARRÊT À LA DISSOLUTION SORTI de la ligne (`travail/dissolution`, `docs/dissolution-a-reprendre.md`) · deux tours de relecture, scénario sur vraie base à 33 vérifications | à relire au déploiement |

## En cours

| # | Objet | État |
|---|---|---|
| A7 bis | TVA des créances irrécouvrables et exigibilité à l'encaissement (O.-L. n° 10/001, art. 25, 2° et 52 ; décret n° 011/42, art. 57, 126 et 127) | PARTIE 1 INTÉGRÉE le 2026-10-04, après cinq tours de vérification (refus nommé de la désignation d'une facture qui partage son lettrage, groupes lus comme `main` hors facture à deux échéances, transition de l'ancien moteur reconstituée et reconstitutions incertaines NOMMÉES) · les deux défauts du moteur corrigés (créance non lettrée en attente, une tranche par règlement), créance de N réglée par son à-nouveau, liquidation qui fige ce qu'elle déclare à l'encaissement (`tvaEncaissementFigee`) et transition des liquidations antérieures, rejouée sur vraie base à travers la clôture · PARTIE 2, RÉCUPÉRATION DE L'ART. 52, LIVRÉE SUR `travail/tva-art52` le 2026-10-08, à intégrer (geste « TVA (art. 52) » du module des créances douteuses, D 443 / C 651 après la perte, duplicata surchargé exigé par facture au lieu de la note de crédit, qui ne vaut que pour l'opération annulée ou résiliée (art. 52 al. 2 et 3, décret art. 127 al. 1 et 2) ; taxe acquittée seule, créance éteinte, preuve exigée ; déclaration · avoir constaté puis déduit le mois suivant (art. 126), négatif d'un avoir lu ; annulation refusée sous une liquidation ; rejouée sur vraie base à travers la clôture de 2026) · NON TRANCHÉ PAR LE CORPUS, consigné · (a) le compte crédité quand la perte est d'un exercice clos (651 de l'exercice en cours, AUDCIF art. 34 par analogie, aucune fiche ne nomme de produit) ; (b) la taxe d'une prestation déclarée à la facture par l'ANCIEN moteur (liquidation sans figé), nommée, jamais récupérée d'office ; (c) « jusqu'au 31 décembre de l'année qui suit » lu sur la date du geste · une récupération de décembre s'impute en janvier, au-delà si le délai se lit à l'imputation, à trancher par Manasse le jour où le cas se présente · les relevés ci-après restent ouverts · travail retiré d'A7 le 2026-10-03 · commits 3d59e29, dfcca03, 2cc6c0f (part TVA), fda6278 et 5ac2bde (récupération de l'art. 52 à la perte, D 651 HT / D 443 / C 416 ; liquidation qui l'impute ; ventes d'origine ; tranches d'exigibilité par encaissement ; TVA figée par la liquidation, `TvaVenteDeclaree` ; régularisations, `RegularisationTvaCreance` ; refus de validation d'un recouvrement en période liquidée), à relire dans l'historique avant toute reprise · CONSTATS OUVERTS de la cinquième relecture (sur 5ac2bde) · B1 report de la tranche en période liquidée RÉPÉTÉ ; B2 recouvrement RESSAISI ; B3 TRANSITION des liquidations antérieures au figé ; B4 AVOIRS, la règle M-c cassait la TVA ordinaire des avoirs ; m1 à m5 (détail dans le rapport de la cinquième relecture) · DÉFAUTS DU MOTEUR D'AVANT A7, présents sur `main` · (1) « une prestation de services dont la ligne du client n'est dans aucun lettrage est un comptant, exigible à la facture » (`TauxTvaService.exigibilite`) contredit l'art. 25, 2° (« au moment de l'encaissement du prix ») · une prestation impayée est déclarée au mois de la facture ; (2) acomptes ordinaires à la FRACTION CUMULÉE · un groupe de lettrage à une seule facture garde la date du dernier règlement et la fraction cumulée, au lieu d'une tranche par règlement (décret n° 011/42, art. 57) · la correction B-2, jugée saine par la quatrième relecture, est retirée avec le reste, à reprendre seule · reprise sur décision de Manasse, la récupération restant déclarée par le cabinet jusque-là · APPORTS DE LA RELECTURE D'A7 TER (2026-10-03), rien de codé ici · (1) RÈGLEMENT D'UNE CRÉANCE RECLASSÉE · l'avertissement au règlement, le constat `COMPTE_CREANCE_RECLASSEE_CREDITEUR` et le 416 hors des échéances sont faits en A7 ter ; RESTE · l'encaissement d'une créance reclassée passé par le « Recouvrement » du module (D trésorerie / C 416) n'est lettré avec aucune facture, et le moteur de TVA ne voit pas l'encaissement d'une prestation (art. 25, 2°) · la TVA d'un recouvrement de créance douteuse se traite avec le reste de cette ligne ; un règlement déjà passé au compte d'origine se corrige à la main (suppression ou inscription en négatif, puis « Recouvrement »), aucun geste ne le réimpute d'office ; (2) GROUPES FACTURE-RECLASSEMENT DÉJÀ POSÉS, avant et pendant A7 ter (le lettrage automatique appariait la facture et la ligne du reclassement de même montant ; le mineur 6 du premier tour d'A7 ter, retiré au second tour sans avoir été intégré, laissait lettrer une facture sans TVA) · taxée ou non, une facture lettrée avec son reclassement est à relever et à défaire (la TVA d'une prestation y est devenue exigible au reclassement ; FIGÉ par une clôture de période, le groupe refuse l'annulation du reclassement et le délettrage), A7 ter ne les touche pas ; la règle d'A7 est rétablie (« le reclassement ne lettre pas le 411 », lettrage refusé toujours) ; (3) question D7 ci-dessous (impayé d'adhérent sous l'encaissement) · CONSTAT D'A6 bis (second tour, m3, sans code) · au mode Détail, un règlement ne se lettre plus avec la facture d'un exercice antérieur (règle 2 de `lettrages-a-cheval.ts`, convention d'OmegaX) mais avec la ligne d'à-nouveau qui la reporte · le lien facture → encaissement que l'exigibilité à l'encaissement lit sur le lettrage (O.-L. n° 10/001, art. 25, 2° ; décret n° 011/42, art. 57) n'atteint donc plus la vente d'origine d'une prestation facturée en N et encaissée en N+1 · à reprendre avec l'exigibilité (lire le règlement à travers la ligne d'à-nouveau, ou par la paire à cheval de `paires-a-cheval.ts`) |

## À faire, dans l'ordre

**Ordre de traitement décidé par Manasse le 2026-10-03 · du plus léger au
plus lourd, les lignes dépendantes mises de côté.** Les corrections de
production passent devant · A5 bis, A6 bis, puis A7 quater. Le tableau ci-dessous
garde la description de chaque ligne ; c'est cet ordre-ci qui se suit.

- **Indépendantes, de la plus légère à la plus lourde** · A13 (léger) ;
  A11 (léger) ; A14 (léger à moyen) ; A12 (moyen) ; A16 (moyen) ; A22
  (moyen) ; A21 (lourd, touche la TVA) ; A15 (lourd) ; A20 (lourd, nouveau
  module) ; A7 bis (le plus lourd, en dernier).
- **Dépendantes, de côté jusqu'à l'intégration de leur ligne mère** · A17
  après A13 ; A9 après A8, puis A18 après A9 ; A19 après A10. Chacune
  démarre dès que sa mère est corrigée et intégrée, sans attendre le reste.
- Deux lignes à la fois, de familles différentes (règle 1).

| # | Objet | Préalable |
|---|---|---|
| A5 bis | DÉFAUT DE PRODUCTION · la contre-passation d'ouverture des réévaluations inversait aussi les écarts des disponibilités (AUDCIF art. 57, réalisés), et sans elle N+1 repartait du coût historique (double comptage) · contre-passation limitée aux 478, 479 et tiers, écart des disponibilités repris par la chaîne des réévaluations, portillon de la contre-passation, contrôle 34 | INTÉGRÉE le 2026-10-03 · vérifiée sur vraie base à travers la clôture de N (contre-passation limitée à 411 / 4781 et 4793 / 401, banque non touchée, perte de N+1 de 50 000 et non 150 000), attestation de l'état de l'écart, message L1 en trois gestes · relevés renvoyés à A5 ter (L1 bloque une contre-passation intégrale déjà juste pour un dossier d'avant la correction, au prix de gestes en plus ; L1 ne cherche la réévaluation postérieure que dans l'exercice cible, une N+1 close tombe sur le message générique ; contre-passation déclarée non comptée par `reglements/reevaluation-et-ecart-realise.ts` ; contrôle 32 et OD déclarée qui inverse aussi la banque) ; sans à-nouveau qui fait foi, la contre-passation écrit 411 / 478 dans N+1 sur la clôture reconstituée de N, que le livre de N+1 ne porte pas encore (vu aux tests navigateur) |
| A5 ter | Suites de la relecture a posteriori d'A5 · SYCEBNL, risque à moins d'un an au 4991 / 6591 / 7591 et non au 194 (fiche SYCEBNL du compte 19, exclusions · CONTREDIT la règle « SYCEBNL, 194 seul » écrite plus haut, le texte tranche) ; titres de placement (50) et titres immobilisés (274) hors réévaluation (Titre VIII ch. 22 § 1.3) ; subdivisions 478 / 479 au SYCEBNL ; 54 en 4786 / 4797 (art. 58-2, § 3.2.2) ; message d'annulation dont l'issue ne lève rien ; contre-passation limitée à l'exercice suivant (repris dans A5 bis) | INTÉGRÉE le 2026-10-04 · familles de provision lues aux fiches · SYCEBNL, court terme au 4991 / 6591 / 7591 (exploitation), 4998 / 839 / 849 (H.A.O., 484 à 488), 599 / 6791 / 7791 (financier, 481, 56, intérêts courus), 194 au long terme seul (fiche du compte 19, exclusions ; CLAUDE.md corrigé) ; 481 et 404 FINANCIERS aux deux plans (ch. 22 § 1.1, comme A6), écart latent au 4784 / 4794 ; intérêts courus 276, 166, 176, 186 au court terme (lecture d'OmegaX pour les trois derniers) ; titres 274, 50 et 508 hors réévaluation (§ 1.3) ; subdivisions 478 / 479 du SYCEBNL ; 54 au 4786 / 4797 (§ 3.2.2) ; portillon L1 retiré, contrôle 32 ligne par ligne, référentiel sans repli ; avertissement chiffré à la bascule des dossiers SYCEBNL ; deux tours de vérification, rejoué sur vraie base à travers la clôture · À DIRE aux utilisateurs · la réserve « non déclarée » vaut désormais aux 4991, 4998 et 599 du SYCEBNL · QUESTION À MANASSE · 54 de couverture et or du 545 (§ 3.2.2, § 3.2.5, art. 58-1 à 58-4, numérotés 57-x au ch. 22 · divergence du corpus) |
| A6 bis | DÉFAUT DE PRODUCTION · relecture a posteriori d'A6 · règlement en devise accepté avec 0 franc payé (gain fictif) ; groupe de lettrage à cheval sur N et N+1 qui enferme la clôture (500) ; banque en devise payant des factures en francs sans devise (art. 57) ; D4 au cours moyen ; à-nouveau pris pour un règlement ; 404 financier (§ 1.1) ; ordre des factures du même jour ; avertissement d'extourne limité à N-1 ; facture partiellement payée en N ressortie entière en N+1 | INTÉGRÉE le 2026-10-03 · vérifiée sur vraie base à travers la clôture de N (fournisseur et client en USD, partiel puis solde en N+1, contre-passation, réévaluation de N+1, refus à zéro franc et banque en devise sur facture en francs) · relevés renvoyés à A6 ter |
| A6 ter | Suites de la vérification d'A6 bis (2026-10-03) · (m-1) D3 ne compte pas un lettrage à cheval sur deux exercices dénoué dans l'exercice (`reglements/ecarts-non-constates.ts`, filtre `every` sur l'exercice) · la clôture passe avec la perte réalisée non constatée, seul un AVERTISSEMENT le dit ; l'exclusion visait un groupe figé, que le B2 du second tour tolère désormais · (m-2) faux avertissement « en francs, sans devise » sur la ligne reportée d'une réévaluation (`reglements.service.ts`, `reglesEnFrancs`) · (m-3) la borne M6 dit « réglez au plus » avant « lettrez d'abord avec sa facture » · (m-4) concordance de `lireLaReevaluation` qui ne suit pas la règle B1 (avertissement de trop) · antérieurs · la ligne reportée d'une réévaluation apparaît comme facture à payer aux échéances fournisseurs (Détail) ; en Solde, N clôturé, la perte réalisée d'une facture payée en N+1 reste dans la position et se provisionne · contrôle qui nomme les réévaluations déjà passées que B-3 change ; groupe à cheval dont la seule ligne de l'exercice est en francs | INTÉGRÉE le 2026-10-03 · D3 refuse la clôture sur un lettrage à cheval dénoué dans l'exercice (issue praticable, groupe figé compris, report au premier jour ouvert) ; DÉFAUT DE PRODUCTION d'A6 bis corrigé au second tour · le reste d'une ligne reportée réglée en partie par un groupe à cheval se lit au COÛT HISTORIQUE au prorata de la devise (AUDCIF art. 54, 55), et non « francs moins payé » (perte de 150 000 au lieu de 50 000, 411 à −100 000) ; lignes de réévaluation reconnues par liaison, hors échéances ; vérifiée sur vraie base · relevés à l'audit · deux lignes d'à-nouveau ouvertes de même montant (réévaluation et vraie facture en francs) indiscernables avant lettrage, total dû juste (lien d'origine du report à poser) ; écart réalisé partiel d'un groupe sur trois exercices daté de l'exercice du solde (provisionné entre-temps) ; en Solde, règlement de N+1 non lettré dont la perte reste dans la position |
| A7 ter | DÉFAUT DE PRODUCTION · relecture a posteriori d'A7 · à-nouveau PROVISOIRE de N+1 pris pour un solde fiable (reclassement juste refusé) ; `TIERS_ANCIEN_NON_LETTRE` liste les écritures du module et prescrit un lettrage interdit ; lettrage automatique de la facture avec son reclassement (TVA déclarée deux fois, bloqué jusqu'à A7 bis) ; 651 croisé au SYCEBNL ; déclaration d'ouverture sans contrôle de devise ; listes à 50 sans `tronque` ; reclassement d'adhérent à l'encaissement (cadre conceptuel § 5.4.2.1) | INTÉGRÉE le 2026-10-03 (statut mis à jour le 2026-10-04 · la ligne portait encore « en construction ») |
| A7 quater | Suites de la relecture d'intégration d'A7 ter (2026-10-03, base fusionnée) · (B) le lettrage automatique et le pré-lettrage (`calculerPropositions`) apparient encore la facture reclassée U avec le règlement P d'une autre facture quand P est daté AVANT le reclassement R (U 10/02, T 01/05, P 20/05, R 15/06 · [U,P] posé, T ouverte, TVA de T datée à tort) · même défaut sur `main` avant A7 ter, qui posait en plus [T,R] · correction proposée sans devinette · dès qu'une ligne R ouverte existe sur le compte, les passes par montant s'abstiennent sauf candidate UNIQUE de même montant datée au plus tard de R (écartée avec R), sinon la seule passe par pièce, le nombre écarté dit ; à terme le reclassement désigne les lignes de la facture · (m1) refus du reclassement et gel relus DANS la transaction de pose du lettrage ; écriture de reclassement et `CreanceDouteuse` dans UNE transaction · (m3) une position en devise sur le 416 partagé refuse la déclaration d'une autre créance en francs sans issue · (m4) liste des à-nouveaux de « Lettrer au 416 » triée par uuid, `tronque` faux à 200 pile · (m5) commentaire du schéma « lui seul le défait » faux, `delettrer` défait un groupe MODULE · (m6) `EcritureService.supprimer` ne filtre pas sur le statut BROUILLARD (antérieur, réemprunté par le retrait d'un mouvement) · (m7) le lettrage automatique ne dit pas les lignes écartées pour reclassement · (m8) dates ISO brutes au Règlement des tiers · relevés du troisième passage (m1 « à apporter » non expliqué ; à-nouveaux de U et R appariés en N+1) | INTÉGRÉE le 2026-10-03 · second tour · tout reclassement ouvert suspend les passes par montant du compte (aucune candidate devinée), dans l'exercice et les suivants, la seule passe par pièce restant, dit à l'écran ; vérifiée sur vraie base à travers la clôture de 2026 · relevés renvoyés à A7 bis (la suspension ne finit jamais tant que le reclassement ne désigne pas les lignes de la facture ; une mauvaise désignation au « Lettrer au 416 » ne se défait qu'en annulant le mouvement ; une proposition de pré-lettrage calculée avant le reclassement se confirme encore) |
| A12 | Intérêts courus sur emprunts proposés à la clôture (D 671 / C 166), contre-passés à l'ouverture (AUDCIF Titre VII, compte 16) · relevé CPCC C8 | INTÉGRÉE le 2026-10-04 · charges à payer, nature « Prêteurs », 16x → 166x au SYSCOHADA, 18x → 186x au SYCEBNL, montant déclaré, contre-passés à l'ouverture · MANQUE DU TEXTE à signaler à Manasse · la fiche SYCEBNL du compte 18 n'ouvre aucun 1864, les intérêts courus du 184 se passent à la main |
| A14 | Sortie d'immobilisation · nature (vol, pillage, destruction, rebut, cession) et pièce (procès-verbal, décision) portées par la sortie et son écriture (AUDCIF Titre VII, compte 81 ; art. 17) · relevé CPCC C11 | INTÉGRÉE le 2026-10-04 (lot A14, A12, A16) · nature en liste fermée (fiche du compte 81, Titre V § 5.8, SYCEBNL Partie 3 ch. 3 § 2.5), pièce et date exigées, portées par les écritures de sortie ; le pillage se déclare en vol, la pièce le décrit · relevé · le renouvellement d'un composant ne porte pas de référence de pièce |
| A15 | Réévaluation · notes annexes et tableau des amortissements après réévaluation, déclaration spéciale, sortie d'un bien réévalué (loi n° 23/053 art. 133 al. 3, 135, 137 ; ch. 28 § 6) · relevé CPCC C12 | INTÉGRÉE le 2026-10-04 · NOTE 3E (SYSCOHADA) et 5H (associations) servies ; tableau des amortissements lu tel que le bien était dans l'exercice montré (DÉFAUT corrigé · l'année de la réévaluation portait la hausse à l'ouverture, les années antérieures lisaient les réévaluations postérieures) ; déclaration spéciale éditée (art. 136, 137), jamais dite déposée ; sortie d'un bien réévalué · 106 vers une réserve non distribuable 111, 112 ou 1138 (ch. 28 § 6, fiche du compte 11), 154 au 861 à la cession (art. 133 al. 3, fiche 15), option de location-acquisition non levée comprise ; vérifiée sur vraie base sur trois exercices · DÉCISIONS DE MANASSE du 2026-10-04, intégrées en A15 bis · le 154 se reprend EN ENTIER au 861 à TOUTE sortie (fiche 15, « réduites ou annulées exclusivement par Reprises H.A.O. »), et le 106 du SYCEBNL se vire au 118, IMPOSÉ par le serveur ; la note de la réévaluation compte la reprise d'une sortie dans l'exercice de la SORTIE seul (défaut du premier tour, rejoué sur vraie base) · relevés · une dotation d'exercice entier datée après la sortie n'est pas réduite (préexistant) ; · tableau des immobilisations à une date antérieure montre la valeur du jour ; montant viré non borné par le solde du 106 |
| A16 | Registre des provisions · provisions à moins d'un an (4991 / 6591) et conditions propres à la restructuration, au contrat déficitaire et au déménagement (AUDCIF Titre VII compte 49 ; ch. 18 § 2.2.1, § 4.1, § 4.10) · relevé CPCC C13 | INTÉGRÉE le 2026-10-04 · provisions à moins d'un an (4991, 4997, 4998, 599 ; SYCEBNL sans 4997), conditions propres de la restructuration, du contrat déficitaire et du déménagement (§ 4.1, § 4.3, § 4.10, mot pour mot), horizon jugé à la création ou au changement seulement, avertissement à reclasser sinon · relevé · ACCORD_IRREVOCABLE exigé même hors cession d'une branche |
| A17 | SYCEBNL · virements internes 585 et 588 non soldés à la clôture signalés (fiche SYCEBNL du compte 58) · relevé CPCC C14 | INTÉGRÉE le 2026-10-03 · contrôle 36, aux DEUX référentiels (la fiche AUDCIF du compte 58 porte la même obligation que celle du SYCEBNL), 585 et 588 seuls (581 et 582 sans obligation de solde), fiche citée mot pour mot · relevé · en N+1 tant que N reste ouvert, l'écart dû au seul à-nouveau provisoire se dit « pièce à valider », geste impossible (à dire « clôturez l'exercice précédent »), au suivi de l'audit |
| A18 | Décompte final · déduction des avances et prêts, gratification au prorata proposée, indemnité de fin de contrat stipulée (Code du travail art. 64, 112) · relevé CPCC C15 | INTÉGRÉE le 2026-10-04 · décompte final · retenue des avances et prêts proposée (Code du travail art. 112 c et f, sans plafond légal, bornée au solde et au net), gratification au prorata des mois entiers seulement si stipulée (null sinon), indemnité stipulée saisie avec sa source au 66140000 ; vérifiée sur vraie base · relevés à l'audit · début de la période de gratification non borné par le contrat ; calcul de mois réécrit au lieu d'`ajouterMois` ; proposition muette sur un bulletin du même mois encore actif ; proposition périmée à l'écran ; ANTÉRIEUR rendu plus fréquent · bulletin mensuel passé au journal puis annulé pour le décompte, sa retenue reste au journal et le décompte retient de nouveau (signalé au mois, négatif à passer) |
| A19 | Inventaire · éditions (fiches de comptage vierges, PV d'inventaire, PV de caisse) et lieu du bien recopié sur sa fiche (AUDCIF art. 16) · relevé CPCC C16 | INTÉGRÉE le 2026-10-03 · fiches de comptage vierges, procès-verbal d'inventaire, procès-verbal de caisse (chiffres figés servis par le serveur), lieu du bien recopié sur sa fiche (AUDCIF art. 16, al. 4 et 5), vérifiée sur vraie base à travers la clôture, deux référentiels · relevés au suivi de l'audit · édition périmée si `afterprint` ne vient pas (jeton absent, campagne changée en vol) ; horodatages imprimés au jour UTC et non de Kinshasa ; lieu recopié après coup = lieu du jour, emplacement effacé à dessein rempli de nouveau ; `lieuxRecopies` non montré ; articles du magasin absents des fiches vierges sans fiche de campagne |
| A20 | Comptabilité de gestion · clés de répartition, coût de production avec imputation rationnelle, seuil de rentabilité, définitions d'OmegaX dites (AUDCIF Titre VI ; Titre VIII ch. 14 § 2.3) · relevé CPCC C17 | INTÉGRÉE le 2026-10-04 · comportement des comptes déclaré (fixe, variable, semi-variable), clés de répartition en OD analytiques équilibrées passées au clic sous verrou par dossier dans une transaction (double clic · un seul passage, 409), coût de production avec imputation rationnelle (ch. 14 § 2.3.1 et 2.3.2, coefficient borné à 1, sous-activité en charge de la période, rien au grand livre), seuil de rentabilité (définition d'OmegaX, brouillard compris et dit), comportements figés à la clôture ; renvoi du suivi corrigé (ch. 14, non 13) ; vérifiée sur vraie base · relevés à l'audit · gestionnaire de paie voit des boutons que le serveur lui refuse ; prestations réciproques entre sections non résolues (escalier) ; seuil par section ; coût unitaire non reporté au magasin |
| A21 | Facture d'achat datée à sa RÉCEPTION · l'écriture prend la date de réception de la pièce d'origine externe (AUDCIF art. 16 al. 2), la date de facture restant portée ; effets sur la TVA lus au texte | INTÉGRÉE le 2026-10-04 · `Facture.dateReception` sans défaut, écriture d'achat datée à la réception (AUDCIF art. 16, al. 2), date de facture au libellé, déchéance de l'art. 37 comptée depuis la facture, jamais la réception ; libellé du fournisseur corrigé · relevés à l'audit · facture dont la taxe est déchue encore portée à l'état détaillé ; régime des débits · règlement entre facture et réception lu antérieur au débit (art. 62) ; facture liée à une écriture existante · mois de l'état et mois de la déduction peuvent différer ; ANTÉRIEUR · « TVA déchue » de la déclaration recompte chaque année des taxes déjà déduites (affichage seul) |
| A22 | Trois relevés anciens des immobilisations · dépréciation d'un bien en cours (2919 à 2949) et son sort à la mise en service ; prix global avec fonds de commerce (l'écran visait toujours le 21500000) ; 787 du Guide contre 72 de l'AUDCIF pour les intérêts immobilisés | INTÉGRÉE le 2026-10-04 · (1) dépréciation d'un bien en cours au 29x9 · aucun texte ne la vire à l'achèvement, un seul compte 29 par bien tant qu'elle est en place, avertissement à la mise en service ; (2) prix global · l'écran ne vise le 21500000 que sur un reliquat, calculé au centime comme le serveur ; (3) 72 au SYSCOHADA (l'Acte prime sur le Guide), 787 au SYCEBNL (ses fiches 67 et 72, anomalie de sa fiche 78 écrite), et le TFT des associations retranche de FI les coûts d'emprunt incorporés (intérêts comptés deux fois sinon) ; vérifiée sur vraie base · QUESTION À MANASSE · après la mise en service la dépréciation reste au 29x9, rangée au bilan sous le poste en cours (AL au SYSCOHADA) · relevé ANTÉRIEUR · tableau emplois-ressources des projets, intérêts incorporés comptés deux fois (contrôle VII le montre) · A22 bis INTÉGRÉE le 2026-10-04 (décision de Manasse) · à la mise en service, la dépréciation du 29x9 est REPRISE et DOTÉE DE NOUVEAU sur le 29 du bien achevé (6914 / 7914, ou 853 / 863 au H.A.O.), résultat net inchangé ; mise en service admise à sa vraie date même après un test de clôture au 29x9, le transfert est alors DIFFÉRÉ à un exercice ouvert postérieur (`POST /immobilisations/:id/transfert-depreciation`, daté de son premier jour, art. 22, 4°), message nommé ; rejoué sur vraie base à travers deux clôtures · relevés · chiffres bruts des 69 et 79 visibles en NOTE 28, note 5F et compte de résultat (tranché par la loi, `docs/decisions-par-la-loi-2026-10-07-quater.md` point 9 · colonnes brutes, transfert dit et chiffré au commentaire des deux notes) ; ré-étalement après dépréciation compté en ANNÉES entières (`anneesEcoulees`) et non sur les mois restant à courir (préexistant, ch. 12 § 2.4.1, à l'audit) ; `reclasser` réécrit le 29 de tous les mouvements du bien, transferts compris |

## Après la liste · connexion des trois logiciels, puis audit complet

**Ordre décidé par Manasse le 2026-10-03 (soir).** (1) Finir la liste
ci-dessus, les trois corrections en cours d'abord (A5 bis, A6 bis, A7 ter) ;
(2) connecter « les trois logiciels » au dépôt (lesquels et comment, à
demander à Manasse à ce moment) ; (3) AUDIT COMPLET de tout ce qui est en
ligne, en dernier. Depuis la même date, aucune ligne n'est intégrée sans un
scénario sur VRAIE base qui traverse au moins une clôture d'exercice (règle
à écrire au CLAUDE.md à la prochaine intégration).

**Méthode de l'audit.** Celle qui a trouvé les défauts d'A5 à A7 · un
vérificateur par domaine monte une base jetable, joue des scénarios sur N,
N+1 et N+2 (clôtures annuelles et de période, annulations, devises), lit
chaque solde contre le montant calculé à la main d'après le texte ; tout
défaut confirmé est corrigé et gelé par un test navigateur sur base réelle.
Vague 1 · lignes les plus récentes (A8, A9, A10, A11, A13, lots 1 à 15 des
immobilisations, relecture a posteriori d'A8 et d'A11 comprise). Vague 2 ·
ce qui passe des écritures (paie au journal, clôture et report à nouveau,
TVA, retenues, stocks, subventions, réévaluation, consolidation). Vague 3 ·
ce qui lit sans écrire (états financiers, notes, exports, contrôles).

**À traiter EN TÊTE de l'audit, défauts de production déjà reproduits sur
base réelle (gardés pour l'audit par décision de Manasse du 2026-10-03).**

- AU1 · DOSSIER ENFERMÉ · INTÉGRÉ le 2026-10-04 (trois tours, rejoué sur vraie base) · une ligne
  de l'à-nouveau PROVISOIRE ne se lettre plus par aucun chemin (AUDCIF art. 22,
  2°, `verifierLignes`) ; à la clôture de N, ce qui y était lettré ou pointé
  passe sur la ligne qui la remplace (`apparierTenues`), un groupe figé sans
  équivalent est DÉLETTRÉ par la clôture (audité, nommé « à relettrer », relettrage proposé), la TVA du paiement nommée dans la déclaration jusqu'au relettrage ; l'ouverture de N+1 ne lit que l'à-nouveau, le journal d'OD et leurs corrections. La clôture de période de N+1 n'est
  jamais refusée. Rejoué sur vraie base aux deux référentiels.
- AU2 · MONTANT FAUSSÉ · INTÉGRÉ le 2026-10-04 · la clôture
  confronte l'ouverture déjà passée dans N+1 au bilan de clôture, compte par
  compte (AUDCIF art. 34 · SYCEBNL art. 16, 4)) · concordante, rien n'est
  ajouté ; N sans écriture, l'import fait foi ; divergente, le cabinet déclare
  RECTIFIER (inscription en négatif puis report exact, AUDCIF art. 20, al. 2)
  ou CONSERVER (motif au journal d'audit) ; au brouillard, la clôture demande
  de la valider. Rejoué sur vraie base aux deux référentiels, à travers N et
  N+1.
- AU3 · une balance importée perd la devise · l'ancienne créance n'est
  jamais réévaluée (3 200 000 au lieu de 1 500 USD au cours de 2 400, soit
  3 600 000). CODÉE sur `travail/au3` (2026-10-08), à intégrer · l'import de
  balance lit Devise, Montant en devise et Cours (règle de la saisie, AUDCIF
  art. 52) ; une ligne d'à-nouveau déjà passée se DÉCLARE (au brouillard en
  place, validée par inscription en négatif, art. 20 al. 2), ce qui reste est
  nommé. Rejouée sur vraie base à travers une clôture (40 contrôles) · une
  créance qui monte avec le cours va au 479 sans provision, seule la dette va
  au 478 avec sa provision (art. 54). Relecture adverse (B1, M1, M2, M3, m1,
  m5, m6) corrigée · règlements en francs non lettrés refusés et nommés,
  réévaluation d'un exercice postérieur lue, héritage ligne à ligne, pièce de
  correction hors des écritures de clôture. Relevés en attente · m2, m3, m4
  (fiche `AVANCEMENT-au3.md`), report au solde non retrouvé (nommé, sans geste).

## Design de l'interface · les quatre maquettes, à reprendre après la liste

Les quatre maquettes du 2026-10-03 (accueil du cabinet sur tous ses
dossiers ; « d'où vient ce chiffre » sur un montant d'état ; espace de
travail à onglets avec barre de commande ; vue téléphone du dirigeant) ont
été écartées par Manasse le jour même (« le style typique des sites créés par
IA »), le style Sage à fenêtres restant en place. Consigne de Manasse du
2026-10-07 pour leur reprise · le design est PROPRE à VMG, mais il s'inspire
de logiciels et de sites qui existent vraiment, et rien n'est ajouté pour le
seul effet (ni décor, ni bloc qui encombre). Chaque choix d'écran nomme le
produit réel dont il s'inspire. Reprise après la liste, sur décision de
Manasse (« on verra ça plus tard », 2026-10-03).

## Décisions en attente de Manasse

| # | Question | Proposition |
|---|---|---|
| D1 | Où imprimer les coûts d'emprunt incorporés et la justification d'une préparation courte, aucune rubrique officielle ne les portant (AUDCIF Titre VIII ch. 7 § 1.2 et section 3 ; Titre IX ch. 6) | RÉGLÉE le 2026-10-02, faite (F18) · encadré en lecture seule sous la note « Informations obligatoires » (NOTE 2 SYSCOHADA et associations, NOTE 1 projets), rien écrit dans la saisie |
| D2 | Libellé « Réglé par » · la liste admet aussi un fournisseur, un apport ou un fonds | RÉGLÉE le 2026-10-02 · libellé « Contrepartie », noms de code gardés |
| D3 | Refuser au serveur la sortie d'un bien de projet sur un compte de fonds en sommeil (aujourd'hui seulement retiré de la liste) | RÉGLÉE le 2026-10-02 · refus nommé au serveur (`motifRefusSortieProjet`, `compteFondsEnSommeil`) |
| D4 | Brancher Resend pour que la file de courrier parte réellement | RÉGLÉE · les six secrets API_SMTP_* et API_COURRIER_EXPEDITEUR sont posés dans GitHub (dit par Manasse pendant le paquet 1), aucun code ; la remise réelle se constate au premier courrier |
| D5 | Au SYCEBNL, offrir le 219 et le 229 pour un bien en cours | TRANCHÉ OUI par Manasse le 2026-10-01 · fait |
| D6 | Notes 3A (SYSCOHADA), 5A et 3A (SYCEBNL) · la mise en service comptée en augmentation ET en diminution | TRANCHÉ OUI (corriger) par Manasse le 2026-10-01 · ligne E5 |
| D7 | Créances douteuses (A7 ter, mineur 8) · au SYCEBNL, sous la méthode des cotisations à l'ENCAISSEMENT, un impayé d'adhérent (4131 chèques impayés, 4133 autres valeurs impayées) se reclasse-t-il au 4161 ? Lu · la fiche SYCEBNL du compte 41 (« Les chèques, effets à payer et autres valeurs revenus impayés doivent être enregistrés dans le compte 413 ») et le cadre conceptuel § 5.4.2.1 (cotisations « comptabilisées lors de leur encaissement effectif » faute de droit d'agir) · aucun ne dit si une valeur remise puis revenue impayée a été encaissée, les deux textes ne se hiérarchisent pas | RÉGLÉE PAR LA LOI le 2026-10-07, CODÉE et intégrée le même jour (M8, M9) (`docs/decisions-par-la-loi-2026-10-07-bis.md`, point 5) · sous l'encaissement, une valeur revenue impayée n'a jamais été encaissée (fiche SYCEBNL du compte 51 ; cadre conceptuel § 5.4.2.1) · le 4131 et le 4133 sont REFUSÉS comme le 411, l'avertissement devient un refus nommé ; reclassements déjà passés signalés, jamais défaits d'office · CODÉE sur `travail/decisions-loi-3` (refus du reclassement, de la déclaration et de la perte au 6512 ; contrôle `CREANCE_ADHERENT_RECLASSEE_SOUS_ENCAISSEMENT`), à intégrer · PREMIÈRE RELECTURE (2026-10-07) · M8, la méthode qui juge la perte, la dotation (refusée, reprise ouverte) et le contrôle est celle du JOUR DU RECLASSEMENT, figée au geste ou reconstituée sur le journal d'audit, sinon dite inconnue sans refus ; M9, « Corriger par le résultat » désigne l'écriture du cabinet qui solde la créance d'un exercice clos (cadre conceptuel § 3.3.1.2.4) et la sort du module · limite écrite, le contrôle ne lit que le dossier qui déclare l'encaissement aujourd'hui |

## Relevés en attente (hors liste tant que Manasse ne les y met pas)

- **PAQUET 1, LIGNE A (2026-10-09), second et dernier tour de relecture, non
  corrigés (règle des deux tours, CLAUDE.md § 11).** Les deux BLOQUANTS du
  second tour sont CORRIGÉS (ouverture annulée par un négatif inscrit après
  le premier jour, à la clôture et à l'arrêt à la dissolution).
  - **MAJEUR** · le livre d'inventaire fige 0,00 sur les postes vides du
    tableau des flux (`export.service.ts`, `feuilleEtatFige`), là où l'écran
    et la liasse des associations laissent la cellule vide avec son motif.
  - **Mineurs** · (3) l'écran SYSCOHADA affiche 0,00 sur un poste vide du
    tableau des flux ; (4) `cleDeLectureDeBalance` ne juge pas une date
    invalide ; (5) conversions `as unknown as LecteurOuverturePassee`.
  - **Limites écrites du BLOQUANT 1** · un négatif DATÉ du premier jour laisse
    la position nulle conclure seule (R10), une ressaisie datée plus tard la
    doublerait encore ; une position CONCORDANTE qui contient un négatif
    tardif conclut « rien ajouté » ; la mention aux états ne vise que la
    colonne N du tableau des flux ; la bulle « Bilan d'ouverture importé » du
    cadre de déclaration garde son texte général.
  - **A6 · compte 130** (« Résultat en instance d'affectation ») · le corpus
    ne tranche pas, question pour Manasse ; aucun geste ne passe le résultat
    au 130 à la réouverture.
  - **A3 · proposition** · bilans et comptes de résultat des cinq jeux, et
    tableau des flux SYSCOHADA, servent encore des zéros en colonne N-1 quand
    l'exercice précédent est ouvert sans écriture ; pour le bilan, l'art. 34
    (AUDCIF) et l'art. 16, 4) (SYCEBNL) permettraient de lire le comparatif
    sur l'ouverture de N.
  - **Voisins non codés** · A4, d'autres lecteurs comptent le virement du 13
    dans l'à-nouveau (balance en monnaie fonctionnelle, IFRS 1, « Mouvements
    au <veille> » de la balance FPM) ; A7, rapport d'activité et livre
    d'inventaire reprennent ouverture et variation à 0 sans le dire ; m2, une
    OD du premier jour derrière un N-1 qui tient ses positions se lit comme
    un flux de N (raisonné, non éprouvé) ; A10, `ecartCloture` et
    `natureNonVentilee` servis et jamais lus à l'écran des notes ; A9,
    l'écran des états du projet dit encore « XC ≈ 0 · régime normal » ; G1,
    le cas « ouverture nulle » du relevé MAJEUR reste ouvert.
  - **m5 · production** · deux requêtes en lecture seule
    (`docs/requetes-production-paquet-1.md`, R2) trouvent les dossiers
    clôturés sur l'ancien code par « Rectifier » ou « Conserver » sur une
    contre-passation de réévaluation ; aucun contrôle codé tant qu'elles
    n'ont pas été passées.

- **PAQUET 1, LIGNE C (2026-10-09), second et dernier tour de relecture, non
  corrigés (règle des deux tours, CLAUDE.md § 11).** Aucun BLOQUANT restant
  (celui du second tour, l'arrondi au millier de l'art. 118 jugé sur le
  flottant, et son jumeau du net négatif sont CORRIGÉS, `decimal-exact.ts`).
  - **MAJEURS (relecture ciblée des corrections)** · (M1) la proposition des
    retenues d'un décompte final (`decompte-retenues-stipulations.ts`) chiffre
    sur le net figé au centime loin de zéro (503 900,10) une retenue que
    l'émission refuse au net exact (503 900,095) · le cabinet saisit la
    proposition et reçoit un refus, issue · un centime de moins ; (M2) les
    centimes figés des bulletins ORDINAIRES suivent désormais la règle
    déclarée (loin de zéro) là où le flottant les arrondissait autrement
    (témoin · 380 107 FC, privé, mars 2026, `totalEmployeurFc` 13 303,745
    figé 13 303,75), changement non écrit au guide de la paie ; (M3) le refus
    d'une retenue d'avance au-delà du net ne dit pas le maximum retenable ;
    (M4) `totalExact` de `cotisations-paie.ts` apparie les lignes par RANG, et
    `bareme-irpp.ts` garde des signatures publiques en nombres flottants.
  - **MINEURS** · (m2) les montants de paie à plus de deux décimales ne sont
    refusés qu'à `ElementPaieDto.montantFc` · `montantUsd`,
    `retenuesArticle71Fc`, `tauxLegalAllocationsFamilialesFc`, les champs du
    décompte final, `remunerationBase`, `LigneModeleBulletinDto.montant` et le
    SMIG saisi du cabinet s'arrondissent en silence d'un demi-centime au plus ;
    s'y rattachent R6 (une quote-part au demi-millième laisse un net en
    demi-centime, le bulletin le fige à 503 900,10 quand la paie du mois porte
    le 422 à 503 900,09 · l'écart d'un centime est MONTRÉ par P9) et
    `comptabilisation-paie.ts`, qui arrondit des lignes flottantes par
    `Math.round` (ONEM 285 340,725 passé ,72, dans la tolérance de trois
    centimes) ; (m3) l'observation de l'art. 63, al. 2, 1° (société
    unipersonnelle) est servie à une entreprise DÉCLARÉE du portefeuille de
    l'État · loi n° 08/010, art. 3, à relire avant de coder.
  - **NOTE** · `exercice-requis.spec.ts` ne recense que `compteId` ·
    `compteImmobilisationId`, `compteDepreciationCibleId` et
    `compteSubventionId` lui échappent (déjà jugés par leurs services).
  - **RELEVÉS DE LA LIGNE** · (R1) sur l'ancien `main`, `POST
    /provisions/:exerciceId` avec l'exercice d'un autre dossier créait une
    provision rattachée à l'exercice du voisin, dont l'arrêt à la dissolution
    tombait alors en 500 (clé RESTRICT) · requêtes de contrôle et de purge à
    passer par Manasse (`docs/requetes-production-paquet-1.md`) ; (R2) un
    `exerciceId` de CORPS d'un autre dossier rend 400 « Exercice introuvable
    pour ce tenant », pas 404 (trente-trois refus dans douze services, aucune
    règle unique et sûre), refusé, rien écrit ; (R3) les `compteId` du
    lettrage, de l'inventaire et des comptes d'un tiers n'ont pas été joués
    avec un compte d'un autre dossier ; (R4) `GET
    /creances-douteuses/:id/revue` rendait 400 ou 404 selon la lecture
    concurrente gagnante, désormais toujours 404 ; (R5) une lecture par clé
    primaire de plus par requête porteuse.
  - **À MANASSE** · la déclaration de l'unicité (C4) existe pour la SAS
    (`associeUniqueSas`) ; pour la SARL et la SA, aucun fait n'est encore
    déclarable, l'observation y est servie « sous condition » · ajouter le
    fait relève d'une nouveauté (gel), à décider.

- **PAQUET 1, LIGNE B (2026-10-09), second et dernier tour de relecture, non
  corrigés (règle des deux tours, CLAUDE.md § 11).** Aucun BLOQUANT.
  - **MAJEUR** · B7 incomplet · un bilan d'ouverture IMPORTÉ dans un exercice
    qui a un précédent (N-1 gardé pour les comparatifs) se cherche encore dans
    ce précédent (`relances/date-origine-des-reports.ts`, origine posée
    seulement sans exercice précédent ; l'import porte `estGenereeParCloture`)
    · le groupe posé en N+1 retombe au prorata (art. 154) et la relance
    surévalue le retard ; en N, un groupe qui porte la ligne d'import est nommé
    « à-nouveau sans pièce d'origine » alors que sa date est certaine. NOMMÉ,
    pas silencieux. Correction proposée · une ligne d'écriture d'import de
    bilan d'ouverture (`reference === 'IMPORT'`, `estGenereeParCloture`)
    arrête la chaîne et EST l'origine, à la date de son écriture.
  - **MINEURS** · (1) un PV de caisse ou une fiche peut entrer dans une
    campagne close (`etablirPvCaisse`, `creerFiche` lisent le statut hors
    transaction · `FOR SHARE` puis relecture) ; (2) `caissesNonComptees`
    additionne en mémoire dans la transaction de clôture (§ 8 bis ·
    `groupBy`) ; (3) `valeurAPorterSurLaFiche`, caisse comptée AVANT la
    clôture · la valeur dite fait entrer les mouvements intercalés dans
    l'écart ; (4) infobulles de `groupes-lus-ligne-a-ligne.ts` (« le dû est
    exact » faux en rappel et en préventif ; « au prorata » inexact quand les
    échéances diffèrent) ; (5) balance âgée, échéancier et les deux SMT gardent
    l'ancien tableau à côté d'un refus de rechargement (défaut antérieur) ;
    (6) motifs des groupes nommés sans spec miroir client contre serveur ;
    (7) deux en-têtes de colonne vides dans `TableauBalanceAgee.tsx` ;
    (8) bloc JSDoc orphelin dans `client/src/lib/types.ts`.
  - **VOISINS** · une campagne MIXTE (fiches et PV de caisse à écart, sans
    fiche de la caisse) se clôt avec le manquant du PV jamais décidé ; les
    frais bancaires (631) prélevés sur relevé ne sont pas nommés par
    `CHARGE_SANS_TIERS` (fiche des comptes 62 et 63) ; le classeur de la
    balance âgée et la liasse des notes ne disent pas les groupes lus ligne à
    ligne.

- **SIMULATION DU LOGICIEL COMPLET (2026-10-08), constats hors version 1, non
  corrigés (gel).** Treize lots joués par l'API sur base jetable, 2026 et 2027
  clôtures comprises, et un lot d'écrans dans le navigateur (5 131 contrôles,
  5 030 concordants). Corrigés et en production · G3 (exercice non contigu),
  REL-ANOUVEAU (ancienneté des relances à travers l'à-nouveau), réponse au
  questionnaire et relevé d'unités d'œuvre (écriture par clé composée sous la
  garde de cloisonnement), et une facture réglée en partie pèse son reste,
  imputé par la loi (art. 151 à 154 · `reste-des-lignes-ouvertes.ts`) dans les
  notes par échéance, la balance âgée, l'échéancier, les relances et la NOTE 3
  des deux SMT. Corrigés ensuite (décisions de Manasse du 2026-10-08) · G1,
  la clôture d'un dossier SYCEBNL de groupe admet l'écart égal à son 585 si
  le 585 du GROUPE est soldé à sa date de clôture (fiche du compte 58), et D1, la
  balance âgée ventile chaque solde dans le sens normal de son périmètre.
  Restent, par gravité ·
  - **MAJEUR** ·
    - G2 · le canevas de trésorerie d'une cellule ne vise que l'exercice ouvert
      le plus récent · un canevas de décembre N déposé quand N+1 est ouvert est
      refusé (`groupe.service.ts`, `exerciceOuvert`).
    - SMT (D2) · la NOTE 4 range le règlement d'un tiers sur le 40 ou le 41,
      jamais sur la nature de la facture qu'il règle, quand le compte de
      résultat SMT la rattache · colonnes Achats et Ventes vides sur le chemin
      des modèles (401, 411).
    - Immobilisations (F D2, K1) · `DEPRECIATION_IMMO_HORS_MODULE` et
      `REEVALUATION_IMMO_HORS_MODULE` comptent l'à-nouveau d'une dépréciation
      ou d'un écart posés par le module en N · signalement fabriqué en N+1
      (§ 10 bis) ; le module ne retranche que ses actes de l'exercice.
    - Immobilisations (F D3) · la reprise D 28 / C 798 d'une révision
      rétroactive du plan est lue en acquisition au TFT (anomalie n° 3 déclarée,
      mais l'écriture est reconnaissable par sa liaison).
    - Magasin (MAG-LIEN) · un mouvement se lie à n'importe quelle écriture,
      sans contrôle de compte ni de montant · fiche et compte 31 divergent sans
      signal.
    - Plateforme (H D1) · un second « Ouvrir » pendant le garnissage d'une
      vitrine la double (écritures au brouillard en double, 500).
    - Exonérations (PA1) · les pièces de l'arrêté prévisionnel reprennent celles
      du ponctuel (B.I.6, B.I.7) et omettent B.II.7 et B.II.8 de la note
      circulaire n° 003/2013.
    - Consolidation (J1) · le résultat N-1 non affecté de la consolidante, au
      13 en à-nouveau, est lu comme résultat de l'exercice (règle de
      `resultat-de-l-exercice.ts` non reportée au cumul).
    - Consolidation (J2) · TFT consolidé faux dès que des 478 et 479 sont
      retraités (poste écarté de la CAFG), contrôle en échec non compté parmi
      les motifs.
  - **MAJEUR, relevé après le second tour de G1 (2026-10-08)** · la lecture du
    585 du groupe (`GroupeService.virements585DuGroupe`) cesse de remonter
    vers l'exercice précédent encore ouvert d'un voisin dès qu'une écriture
    validée tombe dans `filtreOuverturePasseeAuPremierJour`, alors que la
    clôture n'y voit pas toujours une ouverture · une ouverture nulle (import
    puis son négatif, la clôture passe le report entier) ou la contre-passation
    d'une réévaluation au premier jour (`devises.service.ts`, OD, admise N
    ouvert). Refus à tort (« écart de 1 000 000 au débit ») tant que le voisin
    n'a pas clôturé N · issue existante (clôturer d'abord N du voisin), non
    nommée par le message, qui propose de passer une contrepartie. Correctif
    proposé · ne s'arrêter que sur une ouverture non nulle, écarter la
    contre-passation reconnue par sa liaison (`ecritureExtourneId`), nommer
    l'exercice précédent ouvert. À VÉRIFIER, hors G1 · à la clôture de N, AU2
    lirait cette contre-passation comme une ouverture divergente (RECTIFIER
    l'inscrirait en négatif, `report-a-nouveau.ts`, rétablissant en silence
    l'écart latent au 478 et au tiers).
  - **MINEUR** · groupe, la clôture n'admet que le 585 (choix de Manasse),
    un virement entre dossiers passé au 588, que la liasse neutralise avec le
    reste du 58, refuse la clôture ; balance âgée, une ligne à solde nul reste
    rendue sous « Soldes en sens inverse », et la grille de l'écran n'a pas de
    rôles de tableau pour un lecteur d'écran (préexistant) ; IFRS consolidé, amortissement de l'écart inclus dans les titres
    mis en équivalence non signalé (IAS 28 § 32 a) ; SMT, motif de la méthode
    des cotisations qui dit « projet de développement », écart KZC/HB d'une
    cession sans décomposition au SYCEBNL ; révision, test ISA 240 qui garde
    l'écriture de clôture, troisième mandat consécutif admis sans rang, report
    des provisions vers un exercice antérieur clos, campagne d'inventaire
    rapprochée de la balance de fin d'exercice et non de la date du comptage,
    campagne de caisse seule qui ne se clôt pas, manuel futur qui efface le
    contrôle d'un exercice passé ; immobilisations, mois du renouvellement d'un
    composant doté deux fois, reconstitution en années de 365,25 jours, fonds
    commercial du prix global sans date de mise en service, désactualisation
    lue en coût de démantèlement au TFT, dette éteinte par l'option non levée
    lue en remboursement ; magasin, code d'article en double en 500 ; société
    dissoute sans liquidation qui peut ouvrir un exercice de liquidation ;
    conventions de financement ferme non signées annoncées « mention en notes »
    sans mention ; second jeu en monnaie fonctionnelle qui ne s'additionne pas
    au centime ; exonération ponctuelle d'une ONG étrangère sans accord-cadre
    dite complète ; quotité saisissable du bulletin qui ne lit pas la classe du
    contrat ; réserves d'une entité convertie au cours d'entrée ;
    `POST /auth/register` qui admet la licence perpétuelle sur site (porte
    fermée en production) ; notes par échéance, la part non ventilée servie par
    le serveur jamais dite à l'écran (`NotesAnnexesRendu.tsx`) ; état des
    créances et dettes des deux SMT (NOTE 3), le règlement lettré en partiel
    avec sa facture lu sous son nom et non déduit d'elle (même cause que les
    notes, sommes demandées à la base par `groupBy`) ; paie, abstention des
    allocations familiales qui renvoie à un nom de constante interne
    (`RESOLUTION_TAUX_LEGAL_ALLOCATIONS`), plafond de l'art. 69, 1 non arrondi
    au centime (« seul l'excédent de 0.00 FC est imposable »).
  - **Reste d'une facture réglée en partie, relevés du second tour (mineurs)** ·
    un groupe qui ne se répartit pas sûrement (négatif sans son origine ou à
    deux origines, reste négatif en devise, part déclarée au-delà de la
    facture) garde la lecture ligne à ligne et n'est nommé qu'au journal du
    serveur, jamais à l'écran ; aux relances, une facture soldée dans sa devise
    avec un gain de change non passé se lit ligne à ligne (le réalisé n'est
    pas nommé) ; un groupe d'à-nouveaux lettré à la main, sans groupe de N
    reconduit, garde l'ordre de ses lignes ; les doublures des tests de la
    note et des SMT rendent un `groupBy` constant, sans ligne au brouillard.
  - **Manque de fonction** · le facturier ne connaît pas les devises · une
    facture en dollars comptabilisée crée une créance en francs, hors de la
    réévaluation de l'art. 54 (voie existante · l'écriture en devise d'abord,
    la facture liée ensuite).
  - **Doutes que le texte ne tranche pas** · forfait libératoire de l'art.
    121, al. 2 · aucun bulletin d'un domestique ou d'une micro-entreprise ne
    s'émet tant que le cours de conversion de l'arrêté n° 019/2025 manque au
    corpus ; quote-part ouvrière CNSS et art. 20, dernier alinéa (le registre
    ne signale que l'IRPP) ; concours d'une cession et d'une saisie (AUPSRVE,
    art. 208 et 209) non servi ; annuité pleine du SMT SYSCOHADA
    l'année d'une cession (Titre X contre fiche du compte 81) ; valeur nette
    d'une cession au SMT sans ligne dans les deux maquettes ; résultat de la
    période d'activité gardé au 13 pendant la liquidation ; acompte d'IS versé
    avant l'échéance de la première cotisation ; déduction du 8994.

- **Passe V1 n° 2 (2026-10-08), constats MINEURS, non corrigés (gel).** C1 ·
  CHARGE_SANS_TIERS se lève sur le redressement du manquant de caisse que
  l'inventaire demande et retient (`controles.service.ts`). C2 · GET
  `/rapprochements/:id/propositions` sans `fenetreJours` rend 400 alors que le
  paramètre est facultatif (l'écran envoie toujours 15). C3 · cloisonnement,
  sans fuite · des identifiants d'un autre dossier rendent 400 au lieu de 404
  (grand livre, contrôles), ou 200 vide (liste, balance, export du journal d'un
  exercice d'un autre dossier). Observation · la feuille CONTROLES de la liasse
  projet compare XC à 0 « en régime normal » sur un projet au résultat de
  120 000. Le MAJEUR R1 (contrôle de restitution écrit avant les tables) est
  corrigé.

- LIGNE PASSE-1-ETATS INTÉGRÉE (2026-10-08, défauts P1, A1 et B1 de la première passe de la version 1), relevés non bloquants ·
  - Le **130** (« Résultat en instance d'affectation », SYSCOHADA) reste hors de
    CJ et de SP2 (anomalie n° 7, audit final F218) · le ch. 7 ne le nomme pas.
    Un dossier qui use de ce compte garde un bilan intermédiaire déséquilibré
    de son montant, signalé en « comptes non rattachés ». Le corpus ne tranche
    pas · point pour Manasse (le lire en CJ comme le 131, par la fiche du
    compte 13 dont il est une subdivision ?).
  - TFT des associations · une ouverture saisie en OD au premier jour (sans
    report) reste lue comme flux, quand le SYSCOHADA la nomme et vide ses postes
    (bloquant 2 du 2026-10-07). Hors des trois défauts, non codé (gel).
  
  Second tour de relecture (aucun BLOQUANT), mineurs ·
  1. un exercice N clos avant le virement n'est signalé que sur son propre bilan ; la colonne N-1 de N+1 reprend le montant dans CH ou CJ sans le dire, et la liasse de N+1 ne lève pas l'anomalie (`comparatifDuBilan`, liasses) ;
  2. `mentionExercicePrecedentVide` (etats-financiers.communs.ts) conseille d'importer la balance de clôture quand l'exercice précédent n'a que du brouillard, sans dire de le valider ;
  3. exercice précédent vide · la colonne N-1 du TFT des associations rend des zéros avec `exerciceN1Disponible` vrai, sans dire « vide » ;
  4. premier exercice clos par la nouvelle clôture · `lignesALOuverture(lignesN)` présente l'ouverture déjà virée (13 à 0, 12/129 porte le montant) dans le comparatif et l'ouverture du TFT ; totaux justes, reclassement interne aux capitaux propres faux.


- LIGNE TVA-DECISIONS INTÉGRÉE (2026-10-08, TVA des factures annulées et rattachées tard, perte d'une créance avec duplicata, trop-payé de liquidation), relevés non bloquants ·
  - (D) La perte au TTC (sans duplicata) reste une écriture D 651 / C 416,
    comme avant · la consigne ne la ramène pas au compte d'origine, lecture
    gardée ; la perte qui récupère est refusée après une perte au TTC déjà
    passée (la règle 3 sert alors).
  - (D) Créance reclassée en N, perdue en N+1 · le lettrage du 416 reste à
    désigner (« Lettrer au 416 », A7 ter B2), comme avant ; au compte
    d'origine, les lignes d'à-nouveau de la facture et du reclassement restent
    ouvertes (règle d'A7, le reclassement ne lettre pas le 411).
  - (E) Réglé au premier tour (M3) · la première cotisation se lit sur le
    constat A11 de l'exercice arrêté ; sans constat, ou sans la réintégration
    de l'impôt (art. 45), la totalisation est refusée, nommée.
  - (Relecture, mineur) La cadence trimestrielle d'une TVA n'est pas connue
    d'OmegaX · la borne du 30 septembre est dite à côté de celle du 30
    novembre, jamais imposée.
  - (Relecture, M4) Le moteur ne rend jamais exigible, après la perte, la taxe
    qu'elle a annulée ; une taxe à l'encaissement d'une facture NON cochée de
    la perte (sans duplicata) reste lue par son groupe, la garde du lettrage
    (reclassement et son report) étant ce qui la protège.
  - (Relecture, M2) Le négatif d'un achat à l'encaissement est NOMMÉ sans
    reprendre la déduction prise au règlement · reprendre la part figée au
    premier jour non liquidé est laissé au cabinet (sûreté non établie sur un
    groupe partiellement réglé).
  
  - Le négatif d'une facture À L'ENCAISSEMENT déjà en partie encaissée · la
    taxe des règlements reste déclarée (figée) ; la restitution au client
    relève de la note de crédit (art. 52, al. 2), non chiffrée.
  - Les compteurs descriptifs (biens datés à la facture, services aux débits,
    acomptes imputés) restent lus à la date d'écriture · une ligne rattachée
    tard y figure dans sa période d'origine, pas dans celle qui la déclare.
  - (E) Le crédit du 8994 entre au résultat comptable de l'exercice de
    liquidation · tant que le cabinet ne le déduit pas (doctrine du 899 d'A11,
    `observationDegrevement`), la totalisation recalculée après validation
    l'inclut, et le constat dit l'écart du trop-payé. Neutralisation d'office
    non codée (aucun texte exprès, même parti que le dégrèvement).


- LIGNE LETTRAGE-CLOTURE INTÉGRÉE (2026-10-08, lettrage partiel reconduit à la clôture), relevés non bloquants ·
  - `groupesNonReconduits` ne lit que le couple (N clôturé, N+1 ouvert). La
    clôture de N+1 reconduit désormais en N+2 les groupes de N À RECONDUIRE
    et nomme les autres ; un groupe NOMMÉ (lettré ailleurs, introuvable) n'est
    plus suivi au-delà de N+2.
  - Relevés des relectures non traités · m4 (types des lectures tirés des
    charges utiles de Prisma plutôt qu'écrits à la main) ; les déclarations
    d'imputation (art. 151, 153, `ImputationPaiement`) ne sont lues que par
    la TVA, jamais par le reste servi (D9) ; la garde m6 (dû en devise nul,
    francs restants) n'est plus guère atteignable, gardée ; les candidates de
    l'ouverture passée en OD (`filtreOuverturePasseeAuPremierJour`) sont
    larges (toute OD au premier jour hors gestion), à resserrer.
  - LIMITE D9 · une facture HORS du groupe, PLUS ANCIENNE que ses factures,
    choisie avec lui dans un règlement PARTIEL · le reste relu ensuite
    l'éteint avant les règlements déjà inscrits sur le groupe · la répartition
    facture par facture peut s'écarter de l'inscription ; le total du groupe
    reste exact, et l'écart en francs passe à l'écart proposé. Cas rare,
    non refusé.
  - Un règlement choisi sur une facture du groupe s'inscrit d'abord sur ses
    factures plus anciennes (D5, D9) · dit par l'avertissement, jamais
    refusé ; l'échéancier sert chaque facture pour son reste.
  - Un groupe partiel À CHEVAL (lignes en N−1 et N) n'est pas reconduit à la
    clôture de N (D1 · la paire à cheval le lit) · reste au régime d'A6 bis.
  - Un groupe reconduit (origine CLOTURE) se délettre comme un manuel · il
    revient alors « à reconduire » au pré-lettrage et au contrôle. Voulu
    (aucun dossier enfermé), à confirmer.
  - Arrêt du serveur de rejeu · au premier rejeu, un `pkill -f "node
    dist/main.js"` a été lancé (motif trop large, il pouvait atteindre un autre
    serveur compilé de la machine) ; aucun autre `dist/main.js` n'était visible
    ensuite. Au second rejeu, arrêt par le seul PID du serveur (port 8743
    vérifié dans son environnement). Au rejeu du premier tour, le PID gardé
    au lancement était celui du sous-shell (`&` posé sur toute la chaîne) ·
    node a survécu, puis a été arrêté par son propre PID, port 8743 et copie
    `wt-lettrage` lus dans son environnement. Lancer `node` seul en arrière-plan.
  - Le refus en devise dit « en a déjà réglé 1680000.00 » en FRANCS (coût
    historique) à côté d'un reste en devise · lisible, mais deux unités dans
    une phrase.


- SIMULATION COMPLÈTE DU 2026-10-08 (SARL SYSCOHADA 2026 à 2028, association SYCEBNL), failles non corrigées · voir le détail ci-dessous, repris de la fiche ·
  Base PostgreSQL jetable, serveur compilé, jeu PAR L'API seulement. Deux
  dossiers · SARL SYSCOHADA (système normal, assujettie TVA) sur 2026 et 2027,
  association SYCEBNL (jeu associations) sur 2026. Chaque solde lu contre le
  calcul à la main.
  
  ## Fait
  
  - Correction 1 (BLOQUANT, geste juste refusé sans issue) · variation des
    stocks en inventaire intermittent refusée sur tout dossier SYSCOHADA semé ·
    « Ces comptes ne sont pas ouverts en imputation dans ce dossier : 6031 ».
    La proposition écrit `6031`, le plan sème `60310000`, et la requête ne
    demandait que la forme courte (`StockService.enregistrer`). Test ·
    `stock.service.spec.ts`, doublure qui honore le `where`. Rejoué sur la base ·
    D 31110000 / C 60310000 8 000 000 passé.
  - Correction 2 (MAJEUR tranché par la loi, consigne du coordinateur) · le
    résultat de l'exercice précédent non affecté est VIRÉ AU REPORT À NOUVEAU à
    la clôture de N+1. AUDCIF Titre VII, compte 13 (« En fin d'exercice, le
    résultat de l'exercice précédent non affecté [...] est viré au compte de
    report à nouveau » ; « Dans les entités individuelles, le solde du compte 13
    est viré au compte 103 ») ; SYCEBNL Partie 2 ch. 3, compte 13, même phrase.
    Comptes semés · SYSCOHADA 12100000 / 12910000 (10300000 pour l'entreprise
    individuelle et l'entreprenant), SYCEBNL 12100000 / 12900000.
    `virement-resultat-non-affecte.ts`, écriture de clôture LIÉE validée avant
    le solde des comptes de gestion, message nommé dans la réponse de la clôture
    et à l'écran (`issueOuverture`) avec l'avertissement sur l'affectation à
    passer depuis le 12. Report provisoire et aperçu de l'ouverture suivante
    fondent le même virement. Exception écrite au commentaire F209.
  - La clôture REFUSE un bilan déséquilibré par un autre chemin
    (`refuserBilanDesequilibre`, `ecartInexpliqueDuBilan`, montants et écart
    nommés), bilan du jeu du dossier lu par jetons (`common/lecteurs-bilan.ts`).
  - Rejoué sur vraie base · SARL bilan 2027 165 828 000 = 165 828 000 (CH
    −46 072 000, CJ −11 600 000, CP −7 672 000), bilan 2028 équilibré, colonne
    N-1 de 2028 identique, ouverture 2028 · 12910000 46 072 000 et 13900000
    11 600 000. ASBL sans affectation · excédent 2026 de 2 700 000 viré au
    12100000 à la clôture 2027, bilans 2027 et 2028 équilibrés. Affectation
    passée avant la clôture · rien viré (specs, deux référentiels).
  - Limite écrite · le virement porte le drapeau de clôture et se range, à la
    balance de N+1, dans la colonne « report ».
  
  ## Scénario joué (tout lu contre le calcul à la main, concordant sauf constats)
  
  - SARL 2026 · capital 50 M, emprunt 150 M, achats 20 M HT + TVA 3,2 M,
    ventes 30 M et 10 M HT + TVA 6,4 M, facture 10 000 USD à 2 800, règlement
    4 000 USD à 2 850 (perte réalisée 200 000 au 656), paie 3 salariés juillet et
    août (brut 5 800 000, CNSS 290 000 + 754 000, IRPP 997 000, INPP 203 000,
    ONEM 29 000, net 4 513 000 par mois), véhicule 30 M, bâtiment 100 M plus
    toiture 20 M en composant, serveur 6 M cédé 5 M (VNC 4 666 666,67), créance
    C2 de 11 600 000 reclassée au 4162 et dépréciée de 5 800 000, charges à
    payer (électricité, intérêts courus 15 M), stock final 8 M, réévaluation
    (4783 et 4991 de 600 000), IMF 400 000, résultat −46 072 000, bilan
    187 908 000 équilibré, TFT bouclé sur 12 628 000, liquidation TVA T1.
  - SARL 2027 · extourne, reprise des régularisations, règlements des
    à-nouveaux (F2 6 000 USD à 2 950, perte 900 000 ; reprise de provision
    600 000), recouvrement 4 M et revue de C2 (reprise 2 200 000), variation
    8 M vers 5 M, IMF 500 000, résultat −11 600 000.
  - ASBL 2026 · cotisations à l'encaissement, dons, fonds affectés 30 M dont
    18 M repris au 7925, subvention d'équipement 12 M reprise au 799 (2 M),
    ordinateurs reçus en don 6 M (167, reprise 7923), excédent 2 700 000,
    bilan 29 533 333,33 équilibré, TFT bouclé, clôture, affectation en 2027.
  - Cloisonnement (lecture, écriture, suppression croisées) et rôle lecture
    seule · tous refusés, sauf le constat 4.
  
  ## Constats non bloquants (consignés, non corrigés)
  
  1. (corrigé, voir « Fait », correction 2)
  2. MOYEN · un lettrage PARTIEL n'est pas reconduit à la clôture · facture
     34 800 000 et acompte 20 000 000 du client arrivent séparés et non lettrés
     en N+1 ; le règlement de la facture entière (34 800 000) est accepté alors
     que le client ne doit que 14 800 000 (compte ensuite créditeur de
     20 000 000). Même chose pour le report en devise du fournisseur F2.
  3. MINEUR · `POST /ecritures/valider-jusqua` avec l'exercice d'un autre
     dossier rend 201 (zéro validée) au lieu d'un 404 · aucune fuite.
  4. MINEUR · l'observation « Société unipersonnelle à associé unique » du
     résultat fiscal est servie à toute SARL, SA, SAS, unipersonnelle ou non.
  5. MINEUR · `CHARGE_SANS_TIERS` sur des intérêts d'emprunt prélevés par la
     banque (6712 contre 521), cas légitime non nommé.
  6. À EXAMINER · au TFT SYSCOHADA, la variation des intérêts courus (1662)
     entre dans FE (passif circulant) quand le bilan les range en DA ; le
     tableau boucle, la ventilation est à relire contre le ch. 5.
  

- LIGNE INPP TRIMESTRIEL INTÉGRÉE, relevés de la relecture ·
  (relecture adverse, non corrigés ici)
  
  - **Exception de lecture de N-1** · une exception levée dans
    `ouvertureVentileeInpp` (lecture du registre de l'exercice précédent) fait
    tomber TOUT le registre au lieu du repli (bloc au trimestre, dit). Rien n'est
    avalé, mais l'écran entier refuse pour une ventilation facultative · repli
    nommé à poser.
  - **Réduction saisie par bulletin** · la réduction et son acte se saisissent à
    chaque simulation, sans être portés par le dossier ; un bulletin émis sans
    elle sort au taux plein. Une déclaration au dossier, datée, avec son acte,
    serait la forme durable · décision d'organisation à soumettre.

- LIGNE AU3 INTÉGRÉE, relevés de la seconde relecture ·
  - m2 · déclaration sur une ligne REPORT · l'art. 20 al. 4 veut une mention aux Notes annexes, rien ne la signale ; aucun contrôle ne dit que l'ouverture de N+1 diffère alors, devise par devise, de la clôture de N (en francs, l'art. 34 tient).
  - m3 · la liste lit le contexte de l'exercice (réévaluation, précédent ouvert) à la date de la première candidate · les lignes d'à-nouveau partagent la date d'ouverture ; B1 est désormais lu par compte et par sens.
  - m4 · le lettrage concurrent n'est relu que par `count` dans la transaction, sans verrou de ligne · fenêtre étroite.
  - Report au SOLDE d'une ligne non déclarée · nommé, sans geste dédié (correction par inscription en négatif à la main).

- LIGNE A7 BIS PARTIE 2 (TVA de l'art. 52) INTÉGRÉE, relevés de la seconde relecture ·
  - NÉGATIF D'UNE VENTE CORRIGÉE · un crédit NÉGATIF du 443 à taux (inscription en
    négatif d'une facture de vente) reste ignoré par la déclaration (`montant <= EPSILON`)
    · la collecte d'une vente annulée au journal resterait déclarée. Défaut de `main`,
    hors de cette ligne ; même mécanique que le négatif d'avoir, à reprendre avec sa
    période et sa reprise nommée.
  - 443 DÉBITÉ À LA MAIN · un débit du 443 à taux saisi hors facturation et hors module
    est lu comme un avoir sur vente, compté « sans note de crédit » · aucun refus, la
    déclaration le dit. Une récupération d'impayé passée à la main n'a pas de duplicata
    connu d'OmegaX et reste signalée ainsi.
  - RÉPARTITION SUR LE TTC DE L'ÉCRITURE · la taxe correspondante d'une facture se lit au
    rapport taxe / TTC de TOUTE la pièce (classe 4 hors 44, et classe 5 perçue), pas de la
    seule ligne désignée · exact pour une facture d'un seul client, approché si la pièce
    réunit plusieurs clients ou plusieurs taux sur des échéances de parts inégales.
  - Une facture validée APRÈS qu'une période ultérieure a été liquidée n'entre dans aucune
    déclaration (avoir compris) · défaut de `main`, la récupération du module en est
    protégée par son refus de date.

- 2026-10-07 · LIGNE CORRECTIONS DE LA PAIE INTÉGRÉE (C1 à C9, T1 à T9, B1 et M1 à M3 de la relecture) · relevés non bloquants · (T7) l'indemnité de l'art. 70 et le montant convenu de l'art. 61 bis entrent dans l'assiette sociale sans la réserve de l'indemnité de préavis ; (C1) l'apprenti, assujetti aux seuls risques professionnels, n'a pas de cas sous abstention de la CNSS ; (C2) un négatif déjà inscrit à la main ne peut être déclaré « repris », la passation du mois reste à confirmer ; référence vide (« Bulletins n° ») d'une paie qui ne fait que reprendre en négatif ; un rejeu refusé arrête le mois entier ; la reprise d'un bulletin de N passée en N+1 n'a aucune date par défaut ; (contrôle 36) un 4334 ou 4335 d'un bilan d'ouverture importé est signalé comme résidu d'avant T1 ; journalier et mensuel tous deux saisis, le mensuel l'emporte sans le dire ; (T9) le 17 janvier 2027, férié un dimanche quand le 16 l'est déjà, l'ordonnance n° 23-042 se tait.

- 2026-10-07 · LIGNE DÉCISIONS DU QUATRIÈME LOT (dissolution, `travail/decisions-quater-code`), relecture · deux relevés non bloquants · (4) L'EXEMPTION DE LA COOPÉRATIVE AGRICOLE DE FORME CIVILE (loi n° 23/053, art. 5, 2°) n'est portée par aucun champ du dossier · les cotisations spéciales lui sont servies avec la réserve écrite (`RESERVE_COOPERATIVE_EXEMPTEE`) ; un fait déclarable (forme civile et objet agricole, deux conditions cumulatives) les retirerait ; (6) SÉRIALISATION DES MODULES PENDANT L'ARRÊT · l'arrêt passe en transaction SÉRIALISABLE et relit écritures et actes, mais un module qui écrit un acte de la période (dotation, dérogatoire, revue) hors de cette transaction, au même instant, n'est rejoué que par le conflit de sérialisation de PostgreSQL · un verrou par dossier commun aux gestes qui changent la période d'un exercice et aux modules serait la garde explicite. LIMITE ÉCRITE DU BLOQUANT 1 · la provision pour démantèlement, la réévaluation des immobilisations et la reprise de la provision spéciale, calculées sur la période, n'ont aucun geste d'annulation · l'arrêt les NOMME et refuse, le message le dit (« aucun geste d'OmegaX ne l'annule encore ») · porte de régularisation à décider.
- 2026-10-07 · LIGNE DÉCISIONS DU QUATRIÈME LOT INTÉGRÉE, seconde relecture · relevés non bloquants · (a) une société dissoute SANS liquidation (associé unique personne morale, AUSCGIE art. 201 al. 4) peut encore créer un exercice de liquidation · `validerArticle7` (branche `liquidation`) ne lit que la date de dissolution, le bouton « Préparer l'exercice de liquidation » de `ExercicePage.tsx` s'affiche, et le refus des exercices civils dit « Créez l'exercice de liquidation » · refuser `liquidation` quand `sansLiquidation` est vrai, masquer le bouton, adapter le message ; (b) arrêt refusé sans issue dans OmegaX pour `mouvementDemantelement`, `reevaluationBilan` et `repriseProvisionReevaluation` (aucun geste d'annulation) · rendre au moins le démantèlement retirable au brouillard par le chemin générique, à vérifier ; (c) l'accord de retrait des actes de la période est global · envoyer les identifiants des actes confirmés et ne retirer qu'eux, faire passer l'arrêt par `gesteDissolution` ; (d) `annulerArretDissolution` lit les actes avant le statut de la liquidation · tester `liquidation.statut` d'abord.
- 2026-10-07 · LIGNE DÉCISIONS PAR LA LOI, SECOND ET TROISIÈME LOTS, INTÉGRÉE (imputation des paiements en TVA, C14, C09, D7, ordre des pertes) · relevés non bloquants · (M-c) la correction d'une erreur significative par le report à nouveau (AUDCIF art. 20, `imputerAuxCapitauxPropresDOuverture`) n'est pas désignable comme écriture de correction d'une créance douteuse, seule la voie du résultat l'est ; (m-1) sans liaison `corrigeEcritureId`, une inscription en négatif s'apparie à la première ligne de même compte et de montant opposé, rendre `null` et nommer le groupe à plusieurs candidates ; (m-2) la fenêtre ouverte depuis le groupe de N ne suit pas la prolongation vers N+1 ; (m-3) C09, chiffre d'affaires déclaré de la période non confronté au livre-journal dans les observations ; (m-4) M9, une écriture couvrant plusieurs créances sur un même 416 devrait dire « une écriture par créance » ; (m-5) un ordre de virement annulé laisse l'imputation par parts, peut-être jamais notifiée ; (m-6) le contrôle 6 quinquies lit le journal d'audit trois fois par candidate, liste des candidates non bornée ; Échap de `ImputationPaiementModale` sans garde de fermeture ; effet d'une déclaration sur un mois liquidé au régime des débits non dit ; LIMITE ÉCRITE · deux reports d'une même pièce dans un même exercice, ou une pièce d'origine au brouillard, ne se relient pas, le groupe est nommé, jamais deviné.

- 2026-10-07 · LIGNE CAS CHIFFRÉS IS INTÉGRÉE · relevés non bloquants · jumeau aux états financiers (`calculerCJ` bascule sur le 13 au net nul des classes 6 à 8, effet sur le bilan à relire) ; gestion soldée à la main sous un à-nouveau non affecté, dite non retranchée ; lectures du rejeu en série (`deficitsAnterieursCalcules`), à paralléliser si le temps le demande ; dossier repris dont le premier exercice tenu est long, l'art. 12, al. 3 non désactivable ; signal du report décalé à l'exercice qui impute ; perte de la période de création de 2025 sous le texte antérieur non tranchée ; date de valeur de l'art. 22, 4° pour l'écriture de la période ; écran · deux champs sans libellé associé, « Retirer » sans nom distinct, focus non placé à l'ajout, `key={i}` dans `OrigineDeficits`, « Enregistrer l'origine » actif sur liste vide. Questions C14, C09 et ordre d'imputation entre plusieurs pertes · TRANCHÉES PAR LA LOI le 2026-10-07 (`docs/decisions-par-la-loi-2026-10-07-bis.md`, points 1 et 2 ; `…-ter.md`, point 1 · la plus ancienne d'abord, par la structure de l'art. 51, le Code civil, Livre III, art. 154, et la LPF, art. 43, al. 3).
- 2026-10-07 · LIGNE DÉCISIONS DU 2026-10-07 (PREMIER LOT) INTÉGRÉE (F33) · relevés du second tour non bloquants · PLAFOND DISTRIBUABLE non chiffré (quote-part × (bénéfice − pertes antérieures − dotation légale due), AUSCGIE art. 143, 346, 546, seul l'avertissement est servi) ; avertissement des capitaux propres comparé au seul capital, pas au capital augmenté des réserves indisponibles ni après distribution (art. 143) ; paiement « Non calculée » entre la déclaration et la réception de la note, alors que la note dépend de l'Administration ; amende du simple au triple pour non-paiement (arrêté, art. 1er, point 11) non dite ; résumé de la LF n° 24/011 cité entre guillemets ; point 3 de l'art. 1er (parts cédées, Code minier art. 71 d, 82 h, 104) non cité ; dividende d'un exercice clos avant une dissolution déclarée sans mention ; invitation « secteur minier non déclaré » non bornée au 10/12/2025 ; quote-part non datée (la changer réécrit les exercices passés) ; quote-part écrite avec un point ; SARL, SAS, SNC au-delà des seuils sans mandat · PV masqué ; commentaire faux de `duree-mandat.ts` (contrôle 28 et fin anticipée, art. 705, 709) ; messages de date sans `role="alert"`, source périmée affichée après effacement ; specs qui gèlent encore la forme d'une ligne ; 25 % sur les dividendes de coentreprise d'une entreprise publique minière (arrêté, art. 4), non décidé.
- 2026-10-07 · CAS CHIFFRÉS DE LA PAIE JOUÉS (branche `travail/paie-cas`, `docs/cas-chiffres/paie.md`, 273 concordances sur 282) · constats C1 (IRPP et net chiffrés sous abstention CNSS), C2 (bulletin de décembre annulé après clôture repassé en entier en N+1), C3 (logement en nature sans la case du contrat, quotité), C4 (préavis du délégué) · les neuf questions T1 à T9 TRANCHÉES PAR LA LOI le 2026-10-07 (`docs/decisions-par-la-loi-paie-2026-10-07.md`) · INPP au 6415 et ONEM au 6413 contre le 4428, les 4334 et 4335 retirés (fiches des comptes 64 et 66 des deux plans, AUDCIF art. 18) ; plafond de l'art. 118 avant la quotité de l'art. 123 ; logement à 30 % · condition ; plancher CNSS de 2025 au SMIG payé (14 500) ; ONEM de septembre 2025 à 0,5 % (arrêté n° 028/2025 art. 6), INPP selon la date de versement ; tranche d'ancienneté du congé due entière (art. 141, 144) ; indemnité de préavis dans l'assiette sociale (art. 63 al. 3, 7 point 8 ; arrêté n° 146/2018 art. 20) ; cours du dollar au jour de la mise à disposition, arrondi au centime supérieur (P5) ; samedi qui porte le congé d'un férié tombé un dimanche non ouvrable (P5), et l'indemnité de préavis se lit sur la rémunération du délai, fériés compris (art. 63 al. 3, 93), nouveau constat · à coder dans la ligne des corrections de la paie · T2 et le prorata d'un mois entamé (T9) TRANCHÉS PAR LA LOI le 2026-10-07 (`docs/decisions-par-la-loi-2026-10-07-ter.md`, points 2 et 3 · réduction du plafond rapportée à la quatrième tranche, lecture d'OmegaX gardée ; mois entamé à 1/26 du mensuel par jour payable, décret n° 25/22 art. 7 par analogie) · RESTENT À MANASSE, faute d'être des questions de droit · ordonnance n° 84/186 sur l'INPP absente du corpus (T5), deux notes de compétences contraires au texte (`fiscalite-rdc/irpp/NOTES.md` et son script, `fiscalite-rdc/parafiscalite-sociale/NOTES.md`).
- 2026-10-07 · LIGNE DÉCISIONS PAR LA LOI INTÉGRÉE (F32) · relevés non bloquants · recalage des étapes 17 et 18 et du dépôt au RCCM par l'assemblée DÉCLARÉE hors portefeuille (le planning de base reste au sixième mois, seul l'échéancier fiscal lit l'assemblée) ; jalon RCCM (étape 24) sans geste qui le lève (antérieur) ; proposition de la case ZK depuis le portefeuille, reprise de la fiche R2 de N-1, contrôle 409 d'un écran resté ouvert pendant un déploiement, écarts de formule par ligne répétée ; personnel extérieur et bénévole des 20B et 29B gardé à une colonne (à lire au J.O. OHADA) · les six questions laissées ouvertes sont TRANCHÉES PAR LA LOI le 2026-10-07 (`docs/decisions-par-la-loi-2026-10-07.md`) · procédure collective admise avec un associé unique personne morale (AUPCAP art. 53, AUSCGIE art. 203 al. 2) ; exercice arrêté à la dissolution puis un seul exercice de liquidation (loi n° 23/053 art. 12 et 13, LPF art. 16, AUDCIF art. 7 al. 4) ; dividende minier au 15 mai (arrêté interministériel du 10 décembre 2025, art. 2) ; siège compté en ZN (AUDCIF Titre VIII ch. 34 § 3), contrôle lu à l'art. 78 ; code 00 proposé à une SA du portefeuille, jamais lu à rebours ; délais « au moins N jours avant » servis francs, l'autre lecture dite · constat ajouté · PV de la LPF art. 13 bis borné aux états certifiés par un commissaire aux comptes.

- 2026-10-04 · LIGNE TVA 24-26 INTÉGRÉE (reconfrontation des art. 24 à 26 de l'O.-L. n° 10/001 et 51 à 63 du décret n° 011/42, trois tours de vérification) · groupe partiel à plusieurs factures de même composition · taxe exigible à CHAQUE encaissement (art. 25, 2° ; décret art. 57), mois liquidés figés ; composition différente · règle de `main` et groupe NOMMÉ ; groupe partiel suivi d'exercice en exercice par ses à-nouveaux (provisoires compris) ; sept hypothèses tues nommées ; `FAIT_GENERATEUR` renommé `DATE_ECRITURE`, « exigible » à l'écran · règle d'IMPUTATION DES PAIEMENTS · RÉGLÉE PAR LA LOI le 2026-10-07 (Code civil congolais, Livre III, art. 151 à 154, au corpus · `docs/decisions-par-la-loi-2026-10-07-bis.md`, point 4) · imputation déclarée par le client, sinon légale (échue, plus onéreuse, plus ancienne, prorata en dernier), la convention « aucun prorata » tombe, à coder · relevé hérité · un avoir sans TVA ou un escompte au 673 lettré dans un groupe compte comme un règlement.

- 2026-10-04 · `src/modules/groupe/liaison-etablissements-syscohada.spec.ts` est tombé UNE fois dans la suite complète à l'intégration des exports FPM (machine chargée), sans détail capturé ; vert seul, avec les modules voisins, et dans la suite complète relancée (10 742 sur 10 742). Cause non trouvée · à surveiller, jamais à mettre en quarantaine.

- 2026-10-04 · EXPORTS FPM intégrés (balances, balances des tiers par famille, grands livres au modèle du cabinet, une feuille de grand livre par compte reliée par lien, balances N et N-1 de la liasse au même modèle, décisions de Manasse du 2026-10-04) · relevés · MÉMOIRE DES EXPORTS EN FLUX (préexistant) · le grand livre à plat de `main` mesure environ 812 Mo de mémoire de processus à 100 000 lignes et 1,7 Go à 200 000 (tas V8 bas, 105 à 126 Mo) · la table du 2026-09-12 de `docs/capacite-mesuree.md` (246 Mo) n'a pas été reproduite · à mesurer dans un conteneur borné à 512 Mio, puis plafond de lignes plus bas ou exports simultanés limités (audit) ; tiers rattachés à un compte hors classe 4 (16, 27) dans aucune famille de balance des tiers, non tranché.

- 2026-10-04 · A7 bis partie 1 · recouvrement au-delà de ce qui reste en attente plafonné sans être nommé ; désignation retirée après une liquidation figée, TVA figée sans mention ; `ouvertDeLaLigne` ignore les paiements de N+1 portés sur l'à-nouveau ; recouvrement annulé après liquidation non nommé ; facture au compte collectif contre créance au compte individuel refusée sans issue ; chaîne de reports N, N+1, N+2 avec un groupe partagé · taxe en attente SANS être nommée ; maillon d'audit manqué · reconstitution incertaine tue ; dans un groupe à plusieurs factures, la TVA attend le solde du groupe (règle de `main`, gardée ; levée par la ligne TVA 24-26 pour les factures de même composition, F1, le reste nommé dans la déclaration).

- 2026-10-03 · second tour d'A7 ter, aux relevés sans code · (m-e) les inscriptions en négatif à somme nulle (une perte annulée et son négatif, quand le groupe figé reste en place) restent OUVERTES au 416 et se reportent en mode Détail à chaque clôture, sans effet sur le solde · un lettrage du module qui les réunirait est à décider ; (m-f) une cotisation APPELÉE sous la méthode de l'APPEL, reclassée, est refusée dès que la méthode du dossier devient ENCAISSEMENT (`Tenant.methodeCotisations` sans historique, la méthode du jour est lue) · à trancher (garder la méthode au reclassement, ou un historique daté) ; CE QUE LE CORPUS NE TRANCHE PAS · le recouvrement en N+1 d'une créance passée en perte en N (aucun geste du module, le compte du rentré reste à lire et à trancher) ; le 413 comme compte d'origine d'une créance douteuse au SYCEBNL (admis aujourd'hui, à confirmer au texte) ; ENFIN, relevé par la ligne · la correction par inscription en négatif d'une écriture ORDINAIRE dont une ligne est lettrée dans un groupe FIGÉ, exercice encore ouvert · l'art. 20, al. 2 la rend due dans l'exercice, OmegaX la refuse sur une ligne lettrée et aucun geste ne délettre une ligne figée (le module des créances douteuses l'inscrit à côté de son groupe figé, raisonnement de B2b) · le message le dit (`ISSUE_LETTRAGE_FIGE`), le geste reste à décider
- 2026-10-03 · troisième passage d'A7 ter, aux relevés sans code · (m1) « Lettrer au 416 » annonce le montant « à apporter par l'à-nouveau » sans dire pourquoi aucune ligne ne le porte dans deux cas · l'à-nouveau du 416 est déjà dans un groupe PARTIEL figé (il n'est plus ouvert, l'écran conseille alors à tort de clôturer l'exercice précédent ou de passer le bilan d'ouverture), ou le 416 est reporté en mode SOLDE (une ligne d'à-nouveau pour toutes les créances du compte, d'un autre montant) · le motif de chacun est à servir, rien n'est posé de travers (le groupe se pose soldé ou pas du tout) ; LA TVA DU MOTEUR D'AVANT A7, défaut (1) de la ligne A7 bis, confirmé par la relecture · une prestation non lettrée est datée à la facture, si bien que le lettrage avec le reclassement ne rendait pas la TVA exigible, il la REDATAIT au reclassement, déclarée deux fois si le mois de la facture était liquidé · la règle d'A7 tient ; OBSERVÉ EN N+1 · le lettrage automatique apparie l'à-nouveau de la facture reclassée et celui du reclassement (l'à-nouveau ne porte aucune liaison avec la créance), sans effet sur la TVA de N (relue inchangée sur base réelle) et sans enfermer la créance (l'annulation du reclassement d'un exercice clos est refusée de toute façon) · à décider s'il doit être écarté comme en N
- 2026-10-03 · mineurs du second tour d'A8 (aucun BLOQUANT) · (1) arriérés non nuls ou vides sans élément du mois · le client laisse cliquer, le serveur refuse en 400 nommé, l'Aide dit l'inverse ; (2) calcul seul avec ancienneté vide · message brut de validation au lieu du motif nommé ; (3) succès d'émission jeté si le salarié ou le mois change pendant l'envoi (rien de faussé, second essai refusé « déjà émis ») ; (4) avantages du préavis et jusqu'au terme remplis ensemble · ventilation sur le seul préavis ; (5) deux `as` qui reposent sur un invariant ; (6) un test de source gèle une absence de mot ; (7) un décompte portant des allocations familiales s'émet avec avertissement, mais arrête la passation de tout le mois · compte des allocations à trancher (aucune fiche du compte 66 ne le nomme).
- 2026-10-03 · mineurs de la relecture TypeScript d'A7 (second et dernier tour, aucun BLOQUANT) · (1) DTO des créances douteuses, `compte416Id`, `compte491Id`, `comptePerteId`, `motif`, `pieces` sous `@IsOptional()` seul, `null` lu comme absence par le service (sans effet faux) · `@FacultatifNonNul` ou commentaire ; (2) verrou du dossier à échéance de quinze minutes, même mécanique qu'A5 ; (3) deux `delete` par identifiant après un `findFirst` borné, à écrire `deleteMany` avec `tenantId` pour la symétrie ; (4) refus D3 d'A6 lu avant la transaction de clôture, écrit en commentaire.
- 2026-10-03 · mineurs du second tour d'A11 (aucun BLOQUANT) · (1) une correction manuelle au crédit du 891, hors clôture et sans négatif, laisse `impotConstateAu89` sur les seuls débits · lire le solde des 891, 892, 895 (899 exclu) ; (2) la branche « constat en place » de `etat` échoue si `resultatFiscal` lève · entourer et rendre `impotRecalcule: null` avec motif, pour garder le constat visible et annulable ; (3) réintégration saisie avant l'écriture · dire l'ordre (retirer, passer, valider, remettre) ; (4) passage réservé au comptable au serveur à l'intégration (`@ReserveAuComptable`, comme A7). CORPUS MUET · aucun texte ne nomme le compte du minimum de l'art. 57 (895 retenu, loi n° 23/053 art. 42 al. 2, 2°, 45 et 150) ; sort fiscal d'un dégrèvement d'IS au 899 (art. 45 a contrario) ; exercice ouvert avant le 1er janvier 2026 et clos après · A11 le refuse, la lecture F12 du dégressif l'admet, l'art. 153 se tait ; IS congolais sur activité hors RDC attribuée par convention (8911, 8912 ou 8913) ; acomptes au 441 (Guide, Application 8) contre 4492 (OmegaX).
- 2026-10-03 · mineurs du second tour d'A13 · (1) le dernier rapprochement clos est pris par `max(dateReleve)`, pas par `clotureAt`, et rien n'impose une date de relevé croissante à l'ouverture ; (2) un à-nouveau provisoire périmé ou sans le brouillard de N-1 fausse le solde lu · piste, message « relancez les à-nouveaux provisoires » ; (3) le journal d'à-nouveau définitif compte comme journal écrit · une ligne de bulle Aide ; (4) l'avertissement bancaire part dès le lendemain de la clôture, voulu. CORPUS MUET · date exacte du relevé « à la clôture » (la fiche du 52 dit « périodiquement ») ; définition des « périodes » de l'art. 22, 3° (lecture la plus large, trois mois) ; une clôture posée en retard n'est pas signalée (état présent) ; trou du 526 (fiche · 5261 monnaie locale, 5265 devises ; semis · 5261 et 5267 intérêts courus). DÉFAUT DE PRODUCTION vu en passant · `DevisesService.extourner` contre-passait aussi les écarts des disponibilités (art. 57, réalisés) · ligne A5 bis, en correction.
- 2026-10-03 · mineurs du second tour d'A10 · (1) la comparaison en devise d'une caisse est rarement atteinte au-delà de la première année · le report SOLDE pose une ligne en francs sans devise, et les négatifs d'une réévaluation annulée ne sont pas reliés à ses écarts (`ReevalEcarts`) · la caisse tombe en francs au cours historique AVEC la mention, jamais faux en silence ; (2) migration renumérotée 20270123000000 à l'intégration, après celle d'A11 déjà poussée. CORPUS MUET · monnaie de comparaison d'une caisse en devises (fiche du compte 57, « la somme disponible réellement » ; Titre VIII ch. 22 section 4 ne régit que la conversion) ; anomalie de renvoi · la section 4 rattache la conversion à « l'article 58 », qui porte sur la position globale de change.
- 2026-10-03 · mineurs du second tour d'A9 (aucun BLOQUANT) · (1) CDD en période d'essai · « déclarez le départ à mi-préavis » renvoie à un geste que `motifRefusDecompte` refuse (un prédicat partagé · licenciement, initiative de l'employeur, CDI ou essai) ; (2) la réserve propre à la somme de l'art. 66 n'est jamais figée sur le document (`reservesDecompteEmis`), l'Aide de l'émission le dit à tort ; (3) `mentionDureeRetenue` invoque le plancher de l'art. 64 pour un délégué (art. 258) ou un essai (art. 71) ; (4) départ à mi-préavis avec zéro jour restant accepté · renvoyer à « Presté » ; (5) l'écran exige une ventilation des avantages quand aucun préavis n'est dû (faute lourde, commun accord, CDD hors essai) · masquer, dire « aucun préavis n'est dû » ; (6) art. 70 · un champ masqué reste additionné (déjà sous A8) ; (7) décimales au point (« 17.5 jours ») ; (8) Aide des allocations familiales plus affirmative que le serveur ; (9) `calculerDecompte` sans jeton, calcul affiché périmé possible (déjà sous A8). À REMONTER À MANASSE (Code du travail lu · art. 7 points 8 et 9, 63 à 68, 138, 141, 142, 144) · T2 départ avant la moitié d'un préavis reçu, trois lectures (a, retenue · seuls les jours d'avant la moitié ; b · tous les jours non observés ; c · l'art. 66 reste acquis diminué de la faute), saut de 15 jours entre un départ au jour 13 et au jour 14 ; T3 avantages en nature du temps restant, fournis ou payés ; T4 date de fin du contrat sous l'art. 66 (logement art. 138, mois de cessation, mois de service du congé). Lecture protectrice retenue sans texte exprès · le « délai moindre » de l'art. 67 se lit contre la moitié de l'art. 66 (P5).
- FERMÉ par la décision D1 du 2026-10-03 (réévaluation à la date de clôture
  seulement, AUDCIF art. 54 ; les réévaluations déjà passées ailleurs sont
  signalées). Relevé par la seconde relecture d'A6 (2026-10-03), défaut
  antérieur d'A5 · une réévaluation des devises datée AVANT la fin de
  l'exercice, suivie d'un dénouement postérieur dans le même exercice · la
  position réévaluée se dénoue après elle, et rien ne reprend son 478 ou 479
  ni sa provision avant la clôture (une seule réévaluation par exercice).
  A6 L'AGGRAVE (troisième relecture) · le réalisé est passé au 656 ou au 676
  contre le coût historique pendant que le 478 et sa provision restent en
  place · la même perte est comptée deux fois dans l'exercice. Depuis la
  quatrième relecture, quelle que soit la date de la réévaluation, le
  règlement en devise refuse (409) une facture choisie qu'elle a lue dans une
  devise dont la position et l'écart reconstitués sont non nuls, et l'écart
  proposé refuse (409) quand le compte reconstitué à sa date concorde avec le
  groupe lu ; cela borne le défaut sans le corriger, la sortie attend la
  décision de Manasse sur le retrait d'une réévaluation.

  textes, ni proposée ni virée au 29x définitif à la mise en service, faute de
  texte.

- Prix global avec fonds de commerce · l'écran vise toujours le 21500000,
  alors que le serveur ne crée le fonds que s'il reste un reliquat.
- Guide SYSCOHADA Partie 1 ch. 5 · 787 à côté du 72 pour les intérêts
  immobilisés, contre l'AUDCIF (fiches 67 et 78) · le module suit l'AUDCIF.
- Hors plan · bailleur, sous-location, cession-bail, concessions et PPP,
  première application du SYSCOHADA révisé, groupe d'actifs, cession
  partielle de titres.
- Pour A3 (lot 14), lu le 2026-10-02 · séminaire CPCC « Arrêté des comptes
  2024 », Jour 2, réévaluation des immobilisations (compétence
  `audcif-acte-uniforme`, `pratique-redressements-comptes-patrimoine-cpcc.md`,
  § II). Un TÉMOIN, pas une source · il propose la méthode indiciaire (VBR =
  VO × coefficient, ER = CV moins CA), la contrepartie au 106 dans son
  schéma général puis au 154 dans son cas chiffré, et la reprise du 154 au
  861 à hauteur du supplément d'amortissement. Deux points à ne pas
  reprendre tels quels · (1) les « innovations de la loi de finances 2023 »
  qu'il cite (déclaration avant le 30 avril, astreinte de 100 000 CDF par
  jour) sont celles de l'O.-L. n° 89/017, abrogée au 1er janvier 2026 (loi
  n° 23/053, art. 136 et 138 · au plus tard le 30 avril, 300 000 FC par
  jour) ; (2) le cumul « amorti avant réévaluation » de
  l'imprimante (308 969,10) ne rejoint pas celui du fichier n° 3
  (299 970,00). Les sommes des deux écritures (15 697 000,00 et
  7 855 950,86) se vérifient. Numéros de compte à sept chiffres de cabinet,
  à relire au plan. AUDCIF Titre VIII ch. 28 à lire avant tout code.

- 2026-10-02 · D1, D2 et D3 réglées selon la proposition écrite (Manasse ·
  « exécuter tout ») · D1, encadré « Coûts d'emprunt incorporés de
  l'exercice » aux Notes annexes des deux référentiels, en lecture seule
  (`CoutsEmpruntEnNote`, `lib/couts-emprunt-en-note.ts`), ce qui fait aussi
  A2 ; D2, « Réglé par » devenu « Contrepartie » ; D3, fonds de projet en
  sommeil refusé au serveur. À vérifier en production avant de passer en
  « Fait ».
- 2026-10-02 · séminaires du CPCC confrontés à OmegaX · dix-sept manques et un écart à trancher, au relevé `docs/releve-seminaires-cpcc-2026-10-02.md` (hors liste tant que Manasse ne les y met pas) ; les deux défauts du lot 14 (réévaluations successives) sont corrigés dans le lot.
