import { NumerotationPiece } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
export interface LignePalmares {
    compteId: string;
    numero: string;
    intitule: string;
    classe: string;
    mouvement: number;
    debit: number;
    credit: number;
    solde: number;
    nombreLignes: number;
    part: number;
    partCumulee: number;
}
export interface LigneAnalyseJournal {
    journalId: string;
    code: string;
    intitule: string;
    type: string;
    numerotation: NumerotationPiece;
    nombreEcritures: number;
    nombreLignes: number;
    debit: number;
    credit: number;
    enBrouillard: number;
    deCloture: number;
    premiereDate: string | null;
    derniereDate: string | null;
    sequence: {
        perimetre: string;
        explication: string;
        manquants: number | null;
        trous: Array<{
            de: number;
            a: number;
        }>;
        rattachesALArret?: {
            nombre: number;
            explication: string;
        };
    };
}
export declare class AnalyseJournauxService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    palmaresComptes(tenantId: string, params: {
        exerciceId: string;
        classe?: string;
        limite?: number;
        inclureBrouillard?: boolean;
    }): Promise<{
        lignes: LignePalmares[];
        total: {
            mouvement: number;
            comptes: number;
        };
        tronque: boolean;
    }>;
    analyseJournaux(tenantId: string, params: {
        exerciceId: string;
    }): Promise<{
        lignes: LigneAnalyseJournal[];
        sequenceDuDossier: {
            applicable: boolean;
            explication: string;
            manquants: number;
            trous: Array<{
                de: number;
                a: number;
            }>;
            rattachesALArret?: {
                nombre: number;
                explication: string;
            };
        };
    }>;
    private exerciceJumeauDeLArret;
    grilleSaisie(tenantId: string, exerciceId: string): Promise<{
        mois: string[];
        journaux: {
            cases: import("./etat-journaux-saisie").CaseJournalMois[];
            type: import(".prisma/client").$Enums.TypeJournal;
            id: string;
            estActif: boolean;
            intitule: string;
            code: string;
        }[];
    }>;
}
