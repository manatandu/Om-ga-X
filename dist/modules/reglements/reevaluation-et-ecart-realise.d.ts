import type { PrismaService } from '../../common/prisma.service';
type Lecteur = Pick<PrismaService, 'reevaluation' | 'ligneEcriture' | 'coursDevise' | 'exercice'>;
export interface LigneAReconstituer {
    id?: string;
    deviseId: string;
    debit: number;
    credit: number;
    montantDevise: number | null;
    lettrageId: string | null;
}
export declare function ecartReconstitue(lignes: LigneAReconstituer[], denoues: ReadonlySet<string>, cours: ReadonlyMap<string, number | null>, inclus: string | null): number;
export declare function ecartsParDevise(lignes: LigneAReconstituer[], denoues: ReadonlySet<string>, cours: ReadonlyMap<string, number | null>, inclus: string | null): Map<string, {
    montantDevise: number;
    ecart: number;
}>;
export declare function motifDejaReevalue(p: {
    date: Date;
    creeeLe: Date;
    compteNumero: string;
    objet: string;
}): string;
export type IssueReevaluation = {
    refus: string;
} | {
    avertissement: string;
} | null;
export declare function issueReevaluationDejaPassee(prisma: Lecteur, p: {
    tenantId: string;
    exerciceId: string;
    compteId: string;
    compteNumero: string;
    lettrageId: string;
}): Promise<IssueReevaluation>;
export declare function motifReglementDejaReevalue(prisma: Lecteur, p: {
    tenantId: string;
    exerciceId: string;
    compteId: string;
    compteNumero: string;
    ligneIds: string[];
}): Promise<string | null>;
export declare function avertissementExtourneManquante(prisma: Lecteur, p: {
    tenantId: string;
    exerciceId: string;
    compteId: string;
    compteNumero: string;
    ligneIds: string[];
}): Promise<string | null>;
export {};
