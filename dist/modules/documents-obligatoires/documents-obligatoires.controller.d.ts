import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { LivreInventaireService } from './livre-inventaire.service';
import { RapportActiviteService } from './rapport-activite.service';
import { ManuelProceduresService } from './manuel-procedures.service';
import { EnregistrerManuelDto } from './dto/manuel-procedures.dto';
import { EtablirRapportActiviteDto, ResumeInventaireDto, TranscrireInventaireDto } from './dto/documents-obligatoires.dto';
export declare class DocumentsObligatoiresController {
    private readonly livreInventaire;
    private readonly rapportActivite;
    private readonly manuelProcedures;
    constructor(livreInventaire: LivreInventaireService, rapportActivite: RapportActiviteService, manuelProcedures: ManuelProceduresService);
    transcriptions(user: AuthenticatedUser, exerciceId: string): Promise<{
        id: string;
        tenantId: string;
        exerciceId: string;
        version: number;
        jeu: import(".prisma/client").$Enums.JeuEtatsFinanciersSycebnl | null;
        systemeSyscohada: import(".prisma/client").$Enums.SystemeComptableSyscohada | null;
        etats: import("@prisma/client/runtime/library").JsonValue;
        documentsManquants: import("@prisma/client/runtime/library").JsonValue;
        resumeOperationInventaire: string | null;
        transcritLe: Date;
        transcritPar: string;
    }[]>;
    conformiteInventaire(user: AuthenticatedUser, exerciceId: string): Promise<{
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
            cle: import("./correspondance-inventaire").CleEtatInventaire;
            libelle: string;
            transcrit: boolean;
            motifIndisponibilite: string | null;
        }[];
        documentsManquants: import("./livre-inventaire.service").DocumentManquant[];
        resume: {
            exigence: string;
            renseigne: boolean;
            remarque: string;
        };
        complete: boolean;
    }>;
    transcrire(user: AuthenticatedUser, dto: TranscrireInventaireDto): Promise<{
        id: string;
        tenantId: string;
        exerciceId: string;
        version: number;
        jeu: import(".prisma/client").$Enums.JeuEtatsFinanciersSycebnl | null;
        systemeSyscohada: import(".prisma/client").$Enums.SystemeComptableSyscohada | null;
        etats: import("@prisma/client/runtime/library").JsonValue;
        documentsManquants: import("@prisma/client/runtime/library").JsonValue;
        resumeOperationInventaire: string | null;
        transcritLe: Date;
        transcritPar: string;
    }>;
    renseignerResume(user: AuthenticatedUser, id: string, dto: ResumeInventaireDto): Promise<{
        id: string;
        tenantId: string;
        exerciceId: string;
        version: number;
        jeu: import(".prisma/client").$Enums.JeuEtatsFinanciersSycebnl | null;
        systemeSyscohada: import(".prisma/client").$Enums.SystemeComptableSyscohada | null;
        etats: import("@prisma/client/runtime/library").JsonValue;
        documentsManquants: import("@prisma/client/runtime/library").JsonValue;
        resumeOperationInventaire: string | null;
        transcritLe: Date;
        transcritPar: string;
    }>;
    rapports(user: AuthenticatedUser, exerciceId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        exerciceId: string;
        version: number;
        etabliLe: Date;
        etabliPar: string;
        sections: import("@prisma/client/runtime/library").JsonValue | null;
        situationExerciceEcoule: string | null;
        perspectivesDeveloppement: string | null;
        evolutionTresorerie: string | null;
        evenementsPosterieurs: string | null;
        entiteAvecAuditeur: boolean;
        declarationDirigeants: string | null;
        sourceRegle: string | null;
        tresorerie: import("@prisma/client/runtime/library").JsonValue | null;
    }[]>;
    conformiteRapport(user: AuthenticatedUser, exerciceId: string): Promise<{
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
        sections: {
            cle: string;
            titre: string;
            exigence: string;
            renseignee: boolean;
        }[];
        fenetreEvenementsPosterieurs: {
            du: Date;
            au: Date;
            article: string;
        } | null;
        tresorerie: import("./rapport-activite.service").TresorerieDuRapport | null;
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
        tresorerie: import("./rapport-activite.service").TresorerieDuRapport | null;
        mentionTransformation: string | null;
        modificationsDeMethodeEnregistrees: number;
        complet: boolean;
    } | {
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
        tresorerie: import("./rapport-activite.service").TresorerieDuRapport | null;
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
    etablir(user: AuthenticatedUser, dto: EtablirRapportActiviteDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        exerciceId: string;
        version: number;
        etabliLe: Date;
        etabliPar: string;
        sections: import("@prisma/client/runtime/library").JsonValue | null;
        situationExerciceEcoule: string | null;
        perspectivesDeveloppement: string | null;
        evolutionTresorerie: string | null;
        evenementsPosterieurs: string | null;
        entiteAvecAuditeur: boolean;
        declarationDirigeants: string | null;
        sourceRegle: string | null;
        tresorerie: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    manuels(user: AuthenticatedUser): Promise<{
        sections: import("./manuel-procedures.service").SectionManuel[];
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        version: number;
        dateApplication: Date;
    }[]>;
    conformiteManuel(user: AuthenticatedUser): Promise<{
        source: string;
        existe: boolean;
        versionEnVigueur: number;
        dateApplication: Date;
        nombreVersions: number;
        sectionsVides: string[];
        classementRenseigne: boolean;
    }>;
    squeletteManuel(): Promise<import("./manuel-procedures.service").SectionManuel[]>;
    enregistrerManuel(user: AuthenticatedUser, dto: EnregistrerManuelDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        version: number;
        dateApplication: Date;
        sections: import("@prisma/client/runtime/library").JsonValue;
    }>;
}
