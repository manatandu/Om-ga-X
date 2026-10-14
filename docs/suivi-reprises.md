# Suivi des reprises · notes gardées hors des lignes

Notes tenues jusqu'au 2026-10-14 dans la fiche d'avancement de la ligne
virement de fonds (`AVANCEMENT-virement-fonds.md`), retirée à son intégration.
Elles ne concernent pas cette ligne : sujets à reprendre, décisions de Manasse
et travaux à sa charge. Recopiées telles quelles pour que rien ne se perde.

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
   bouton manque à l'administrateur VMG (estAdmin = role ADMIN_CABINET,
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
  « Messagerie posée · le courrier part sous l'adresse admin@vmgconsulting.net »,
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
- Parcours client actuel : inscription publique fermée, dossier créé par VMG
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
   isolé, aucune donnée d'autrui visible (règle VMG).
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
  adresse postale et courriel de contact non arrêtés par VMG (dits dans le texte),
  pas de résumé en tête. LE CONTENU SE TRANCHE PAR LA LOI, pas par le RGPD :
  lire la compétence droit-numerique-ua-rdc-corpus (ordonnance-loi n° 23/10 du
  13 mars 2023) avant toute modification.

## Ajout du 2026-10-14

- LOGO DE VMG CONSULTING reçu de Manasse (« garde ça pour plus tard »), rangé
  tel quel dans docs/marque-vmg/logo-vmg-consulting.png (PNG 1024 x 1024, fond
  blanc). Aucun usage décidé. Ne pas le confondre avec la marque OmegaX, dont le
  signe et le logotype sont des tracés engendrés (§ 9 bis). Usage possible plus
  tard, sur décision de Manasse : site vitrine, pièces émises par VMG (factures
  d'abonnement), console de l'éditeur.
