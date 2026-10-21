import { type CopieDuTiers } from './duplication-tiers';
import { type RolePanoplie } from './collectifs-tiers';
import { PrismaService } from '../../common/prisma.service';
import { Prisma, TypeTiers } from '@prisma/client';
import { CreerTiersDto, ModifierTiersDto, RattacherCompteDto } from './dto/tiers.dto';
import { CreerModeleReglementDto, ModifierModeleReglementDto, CreerEcheanceReglementDto, CalculerEcheancesDto, EcheancierDeLigneDto } from './dto/modele-reglement.dto';
export declare const TRANCHE_PANOPLIES = 100;
export interface PanoplieTiers {
    principal: {
        id: string;
        numero: string;
        collectif: string;
    } | null;
    crees: {
        role: RolePanoplie;
        numero: string;
        collectif: string;
    }[];
    dejaPresents: number;
    impossibles: {
        collectif: string;
        motif: string;
    }[];
    horsRang: {
        collectif: string;
        numero: string;
    }[];
}
export interface NumeroPropose {
    numero: string | null;
    collectif: string | null;
    longueur: number;
    motif: string | null;
}
export interface CompletionPanoplies {
    tiersLus: number;
    comptesCrees: number;
    impossibles: {
        tiers: string;
        collectif: string;
        motif: string;
    }[];
    horsRang: {
        tiers: string;
        numero: string;
    }[];
    suivant: string | null;
}
export declare class TiersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private trouver;
    lister(tenantId: string, filtres: {
        type?: TypeTiers;
        recherche?: string;
        actifsSeuls?: boolean;
    }): Promise<({
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
                partVariableGestionPct: Prisma.Decimal | null;
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
    obtenir(tenantId: string, tiersId: string): Promise<{
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
                partVariableGestionPct: Prisma.Decimal | null;
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
    creer(tenantId: string, dto: CreerTiersDto): Promise<{
        compteIndividuel: {
            id: string;
            numero: string;
            collectif: string;
        } | null;
        panoplie: PanoplieTiers | null;
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
    duplication(tenantId: string, tiersId: string): Promise<CopieDuTiers>;
    numeroPropose(tenantId: string, type: TypeTiers): Promise<NumeroPropose>;
    completerPanoplie(tenantId: string, tiersId: string): Promise<PanoplieTiers>;
    completerPanoplies(tenantId: string, apres?: string): Promise<CompletionPanoplies>;
    private poserPanoplie;
    private refuserAdherentHorsSycebnl;
    supprimer(tenantId: string, tiersId: string): Promise<{
        supprime: boolean;
    }>;
    fusionner(tenantId: string, sourceId: string, cibleId: string, utilisateurId: string): Promise<{
        fusionne: boolean;
        conserve: string;
        supprime: string;
        reporte: string[];
    }>;
    modifier(tenantId: string, tiersId: string, dto: ModifierTiersDto): Promise<{
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
    rattacherCompte(tenantId: string, tiersId: string, dto: RattacherCompteDto): Promise<{
        id: string;
        createdAt: Date;
        tiersId: string;
        estPrincipal: boolean;
        compteId: string;
    }>;
    definirComptePrincipal(tenantId: string, tiersId: string, compteId: string): Promise<{
        id: string;
        createdAt: Date;
        tiersId: string;
        estPrincipal: boolean;
        compteId: string;
    }>;
    detacherCompte(tenantId: string, tiersId: string, compteId: string): Promise<{
        compteId: string;
        detache: boolean;
    }>;
    dossiersDuGroupe(tenantId: string): Promise<{
        id: string;
        nom: string;
        estDossierMere: boolean;
    }[]>;
    private exigerMemeGroupe;
    private trouverModeleReglement;
    listerModelesReglement(tenantId: string): Promise<({
        echeances: {
            type: import(".prisma/client").$Enums.TypeEcheance;
            id: string;
            ordre: number;
            modeleReglementId: string;
            modeReglementId: string | null;
            valeur: Prisma.Decimal | null;
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
    private verifierModelesImpression;
    creerModeleReglement(tenantId: string, dto: CreerModeleReglementDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        intitule: string;
        modeReglementId: string | null;
        delaiJours: number;
        echeance: import(".prisma/client").$Enums.ConditionEcheance;
    }>;
    modifierModeleReglement(tenantId: string, id: string, dto: ModifierModeleReglementDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        intitule: string;
        modeReglementId: string | null;
        delaiJours: number;
        echeance: import(".prisma/client").$Enums.ConditionEcheance;
    }>;
    listerEcheances(tenantId: string, modeleId: string): Promise<{
        type: import(".prisma/client").$Enums.TypeEcheance;
        id: string;
        ordre: number;
        modeleReglementId: string;
        modeReglementId: string | null;
        valeur: Prisma.Decimal | null;
        delaiJours: number;
        echeance: import(".prisma/client").$Enums.ConditionEcheance;
    }[]>;
    ajouterEcheance(tenantId: string, modeleId: string, dto: CreerEcheanceReglementDto): Promise<{
        type: import(".prisma/client").$Enums.TypeEcheance;
        id: string;
        ordre: number;
        modeleReglementId: string;
        modeReglementId: string | null;
        valeur: Prisma.Decimal | null;
        delaiJours: number;
        echeance: import(".prisma/client").$Enums.ConditionEcheance;
    }>;
    supprimerEcheance(tenantId: string, modeleId: string, echeanceId: string): Promise<{
        id: string;
        supprimee: boolean;
    }>;
    calculerEcheances(tenantId: string, modeleId: string, dto: CalculerEcheancesDto): Promise<import("./echeancier-modele").EcheanceCalculee[]>;
    echeancierDeLigne(tenantId: string, compteId: string, dto: EcheancierDeLigneDto): Promise<{
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
}
