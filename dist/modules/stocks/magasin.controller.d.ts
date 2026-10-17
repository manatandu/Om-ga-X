import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MagasinService } from './magasin.service';
import { AnnulerMouvementStockDto, ConfronterInventaireDto, CreerArticleStockDto, EnregistrerMouvementStockDto, EnregistrerRegularisationInventaireDto } from './dto/magasin.dto';
export declare class MagasinController {
    private readonly magasin;
    constructor(magasin: MagasinService);
    listerArticles(user: AuthenticatedUser): Promise<{
        referentiel: import(".prisma/client").$Enums.Referentiel;
        modeInventaire: import(".prisma/client").$Enums.MethodeInventaireStocks | null;
        reserve: string | null;
        articles: {
            id: string;
            code: string;
            designation: string;
            uniteMesure: string;
            methodeValorisation: import(".prisma/client").$Enums.MethodeValorisationStock;
            actif: boolean;
            compte: {
                numero: string;
                intitule: string;
            };
            nombreMouvements: number;
        }[];
    }>;
    creerArticle(user: AuthenticatedUser, dto: CreerArticleStockDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        updatedAt: Date;
        code: string;
        createdBy: string;
        compteId: string;
        designation: string;
        actif: boolean;
        uniteMesure: string;
        methodeValorisation: import(".prisma/client").$Enums.MethodeValorisationStock;
    }>;
    ficheDeStock(user: AuthenticatedUser, articleId: string): Promise<{
        article: {
            id: string;
            code: string;
            designation: string;
            uniteMesure: string;
            methodeValorisation: import(".prisma/client").$Enums.MethodeValorisationStock;
            compte: {
                numero: string;
                intitule: string;
            };
        };
        modeInventaire: import(".prisma/client").$Enums.MethodeInventaireStocks | null;
        referentiel: import(".prisma/client").$Enums.Referentiel;
        lignes: {
            id: string;
            date: string;
            ordre: number;
            sens: import(".prisma/client").$Enums.SensMouvementStock;
            piece: string;
            libelle: string | null;
            quantite: number;
            valeur: number | null;
            coutUnitaire: number | null;
            quantiteApres: number | null;
            valeurApres: number | null;
            ecritureId: string | null;
            ecritureManquante: boolean;
            annuleLe: string | null;
            motifAnnulation: string | null;
            ecritureACorriger: boolean;
        }[];
        totaux: {
            quantiteFinale: number;
            valeurFinale: number;
            totalEntrees: number;
            totalSorties: number;
            quantiteEntree: number;
            quantiteSortie: number;
        };
        refus: import("./valorisation-stocks").RefusValorisation[];
    }>;
    enregistrerMouvement(user: AuthenticatedUser, articleId: string, dto: EnregistrerMouvementStockDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        piece: string;
        libelle: string | null;
        ordre: number;
        createdBy: string;
        date: Date;
        annuleLe: Date | null;
        annulePar: string | null;
        motifAnnulation: string | null;
        ecritureId: string | null;
        sens: import(".prisma/client").$Enums.SensMouvementStock;
        articleId: string;
        quantite: import("@prisma/client/runtime/library").Decimal;
        cout: import("@prisma/client/runtime/library").Decimal | null;
    }>;
    annulerMouvement(user: AuthenticatedUser, articleId: string, mouvementId: string, dto: AnnulerMouvementStockDto): Promise<{
        id: string;
        annule: boolean;
        ecritureACorriger: boolean;
    }>;
    confronter(user: AuthenticatedUser, dto: ConfronterInventaireDto): Promise<{
        modeInventaire: null;
        referentiel: import(".prisma/client").$Enums.Referentiel;
        reserve: string;
        confrontation: null;
    } | {
        modeInventaire: import(".prisma/client").$Enums.MethodeInventaireStocks;
        referentiel: import(".prisma/client").$Enums.Referentiel;
        reserve: null;
        confrontation: {
            lignes: import("./boni-mali-inventaire").LigneRegularisation[];
            differences: import("./boni-mali-inventaire").DifferenceInventaire[];
            sansDifference: import("./boni-mali-inventaire").ArticleSansDifference[];
            refus: import("./boni-mali-inventaire").RefusBoniMali[];
            totalBoni: number;
            totalMali: number;
        };
    }>;
    enregistrerRegularisation(user: AuthenticatedUser, dto: EnregistrerRegularisationInventaireDto): Promise<{
        journal: {
            id: string;
            createdAt: Date;
            type: import(".prisma/client").$Enums.TypeJournal;
            estActif: boolean;
            tenantId: string;
            intitule: string;
            code: string;
            compteTresorerieId: string | null;
            numerotation: import(".prisma/client").$Enums.NumerotationPiece;
            contrepartieChaqueLigne: boolean;
        };
        lignes: {
            id: string;
            libelle: string | null;
            modeReglementId: string | null;
            ecritureId: string;
            compteId: string;
            ligneReleveId: string | null;
            debit: import("@prisma/client/runtime/library").Decimal;
            credit: import("@prisma/client/runtime/library").Decimal;
            deviseId: string | null;
            dateEcheance: Date | null;
            lettre: string | null;
            lettrageId: string | null;
            aRelettrerDepuis: Date | null;
            tauxTvaId: string | null;
            rapprochementId: string | null;
            dateVersement: Date | null;
            montantDevise: import("@prisma/client/runtime/library").Decimal | null;
            coursApplique: import("@prisma/client/runtime/library").Decimal | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutEcriture;
        tenantId: string;
        exerciceId: string;
        libelle: string;
        journalId: string;
        createdBy: string;
        date: Date;
        reference: string | null;
        numeroPiece: number | null;
        dateValeur: Date | null;
        valideeAt: Date | null;
        valideeBy: string | null;
        secondRegardNom: string | null;
        secondRegardMotif: string | null;
        estGenereeParCloture: boolean;
        estSoldeDesComptesDeGestion: boolean;
        estANouveauProvisoire: boolean;
        motifImputationOuverture: import(".prisma/client").$Enums.MotifImputationOuverture | null;
        justificationImputationOuverture: string | null;
        corrigeEcritureId: string | null;
        motifCorrection: string | null;
    }>;
}
