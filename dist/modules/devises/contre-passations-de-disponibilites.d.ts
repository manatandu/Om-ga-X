import type { PrismaService } from '../../common/prisma.service';
type Lecteur = Pick<PrismaService, 'reevaluation'>;
export declare const PLAFOND_REEVALUATIONS_EXAMINEES = 50;
export interface DisponibiliteContrePassee {
    dateReevaluation: Date;
    exerciceReevaluationClos: boolean;
    exerciceContrePassationClos: boolean;
    piece: number | null;
    date: Date;
    compteNumero: string;
    montant: number;
    exception: string | null;
    manuelle: boolean;
    aRepasser: boolean;
    autresGestes: boolean;
}
export declare function contrePassationsDeDisponibilites(prisma: Lecteur, p: {
    tenantId: string;
    exerciceId: string;
}): Promise<{
    elements: DisponibiliteContrePassee[];
    tronque: boolean;
}>;
export declare function ecrituresDesContrePassationsAnnulees(prisma: Lecteur, tenantId: string): Promise<{
    ids: Set<string>;
    tronque: boolean;
}>;
export declare function lignesDeDisponibilitesDesContrePassationsDeclarees(prisma: Lecteur, p: {
    tenantId: string;
    exerciceId: string;
}): Promise<{
    lignes: Set<string>;
    tronque: boolean;
}>;
export {};
