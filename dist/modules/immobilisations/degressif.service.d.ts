import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { OptionDegressifDto, PasserDerogatoireDto } from './dto/immobilisation.dto';
export declare class DegressifService {
    private readonly prisma;
    private readonly ecritures;
    constructor(prisma: PrismaService, ecritures: EcritureService);
    private immo;
    private cumul;
    private plan;
    private natureBareme;
    planFiscal(tenantId: string, id: string): Promise<{
        degressifFiscal: boolean;
        categories: readonly [{
            readonly cle: "MATERIEL_INDUSTRIEL";
            readonly libelle: "Matériels et outillages utilisés pour des opérations industrielles de fabrication, de transformation, d'extraction ou de transport, à l'exclusion des véhicules de tourisme";
        }, {
            readonly cle: "MANUTENTION_LEVAGE";
            readonly libelle: "Matériels de manutention ou de levage, à l’exclusion des chariots métalliques mis à la disposition des clients des magasins";
        }, {
            readonly cle: "INSTALLATIONS_ENERGIE";
            readonly libelle: "Installations productrices de vapeur, chaleur, énergie et froid industriel";
        }, {
            readonly cle: "INSTALLATIONS_SECURITE";
            readonly libelle: "Installations de sécurité";
        }, {
            readonly cle: "MEDICO_SOCIAL";
            readonly libelle: "Installations à caractère médico-social, à l’exclusion des installations purement sociales, d’ordre sportif ou uniquement consacrées à l’organisation des loisirs";
        }, {
            readonly cle: "MACHINES_DE_BUREAU";
            readonly libelle: "Machines de bureau, à l’exclusion de tout autre matériel et du mobilier de bureau";
        }, {
            readonly cle: "RECHERCHE";
            readonly libelle: "Matériel et outillage utilisés à des opérations de recherche scientifique ou technique";
        }, {
            readonly cle: "MAGASINAGE_STOCKAGE";
            readonly libelle: "Installations de magasinage et de stockage, à l’exclusion des locaux servant à l’exercice de la profession";
        }, {
            readonly cle: "HOTELLERIE";
            readonly libelle: "Immeubles et matériels des entreprises hôtelières, à l’exclusion des biens d’équipement des entreprises exerçant uniquement l’activité de restaurateur ou de cafetier";
        }, {
            readonly cle: "AGRICULTURE_ELEVAGE";
            readonly libelle: "Machines agricoles et installations d’élevage, à l’exception des bâtiments et des terrains";
        }];
        lignes: never[];
        cumulDerogatoire: number;
        regimeAnterieur: string | null;
        natureBareme: {
            cle: string;
            designation: string;
            dureeAns: number;
        } | null;
        amortissementExceptionnel?: undefined;
        prorataExport?: undefined;
        sourceChiffreAffairesExport?: undefined;
        categorie?: undefined;
        dureeFiscaleAns?: undefined;
        coefficient?: undefined;
        avertissements?: undefined;
    } | {
        degressifFiscal: boolean;
        amortissementExceptionnel: boolean;
        prorataExport: number | null;
        sourceChiffreAffairesExport: string | null;
        categorie: string | null;
        dureeFiscaleAns: number | null;
        coefficient: number | null;
        categories: readonly [{
            readonly cle: "MATERIEL_INDUSTRIEL";
            readonly libelle: "Matériels et outillages utilisés pour des opérations industrielles de fabrication, de transformation, d'extraction ou de transport, à l'exclusion des véhicules de tourisme";
        }, {
            readonly cle: "MANUTENTION_LEVAGE";
            readonly libelle: "Matériels de manutention ou de levage, à l’exclusion des chariots métalliques mis à la disposition des clients des magasins";
        }, {
            readonly cle: "INSTALLATIONS_ENERGIE";
            readonly libelle: "Installations productrices de vapeur, chaleur, énergie et froid industriel";
        }, {
            readonly cle: "INSTALLATIONS_SECURITE";
            readonly libelle: "Installations de sécurité";
        }, {
            readonly cle: "MEDICO_SOCIAL";
            readonly libelle: "Installations à caractère médico-social, à l’exclusion des installations purement sociales, d’ordre sportif ou uniquement consacrées à l’organisation des loisirs";
        }, {
            readonly cle: "MACHINES_DE_BUREAU";
            readonly libelle: "Machines de bureau, à l’exclusion de tout autre matériel et du mobilier de bureau";
        }, {
            readonly cle: "RECHERCHE";
            readonly libelle: "Matériel et outillage utilisés à des opérations de recherche scientifique ou technique";
        }, {
            readonly cle: "MAGASINAGE_STOCKAGE";
            readonly libelle: "Installations de magasinage et de stockage, à l’exclusion des locaux servant à l’exercice de la profession";
        }, {
            readonly cle: "HOTELLERIE";
            readonly libelle: "Immeubles et matériels des entreprises hôtelières, à l’exclusion des biens d’équipement des entreprises exerçant uniquement l’activité de restaurateur ou de cafetier";
        }, {
            readonly cle: "AGRICULTURE_ELEVAGE";
            readonly libelle: "Machines agricoles et installations d’élevage, à l’exception des bâtiments et des terrains";
        }];
        lignes: {
            exerciceId: string;
            dateDebut: Date;
            dateFin: Date;
            valeurResiduelleDebut: number;
            annuiteFiscale: number;
            mode: "DEGRESSIF" | "LINEAIRE_ART_35" | "EXCEPTIONNEL_ART_38";
            dotationComptable: number | null;
            derogatoire: {
                dotation: number;
                reprise: number;
                excedentAReintegrer: number;
            } | null;
        }[];
        cumulDerogatoire: number;
        regimeAnterieur: string | null;
        natureBareme: {
            cle: string;
            designation: string;
            dureeAns: number;
        } | null;
        avertissements: string[];
    }>;
    opter(tenantId: string, id: string, dto: OptionDegressifDto): Promise<{
        avertissements: string[];
        id: string;
        degressifFiscal: boolean;
        categorieDegressif: string | null;
        dureeFiscaleAns: number | null;
        amortissementExceptionnel: boolean;
    }>;
    private enregistrer;
    private compte;
    passer(tenantId: string, userId: string, id: string, dto: PasserDerogatoireDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        nature: import(".prisma/client").$Enums.NatureDerogatoire;
        exerciceId: string;
        ecritureId: string | null;
        immobilisationId: string;
        dotation: Prisma.Decimal;
        reprise: Prisma.Decimal;
        annuiteFiscale: Prisma.Decimal;
        dotationComptable: Prisma.Decimal;
        excedentAReintegrer: Prisma.Decimal;
    }>;
    solder(tenantId: string, userId: string, id: string, dto: PasserDerogatoireDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        nature: import(".prisma/client").$Enums.NatureDerogatoire;
        exerciceId: string;
        ecritureId: string | null;
        immobilisationId: string;
        dotation: Prisma.Decimal;
        reprise: Prisma.Decimal;
        annuiteFiscale: Prisma.Decimal;
        dotationComptable: Prisma.Decimal;
        excedentAReintegrer: Prisma.Decimal;
    }>;
}
