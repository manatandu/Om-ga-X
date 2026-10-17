import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { AvanceSalaireDto, FinSaisieArretDto, ModeleBulletinDto, ModifierRubriquePaieDto, RubriquePaieDto } from './dto/personnel.dto';
export declare const PLAFOND_LISTES_PAIE = 500;
export declare class AvancesRubriquesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listerRubriques(tenantId: string): Promise<{
        rubriques: {
            id: string;
            createdAt: Date;
            tenantId: string;
            nature: string;
            libelle: string;
            code: string;
            fondement: string;
            actif: boolean;
        }[];
        naturesPermises: readonly import("./assiettes-paie").NatureElementPaie[];
        total: number;
        plafond: number;
        tronque: boolean;
    }>;
    creerRubrique(tenantId: string, dto: RubriquePaieDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        nature: string;
        libelle: string;
        code: string;
        fondement: string;
        actif: boolean;
    }>;
    modifierRubrique(tenantId: string, id: string, dto: ModifierRubriquePaieDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        nature: string;
        libelle: string;
        code: string;
        fondement: string;
        actif: boolean;
    }>;
    listerModeles(tenantId: string): Promise<{
        modeles: {
            id: string;
            nom: string;
            createdAt: Date;
            tenantId: string;
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
        id: string;
        nom: string;
        createdAt: Date;
        tenantId: string;
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
            littera: "c" | "f" | "g";
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
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TypeAvanceSalaire;
        tenantId: string;
        dateFin: Date | null;
        montantFc: Prisma.Decimal;
        retenueMensuelleFc: Prisma.Decimal | null;
        objet: string;
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
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TypeAvanceSalaire;
        tenantId: string;
        dateFin: Date | null;
        montantFc: Prisma.Decimal;
        retenueMensuelleFc: Prisma.Decimal | null;
        objet: string;
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
