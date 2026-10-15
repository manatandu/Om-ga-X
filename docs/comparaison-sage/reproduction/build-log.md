# Journal de construction

Une entrée par fonction, ajoutée quand elle est finie ou laissée partielle :
numéro, date, ligne de travail, fait ou partiel, ce qui manque, ce qui a été
plus dur que prévu. Une fonction plus grosse qu'elle ne paraissait se dit
ici et à Manasse, jamais livrée à moitié sans le dire.

| # | Date | Ligne | État | Ce qui manque | Plus dur que prévu |
|---|---|---|---|---|---|
| 67 | 2026-10-14 | L4 | fait | rien au périmètre | les dépendances entre actes d'un même bien (qui a lu quoi) ; le contrôle 15 bis qui disait « hors module » l'origine annulée, vu sur vraie base seulement |
| 66 | 2026-10-14 | L4 | fait | la correction d'une valeur d'acquisition déjà validée (question posée) | ne réécrire aucun contrôle de la création, d'où `preparerFiche` ; la pièce du brouillard retouchée en place sans trou ni double acquisition |
| 68 | 2026-10-14 | L4 | fait | un bien réparti sur plusieurs lignes (une ligne, une fiche · corriger la pièce) | le lien d'acquisition était unique ; distinguer une acquisition d'une correction, d'un reclassement ou d'une ouverture saisie à la main |
| 73 | 2026-10-14 | L4 | partiel | la fusion des fiches d'un autre dossier du groupe (comptes de liaison, question posée) | lire un écart sans en fabriquer (dotation non passée, bien sorti, reclassement postérieur) |
| 18 | 2026-10-14 | L4 | partiel | compte, journal et règlement (lignes L1 et L2) ; les cas particuliers restent au formulaire complet | ne rien dupliquer du formulaire, d'où le corps sorti dans `lib/assistant-bien.ts` |
| 79 | 2026-10-14 | L5 | fait | rien au périmètre ; un mois avec un jour hors service (question posée) | l'allocation remplace le salaire des jours de congé dans les deux ordres de saisie, bulletin émis compris |
| 78 | 2026-10-14 | L5 | partiel | feuilles de temps et compteurs libres d'heures (aucun texte) ; la maternité payée par la Caisse sans subrogation (question posée) | trois traitements de l'indemnité de la Caisse, chacun son texte ; la maladie ordinaire n'en ouvre aucune |
| 75 | 2026-10-14 | L5 | fait | rien au périmètre | une ligne d'ordre paie un tiers OU un salarié ; le 422 lu après la clôture sans l'ouverture des exercices suivants |
| 88 | 2026-10-14 | L5 | fait | le pointage des heures par section (voir 78) | la reprise en négatif d'une pièce rejouée se ventile comme l'origine, jamais au prorata |
| 85 | 2026-10-14 | L5 | fait | la tenue des réponses d'un mois à l'autre (question posée) | n'écrire que les champs qui existent, par leurs routes |
| 12 | 2026-10-14 | L1 | fait | rien au périmètre | une centaine de lectures du brouillard relues une à une ; le brouillard hérité qui enfermait le dossier, sorti par le transfert dans un journal ordinaire |
| 11 | 2026-10-14 | L1 | fait | rien au périmètre | l'équilibre reste toujours montré, totaux masqués ou non |
| 60 | 2026-10-14 | L1 | fait | rien au périmètre | une écriture validée après l'impression rend son jour non imprimé |
| 16 | 2026-10-14 | L1 | fait | rien au périmètre | une lettre déjà employée sur le compte, groupes et lignes reprises comprises |
| 14 | 2026-10-14 | L1 | fait | qui peut créer le compte en saisie (question posée) | jamais hors plan ni sous un collectif de tiers |
| 18 | 2026-10-14 | L1 | partiel | le règlement guidé (ligne L2) | compte et journal par étapes sur les mêmes routes, création enchaînée |
| 19 | 2026-10-14 | L1 | fait | les rubriques de paie par séquence (question posée) | lecture de P_SEQUENCE (paie) transposée aux modèles de saisie |
| 1 | 2026-10-15 | L2 | fait | le mode ne suit pas encore le report à-nouveau au détail ; monnaie électronique, prélèvement et effet de commerce face à l'art. 59 bis (question posée) | la modification au brouillard remplace les lignes · le mode devait être rendu au client pour ne pas s'effacer |
| 3 | 2026-10-15 | L2 | fait | une ligne en devise ne se découpe pas d'elle-même (dit à l'écran) | le découpage en échéances passait une facture sous le seuil de l'art. 59 bis · la transaction se relit sur la pièce ; la réponse d'une seconde ligne écrasait la fenêtre de la première · une file, une fenêtre par ligne |
| 18 | 2026-10-15 | L2 | fait (part règlement, la fonction est complète avec L1 et L4) | un tiers à la fois, en francs · devise, parts, escompte, écart et lots au formulaire | rien |
| 24 | 2026-10-15 | L2 | fait | la qualité n'est pas reprise sur les lettres de relance | rien |
| 31 | 2026-10-15 | L2 | fait | aucun document ne lit encore le lieu (la gestion commerciale le reprendra) | le bouton « Mettre en sommeil » du lieu se confondait avec celui du tiers · boutons nommés par lieu ; la fusion de deux clients sous le verrou de leurs lieux |
| 32 | 2026-10-15 | L2 | fait | rien | rien |
| 27 | 2026-10-15 | L2 | fait | l'avis de règlement ne part pas en courriel, et rien pour un règlement sans ordre de virement | un appel de forme `composer(…});` gelé par un test de structure · la lettre composée d'abord, habillée ensuite |
| 36 | 2026-10-15 | L2 | fait | ni escompte ni écart sur un règlement en devise ou à parts désignées (refus nommés) ; l'écart en produit de Sage n'est pas repris (art. 252) | la part de taxe de l'escompte reste en attente sous l'encaissement, dite plutôt que régularisée |
