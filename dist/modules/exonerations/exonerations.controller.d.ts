import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ExonerationsService } from './exonerations.service';
import { CreerExonerationDto, ListerExonerationsDto, ModifierExonerationDto } from './dto/exoneration.dto';
export declare class ExonerationsController {
    private readonly exonerations;
    constructor(exonerations: ExonerationsService);
    lister(user: AuthenticatedUser, filtre: ListerExonerationsDto): Promise<{
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
    creer(user: AuthenticatedUser, dto: CreerExonerationDto): Promise<{
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
        valeurBiens: import("@prisma/client/runtime/library").Decimal | null;
        franchiseDouaniere: string | null;
        piecesFournies: string[];
    }>;
    modifier(user: AuthenticatedUser, id: string, dto: ModifierExonerationDto): Promise<{
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
        valeurBiens: import("@prisma/client/runtime/library").Decimal | null;
        franchiseDouaniere: string | null;
        piecesFournies: string[];
    }>;
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
