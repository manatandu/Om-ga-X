# AVANCEMENT · ligne A15 bis (sortie d'un bien réévalué, décisions du 2026-10-04)

## Fait
- 154 repris EN ENTIER au 861 à TOUTE sortie, aux deux référentiels (`sortDesEcarts`, plus de « non passé »).
  Textes · AUDCIF Titre VII fiche du compte 15 ; SYCEBNL Partie 2 ch. 3 fiche 15 ; loi n° 23/053 art. 132 al. 1er,
  133 al. 2 et 3 ; AUDCIF Titre VIII ch. 28 § 4.2.4.1, § 4.2.4.2, § 6.
- 106 du SYCEBNL transféré au 118 « Autres réserves » IMPOSÉ (11800000, semé sans subdivision), aucun choix,
  autre compte refusé en 400 nommé · décision de Manasse du 2026-10-04, dans le silence du texte SYCEBNL, par
  analogie avec l'AUDCIF ch. 28 § 6.
  SYSCOHADA inchangé (111, 112, 1138 au choix).
- 1062 « avec droit de reprise » · aucun texte de la compétence sycebnl ne dit son sort à la sortie (fiche 10,
  Partie 3 ch. 1 § 2.1.1.3, plan) · même règle.
- Écran · encadré de sortie sans type, réserve imposée montrée sans liste au SYCEBNL, message après sortie.
- CLAUDE.md, paragraphe « SUITES DE LA RÉÉVALUATION » mis à jour.

## Rejeu sur vraie base (PostgreSQL 16 jetable, serveur compilé, clôture de 2026 traversée)
- SYSCOHADA · bien repris 44 000 000 sur 11 ans (acquis 2025), dotation 2026 4 000 000, réévaluation légale k 1,5
  avec neutralité au 31/12/2026 · 154 = 18 000 000 ; clôture 2026 ; 2027 dotation 6 000 000, reprise 2 000 000,
  mise au rebut au 31/12/2027 · 154 report C 18 000 000, mouvement D 18 000 000, solde 0 ; 861 C 18 000 000
  (2 000 000 + 16 000 000) ; 812 D 48 000 000 (66 000 000 − 18 000 000).
- SYCEBNL association · bien repris 50 000 000 sur 10 ans (acquis 2021), dotation 2026 5 000 000, k 1,4 ·
  10611000 = 10 000 000 ; clôture 2026 ; 2027 dotation 7 000 000, destruction au 31/12/2027 · réserve servie
  `impose: true` (11800000 seul) ; 112 envoyé refusé en 400 nommé ; 10611000 report C 10 000 000, D 10 000 000,
  solde 0 ; 11800000 C 10 000 000 ; 812 D 28 000 000 (70 000 000 − 42 000 000).

## Second tour (relecture)
- BLOQUANT corrigé · la note 3E / 5H comptait dans la « reprise de l'exercice » la reprise au 861 d'une sortie
  d'un exercice POSTÉRIEUR (requête qui garde les biens sortis après l'ouverture) · reprise de sortie comptée
  seulement si la date de sortie tombe dans l'exercice montré (`sortiDansLExercice`), même garde que la liste
  des sortis. Spec · réévaluation au 31/12/2025, sortie au 30/06/2026 · note 2025 reprise 0, note 2026
  9 000 000 + 1 000 000 = 10 000 000.
- Au SYCEBNL, un 11800000 inactif ou non détail · le refus dit de le réactiver, jamais « choisissez ».
- Commentaire du DTO de sortie · le 118 imposé au SYCEBNL.

## Relevés en attente
- Préexistant, hors ligne · une dotation d'exercice entier datée après la sortie n'est pas réduite.

## Reste
- Rien dans le périmètre de la ligne.

## Vérification
- Bloc § 3 passé (serveur 10 582 tests, client 1 798) ; `cession-courante.spec.ts` tombé une fois sous charge à
  l'amorçage, vert seul.
- `npx jest src/modules/immobilisations` ; client `npx vitest run src/lib/reevaluation-suites.spec.ts`.
