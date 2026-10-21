import { PrismaService } from '../../common/prisma.service';
import { Prisma, StatutExoneration, TypeDemandeExoneration } from '@prisma/client';
export declare function filtreEnAlerte(aujourdhui: Date): Prisma.ExonerationWhereInput;
export declare function motifRefusAccorde(d: {
    referenceArrete: string | null;
    dateArrete: Date | null;
    dateDebutValidite: Date | null;
    validiteMois: number | null;
}): string | null;
export declare class ExonerationsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    referentiel(): {
        modeles: import("./correspondance-exonerations").ModeleDemande[];
        franchisesDouanieres: readonly [{
            readonly lettre: "e";
            readonly libelle: "Dons distribués gratuitement par un organisme charitable agréé";
            readonly texte: string;
        }, {
            readonly lettre: "h";
            readonly libelle: "Matériels et articles destinés à la recherche ou à l'éducation";
            readonly texte: "Matériels et articles destinés à la recherche et/ou à l'éducation.";
        }, {
            readonly lettre: "i";
            readonly libelle: "Objets religieux destinés à l'exercice du culte";
            readonly texte: "Objets religieux destinés à être utilisés dans l'exercice du culte.";
        }, {
            readonly lettre: "l";
            readonly libelle: "Dons ou matériels fournis gratuitement à l'État ou à une entité territoriale";
            readonly texte: string;
        }, {
            readonly lettre: "m";
            readonly libelle: "Marchandises importées dans le cadre de la coopération bilatérale ou multilatérale";
            readonly texte: "Marchandises importées dans le cadre des projets de coopération bilatérale ou multilatérale.";
        }];
        joursAlerteRenouvellement: number;
        avertissement: string;
    };
    private enrichir;
    lister(tenantId: string, dateReference?: string, filtre?: {
        du?: string;
        au?: string;
    }): Promise<{
        dateReference: Date;
        periode: {
            du: string | null;
            au: string | null;
        };
        total: number;
        plafond: number;
        tronque: boolean;
        dossiers: {
            modele: {
                libelle: string;
                objet: string;
                baseLegale: string;
                validiteMois: number | null;
            };
            pieces: {
                fournie: boolean;
                cle: string;
                libelle: string;
                conditionnelle?: string;
            }[];
            nombrePiecesFournies: number;
            nombrePiecesRequises: number;
            piecesManquantes: string[];
            conditionnellesAVerifier: {
                libelle: string;
                condition: string;
            }[];
            complet: boolean;
            joursAvantExpiration: number | null;
            alerte: "EXPIRE" | "A_RENOUVELER" | null;
            valeurBiens: number | null;
            id: string;
            createdAt: Date;
            type: import(".prisma/client").$Enums.TypeDemandeExoneration;
            statut: import(".prisma/client").$Enums.StatutExoneration;
            tenantId: string;
            objet: string;
            updatedAt: Date;
            createdBy: string;
            dateArrete: Date | null;
            observations: string | null;
            referenceArrete: string | null;
            dateDebutValidite: Date | null;
            dateFinValidite: Date | null;
            lettreTransport: string | null;
            franchiseDouaniere: string | null;
            piecesFournies: string[];
        }[];
        aRenouveler: number;
        expires: number;
        incomplets: number;
        avertissement: string;
    }>;
    creer(tenantId: string, userId: string, dto: {
        type: TypeDemandeExoneration;
        objet: string;
        statut?: StatutExoneration;
        referenceArrete?: string;
        dateArrete?: string;
        dateDebutValidite?: string;
        dateFinValidite?: string;
        lettreTransport?: string;
        valeurBiens?: number;
        franchiseDouaniere?: string;
        piecesFournies?: string[];
        observations?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TypeDemandeExoneration;
        statut: import(".prisma/client").$Enums.StatutExoneration;
        tenantId: string;
        objet: string;
        updatedAt: Date;
        createdBy: string;
        dateArrete: Date | null;
        observations: string | null;
        referenceArrete: string | null;
        dateDebutValidite: Date | null;
        dateFinValidite: Date | null;
        lettreTransport: string | null;
        valeurBiens: Prisma.Decimal | null;
        franchiseDouaniere: string | null;
        piecesFournies: string[];
    }>;
    modifier(tenantId: string, id: string, dto: Record<string, unknown>): Promise<{
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TypeDemandeExoneration;
        statut: import(".prisma/client").$Enums.StatutExoneration;
        tenantId: string;
        objet: string;
        updatedAt: Date;
        createdBy: string;
        dateArrete: Date | null;
        observations: string | null;
        referenceArrete: string | null;
        dateDebutValidite: Date | null;
        dateFinValidite: Date | null;
        lettreTransport: string | null;
        valeurBiens: Prisma.Decimal | null;
        franchiseDouaniere: string | null;
        piecesFournies: string[];
    }>;
    supprimer(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
}
export declare const PLAFOND_LISTE_EXONERATIONS = 500;
