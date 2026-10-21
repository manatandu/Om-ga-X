import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AvancesRubriquesService } from './avances-rubriques.service';
import { AvanceSalaireDto, FinSaisieArretDto, ModeleBulletinDto, ModifierRubriquePaieDto, RubriquePaieDto } from './dto/personnel.dto';
export declare class AvancesRubriquesController {
    private readonly service;
    constructor(service: AvancesRubriquesService);
    listerRubriques(user: AuthenticatedUser): Promise<{
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
    creerRubrique(user: AuthenticatedUser, dto: RubriquePaieDto): Promise<{
        nature: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        code: string;
        libelle: string;
        fondement: string;
        actif: boolean;
    }>;
    modifierRubrique(user: AuthenticatedUser, id: string, dto: ModifierRubriquePaieDto): Promise<{
        nature: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        code: string;
        libelle: string;
        fondement: string;
        actif: boolean;
    }>;
    listerModeles(user: AuthenticatedUser): Promise<{
        modeles: {
            nom: string;
            id: string;
            tenantId: string;
            createdAt: Date;
            creePar: string;
            categorie: string | null;
            deviseStipulation: string;
            lignes: import("@prisma/client/runtime/library").JsonValue;
        }[];
        total: number;
        plafond: number;
        tronque: boolean;
    }>;
    creerModele(user: AuthenticatedUser, dto: ModeleBulletinDto): Promise<{
        nom: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        creePar: string;
        categorie: string | null;
        deviseStipulation: string;
        lignes: import("@prisma/client/runtime/library").JsonValue;
    }>;
    supprimerModele(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
    listerAvances(user: AuthenticatedUser, salarieId?: string): Promise<{
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
    creerAvance(user: AuthenticatedUser, salarieId: string, dto: AvanceSalaireDto): Promise<{
        montantFc: import("@prisma/client/runtime/library").Decimal;
        retenueMensuelleFc: import("@prisma/client/runtime/library").Decimal | null;
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
    terminerSaisie(user: AuthenticatedUser, id: string, dto: FinSaisieArretDto): Promise<{
        montantFc: import("@prisma/client/runtime/library").Decimal;
        retenueMensuelleFc: import("@prisma/client/runtime/library").Decimal | null;
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
    supprimerAvance(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
