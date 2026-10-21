import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { TiersService } from './tiers.service';
import { CompletionPanopliesDto, CreerTiersDto, ModifierTiersDto, NumeroProposeDto, RattacherCompteDto } from './dto/tiers.dto';
import { CreerModeleReglementDto, ModifierModeleReglementDto, CreerEcheanceReglementDto, CalculerEcheancesDto, EcheancierDeLigneDto } from './dto/modele-reglement.dto';
import { TypeTiers } from '@prisma/client';
export declare class TiersController {
    private readonly tiersService;
    constructor(tiersService: TiersService);
    lister(user: AuthenticatedUser, type?: TypeTiers, recherche?: string, actifsSeuls?: string): Promise<({
        modeleReglement: {
            id: string;
            tenantId: string;
            createdAt: Date;
            estActif: boolean;
            intitule: string;
            modeReglementId: string | null;
            delaiJours: number;
            echeance: import(".prisma/client").$Enums.ConditionEcheance;
        } | null;
        modeReglement: {
            nature: import(".prisma/client").$Enums.NatureModeReglement;
            id: string;
            estActif: boolean;
            intitule: string;
            code: string;
        } | null;
        comptesRattaches: ({
            compte: {
                id: string;
                tenantId: string;
                estActif: boolean;
                numero: string;
                intitule: string;
                classe: import(".prisma/client").$Enums.ClasseCompte;
                typeCompte: import(".prisma/client").$Enums.TypeCompteDetailTotal;
                modeReportANouveau: import(".prisma/client").$Enums.ModeReportANouveau;
                estRetenu: boolean;
                lettrable: boolean;
                collectifId: string | null;
                tauxTvaDefautId: string | null;
                codeRetraitementFiscal: string | null;
                comportementGestion: import(".prisma/client").$Enums.ComportementGestion | null;
                partVariableGestionPct: import("@prisma/client/runtime/library").Decimal | null;
                bailleurId: string | null;
                porteFondsContrepartieEtat: boolean;
            };
        } & {
            id: string;
            createdAt: Date;
            tiersId: string;
            estPrincipal: boolean;
            compteId: string;
        })[];
    } & {
        email: string | null;
        nom: string;
        type: import(".prisma/client").$Enums.TypeTiers;
        id: string;
        tenantId: string;
        createdAt: Date;
        adresse: string | null;
        ville: string | null;
        pays: string | null;
        telephone: string | null;
        numeroImpot: string | null;
        estActif: boolean;
        code: string;
        contact: string | null;
        boitePostale: string | null;
        qualite: string | null;
        horsRelance: boolean;
        motifHorsRelance: string | null;
        horsRelanceDepuis: Date | null;
        celluleGroupeId: string | null;
        autoriseTvaDebits: boolean;
        referenceAutorisationDebits: string | null;
        dateEffetAutorisationDebits: Date | null;
        dateRevocationAutorisationDebits: Date | null;
        modeleReglementId: string | null;
        modeReglementId: string | null;
        validationAutomatiqueEcheances: boolean;
        modeleImpressionExtraitId: string | null;
        modeleImpressionReglementId: string | null;
        modeleImpressionRappelId: string | null;
    })[]>;
    dossiersDuGroupe(user: AuthenticatedUser): Promise<{
        id: string;
        nom: string;
        estDossierMere: boolean;
    }[]>;
    numeroPropose(user: AuthenticatedUser, dto: NumeroProposeDto): Promise<import("./tiers.service").NumeroPropose>;
    echeancierDeLigne(user: AuthenticatedUser, compteId: string, dto: EcheancierDeLigneDto): Promise<{
        applicable: boolean;
        echeances: never[];
        motif: string | null;
        tiers: {
            id: string;
            code: string;
            nom: string;
        } | null;
        modele: {
            id: string;
            intitule: string;
        } | null;
        validationAutomatique: boolean;
        modeHabituel: {
            id: string;
            code: string;
        } | null;
    } | {
        applicable: boolean;
        echeances: {
            ordre: number;
            montant: number;
            dateEcheance: string;
            modeReglementId: string | null;
            modeCode: string | null;
        }[];
        motif: null;
        tiers: {
            id: string;
            code: string;
            nom: string;
        } | null;
        modele: {
            id: string;
            intitule: string;
        } | null;
        validationAutomatique: boolean;
        modeHabituel: {
            id: string;
            code: string;
        } | null;
    }>;
    duplication(user: AuthenticatedUser, id: string): Promise<import("./duplication-tiers").CopieDuTiers>;
    obtenir(user: AuthenticatedUser, id: string): Promise<{
        modeleReglement: {
            id: string;
            tenantId: string;
            createdAt: Date;
            estActif: boolean;
            intitule: string;
            modeReglementId: string | null;
            delaiJours: number;
            echeance: import(".prisma/client").$Enums.ConditionEcheance;
        } | null;
        modeReglement: {
            nature: import(".prisma/client").$Enums.NatureModeReglement;
            id: string;
            estActif: boolean;
            intitule: string;
            code: string;
        } | null;
        comptesRattaches: ({
            compte: {
                id: string;
                tenantId: string;
                estActif: boolean;
                numero: string;
                intitule: string;
                classe: import(".prisma/client").$Enums.ClasseCompte;
                typeCompte: import(".prisma/client").$Enums.TypeCompteDetailTotal;
                modeReportANouveau: import(".prisma/client").$Enums.ModeReportANouveau;
                estRetenu: boolean;
                lettrable: boolean;
                collectifId: string | null;
                tauxTvaDefautId: string | null;
                codeRetraitementFiscal: string | null;
                comportementGestion: import(".prisma/client").$Enums.ComportementGestion | null;
                partVariableGestionPct: import("@prisma/client/runtime/library").Decimal | null;
                bailleurId: string | null;
                porteFondsContrepartieEtat: boolean;
            };
        } & {
            id: string;
            createdAt: Date;
            tiersId: string;
            estPrincipal: boolean;
            compteId: string;
        })[];
    } & {
        email: string | null;
        nom: string;
        type: import(".prisma/client").$Enums.TypeTiers;
        id: string;
        tenantId: string;
        createdAt: Date;
        adresse: string | null;
        ville: string | null;
        pays: string | null;
        telephone: string | null;
        numeroImpot: string | null;
        estActif: boolean;
        code: string;
        contact: string | null;
        boitePostale: string | null;
        qualite: string | null;
        horsRelance: boolean;
        motifHorsRelance: string | null;
        horsRelanceDepuis: Date | null;
        celluleGroupeId: string | null;
        autoriseTvaDebits: boolean;
        referenceAutorisationDebits: string | null;
        dateEffetAutorisationDebits: Date | null;
        dateRevocationAutorisationDebits: Date | null;
        modeleReglementId: string | null;
        modeReglementId: string | null;
        validationAutomatiqueEcheances: boolean;
        modeleImpressionExtraitId: string | null;
        modeleImpressionReglementId: string | null;
        modeleImpressionRappelId: string | null;
    }>;
    creer(user: AuthenticatedUser, dto: CreerTiersDto): Promise<{
        compteIndividuel: {
            id: string;
            numero: string;
            collectif: string;
        } | null;
        panoplie: import("./tiers.service").PanoplieTiers | null;
        email: string | null;
        nom: string;
        type: import(".prisma/client").$Enums.TypeTiers;
        id: string;
        tenantId: string;
        createdAt: Date;
        adresse: string | null;
        ville: string | null;
        pays: string | null;
        telephone: string | null;
        numeroImpot: string | null;
        estActif: boolean;
        code: string;
        contact: string | null;
        boitePostale: string | null;
        qualite: string | null;
        horsRelance: boolean;
        motifHorsRelance: string | null;
        horsRelanceDepuis: Date | null;
        celluleGroupeId: string | null;
        autoriseTvaDebits: boolean;
        referenceAutorisationDebits: string | null;
        dateEffetAutorisationDebits: Date | null;
        dateRevocationAutorisationDebits: Date | null;
        modeleReglementId: string | null;
        modeReglementId: string | null;
        validationAutomatiqueEcheances: boolean;
        modeleImpressionExtraitId: string | null;
        modeleImpressionReglementId: string | null;
        modeleImpressionRappelId: string | null;
    }>;
    modifier(user: AuthenticatedUser, id: string, dto: ModifierTiersDto): Promise<{
        email: string | null;
        nom: string;
        type: import(".prisma/client").$Enums.TypeTiers;
        id: string;
        tenantId: string;
        createdAt: Date;
        adresse: string | null;
        ville: string | null;
        pays: string | null;
        telephone: string | null;
        numeroImpot: string | null;
        estActif: boolean;
        code: string;
        contact: string | null;
        boitePostale: string | null;
        qualite: string | null;
        horsRelance: boolean;
        motifHorsRelance: string | null;
        horsRelanceDepuis: Date | null;
        celluleGroupeId: string | null;
        autoriseTvaDebits: boolean;
        referenceAutorisationDebits: string | null;
        dateEffetAutorisationDebits: Date | null;
        dateRevocationAutorisationDebits: Date | null;
        modeleReglementId: string | null;
        modeReglementId: string | null;
        validationAutomatiqueEcheances: boolean;
        modeleImpressionExtraitId: string | null;
        modeleImpressionReglementId: string | null;
        modeleImpressionRappelId: string | null;
    }>;
    fusionner(user: AuthenticatedUser, id: string, cibleId: string): Promise<{
        fusionne: boolean;
        conserve: string;
        supprime: string;
        reporte: string[];
    }>;
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
    completerPanoplie(user: AuthenticatedUser, id: string): Promise<import("./tiers.service").PanoplieTiers>;
    completerPanoplies(user: AuthenticatedUser, dto: CompletionPanopliesDto): Promise<import("./tiers.service").CompletionPanoplies>;
    rattacherCompte(user: AuthenticatedUser, id: string, dto: RattacherCompteDto): Promise<{
        id: string;
        createdAt: Date;
        tiersId: string;
        estPrincipal: boolean;
        compteId: string;
    }>;
    definirComptePrincipal(user: AuthenticatedUser, id: string, compteId: string): Promise<{
        id: string;
        createdAt: Date;
        tiersId: string;
        estPrincipal: boolean;
        compteId: string;
    }>;
    detacherCompte(user: AuthenticatedUser, id: string, compteId: string): Promise<{
        compteId: string;
        detache: boolean;
    }>;
}
export declare class ModeleReglementController {
    private readonly tiersService;
    constructor(tiersService: TiersService);
    lister(user: AuthenticatedUser): Promise<({
        echeances: {
            type: import(".prisma/client").$Enums.TypeEcheance;
            id: string;
            ordre: number;
            modeleReglementId: string;
            modeReglementId: string | null;
            valeur: import("@prisma/client/runtime/library").Decimal | null;
            delaiJours: number;
            echeance: import(".prisma/client").$Enums.ConditionEcheance;
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        intitule: string;
        modeReglementId: string | null;
        delaiJours: number;
        echeance: import(".prisma/client").$Enums.ConditionEcheance;
    })[]>;
    creer(user: AuthenticatedUser, dto: CreerModeleReglementDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        intitule: string;
        modeReglementId: string | null;
        delaiJours: number;
        echeance: import(".prisma/client").$Enums.ConditionEcheance;
    }>;
    modifier(user: AuthenticatedUser, id: string, dto: ModifierModeleReglementDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        intitule: string;
        modeReglementId: string | null;
        delaiJours: number;
        echeance: import(".prisma/client").$Enums.ConditionEcheance;
    }>;
    listerEcheances(user: AuthenticatedUser, id: string): Promise<{
        type: import(".prisma/client").$Enums.TypeEcheance;
        id: string;
        ordre: number;
        modeleReglementId: string;
        modeReglementId: string | null;
        valeur: import("@prisma/client/runtime/library").Decimal | null;
        delaiJours: number;
        echeance: import(".prisma/client").$Enums.ConditionEcheance;
    }[]>;
    ajouterEcheance(user: AuthenticatedUser, id: string, dto: CreerEcheanceReglementDto): Promise<{
        type: import(".prisma/client").$Enums.TypeEcheance;
        id: string;
        ordre: number;
        modeleReglementId: string;
        modeReglementId: string | null;
        valeur: import("@prisma/client/runtime/library").Decimal | null;
        delaiJours: number;
        echeance: import(".prisma/client").$Enums.ConditionEcheance;
    }>;
    supprimerEcheance(user: AuthenticatedUser, id: string, echeanceId: string): Promise<{
        id: string;
        supprimee: boolean;
    }>;
    calculerEcheances(user: AuthenticatedUser, id: string, dto: CalculerEcheancesDto): Promise<import("./echeancier-modele").EcheanceCalculee[]>;
}
