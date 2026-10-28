# Suivi des reprises · notes gardées hors des lignes

Notes tenues jusqu'au 2026-10-14 dans la fiche d'avancement de la ligne
virement de fonds (`AVANCEMENT-virement-fonds.md`), retirée à son intégration.
Elles ne concernent pas cette ligne : sujets à reprendre, décisions de Manasse
et travaux à sa charge. Recopiées telles quelles pour que rien ne se perde.

## Relevés en attente · essais de parité des lignes sage-l1, l4, l5 (2026-10-15)

- B-PAR-01 (S3, pas BLOQUANT) · deux lettrages envoyés en même temps sur un
  même compte, même lettre choisie ou lettre proposée · le second rend une
  500 au lieu du refus nommé « Trop de lettrages effectués au même instant
  sur ce compte · veuillez réessayer. ». La contrainte unique (compteId,
  code) tient la base juste ; le garde sérialisable
  (`common/prisma-retry.util.ts`) ne reconnaît que P2034, pas la P2002 du
  heurt sur la lettre. Antérieur à la ligne sage-l1. Correction proposée et
  reproduction · `docs/comparaison-sage/reproduction/bugs.md`.

## Questions à Manasse · saisie, ligne sage-l1

Aucune ne bloque · le corpus ne régit aucun de ces choix, d'organisation ou
de produit.

- #19 · Sage range aussi les RUBRIQUES DE PAIE par séquence (P_SEQUENCE est
  une page de la Paie). Les ranger de même dans OmegaX, sur les mêmes
  séquences que les modèles de saisie ou sur des séquences propres à la paie ?
- #12 · Sage peut inclure les journaux de situation dans une balance ou un
  grand livre de SIMULATION. OmegaX les tient hors de tout livre et état ;
  elles se lisent dans leur journal. Faut-il une balance de simulation à
  part, dite sans valeur légale (comme le second jeu en monnaie
  fonctionnelle) ?
- #14 · sous l'option, le comptable et l'aide-comptable (par héritage)
  créent le compte en saisie, alors que « Nouveau compte » au Plan comptable
  reste à l'administrateur, qui délègue en ouvrant l'option. Réserver le
  geste au comptable (`@ReserveAuComptable()`), ou à l'administrateur seul ?

## Questions à Manasse · tiers et règlements, ligne sage-l2

- #1 · MONNAIE ÉLECTRONIQUE, PRÉLÈVEMENT ET EFFET DE COMMERCE face à
  l'art. 59 bis de l'O.-L. n° 10/001 (créé par l'O.-L. n° 13/007 du
  23 février 2013, compilation DGI au 19/07/2026) · « Toute transaction
  entre assujettis à la taxe sur la valeur ajoutée d'un montant d'au moins
  1.000.000,00 de Francs congolais doit être payée par chèque, par virement
  ou par carte bancaire » ; l'art. 74 bis sanctionne le manquement par « la
  perte du droit à déduction de la taxe sur la valeur ajoutée supportée ».
  Lu · la liste du texte nomme ces trois moyens et eux seuls ; l'alinéa 2
  ne délègue au Ministre que le MONTANT, et aucun arrêté d'application lu
  n'assimile un autre moyen. Le corpus est muet sur les trois autres modes.
  OmegaX avertit les espèces sans réserve et ces trois modes SOUS RÉSERVE
  (jamais un refus). Faut-il les tenir pour admis (il suffit d'ajouter leur
  nature à `NATURES_ADMISES_ART_59_BIS`), ou garder la réserve ?

## Relevés en attente · tiers et règlements, ligne sage-l2

- L'avis de règlement ne part pas par courriel, et aucun avis n'est servi
  pour un règlement sans ordre de virement (chèque, espèces) · il habille
  aujourd'hui l'ordre de virement imprimé seulement.
- Le mode de règlement ne suit pas encore le report à-nouveau au détail ;
  une ligne en devise ne se découpe pas d'elle-même en échéances (dit à
  l'écran) ; ni escompte ni écart sur un règlement en devise ou à parts
  désignées (refus nommés) ; la qualité du tiers n'est pas reprise sur les
  lettres de relance ; aucun document ne lit encore le lieu de livraison.

## Relevés en attente · paie, ligne sage-l5 (second tour non bloquant)

- Congé À CHEVAL qui porte des jours de voyage (Code du travail, art. 141,
  al. 3) · aucune date ne dit le mois de ces jours ; la proposition
  s'abstient et la garde n'oppose que le certain. La règle de placement
  reste à trancher.
- Reconstitution d'une reprise rejouée (M3) par les répartitions des
  salariés de la pièce d'origine · elle refuse quand la pièce ne se refait
  pas au centime ; cas limites (répartition déclarée après coup, salarié
  sorti du plan) à relire.

### Questions à Manasse (ligne sage-l5)

- Q1 · un jour hors service rend-il le mois non entier ? L'art. 141, al. 2
  énumère les services pris en considération. Lecture retenue, littérale ·
  un mois qui contient un jour de mise à pied ou d'absence non rémunérée
  n'acquiert rien, nommé à l'écran avec le jour en cause. Le texte ne dit
  pas s'il faut plutôt compter les jours et les convertir.
