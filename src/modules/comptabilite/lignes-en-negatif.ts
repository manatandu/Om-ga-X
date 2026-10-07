import { Prisma } from '@prisma/client';

/**
 * LES LIGNES D'UNE INSCRIPTION EN NÉGATIF · AUDCIF art. 20, al. 2. Les MÊMES
 * comptes, dans les MÊMES sens, au signe près ; ni lettre ni pointage, qui
 * appartiennent à la ligne d'origine. Une seule écriture de la règle, servie
 * à la correction d'une écriture et à l'annulation d'une réévaluation des
 * devises (ligne A6, D6), et au retrait des actes de la période par l'arrêt de
 * l'exercice à la dissolution. Dans son propre fichier · `exercice.service.ts`
 * ne peut importer `ecriture.service.ts`, qui l'importe.
 */
export function lignesEnNegatif(lignes: Array<Prisma.LigneEcritureGetPayload<{ include: { ventilations: true } }>>) {
  return lignes.map((l) => ({
    compteId: l.compteId,
    libelle: l.libelle,
    debit: l.debit.negated(),
    credit: l.credit.negated(),
    tauxTvaId: l.tauxTvaId,
    dateEcheance: l.dateEcheance,
    // La contre-passation reprend les deux dates de l'origine · une
    // inscription en négatif annule une opération, elle ne la
    // redate pas. La retenue contre-passée doit sortir du registre
    // par le MÊME mois qu'elle y est entrée, sans quoi elle
    // creuserait un mois et en gonflerait un autre.
    dateVersement: l.dateVersement,
    // LA DEVISE ET L'ANALYTIQUE SUIVENT (audit final F1). Sans
    // elles, le grand livre revenait à zéro pendant que le réalisé
    // par section et la position en devise gardaient l'opération
    // annulée. Le montant en devise se recopie SANS SIGNE, comme
    // il est stocké : c'est le sens de la ligne qui le donne
    // (lettrage, réévaluation). Les ventilations, elles, portent
    // leur propre débit et crédit, et passent en négatif.
    deviseId: l.deviseId,
    montantDevise: l.montantDevise,
    coursApplique: l.coursApplique,
    ventilations: {
      create: l.ventilations.map((v) => ({
        sectionId: v.sectionId,
        planId: v.planId,
        debit: v.debit.negated(),
        credit: v.credit.negated(),
      })),
    },
  }));
}
