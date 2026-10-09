# Avancement · ligne virement de fonds

Demande de Manasse du 2026-10-09 · virer des fonds banque à banque, banque à
caisse, caisse à banque, caisse à caisse, chaque côté dans son journal, avec
pièces et informations justificatives, quatre comptes de passage par défaut.

## Décisions prises, avec leur texte

- **Le 585, pas le 581.** AUDCIF Titre VII, compte 58 · 581 « Régies
  d'avance » (fonds des régisseurs), 585 « Virements de fonds », comptes de
  passage « soldés au terme de leur utilisation » ; le SYCEBNL (Partie 2
  ch. 3, compte 58) n'ouvre que 585 et 588. Dit à Manasse avant de coder.
- Quatre sous-comptes 58500001 à 58500004, un par sens, personnalisés,
  semés à la création du dossier (`seedPlan`) et migrés pour les autres
  (`20270165000000_virements_de_fonds`), rouverts au premier virement s'il
  en manque (`assurerComptesDePassage`).
- Deux pièces nées ensemble · origine D 585 / C sa trésorerie, destination
  D sa trésorerie / C 585, même date, une transaction.
- Pièce justificative exigée · nature, référence, date, objet (AUDCIF
  art. 17, 3° et 5°, non écartés par l'art. 3 du SYCEBNL). Porteur des
  espèces exigé dès qu'une caisse est en jeu · convention d'OmegaX, dite.
  Fichiers joints facultatifs, mêmes règles que les documents des tiers.
- Annulation · brouillard supprimé, validée inscrite en négatif (AUDCIF
  art. 20, al. 2) ; refus si une ligne est lettrée ou pointée, ou l'exercice
  clos.
- Journal dont le RIB est en devise refusé (monnaie de tenue, loi n° 23/053
  art. 141, 1°).
- 585 et 588 exemptés du refus « compte du plan subdivisé » en saisie
  (`estCompteDePassage`), sans quoi le 58500000 se fermait dès les quatre
  sous-comptes ouverts.
- Gel levé pour cette fonction · à écrire au § 5 de CLAUDE.md.

## Fait

- Schéma et migration (954c4d2), `prisma migrate diff` sans écart.
- Service, contrôleur, module, listes structurelles, exemption 585/588, semis.
- Tests du module (30), doublures complétées, serveur et client au vert.
- Écran Traitement > Tiers et trésorerie > Virement de fonds, cache du plan.
- Scénarios navigateur sur vraie base à travers une clôture, SYSCOHADA et
  SYCEBNL (`e2e/tests/virements-fonds.e2e.ts`), au vert en local.
- CLAUDE.md (paragraphe de la ligne, gel levé pour elle).

## Reste

1. Relectures (silent-failure-hunter, typescript-reviewer, react-reviewer) ·
   lancées puis arrêtées, la limite d'utilisation approchant · à relancer.
2. Bloc § 3, intégration sur `main`, déploiement vérifié, fiche retirée.

## Vérification

```bash
npx tsc --noEmit && npx jest src/modules/virements-fonds
(cd client && npx tsc --noEmit && npm test)
```

## Reprise après la réinitialisation (2026-10-09, demande de Manasse)

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