- Q2 · CLOSE, TRANCHÉE PAR LA LOI LE 2026-10-25, aucun code · la maternité,
  Caisse qui paie la salariée sans subrogation. Code du travail, art. 130,
  al. 2 (« la femme salariée a droit aux deux tiers de sa rémunération ») et
  art. 59 (l'obligation de l'art. 130 survit à la suspension), art. 131
  (« Toute convention contraire aux dispositions des articles 129 et 130
  ci-dessus est nulle de plein droit ») ; loi n° 16/009, art. 48, et arrêté
  n° 146/2018, art. 63 (l'indemnité de la Caisse, « intégralité de la
  rémunération journalière moyenne ») et art. 139, al. 2 et 3 (subrogation de
  plein droit de l'employeur en règle, totale s'il paie toute la
  rémunération, « à la limite de la partie versée » s'il n'en paie qu'une
  partie). Sans subrogation, l'employeur doit les deux tiers et ne déduit
  rien · aucun texte n'autorise l'imputation (l'art. 106, al. 2 ne vise que
  l'accident du travail), et une règle de protection ne se tranche pas
  contre celle qu'elle protège (CLAUDE.md, P5). C'est ce que fait déjà
  `personnel/absences.ts` (régime des deux tiers, déduction réservée à
  `DEDUITE` sur l'accident du travail, subrogation partielle bornée à la
  partie versée) ; aucun message ni aucune bulle ne disait la question
  ouverte.
- Q3 · nature de l'employeur pour l'INPP, régime de la retenue, classe et
  personnes à charge se ressaisissent chaque mois (champs de la simulation,
  figés par le bulletin émis). Les garder au dossier et au salarié pour
  qu'ils se proposent d'un mois à l'autre ? Choix d'organisation.

## Relevés en attente · immobilisations, ligne sage-l4 (second tour non bloquant)

- Renumérotation refusée pour TOUTE campagne d'inventaire non clôturée, de
  stocks ou de caisses comprise · ne compter que les campagnes dont une
  fiche porte un bien (`maintenance-immobilisations.service.ts`).
- SYCEBNL · une mise en service passée à la main (D 21x / C 219 ou 229) est
  refusée par la liste n° 68 avec une issue qui ne s'y applique pas ·
  écarter de `creditsQuiSortentUnBien` les en-cours de la même division.
- Un bien REPRIS saisi avant la clôture de N, faux ou en double, ne se
  corrige plus (M4) · à joindre à la question « Corriger l'entrée » posée à
  Manasse (retrait motivé du registre ou correction à partir de N+1).
- Une fiche née d'un renouvellement ne se supprime plus, et aucun geste
  n'annule un renouvellement passé par erreur, même au brouillard.
- Lectures bornées sans effet en pratique · `take: 500` sur les maillons de
  clôture (`exerciceClosQuiPorteLaFiche`), `take: 2000` sur les négatifs de
  `negatifsAilleurs`.
- M4, deux réserves · (a) le repère est la clôture dans OmegaX, pas l'arrêté
  des comptes (AUDCIF art. 23) ; (b) une clôture sans maillon d'audit est
  tenue pour antérieure au journal · repère plus sûr, la date de création
  des écritures que la clôture pose.
- Hors ligne, défaut antérieur · la NOTE 1 des deux SMT et le tableau des
  amortissements lisent les fiches sans borne sur leur création · une fiche
  saisie après la clôture de N, datée dans N, change leur réimpression ; ne
  lire que les fiches qui existaient à la clôture.
- Questions de la ligne pour Manasse (fiche de la ligne) · « Corriger
  l'entrée » d'une valeur d'acquisition validée ; retrait d'une fiche née
  d'une écriture déjà passée (lecture de D7).
- N° 73 · TRANCHÉ PAR LA LOI LE 2026-10-25, construit (SYSCOHADA) · le
  transfert d'un bien entre le siège et une cellule passe par les comptes
  permanents de liaison 184 et 185 (AUDCIF, Titre VII, fiche du compte 18 ·
  « égaux et de sens contraire dans les deux comptabilités », opérations
  « traitées comme s'il s'agissait d'un tiers », mêmes pièces, même
  période), à sa valeur d'entrée avec ses amortissements et ses
  dépréciations, plan inchangé, sans 81 ni 82 (AUDCIF art. 35 et 36) ;
  « comme un tiers » régit la tenue du compte de liaison, jamais la valeur.
  Deux pièces nées ensemble ; annulation motivée des deux côtés (art. 20,
  al. 2) ; neutralisé au tableau des flux (Titre IX ch. 5 § 1.3, aucune
  trésorerie). Lecture d'OmegaX à confirmer · à la NOTE 3A, l'entrée se lit
  en « Acquisitions, apports, créations » chez celui qui reçoit et en
  « Cessions, scissions, hors service » chez celui qui cède (le 184 porte
  la dotation de l'établissement, un apport) ; rien n'est reclassé en
  virement de poste à poste.
- N° 73, limites écrites · deux cellules ne se transfèrent pas un bien
  directement (fiche du compte 18, siège et établissement), refusé avec
  l'issue (deux transferts par le siège) ; bien réévalué, à dérogatoire, en
  cours, composant ou principal à composants, à subvention non soldée, à
  dette aléatoire, à démantèlement, en location-acquisition, aux unités
  d'œuvre déprécié · refus nommés, non servis ; le numéro d'inventaire déjà
  pris chez celui qui reçoit n'est pas repris (fiche sans numéro, que la
  maintenance du registre nomme).

### Question à Manasse (ligne sage-l4, n° 73, SYCEBNL)

- Le transfert d'un bien entre deux dossiers d'un groupe SYCEBNL est REFUSÉ
  et ce refus est gelé par un test (`transfert-groupe.spec.ts`). Lu · la
  fiche du compte 58 du SYCEBNL (Partie 2 ch. 3) ne fait passer par le 58 que
  la trésorerie (« par le crédit : des comptes de trésorerie », le 585
  « Virements de fonds », le 588 « Autres virements internes »), et le
  compte 18 du SYCEBNL porte des emprunts (son 185 est « Dépôts et
  cautionnements reçus ») ;
  aucun texte lu n'y fait passer un bien. TRANCHÉ PAR LA LOI (2026-10-25,
  relu par la session) · la fiche SYCEBNL du compte 58 dit son contenu,
  « les mouvements de virement entre les comptes de trésorerie », le fait
  fonctionner « par le crédit » et « par le débit » des seuls « comptes de
  trésorerie », et exige qu'il soit « soldé à la fin de l'exercice » · un
  bien passé par le 588 n'est pas un virement de trésorerie et laisserait
  le 588 de chaque dossier ouvert à la clôture. Voie (a) retenue, le refus
  reste ; la voie (b) irait contre la lettre de la fiche et n'est pas
  servie.
