# Avancement · ligne tiers-numero

Décision de Manasse du 2026-10-09 · « Choisi à la création (Recommandé) » ·
le numéro du compte principal d'un tiers est proposé par OmegaX et modifiable
à la création ; les sous-comptes de la panoplie prennent son rang.

## Fait
- Serveur · `motifRefusNumeroChoisi` (collectifs-tiers.ts) · chiffres seuls
  (AUDCIF art. 18 et Titre VII ; SYCEBNL Partie 2 ch. 2 section 1, l'art. 18
  étant écarté par l'art. 3 du SYCEBNL), racine du collectif (Titre VII,
  « commence toujours par celui du compte […] dont il est une subdivision »),
  distinct du collectif, longueur du dossier (convention d'OmegaX).
- `CreerTiersDto.numeroCompte`, `TiersService.creer` et `poserPanoplie` ·
  pris = 409 nommé, jamais le suivant ; collectif absent = 400, tiers non créé ;
  sans « Ouvrir ses comptes » = 400.
- `GET /tiers/numero-propose?type=` (rangée dans `ROUTES_QUI_NE_SONT_PAS_DES_LISTES`).

## Reste
- Écran de création (TiersPage) · champ prérempli, envoyé seulement s'il change.
- Scénario sur vraie base (tiers-panoplie.e2e.ts) à travers la clôture.
- Relectures (silent-failure-hunter, typescript, react), docs, intégration.

## Vérification
npx tsc --noEmit ; npx jest src/modules/tiers src/modules/comptes ;
(client) npx tsc --noEmit ; npm test ; e2e par /tmp/claude-0/integ-tp.sh
