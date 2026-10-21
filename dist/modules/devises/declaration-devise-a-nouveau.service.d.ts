import { Prisma, StatutEcriture } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { DevisesService } from './devises.service';
import { type PartDeclaree } from './declaration-devise-a-nouveau';
export declare const REFERENCE_DECLARATION_DEVISE = "DECLARATION-DEVISE";
export interface DeclarerDeviseANouveauEntree {
    ligneId: string;
    parts: PartDeclaree[];
    source: string;
}
export interface LigneRestantADeclarer {
    ligneId: string;
    exerciceId: string;
    exercice: string;
    date: string;
    piece: number | null;
    origine: 'IMPORT' | 'REPORT';
    statut: StatutEcriture;
    compteNumero: string;
    compteIntitule: string;
    montant: number;
    motifRefus: string | null;
}
export interface ReportNonRetrouve {
    exercice: string;
    exerciceSuivant: string;
    compteNumero: string;
    montant: number;
    motif: 'NON_RETROUVE' | 'AMBIGU';
}
export declare class DeclarationDeviseANouveauService {
    private readonly prisma;
    private readonly ecritureService;
    private readonly devises;
    constructor(prisma: PrismaService, ecritureService: EcritureService, devises: DevisesService);
    private ecrituresHorsMouvements;
    private contexteDeLExercice;
    private reglementsEnFrancs;
    private prolongeUneLigneDeclaree;
    private contexte;
    restantADeclarer(tenantId: string): Promise<{
        sansDeviseEtrangere: boolean;
        lignes: LigneRestantADeclarer[];
        total: number;
        tronque: boolean;
        nonRetrouvees: ReportNonRetrouve[];
    }>;
    declarer(tenantId: string, userId: string, entree: DeclarerDeviseANouveauEntree): Promise<{
        messages: string[];
        declaration: {
            id: string;
            tenantId: string;
            createdAt: Date;
            createdBy: string;
            exerciceId: string;
            compteId: string;
            source: string;
            ecritureOrigineId: string;
            mode: string;
            ligneOrigineId: string;
            montantLigne: Prisma.Decimal;
            parts: Prisma.JsonValue;
            resteEnFrancs: Prisma.Decimal;
            ecritureCorrectionId: string | null;
            lignesResultantes: Prisma.JsonValue | null;
        };
        ecritureCorrectionId: string;
    } | {
        declaration: {
            id: string;
            tenantId: string;
            createdAt: Date;
            createdBy: string;
            exerciceId: string;
            compteId: string;
            source: string;
            ecritureOrigineId: string;
            mode: string;
            ligneOrigineId: string;
            montantLigne: Prisma.Decimal;
            parts: Prisma.JsonValue;
            resteEnFrancs: Prisma.Decimal;
            ecritureCorrectionId: string | null;
            lignesResultantes: Prisma.JsonValue | null;
        };
        ecritureCorrectionId: null;
        messages: string[];
    }>;
    private declarerSousVerrou;
    private declarerAuBrouillard;
    private declarerParCorrection;
}