- Relevé de la ligne · la création admet une valeur résiduelle supérieure à
  la valeur d'origine · la borner dans `preparerFiche`.
- Question ouverte (2026-10-28) · NOTE 3A du SYSCOHADA, le transfert d'un
  bien entre établissements paraît en « Acquisitions » chez celui qui reçoit
  et en « Cessions » chez celui qui cède. Lu · le ch. 6 du Titre IX ne
  définit pas ses colonnes, la fiche du compte 18 ne parle pas du tableau des
  immobilisations ; aucun texte ne range ce mouvement en « Virements de
  poste à poste ». Écart écrit en tête de `correspondance-notes-syscohada-1.ts`
  (anomalie n° 9) ; le porter aux virements serait une lecture d'OmegaX.

## Relevés en attente · virement de fonds (second tour non bloquant)

- Un groupe de lettrage FIGÉ qui ne réunit que les lignes 585 d'un même
  virement bloque son annulation ; le tolérer (`groupeTolere`, comme A7 ter
  B2b) reste à faire.
- Rejouer `motifRefusCompteDeTresorerie` dans `motifRefusVirement` (un journal
  plus ancien que la règle, porté sur un 585, un 588, un 56 ou un 51, passe un
  virement).
- Typage · `JournalDeTresorerie.type` en `TypeJournal`, résultat discriminé au
  lieu des assertions non nulles.
- Numérotation des négatifs sous lecture validée (max + 1 sans index unique) ·
  défaut hérité, commun à `constat-impot`, `devises` et `creances-douteuses`.
- Écran · rendre le focus au bouton qui a ouvert la modale (commun à toutes les
  modales du dépôt) ; le client n'a ni ESLint ni règles des hooks.
- Ligne virement-pieces, second tour (2026-10-16) · l'ARRÊT À LA DISSOLUTION
  (`arret-dissolution.ts`) fait passer à l'exercice de liquidation une entrée
  datée après la dissolution, la sortie et la fiche `VirementFonds` restant
  dans l'exercice arrêté · le 585 de l'exercice arrêté reste ouvert. L'arrêt
  doit nommer et refuser un tel virement, issue « annulez-le, puis
  repassez-le » de part et d'autre de la dissolution. Autre module, hors de
  la ligne.
- Même tour · le focus va au bandeau d'erreur, jamais au champ en faute ; un
  virement au-delà des 500 de la liste n'est nommé que par sa référence dans
  le bandeau « Scan non joint ».
