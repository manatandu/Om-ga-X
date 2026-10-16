# AVANCEMENT · ligne virement-pieces (2026-10-16)

Demande de Manasse · « pièces justificatives demandé est pour quelle opération ?
Car dans le virement il y a deux opérations (la sortie et l'entrée des fonds).
Retire ces textes de trop « Virement banque vers caisse · compte de passage
58500002 · Virements de fonds · banque vers caisse ». T'es pas obligé de le
mentionner. »

Branche de sauvegarde · `travail/virement-pieces` (partie de `main` d461c28).

## Décision par la loi

- DEUX OPÉRATIONS, DEUX PIÈCES. Le virement passe deux écritures, une dans
  chaque journal auxiliaire (fiche du compte 58 des deux plans · « comptes de
  passage » des « comptabilités organisées sur la base de journaux
  auxiliaires »). Chaque écriture s'appuie sur SA pièce justificative et en
  porte les références (AUDCIF art. 17, 3° et 5° ; art. 22, 7°, « chaque
  enregistrement s'appuie sur une pièce justificative fiable et conservée »).
  La sortie se justifie par la pièce de l'origine (chèque, ordre de virement,
  bon de caisse), l'entrée par celle de la destination (bordereau de
  versement, avis de crédit, pièce de caisse). Rien n'interdit que les deux
  références coïncident quand un seul document justifie les deux côtés.
- CHAQUE ÉCRITURE EST DATÉE PAR SA PIÈCE · « Cette date est celle de
  l'émission par l'entité de la pièce justificative de l'opération, ou celle
  de la réception des pièces d'origine externe » (AUDCIF art. 16, al. 2 ; non
  écarté par l'art. 3 du SYCEBNL). La « date du virement » disparaît · la
  sortie est datée par sa pièce, l'entrée par la sienne.
- L'ENTRÉE N'EST PAS ANTÉRIEURE À LA SORTIE, ET LES DEUX TOMBENT DANS LE MÊME
  EXERCICE · le 585 attend l'entrée entre les deux dates (sa raison d'être),
  et il est « soldé à la fin de l'exercice » (fiche du compte 58, éléments de
  contrôle). Une entrée sur l'exercice suivant laisserait le 585 ouvert à la
  clôture · refus nommé, le virement se passe alors à la main.
- AUCUNE NATURE PAR DÉFAUT · une nature présélectionnée (« Ordre de
  virement ») se retrouvait sur la pièce d'une caisse.
- Le texte de sens et de compte de passage sort de l'écran (demande de
  Manasse) · il reste dans la bulle d'aide, au plan comptable et au journal.

## Fait

- Schéma et migration `20270186000100` (colonnes de l'entrée recopiées de la
  pièce unique des virements anciens, `operation` des scans, unicité par
  opération) · `prisma migrate diff` sans écart ; migration rejouée sur une
  base à l'état d'avant avec un virement et un scan existants.
- Règle (`motifRefusVirement`) · nature, référence, jour (`estUnJour`) de
  chaque pièce jugés là, l'opération nommée ; la porte ne vérifie que l'objet
  (plus de préfixe « sortie. »). Service · chaque écriture datée par sa pièce,
  dates hors exercice refusées, la phrase sur l'exercice suivant propre à
  l'entrée ; scans par opération (`?operation=`), messages élidés.
- Écran · deux cadres « Sortie des fonds » et « Entrée des fonds », texte de
  sens et de compte de passage retiré, liste par opération, « Joindre » de
  chaque côté. CLAUDE.md, specs serveur et client, e2e à jour.
- Scénario sur vraie base (`vp-scenario.mjs`, serveur compilé, port 8083) ·
  refus, sortie le 30 et entrée le 31 décembre (le 585 débité le 30, crédité
  le 31, soldé), même référence admise des deux côtés, scans par opération,
  clôture de N, à-nouveau, refus d'annuler en N clos, V3 de N+1 à deux dates
  (sortie validée, entrée au brouillard) annulé · tout VERT.

- Premier tour de relecture (échecs silencieux, TypeScript, React) · aucun
  BLOQUANT. Corrigé · la pièce ne porte que nature, référence et date (clé en
  trop refusée, nommée) ; la porte ne descend plus dans les objets, la règle
  juge chaque champ (un seul message pour une pièce absente, nulle ou
  illisible) ; une PÉRIODE CLOSE du journal d'une opération est refusée AVANT
  toute écriture, l'opération et le journal nommés, l'issue dite (saisie à la
  main, où le report se demande · AUDCIF art. 22, 4°) ; un scan déjà joint au
  virement entier (ancien, sans opération) est refusé en 409 au lieu d'un
  doublon ; écran · scans choisis tenus en état, retenus avant l'envoi et
  retirables, formulaire entamé compté champ par champ, ancien scan montré
  « (virement entier) », date des écritures dite quand elle diffère de la
  pièce, `noValidate` sur le formulaire (le refus vient du serveur, nommé),
  libellés accessibles des boutons « Joindre ».

- Second tour de relecture (échecs silencieux, React) · aucun BLOQUANT ni
  MAJEUR serveur. Corrigé · garde de fermeture pendant l'envoi (issue
  inconnue) ; réponse perdue (réseau, 5xx) dite « le virement a pu passer »
  et la liste relue, au lieu d'un échec qui ferait repasser le virement ;
  scans jugés AVANT l'envoi (vide, plus de 5 Mo, format) ; scan non joint
  nommé par opération, pièce et motif, retiré du bandeau une fois joint
  depuis la liste ; date des écritures dite des deux côtés ; focus au
  bandeau d'erreur ; exercice CLÔTURÉ refusé d'abord (art. 20, al. 3) ;
  période close jusqu'à la fin de l'exercice · plus de renvoi à la saisie
  (aucun jour n'y est ouvert), issue dite. Arrêt à la dissolution et deux
  mineurs d'écran aux « Relevés en attente » (`docs/suivi-reprises.md`).

## Reste

- Second tour TypeScript rendu · aucun BLOQUANT ni MAJEUR, six MINEURS rangés aux « Relevés en attente » de `docs/suivi-reprises.md`. Reste le bloc du § 3 après intégration d'export-periode, la fusion de `main`, les tests navigateur, l'intégration.
- Bloc § 3, e2e local, intégration sur `main` après l'export par période
  (fusion de `main` d'abord).

## Vérification

```bash
npx tsc --noEmit && npx jest src/modules/virements-fonds
cd client && npx tsc --noEmit && npx vitest run src/lib/virement-fonds.spec.ts
```
