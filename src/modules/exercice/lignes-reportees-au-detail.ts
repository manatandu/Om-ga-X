import { ModeReportANouveau, Prisma } from '@prisma/client';

/**
 * LES LIGNES QUE LE REPORT AU DÉTAIL REPORTE, UNE SEULE DÉFINITION
 * (relecture « échecs silencieux » du paquet 1, mineur 2).
 *
 * Le report à-nouveau d'un compte au DÉTAIL reporte ligne à ligne ses
 * mouvements NON lettrés (`report-a-nouveau.ts`) · une lettre vide n'y vaut
 * pas lettre, et une ligne lettrée par un groupe qui touche un AUTRE exercice
 * se lit non lettrée (A6 bis, règle 1 de `lettrage/lettrages-a-cheval.ts`).
 * La date d'origine d'une ligne reportée (`relances/date-origine-des-reports.ts`)
 * cherche sa pièce parmi les lignes de l'exercice précédent · elle les lisait
 * par `lettre: null` seulement, et une pièce reportée sous une lettre vide ou
 * dans un groupe à cheval n'y était plus candidate · l'origine passait pour
 * introuvable, ou la clé portait d'un côté plus de lignes que de l'autre.
 *
 * `ecriture` porte le périmètre de celui qui reporte · l'exercice entier à la
 * clôture, le livre-journal seul (`statut: VALIDEE`) pour l'à-nouveau
 * provisoire · et nomme toujours l'exercice lu, contre lequel un groupe
 * « touche un autre exercice ». La forme rendue est celle que la lecture du
 * report posait (`ecriture`, `compte`, `OR`), pour qu'un appelant puisse y
 * ajouter ses propres bornes sans les mêler à ce `OR`.
 */
export function lignesReporteesAuDetail(
  ecriture: Prisma.EcritureWhereInput & { tenantId: string; exerciceId: string },
): Prisma.LigneEcritureWhereInput & { OR: Prisma.LigneEcritureWhereInput[] } {
  return {
    ecriture,
    compte: { modeReportANouveau: ModeReportANouveau.DETAIL },
    OR: [
      { lettre: null },
      { lettre: '' },
      // Lettrée par un groupe qui touche un autre exercice · se lit non lettrée.
      { lettrage: { lignes: { some: { ecriture: { tenantId: ecriture.tenantId, exerciceId: { not: ecriture.exerciceId } } } } } },
    ],
  };
}
