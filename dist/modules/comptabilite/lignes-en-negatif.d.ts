import { Prisma } from '@prisma/client';
export declare function lignesEnNegatif(lignes: Array<Prisma.LigneEcritureGetPayload<{
    include: {
        ventilations: true;
    };
}>>): {
    compteId: string;
    libelle: string | null;
    debit: Prisma.Decimal;
    credit: Prisma.Decimal;
    tauxTvaId: string | null;
    dateEcheance: Date | null;
    dateVersement: Date | null;
    modeReglementId: string | null;
    deviseId: string | null;
    montantDevise: Prisma.Decimal | null;
    coursApplique: Prisma.Decimal | null;
    ventilations: {
        create: {
            sectionId: string;
            planId: string;
            debit: Prisma.Decimal;
            credit: Prisma.Decimal;
        }[];
    };
}[];
