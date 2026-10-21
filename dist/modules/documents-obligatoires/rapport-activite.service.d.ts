import { JeuEtatsFinanciersSycebnl, Prisma, Referentiel, SystemeComptableSyscohada } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EtatsFinanciersService } from '../etats-financiers/etats-financiers.service';
import { EtatsFinanciersSyscohadaService } from '../etats-financiers-syscohada/etats-financiers-syscohada.service';
import { DonationService } from '../registre-donateurs/donation.service';
import { EtablirRapportActiviteDto } from './dto/documents-obligatoires.dto';
export interface TresorerieDuRapport {
    tableau?: TableauTresorerieRapport;
    ouverture: number | null;
    variation: number | null;
    cloture: number;
    boucle: boolean | null;
    motifNonControlable?: string | null;
}
export type TableauTresorerieRapport = 'TFT_ASSOCIATIONS' | 'TFT_SYSCOHADA_NORMAL';
export declare function tableauTresorerieDuDossier(tenant: {
    referentiel: Referentiel;
    jeuEtatsFinanciersSycebnl: JeuEtatsFinanciersSycebnl;
    systemeComptableSyscohada: SystemeComptableSyscohada | null;
}): TableauTresorerieRapport | null;
export declare function tresorerieFigee(stockee: unknown, attendu: TableauTresorerieRapport | null): TresorerieDuRapport | null;
export declare class RapportActiviteService {
    private readonly prisma;
    private readonly etatsFinanciers;
    private readonly donationService;
    private readonly etatsSyscohada;
    constructor(prisma: PrismaService, etatsFinanciers: EtatsFinanciersService, donationService: DonationService, etatsSyscohada: EtatsFinanciersSyscohadaService);
    lister(tenantId: string, exerciceId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        exerciceId: string;
        version: number;
        etabliLe: Date;
        etabliPar: string;
        sections: Prisma.JsonValue | null;
        situationExerciceEcoule: string | null;
        perspectivesDeveloppement: string | null;
        evolutionTresorerie: string | null;
        evenementsPosterieurs: string | null;
        entiteAvecAuditeur: boolean;
        declarationDirigeants: string | null;
        sourceRegle: string | null;
        tresorerie: Prisma.JsonValue | null;
    }[]>;
    courant(tenantId: string, exerciceId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        exerciceId: string;
        version: number;
        etabliLe: Date;
        etabliPar: string;
        sections: Prisma.JsonValue | null;
        situationExerciceEcoule: string | null;
        perspectivesDeveloppement: string | null;
        evolutionTresorerie: string | null;
        evenementsPosterieurs: string | null;
        entiteAvecAuditeur: boolean;
        declarationDirigeants: string | null;
        sourceRegle: string | null;
        tresorerie: Prisma.JsonValue | null;
    } | null>;
    private regimeRapport;
    etablir(tenantId: string, userId: string, dto: EtablirRapportActiviteDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        exerciceId: string;
        version: number;
        etabliLe: Date;
        etabliPar: string;
        sections: Prisma.JsonValue | null;
        situationExerciceEcoule: string | null;
        perspectivesDeveloppement: string | null;
        evolutionTresorerie: string | null;
        evenementsPosterieurs: string | null;
        entiteAvecAuditeur: boolean;
        declarationDirigeants: string | null;
        sourceRegle: string | null;
        tresorerie: Prisma.JsonValue | null;
    }>;
    conformiteRapportGestion(tenantId: string, exerciceId: string): Promise<{
        exercice: {
            id: string;
            dateDebut: Date;
            dateFin: Date;
        };
        regleLue: boolean;
        motif: string;
        exigence: string | null;
        etabli: boolean;
        version: number | null;
        etabliLe: Date | null;
        sections: Array<{
            cle: string;
            titre: string;
            exigence: string;
            renseignee: boolean;
        }>;
        fenetreEvenementsPosterieurs: {
            du: Date;
            au: Date;
            article: string;
        } | null;
        tresorerie: TresorerieDuRapport | null;
        mentionTransformation: string | null;
        modificationsDeMethodeEnregistrees: number;
        complet: boolean;
    } | {
        exercice: {
            id: string;
            dateDebut: Date;
            dateFin: Date;
        };
        regleLue: boolean;
        motif: string | null;
        exigence: string;
        etabli: boolean;
        version: number | null;
        etabliLe: Date | null;
        sections: {
            renseignee: boolean;
            cle: string;
            titre: string;
            exigence: string;
        }[];
        fenetreEvenementsPosterieurs: {
            du: Date;
            au: Date;
            article: string;
        } | null;
        tresorerie: TresorerieDuRapport | null;
        mentionTransformation: string | null;
        modificationsDeMethodeEnregistrees: number;
        complet: boolean;
    }>;
    conformite(tenantId: string, exerciceId: string): Promise<{
        exercice: {
            id: string;
            dateDebut: Date;
            dateFin: Date;
        };
        exigence: string;
        etabli: boolean;
        version: number | null;
        etabliLe: Date | null;
        sections: {
            renseignee: boolean;
            cle: "situationExerciceEcoule" | "perspectivesDeveloppement" | "evolutionTresorerie" | "evenementsPosterieurs";
            titre: string;
            exigence: string;
        }[];
        fenetreEvenementsPosterieurs: {
            du: Date;
            au: Date;
            article: string;
        } | null;
        tresorerie: TresorerieDuRapport | null;
        declarationRegistreDonateurs: {
            exigence: string;
            remarque: string;
            entiteAvecAuditeur: boolean;
            attendue: boolean;
            renseignee: boolean;
            registreConforme: boolean;
        };
        complet: boolean;
    }>;
    private tresorerieDuTft;
    private tableauDuDossier;
    private exercice;
}
