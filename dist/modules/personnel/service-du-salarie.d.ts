import type { Prisma } from '@prisma/client';
export type ContratLu = {
    id: string;
    dateEntreeEnVigueur: Date;
    dateFin: Date | null;
    renouvelleDeId: string | null;
    remunerationBase: Prisma.Decimal | null;
    periodiciteRemuneration: string | null;
    deviseRemuneration: string | null;
};
type ContratDuService = Pick<ContratLu, 'id' | 'dateEntreeEnVigueur' | 'dateFin' | 'renouvelleDeId'>;
export declare function serviceEnCours<C extends ContratDuService>(contrats: readonly C[]): {
    origine: Date;
    fin: Date | null;
    contrats: C[];
} | null;
export {};
