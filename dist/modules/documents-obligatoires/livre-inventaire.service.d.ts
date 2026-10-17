import { JeuEtatsFinanciersSycebnl, Prisma, Referentiel, SystemeComptableSyscohada } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EtatsFinanciersService } from '../etats-financiers/etats-financiers.service';
import { EtatsFinanciersProjetService } from '../etats-financiers/etats-financiers-projet.service';
import { EtatsFinanciersSmtService } from '../etats-financiers/etats-financiers-smt.service';
import { EtatsFinanciersProjetBudgetService } from '../etats-financiers/etats-financiers-projet-budget.service';
import { CleEtatInventaire } from './correspondance-inventaire';
import { EtatsFinanciersSyscohadaService } from '../etats-financiers-syscohada/etats-financiers-syscohada.service';
import { EtatsFinanciersSmtSyscohadaService } from '../etats-financiers-syscohada/etats-financiers-smt-syscohada.service';
import { ResumeInventaireDto, TranscrireInventaireDto } from './dto/documents-obligatoires.dto';
export interface DocumentManquant {
    cle: CleEtatInventaire;
    libelle: string;
    motif: string;
}
export declare function fondementInventaire(tenant: {
    referentiel: Referentiel;
    jeuEtatsFinanciersSycebnl: JeuEtatsFinanciersSycebnl;
    systemeComptableSyscohada: SystemeComptableSyscohada | null;
}): {
    article: string;
    perimetre: string;
    sanction: string;
};
export declare class LivreInventaireService {
    private readonly prisma;
    private readonly etatsFinanciers;
    private readonly etatsFinanciersProjet;
    private readonly etatsFinanciersSmt;
    private readonly etatsFinanciersProjetBudget;
    private readonly etatsSyscohada;
    private readonly etatsSmtSyscohada;
    constructor(prisma: PrismaService, etatsFinanciers: EtatsFinanciersService, etatsFinanciersProjet: EtatsFinanciersProjetService, etatsFinanciersSmt: EtatsFinanciersSmtService, etatsFinanciersProjetBudget: EtatsFinanciersProjetBudgetService, etatsSyscohada: EtatsFinanciersSyscohadaService, etatsSmtSyscohada: EtatsFinanciersSmtSyscohadaService);
    private regimeInventaire;
    lister(tenantId: string, exerciceId: string): Promise<{
        id: string;
        tenantId: string;
        exerciceId: string;
        version: number;
        jeu: import(".prisma/client").$Enums.JeuEtatsFinanciersSycebnl | null;
        systemeSyscohada: import(".prisma/client").$Enums.SystemeComptableSyscohada | null;
        etats: Prisma.JsonValue;
        documentsManquants: Prisma.JsonValue;
        resumeOperationInventaire: string | null;
        transcritLe: Date;
        transcritPar: string;
    }[]>;
    courante(tenantId: string, exerciceId: string): Promise<{
        id: string;
        tenantId: string;
        exerciceId: string;
        version: number;
        jeu: import(".prisma/client").$Enums.JeuEtatsFinanciersSycebnl | null;
        systemeSyscohada: import(".prisma/client").$Enums.SystemeComptableSyscohada | null;
        etats: Prisma.JsonValue;
        documentsManquants: Prisma.JsonValue;
        resumeOperationInventaire: string | null;
        transcritLe: Date;
        transcritPar: string;
    } | null>;
    transcrire(tenantId: string, userId: string, dto: TranscrireInventaireDto): Promise<{
        id: string;
        tenantId: string;
        exerciceId: string;
        version: number;
        jeu: import(".prisma/client").$Enums.JeuEtatsFinanciersSycebnl | null;
        systemeSyscohada: import(".prisma/client").$Enums.SystemeComptableSyscohada | null;
        etats: Prisma.JsonValue;
        documentsManquants: Prisma.JsonValue;
        resumeOperationInventaire: string | null;
        transcritLe: Date;
        transcritPar: string;
    }>;
    renseignerResume(tenantId: string, id: string, dto: ResumeInventaireDto): Promise<{
        id: string;
        tenantId: string;
        exerciceId: string;
        version: number;
        jeu: import(".prisma/client").$Enums.JeuEtatsFinanciersSycebnl | null;
        systemeSyscohada: import(".prisma/client").$Enums.SystemeComptableSyscohada | null;
        etats: Prisma.JsonValue;
        documentsManquants: Prisma.JsonValue;
        resumeOperationInventaire: string | null;
        transcritLe: Date;
        transcritPar: string;
    }>;
    conformite(tenantId: string, exerciceId: string): Promise<{
        exercice: {
            id: string;
            dateDebut: Date;
            dateFin: Date;
        };
        jeu: import(".prisma/client").$Enums.JeuEtatsFinanciersSycebnl | null;
        systemeSyscohada: import(".prisma/client").$Enums.SystemeComptableSyscohada | null;
        exigence: string;
        fondement: {
            article: string;
            perimetre: string;
            sanction: string;
        };
        transcrit: boolean;
        version: number | null;
        transcritLe: Date | null;
        etatsExiges: {
            cle: CleEtatInventaire;
            libelle: string;
            transcrit: boolean;
            motifIndisponibilite: string | null;
        }[];
        documentsManquants: DocumentManquant[];
        resume: {
            exigence: string;
            renseigne: boolean;
            remarque: string;
        };
        complete: boolean;
    }>;
    private produireSyscohada;
    private produire;
    private exercice;
}
