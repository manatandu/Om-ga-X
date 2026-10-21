import { PrismaService } from '../../common/prisma.service';
export declare class AccordCadreService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private dossier;
    private exigerPerimetre;
    etat(tenantId: string, params?: {
        dateReference?: string;
    }): Promise<{
        applicable: boolean;
        modele: {
            readonly dureeAnnees: 10;
            readonly preavisMois: 6;
            readonly source: string;
        };
        partMinimaleMainOeuvreLocale: number;
        accords: {
            etat: import("./conditions-ong-etrangere").EtatAccordCadre;
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            reference: string;
            dateSignature: Date;
            dureeAnnees: number;
            taciteReconduction: boolean;
            preavisMois: number | null;
            denonceLe: Date | null;
            motifDenonciation: string | null;
            representationRdc: string | null;
            attestationsBonneConduiteLe: Date | null;
            partMainOeuvreLocale: number | null;
            sourceMainOeuvre: string | null;
            dateMainOeuvre: Date | null;
        }[];
        propositionMainOeuvre: {
            part: number | null;
            effectif: number;
            nationaux: number;
            source: string;
            reserve: string | null;
        } | null;
        dateReference: string;
    }>;
    enregistrer(tenantId: string, dto: {
        reference: string;
        dateSignature: string;
        dureeAnnees: number;
        taciteReconduction?: boolean;
        preavisMois?: number | null;
        representationRdc?: string | null;
        attestationsBonneConduiteLe?: string | null;
    }): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        reference: string;
        dateSignature: Date;
        dureeAnnees: number;
        taciteReconduction: boolean;
        preavisMois: number | null;
        denonceLe: Date | null;
        motifDenonciation: string | null;
        representationRdc: string | null;
        attestationsBonneConduiteLe: Date | null;
        partMainOeuvreLocale: number | null;
        sourceMainOeuvre: string | null;
        dateMainOeuvre: Date | null;
    }>;
    declarerMainOeuvre(tenantId: string, id: string, dto: {
        part: number;
        source: string;
        date: string;
    }): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        reference: string;
        dateSignature: Date;
        dureeAnnees: number;
        taciteReconduction: boolean;
        preavisMois: number | null;
        denonceLe: Date | null;
        motifDenonciation: string | null;
        representationRdc: string | null;
        attestationsBonneConduiteLe: Date | null;
        partMainOeuvreLocale: number | null;
        sourceMainOeuvre: string | null;
        dateMainOeuvre: Date | null;
    }>;
    denoncer(tenantId: string, id: string, dto: {
        denonceLe: string;
        motif: string;
    }): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        reference: string;
        dateSignature: Date;
        dureeAnnees: number;
        taciteReconduction: boolean;
        preavisMois: number | null;
        denonceLe: Date | null;
        motifDenonciation: string | null;
        representationRdc: string | null;
        attestationsBonneConduiteLe: Date | null;
        partMainOeuvreLocale: number | null;
        sourceMainOeuvre: string | null;
        dateMainOeuvre: Date | null;
    }>;
}
