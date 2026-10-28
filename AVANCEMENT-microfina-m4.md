# Avancement · ligne Microfina M4 (détenteur d'un bien)

Branche de sauvegarde `travail/microfina-m4`, copie `/home/user/wt-microfina-m4`.
Plan · `docs/comparaison-microfina/plan-reproduction-microfina.md`, ligne M4
(idée 4 · affectation à un salarié, transfert, libération, reçu signé, suivi
sur une période).

## Fait

- Schéma · `DetentionBien`, `RecuDetentionBien`, `NatureRecuDetention` ;
  migration écrite à la main `20270198000100_detentions_biens` (au-dessus
  de main, M2 et M3), clés RESTRICT, index qui commencent par `tenantId`,
  `prisma migrate diff` sans différence sur base jetable.
- Règles pures `immobilisations/detention-bien.ts`, service, contrôleur,
  DTO. Aucune écriture comptable.
- Registres · journal d'audit (`MODELES_AUDITES`), cloisonnement, libellés,
  usages de la fiche (retiennent la suppression, jamais la modification),
  libellés de `common/suppression/references.ts`, suppression d'un lieu
  (refus nommé au lieu d'un 500), maintenance du registre (biens sortis
  encore détenus).
- Écran · volet « Détenteur » de la fiche du bien, onglet « Détenteurs »
  (suivi sur une période), masqués aux deux rôles cantonnés.
- Tests · `detention-bien.spec.ts` (serveur), `lib/detention-bien.spec.ts`
  (client), `e2e/tests/microfina-m4-detenteur.e2e.ts`.

## Décisions (aucun texte ne régit la détention · conventions d'OmegaX)

- Droits · lire · administrateur, comptable, lecture seule ; écrire ·
  administrateur, comptable. Aide-comptable ET gestionnaire de paie refusés
  en entier (le détenteur est un salarié nommé, le personnel est fermé à
  l'aide ; le gestionnaire n'a pas le registre des immobilisations).
- Une détention à la fois par bien, dans l'ordre des dates (jamais
  antidatée sous la dernière ; le jour même de la fin admis), jamais dans le
  futur (jour de Kinshasa), jamais avant l'acquisition ou l'entrée dans le
  groupe, jamais sur un bien sorti ; contrat en cours à la date exigé.
- Un bien sorti pendant sa détention se libère encore (sinon enfermé),
  signalé au suivi, à la fiche et à la maintenance.
- Reçu · suite continue par dossier sous verrou consultatif, clé unique
  (dossier, numéro), texte figé, mention « document interne, ne vaut que par
  ses signatures » ; signature DÉCLARÉE une fois (qui, quel jour), 409 sinon.
- Le lieu donné à la remise devient le lieu du bien.
- Une fiche qui porte des détentions ne se supprime plus.

## Reste

- Rejeu sur vraie base FAIT · `scripts/rejouer-detentions-biens.cjs`, tout vert (PostgreSQL 16 jetable).
- Relecture « échecs silencieux ».

## Commandes

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
```