- Même tour, relecture TypeScript (six MINEURS, aucun BLOQUANT) ·
  (1) `virement-fonds.ts` · les assertions `pieceJugee(...)!` reposent sur
  une boucle qui recopie les mêmes conditions ; les garder une seule fois,
  sans `!`, sans quoi une borne changée d'un côté rend un 500 ; (2) la règle
  suppose un objet (`Object.keys(piece)`) · une pièce nulle venue d'un autre
  chemin que la porte rendrait un 500, à refuser par le message de la porte ;
  (3) un caractère nul dans une référence (comme déjà dans l'objet) passe la
  règle puis tombe en base (500 et rien d'écrit) · refuser les caractères de
  contrôle en nommant l'opération ; (4) import mort de `NaturePieceVirement`
  dans le service ; (5) casts `as PieceRecue` superflus, qui masqueraient une
  divergence future des deux types ; (6) `LIBELLES_OPERATION` exporté sans
  lecteur, et le commentaire « jamais ignorée en silence » inexact pour
  `constructor` et `__proto__`, que class-transformer retire sans rien dire.

## Reprise après la réinitialisation (2026-10-09, demande de Manasse)

État au 2026-10-14 · le point 1 est fait (`docs/comparaison-sage/`, quatorze
manuels, tri de Manasse du même jour) ; le point 3 aussi (ligne intégrée sur
`main`) ; restent le point 2 (plan comptable façon Sage) et le point 4
(clôture).

Ordre voulu, dans cette ligne et sans rien coder avant l'étape 1 :

1. COMPARAISON SAGE COMPLÈTE, avant tout code. Lire en entier TOUS les manuels
   Sage du Drive (guide Comptabilité i7 id 1p0AZjvBs7LCkvbev2m0Y2TZX6UhO1ixY,
   EDM id 1AE7nAaoL09lXvIQQHhue_Sh0bFvfnIAk, SAARI id
   1EV0hSoCgA0YaXVBwSf8PzlitmdJTTgj8, structure des fichiers, Moyens de
   paiement, Immobilisations, Édition pilotée, Paie ; le manuel de 62 Mo est
   illisible, demander à Manasse de le scinder). Tableau d'UNE LIGNE PAR
   FONCTION de Sage, y compris celles que Manasse n'a jamais citées : présent
   et fidèle, présent mais différent (écart voulu ou oublié), absent (raison),
   non vérifiable. Page du manuel citée à chaque ligne. Fichier de suivi
   committé à chaque manuel fini. Manasse trie la liste ; le gel tient, chaque
   absent retenu demande une levée expresse. Cause : la comparaison existante
   (docs/comparaison-sage-i7-omegax.md) notait « Plan comptable » OUI sans
   comparer la fiche de compte champ par champ.
2. PLAN COMPTABLE FAÇON SAGE (guide i7, section Plan comptable général) :
   fiche « Nouveau compte » (numéro, intitulé, type Détail ou Total, abrégé,
   nature, report à-nouveau, code taxe, options de traitement, sommeil),
   bouton toujours visible même sur écran étroit (barre d'outils sans retour à
   la ligne, PlanComptesPage.tsx l. 323), retrait du filtre « Comptes
   personnalisés seulement » qui garde tous les TOTAL (l. 194) et n'existe pas
   chez Sage ; « Gérer » conservé (il existe chez Sage). Vérifier pourquoi le
   bouton manque à l'administrateur de l'éditeur (estAdmin = role ADMIN_CABINET,
   auth.tsx l. 248). La règle « seuls les comptes personnalisés se saisissent »
   n'est pas de Sage : la garder telle quelle, à montrer à Manasse avant de
   fusionner.
3. VIREMENT DE FONDS : relire (silent-failure-hunter, typescript-reviewer,
   react-reviewer, deux tours), bloc § 3 des deux côtés, fusion sur main,
   déploiement vérifié, retrait de cette fiche et de la branche de sauvegarde.
4. CLÔTURE (tâche 21) : plan, consignes, CLAUDE.md, rapport final.

Modèle et effort : celui de la session, effort moyen, relecture finale plus
haut ; un agent à la fois.

À la charge de Manasse (hors session) : supprimer les branches travail/*
intégrées, dossiers pilotes, messagerie, relevés de sécurité, secrets de
télémétrie (dont le refus de conserver l'adresse IP).

## Ajouts du 2026-10-09 (soir), à traiter à la reprise

- MESSAGERIE : DÉJÀ POSÉE ET EN SERVICE (fenêtre « Courriers sortants » :
  « Messagerie posée · le courrier part sous l'adresse [de l'éditeur] »,
  avis de double authentification ENVOYÉ et reçu). Les secrets API_SMTP_*,
  API_COURRIER_EXPEDITEUR, télémétrie existent depuis deux jours. NE RIEN
  ÉCRASER. Le mot de passe d'application Gmail demandé à Manasse ne sert pas.
- À VÉRIFIER DANS LE CODE (docs/plan-site-et-courrier-2026-10-05.md § 3 et § 4) :
  courriel d'un cabinet à SES clients · nom du cabinet affiché, « Répondre à »
  du cabinet, envoi refusé sans adresse de réponse ; écran « Courrier » des
  cabinets (n'existe pas).
- À CONSTRUIRE (demande de Manasse, levée du gel à demander expressément, une
  phrase par fonction) : (1) FORMULAIRE DE DEMANDE sur la vitrine, relié à la
  messagerie (plan du site, étape 3) ; (2) question posée : débloquer
  l'abonnement AUTOMATIQUEMENT après un paiement (plan, étape 5). Aujourd'hui
  la licence suit l'encaissement DÉCLARÉ à la main
  (PlateformeService.echeanceAbonnement). L'automatisation suppose un
  prestataire de paiement qui appelle le serveur (webhook) : signature
  vérifiée, paiement jamais compté deux fois, montant et monnaie confrontés à
  la facture, journal d'audit. À étudier avec Manasse (choix du prestataire :
  décision commerciale, non régie par un texte).
- Parcours client actuel : inscription publique fermée, dossier créé par l'éditeur
  depuis la console, mot de passe provisoire tiré au sort par le serveur et
  envoyé au seul courriel de l'administrateur, changement forcé à la première
  connexion. Vérifier comment démarre l'essai de 30 jours à la création.
- Branches travail/* intégrées supprimées par Manasse ; restent
  travail/virement-fonds et travail/passe-v1 (39 commits en avance sur main,
  À VÉRIFIER avant toute suppression).
- Prochain sujet avec Manasse : relevés de sécurité.

## Décision de Manasse du 2026-10-10 · « faire comme les autres logiciels »

Après relevé des pratiques (Zoho Books, Odoo, Sage ; sources citées dans la
conversation, à re-citer dans le plan), Manasse veut le parcours habituel :

- EN LIGNE : le client s'inscrit seul sur le site vitrine, essai gratuit limité
  dans le temps, puis abonnement mensuel ou annuel payé en ligne
  (mobile money : M-Pesa, Orange Money, Airtel Money, par un agrégateur), accès
  ouvert ou prolongé automatiquement à la réception de l'avis de paiement.
- SUR SITE : installateur Windows plus fichier de licence signé (déjà construit ;
  reste la paire de clés de licence et un premier essai du paquet sur un vrai PC).

À FAIRE AVANT TOUT CODE (le gel tient) :
1. Phrase expresse de Manasse « Lève le gel pour X » pour chaque fonction :
   inscription libre + essai, paiement en ligne, formulaire de demande.
2. Rouvrir l'inscription publique est un RENVERSEMENT d'une décision
   (INSCRIPTION_PUBLIQUE fermée) · le dire dans le plan et le CLAUDE.md.
   Garde-fous à prévoir : courriel vérifié, limitation de débit, dossier d'essai
   isolé, aucune donnée d'autrui visible (règle de confidentialité de l'éditeur).
3. Choix du prestataire de paiement utilisable en RDC, des monnaies (CDF et USD) et
   des frais : décision commerciale de Manasse, frais à vérifier auprès des
   opérateurs (les sources lues ne concordent pas).
4. Grille des offres : essai (durée à choisir), mensuel, annuel, sur site
   (perpétuelle plus maintenance, ou annuelle) · à décider par Manasse.

## Ajouts du 2026-10-12

- Pack replica-* posé sur la branche travail/replica-skill (commit 1021419), SIX
  compétences : recon, diff, test, entrepreneur, design et launch (les cinq autres
  retirées). À FUSIONNER sur main avec le premier fichier de suivi de la
  comparaison Sage (bloc § 3 joué à ce moment). Emploi : lire Sage (manuels de
  Drive, dont le Guide de 44 pages, puis le gros manuel de 27 Mo, à essayer, à
  couper en parties sinon), jamais copier. design et launch : site vitrine seul.
- Plugin PostHog (130 compétences) : conseillé de le désactiver dans ce projet, rien
  dans le dépôt ; à réactiver pour mesurer le parcours d'essai si l'inscription libre
  est décidée. Règle de télémétrie du § 8 de CLAUDE.md inchangée.
- Politique de confidentialité (client/src/pages/ConfidentialitePage.tsx, 8 sections,
  mise à jour du 7 octobre 2026) : comparer à la pratique des autres logiciels
  (Zoho : résumé d'abord, deux parties, contact du délégué). Écarts à examiner :
  adresse postale et courriel de contact non arrêtés par l'éditeur (dits dans le texte),
  pas de résumé en tête. LE CONTENU SE TRANCHE PAR LA LOI, pas par le RGPD :
  lire la compétence droit-numerique-ua-rdc-corpus (ordonnance-loi n° 23/10 du
  13 mars 2023) avant toute modification.

## Ajout du 2026-10-14

- LOGO DE L'ÉDITEUR reçu de Manasse (« garde ça pour plus tard »), rangé
  tel quel dans le dépôt (PNG 1024 x 1024, fond blanc), RETIRÉ le 2026-10-28
  (OmegaX seul). Aucun usage décidé. Ne pas le confondre avec la marque OmegaX, dont le
  signe et le logotype sont des tracés engendrés (§ 9 bis). Usage possible plus
  tard, sur décision de Manasse : site vitrine, pièces émises par l'éditeur (factures
  d'abonnement), console de l'éditeur.

## Questions à Manasse · éditions et exports, ligne sage-l7

- Sélections enregistrées · rangées au DOSSIER (décision L7-5, choix
  d'organisation d'OmegaX qu'aucun texte ne régit) · à revoir s'il préfère
  des sélections propres à chaque utilisateur.
- Impression différée · Cloud Run n'alloue le processeur que pendant les
  requêtes ; la production se fait donc dans une requête que la fenêtre
  relance. Une production sans fenêtre ouverte demanderait un processeur
  alloué en permanence (`--no-cpu-throttling`) ou une tâche planifiée ·
  décision d'exploitation, non prise.
- Les fichiers des exports et des impressions différées sont rangés en base
  (Neon) · le volume reste à surveiller.

## Relevés en attente · éditions et exports, ligne sage-l7

- Relectures sans jeton (export des modifications, impressions différées) ·
  deux relectures croisées peuvent poser la plus ancienne en dernier, la
  suivante remet la liste juste.
- L'échec d'un téléchargement s'affiche en tête de fenêtre, pas sur sa
  ligne (il nomme le numéro).
- La mise au point retombe sur la page quand le contrôle qui la tenait
  disparaît (sélection enregistrée, confirmation refermée).
- L'édition du plan comptable et du plan des tiers se recalcule à chaque
  rendu (un `useMemo` à poser).

## Questions à Manasse · pages légales, ligne pages-legales (2026-10-15)

L'acceptation en ligne du contrat reste FERMÉE tant que les mentions
obligatoires manquent (art. 54, al. 2) · c'est voulu. Ce que nul texte ne
fixe est un choix commercial du cabinet ; ce qui relève d'un juriste est dit.

1. Identité de l'éditeur (art. 52) · siège, courriel, téléphone, RCCM, forme,
   identification nationale, numéro d'impôt, capital.
2. Réclamations (art. 53, 13° et 14° ; art. 29, 5°) · adresse, modalités, et
   si le délai de 72 heures de l'art. 65, al. 3 s'applique à OmegaX.
3. Plafond de responsabilité (Odoo · 50 % des sommes des douze derniers mois ;
   Basecamp · exclusion presque totale), à confronter à l'art. 51 par un
   juriste.
4. Juridiction compétente (Odoo · droit belge, tribunaux de Nivelles).
5. Résiliation, préavis, reconduction (Odoo · trente jours ; Basecamp ·
   résiliation à tout moment, sans prorata).
6. Sort des données après la fin du contrat (Basecamp · trente puis soixante
   jours ; Odoo · restitution ou suppression).
7. Raisons de modification que le contrat admet (art. 34, 1°).
8. Moyen de publication des interruptions prévues (art. 29, 4°).
9. Assistance · canal et horaires.
10. Publication des prix (art. 31) et politique de changement de prix au
    regard de l'art. 34.
11. Dépôt de garantie (art. 30, al. 2) · aucun, ou lequel.
12. Droit de rétractation (art. 61) · le client cabinet est-il un
    professionnel ; qualification par un juriste.
13. Garanties légales (art. 53, 20°) selon la nature du contrat.
14. Titularité des droits sur OmegaX · œuvre de salariés (ordonnance-loi
    n° 86-033, art. 8, al. 2), œuvre collective (art. 10), cession écrite
    (art. 34) ; et si la licence d'utilisation est une « cession » au sens
    des art. 33 à 36 (art. 36, 4°, la part de 10 %).
15. Art. 229 « instruction documentée » face à l'autorisation de l'art. 201 ·
    à faire qualifier par un juriste.
16. Les factures d'abonnement de l'éditeur viennent d'un système de facturation non
    homologué (décret n° 23/10, art. 22) · effet sur la facture de l'art. 56,
    al. 3.
17. Le programme d'installation sur site doit-il faire accepter le contrat
    avant l'installation.
18. Date de déploiement du serveur dans « À propos » ; menu « ? » du
    gestionnaire de paie (il n'en a pas aujourd'hui, les pages restent
    publiques depuis l'écran d'ouverture).
19. Licence perpétuelle hébergée (PERPETUEL_SAAS) · ses conditions et son
    prix ; le contrat ne connaît que l'abonnement et le sur site, et
    l'acceptation en ligne de ces dossiers reste fermée.
20. Modalités de paiement (art. 53, 6°) · les moyens de paiement acceptés.
21. Droit de rétractation (art. 53, 16°) · son existence ou son absence pour
    le présent contrat, et ses conditions d'exercice (voir le point 12).
22. Garanties légales de conformité, des vices cachés et d'éviction (art. 53,
    20°) · leur énoncé (voir le point 13).
23. Dossiers d'un paquet Cabinet et anciens dossiers sans abonnement · le
    rattachement d'un abonnement depuis la console, sans quoi leur
    acceptation reste fermée.
24. Compléter les mentions publiera la version 2 · fixer sa date de
    communication et d'entrée en vigueur (art. 34), et faire coder avant elle
    la bascule de la version 1 à la 2 (acceptation de la 1 maintenue jusqu'à
    la prise d'effet de la 2), que `versions-publiees.spec.ts` exige.
25. Relevé · l'art. 53, 7° (modalités et délais de fourniture du service)
    n'est pas dans la garde · à relire avec l'éditeur (accès ouvert à la création du
    dossier, essai).
26. Abonnement modifié APRÈS l'acceptation (formule, option, prix) · la
    commande acceptée reste celle gardée avec l'acte, et rien ne redemande
    l'acceptation. Lu · art. 55, al. 1er (le client vérifie « les détails
    de sa commande » avant d'accepter) et al. 2 (accusé de « la commande »).
    Le texte ne dit pas si un changement de formule par l'opérateur est une
    commande nouvelle à accepter, ou l'exécution du contrat accepté (art. 34
    pour une modification à l'initiative de l'éditeur) · à trancher avec un
    juriste, puis à coder (relire l'empreinte de la commande en vigueur
    contre celle gardée, et rouvrir l'acceptation au besoin).

## Relevés en attente · pages légales

- Date de déploiement du SERVEUR dans « À propos » · non servie (seule celle
  de l'interface a une source réelle, le workflow de publication).
- La bascule d'une version du contrat à la suivante (art. 34) · non servie
  tant qu'une seule version existe, et `versions-publiees.spec.ts` le tient.

## Questions à Manasse · pièces jointes et analytique, ligne sage-l6

1. Longueur des codes de section, par plan ou par dossier ? Aucun texte ne
   la régit (SYCEBNL Partie 2 ch. 3, classe 9, sous-section 2 · découpage
   « à la convenance » de l'entité ; Partie 4 ch. 3, section 2 ·
   « nomenclature budgétaire du projet »). Sage la pose au DOSSIER
   (P_DOSSIER) ; OmegaX la pose au PLAN, parce que les codes et les
   rubriques vivent dans un plan et qu'un axe Bailleurs n'a pas à prendre
   la longueur de l'axe Projets. Choix d'organisation, donc le sien · à
   confirmer ou à renverser.

## Relevés en attente · pièces jointes et analytique, ligne sage-l6

- Le typage des délégués Prisma des tables de pièces de la restitution
  (`delegueDesPieces`, un `as unknown as Record`) reste à remplacer par les
  types Prisma de chaque table.
- Les boutons de liste « Commentaire » et « Retirer » du volet et des pièces
  détachées n'ont pas d'`aria-label` qui nomme la pièce · l'ajouter impose de
  rendre exacts les sélecteurs des tests navigateur qui lisent le nom du
  fichier.
- Les suppressions de module au brouillard (annulation de la passation de la
  paie, d'une liquidation de TVA, d'un constat d'impôt, d'un virement de
  fonds, d'une réévaluation des devises, d'un traitement d'immobilisation,
  d'un paiement de salaires, d'une créance douteuse, retrait des actes de la
  période, suppression d'une fiche de bien, d'une affectation) détachent les
  pièces de l'écriture retirée sans le dire à l'écran · le nombre est rendu
  par `EcritureService.supprimer` aux seuls chemins qui passent par lui. Les
  pièces ne se perdent pas · elles se lisent dans Journal > Pièces détachées.
- Écran (relecture React, mineurs) · le décompte des pièces du Journal et de
  la Saisie se recharge sur une liste de dépendances incomplète ; « Retirer »
  s'offre sur une pièce détachée à un utilisateur que le serveur refusera ;
  le paragraphe d'explication reste affiché sur une écriture validée ; le
  409 dit « Rechargez la liste » sans bouton Relire ; Personnel et Plans
  analytiques ne branchent ni `onOccupe` ni `useGardeFermeture` sur le volet
  (même constat de la relecture « échecs silencieux », mineur 2) ; le bouton
  PJ et son dialogue n'ont ni nom accessible exact, ni retour du focus, ni
  Échap pendant l'édition d'un commentaire ; le code de section n'a pas de
  `minLength` et son erreur s'affiche derrière la modale ; les raccourcis de
  la Saisie restent actifs sous le dialogue des pièces.
- Serveur (relecture TypeScript, mineurs) · `sectionsQuiPortentUnDocument`
  lit par une liste `in` non bornée (bornée en pratique par le plan qu'on
  supprime) ; la restitution continue de lire la base quand le client coupe
  la connexion, jusqu'à l'erreur d'écriture de la sortie.

## Relevés en attente · banque et trésorerie, ligne sage-l3 (second tour non bloquant)

Intégrée le 2026-10-22. Aucun BLOQUANT ni MAJEUR ouvert ; ces points restent
mineurs, relevés par les deux tours de relecture de chaque fonction.

- **Remises (n° 40).** Le numéro du bordereau est pris sous verrou après
  l'instantané sérialisable de `creerAvec` · l'index unique ferme le doublon,
  mais un conflit sorti en 23505 ferait un 500 au lieu d'un rejeu (à prouver
  par deux bordereaux simultanés, ou numéroter par une ligne compteur
  `FOR UPDATE`). Les échéances de tous les clients sont lues pour n'en garder
  qu'un (`/reglements/echeances` sans filtre par compte, commun aux effets).
  Flèches gauche et droite des onglets.
- **Effets de commerce (n° 39).**
  - Un effet à terme n'est listé que sous l'exercice de sa création.
  - `banque()` ne lit pas `estActif` du 52.
  - À trancher par la loi (Code civil, Livre III, art. 151, « lorsqu'il
    paye ») · `motifRefusDeclaration` juge « jamais postérieure au paiement »
    sur la date de la pièce d'acceptation, quand le moteur date le règlement
    à l'échéance ; l'imputation nomme le paiement à la date de sa pièce.
  - Le numéro de pièce du négatif est pris sans verrou sous une transaction
    non sérialisable (commun aux devises, remises, créances douteuses,
    virements).
  - L'acte dont la pièce est dans un exercice clôturé refuse l'annulation
    sans dire l'issue.
  - Le lettrage reste une seconde transaction après le commit de l'effet.
  - `retirerCompensation` supprime sans relire le statut.
  - L'issue proposée pour une facture d'un lettrage partiel (« délettrez »)
    n'est pas la bonne · accepter sans la cocher puis compléter le groupe.
  - Le négatif d'une acceptation validée ne porte pas
    `dateEncaissementEffet`.
  - Écran · changer d'onglet jette une acceptation en cours de saisie sans
    confirmation ; contrôles laissés au serveur (échéance antérieure à la
    création, centime, frais qui atteignent le nominal, dates minimales des
    actes) ; « Lecture… » sous un bandeau d'erreur ; flèches de la liste
    d'onglets, focus des modales, `aria-label` de la table.
- **Extraits bancaires (n° 45).** `depart` lit tous les relevés clos du
  compte sans borne (un par mois) ; au-delà de 500 comptes, la tranche suit
  l'ordre des identifiants ; le solde de départ n'est pas relu pendant
  l'édition (réouverture concurrente du relevé clos précédent).
- **Financements, placements et titres (n° 47).**
  - Mise en place et échéance datées d'une période close · aucun report
    demandable (la contre-passation, elle, l'est).
  - `passerActeSansPiece` ne relit pas le statut de l'exercice sous verrou.
  - Montant de la contre-passation non relu sur les lignes d'une
    régularisation retouchée au brouillard.
  - Valeur d'une part bornée à 10^12 FC quand le calcul exact s'arrête vers
    9 × 10^9 ; `interetsCalcules` perd sa précision au-delà de 10^13 FC
    (une proposition seulement).
  - Un titre au-delà de 5 000 mouvements se lit tronqué ; actes et revues
    listés sans borne par opération ; contre-passation sans ventilation
    analytique ; journal d'opérations diverses mis en sommeil après coup non
    dit ; clôture non refusée sur un titre non revu.
  - Écran · aucune garde de fermeture sur les modales de saisie ni sur les
    formulaires des taux ; journaux de la section des titres affichés vides
    pendant leur lecture ou leur échec ; échec de lecture des comptes de la
    mise en place sans bandeau d'alerte ; modales non remises à zéro au
    changement d'exercice ; ancienne liste gardée après une relecture en
    échec ; boutons de ligne sans libellé accessible ; focus des modales ;
    le gestionnaire de paie voit les boutons de saisie ; annulation choisie
    dans l'historique défaite par Échap seulement.
- **Commun aux effets, remises et opérations.** Le retrait d'une pièce au
  brouillard passe par `deleteMany`, hors `EcritureService.supprimer` · une
  pièce jointe se détache sans que sa description soit refaite ni comptée.

## Questions à Manasse · sécurité, ligne securite (2026-10-23)

- **Appel direct à `*.run.app`** · la limitation de débit se contourne en
  forgeant `X-Forwarded-For` (sondé sur instance jetable · 25 essais de
  connexion sans un 429). Par Firebase, l'adresse lue est la bonne ; en
  direct, l'entrée lue est celle que le client écrit
  (`common/sauts-de-confiance.ts` le dit déjà). Le verrouillage par compte
  tient toujours. Se ferme dans l'infrastructure (n'admettre à Cloud Run que
  le trafic du site), décision et réglage de la console Google.
- **Formules dans l'archive de restitution** · les CSV recopient les libellés
  tels quels ; un libellé qui commence par « = » s'évalue à l'ouverture dans
  Excel. Le neutraliser (apostrophe en tête) changerait la donnée restituée.
- **Fichiers engendrés versionnés** · le commit `69e7e01` (2026-10-17) a fait
  entrer `node_modules/`, `client/node_modules/`, `dist/`, `client/dist/` et
  `client/tsconfig.tsbuildinfo` (50 679 fichiers), que `.gitignore` exclut.
  Chaque construction les fait apparaître modifiés. À retirer de l'index
  (`git rm -r --cached`) sur accord.

## Relevés en attente · sécurité, ligne securite

- Une déconnexion dont la fermeture serveur échoue rend `sessionFermee: false`,
  que l'écran ne lit pas encore · l'utilisateur se voit déconnecté sans être
  averti que la copie éventuelle du cookie reste valable (MINEUR, second tour).
- Une colonne `sessionsFermees` illisible (écriture manuelle, restauration) se
  lit comme vide, sans trace au journal (MINEUR, second tour ; la colonne est
  `NOT NULL DEFAULT '[]'`).
- Restent connus sans correctif hors version majeure · @nestjs 10 (avis
  modérés, corrigés en 11), react-router 6 (redirection ouverte par barre
  oblique inverse, corrigée en 7, sans portée en HashRouter), glob, ajv,
  webpack (outillage de construction).

## Campagne de pénétration v2, ligne securite (2026-10-23)

Sondes élargies sur l'instance jetable (affectation massive de drapeaux
comptables, IDOR par identifiant direct, second facteur, pollution de
paramètres, pollution de prototype, verbe HTTP exotique, override de méthode,
corps surdimensionné, écriture sur le journal d'audit). UNE faiblesse trouvée
et corrigée · `GET /tiers?type[]=...` arrivait en tableau et tombait en 500
(entrée malformée, aucune fuite) · `type` validé par ParseEnumPipe, `recherche`
en tableau refusée (400 nommé). Les autres paramètres de requête scalaires
balayés ne tombent pas en 500 (comptes, écritures, relances tolèrent). Tout le
reste a résisté.

Décision sur le point « adresse directe `*.run.app` » (du relevé v1) · le
correctif en code n'est PAS réalisable proprement · l'`X-Forwarded-For` arrive
en une chaîne, seule l'infrastructure sait combien d'entrées sont authentiques ;
une règle en code soit ne ferme rien (rembourrage), soit, calée sur l'IP de
droite, bloque tous les cabinets derrière l'adresse partagée de Firebase. La
défense réelle contre la force brute reste le VERROUILLAGE PAR COMPTE
(`verrouillage.ts`, keyé sur le compte, non sur l'IP, non contourné par un
`X-Forwarded-For` forgé) ; le point se ferme dans l'infrastructure (n'admettre
à Cloud Run que le trafic du site).

## Relevés en attente · écran des logiciels (2026-10-25)

- `journauxAutorises` et `fonctionsAutorisees` ont le même défaut d'origine :
  un utilisateur promu administrateur garde en base sa restriction, qui
  ressusciterait s'il redevenait comptable (`UtilisateurService.modifier`
  n'efface ni `restreindreJournaux` ni `restreindreFonctions`). Non corrigé
  ici.

**Masquer n'est pas refuser.** Aucune route n'est refusée sur le fondement d'un
logiciel : une adresse tapée ouvre toujours sa fenêtre, et le serveur ne
connaît l'attribution que pour la rendre à l'écran. Pour que « ce qui ne
concerne pas l'utilisateur ne soit pas accessible », il reste, module par
module, à poser le refus au serveur (un garde qui relit `logicielsAutorises`
sur chaque contrôleur rangé dans une tuile, sur le modèle de
`@ReferentielsAutorises` + `ReferentielGuard`), et à l'aiguillage client
(`fenetreOuverteAuRole`). À noter au suivi, pas à coder avant décision :
une commande rangée dans plusieurs tuiles (paramètres du dossier, journal
d'écritures exportées, contrôles) doit être autorisée si l'une des tuiles
l'est. Aucune fonction n'est marquée « bientôt disponible ».


## Questions et relevés · personnel, ligne microfina-m3 (2026-10-28)

Ce que le corpus lu ne tranche pas, codé en abstention. Textes lus · Code du
travail (compétence `droit-travail-congolais`, `texte-loi-verbatim/`), art. 7,
point 8 ; 8 ; 41 ; 42 ; 43 ; 69 ; 112 ; 140 ; 141 ; 218 ; 219 · loi
n° 23/053, art. 68 et 69 (`fiscalite-rdc`, `code-general-2026/references/05`)
· O.-L. n° 10/001, art. 41 (`10-tva-ol10-001`) · ordonnance n° 84/186,
art. 1er (`smig-cotisations-textes-application/`) · fiche du compte 66 des
deux plans (AUDCIF Titre VII ; SYCEBNL Partie 2 ch. 3) · AUPSRVE, art. 184.

- **Délai de six mois de l'art. 140, al. 4** (« sans toutefois que la prise
  effective du congé puisse dépasser de six mois la date prévue pour son
  ouverture ») · « la date prévue pour son ouverture » se lit soit la date où
  le droit naît (al. 3, expiration de l'année de services), soit la date que
  l'accord a fixée. Aucun texte lu ne départage · aucun refus ni avertissement
  n'est codé (`suivi-personnel.ts`). Question à Manasse.
- **Poursuite des services après le terme d'un CDD** · l'art. 69 dit que le
  contrat prend fin au terme ; l'art. 41, al. 3 requalifie « la continuation
  de service en dehors des cas prévus à l'alinéa précédent » (renouvellements)
  ; aucun article lu ne dit expressément le sort d'un CDD dont le travailleur
  reste en service au-delà du terme sans renouvellement. L'échéancier dit le
  terme passé, sans requalifier.
- **Deux conventions pour le plafond de l'essai** · `verdictEssai`
  (`regles-contrat-travail.ts`) convertit « un mois » et « six mois » en 30 et
  180 jours ; l'échéancier de la ligne les compte de date à date, comme le
  plafond de l'art. 41. À aligner (date à date, lecture la plus proche du
  texte) dans une ligne qui touche le contrôle des contrats.
- **Frais de mission sur un bulletin stipulé en dollars** · refusés, avec
  l'issue (écriture au 6384 au journal de trésorerie) ; le cours qui
  convertirait un frais en francs vers la stipulation n'est fixé par aucun
  texte. Relevé, non bloquant.
- **Avance de mission** (somme remise avant le départ, régularisée au retour)
  et **ventilation analytique** des frais de mission par projet ou bailleur ·
  non servies ; l'avance relève du 4211 et de l'art. 112, c), sa
  régularisation par les frais justifiés reste à concevoir.
- **Visa d'un plan d'étalement par un second utilisateur** (idée 2 de la
  partie C de l'audit Microfina++) · non servi ; le plan n'est qu'une
  proposition, la retenue reste celle que le bulletin porte.
- **Déclaration de la main-d'œuvre (art. 218)** · formulaire, date limite et
  dérogations relèvent de l'arrêté du Ministre de l'art. 219, absent du
  corpus ; le bilan social de l'art. 218, al. 2 n'est pas servi. Texte à
  fournir.
