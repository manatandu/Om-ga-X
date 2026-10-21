import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { AvanceSalaireDto, FinSaisieArretDto, ModeleBulletinDto, ModifierRubriquePaieDto, RubriquePaieDto } from './dto/personnel.dto';
export declare const PLAFOND_LISTES_PAIE = 500;
export declare class AvancesRubriquesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listerRubriques(tenantId: string): Promise<{
        rubriques: {
            nature: string;
            id: string;
            tenantId: string;
            createdAt: Date;
            code: string;
            libelle: string;
            fondement: string;
            actif: boolean;
        }[];
        naturesPermises: readonly import("./assiettes-paie").NatureElementPaie[];
        total: number;
        plafond: number;
        tronque: boolean;
    }>;
    creerRubrique(tenantId: string, dto: RubriquePaieDto): Promise<{
        nature: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        code: string;
        libelle: string;
        fondement: string;
        actif: boolean;
    }>;
    modifierRubrique(tenantId: string, id: string, dto: ModifierRubriquePaieDto): Promise<{
        nature: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        code: string;
        libelle: string;
        fondement: string;
        actif: boolean;
    }>;
    listerModeles(tenantId: string): Promise<{
        modeles: {
            nom: string;
            id: string;
            tenantId: string;
            createdAt: Date;
            creePar: string;
            categorie: string | null;
            deviseStipulation: string;
            lignes: Prisma.JsonValue;
        }[];
        total: number;
        plafond: number;
        tronque: boolean;
    }>;
    creerModele(tenantId: string, creePar: string, dto: ModeleBulletinDto): Promise<{
        nom: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        creePar: string;
        categorie: string | null;
        deviseStipulation: string;
        lignes: Prisma.JsonValue;
    }>;
    supprimerModele(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
    listerAvances(tenantId: string, salarieId?: string): Promise<{
        avances: {
            id: string;
            salarieId: string;
            salarie: string;
            matricule: string | null;
            type: import(".prisma/client").$Enums.TypeAvanceSalaire;
            categoriePret: import(".prisma/client").$Enums.CategoriePretPersonnel | null;
            littera: "f" | "c" | "g";
            compte: {
                compte: string;
                intitule: string;
            };
            dateOctroi: Date;
            montantFc: number;
            retenueMensuelleFc: number | null;
            objet: string;
            pieceJustificative: string;
            referenceActe: string | null;
            greffe: string | null;
            destinataire: string | null;
            dateFin: Date | null;
            retenues: {
                montantFc: number;
                numero: number;
                moisDePaie: string;
                bulletinAnnule: boolean;
            }[];
            soldeFc: number;
        }[];
        total: number;
        plafond: number;
        tronque: boolean;
    }>;
    creerAvance(tenantId: string, email: string, salarieId: string, dto: AvanceSalaireDto): Promise<{
        montantFc: Prisma.Decimal;
        retenueMensuelleFc: Prisma.Decimal | null;
        objet: string;
        type: import(".prisma/client").$Enums.TypeAvanceSalaire;
        id: string;
        tenantId: string;
        createdAt: Date;
        dateFin: Date | null;
        creePar: string;
        destinataire: string | null;
        dateOctroi: Date;
        salarieId: string;
        categoriePret: import(".prisma/client").$Enums.CategoriePretPersonnel | null;
        pieceJustificative: string;
        referenceActe: string | null;
        greffe: string | null;
    }>;
    terminerSaisie(tenantId: string, id: string, dto: FinSaisieArretDto): Promise<{
        montantFc: Prisma.Decimal;
        retenueMensuelleFc: Prisma.Decimal | null;
        objet: string;
        type: import(".prisma/client").$Enums.TypeAvanceSalaire;
        id: string;
        tenantId: string;
        createdAt: Date;
        dateFin: Date | null;
        creePar: string;
        destinataire: string | null;
        dateOctroi: Date;
        salarieId: string;
        categoriePret: import(".prisma/client").$Enums.CategoriePretPersonnel | null;
        pieceJustificative: string;
        referenceActe: string | null;
        greffe: string | null;
    }>;
    supprimerAvance(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
}
