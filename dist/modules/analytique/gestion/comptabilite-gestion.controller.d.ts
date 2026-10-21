import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { ComptabiliteGestionService } from './comptabilite-gestion.service';
import { CreerCleRepartitionDto, DeclarerComportementsDto, DeclarerCoutProductionDto, RepartirDto, ReprendreClesDto } from './dto/comptabilite-gestion.dto';
export declare class ComptabiliteGestionController {
    private readonly gestion;
    constructor(gestion: ComptabiliteGestionService);
    comportements(user: AuthenticatedUser, exerciceId: string): Promise<{
        comptes: {
            compteId: string;
            numero: string;
            intitule: string;
            classe: string;
            comportement: import(".prisma/client").$Enums.ComportementGestion | null;
            partVariablePct: number | null;
            mouvementDebit: number;
            mouvementCredit: number;
        }[];
        total: number;
        tronque: boolean;
    }>;
    declarerComportements(user: AuthenticatedUser, dto: DeclarerComportementsDto): Promise<{
        declares: number;
    }>;
    seuil(user: AuthenticatedUser, exerciceId: string): Promise<{
        produits: number;
        chargesVariables: number;
        chargesFixes: number;
        marge: number;
        tauxMarge: number | null;
        seuil: number | null;
        margeSecurite: number | null;
        indiceSecurite: number | null;
        pointMortMois: number | null;
        motif: string | null;
        horsCalcul: {
            numero: string;
            intitule: string;
            montant: number;
        }[];
        nonDeclares: {
            numero: string;
            intitule: string;
            montant: number;
        }[];
        exercice: {
            id: string;
            dateDebut: string;
            dateFin: string;
            mois: number;
        };
        brouillardCompris: boolean;
        comportementsFigesLe: string | null;
    }>;
    cles(user: AuthenticatedUser, exerciceId: string): Promise<{
        id: string;
        planId: string;
        plan: {
            intitule: string;
            code: string;
        };
        sectionSourceId: string;
        sectionSource: {
            intitule: string;
            code: string;
        };
        libelle: string;
        mode: import(".prisma/client").$Enums.ModeCleRepartition;
        unite: string | null;
        source: string;
        odsProduites: number;
        lignes: {
            sectionCibleId: string;
            code: string;
            intitule: string;
            valeur: number;
        }[];
    }[]>;
    creerCle(user: AuthenticatedUser, dto: CreerCleRepartitionDto): Promise<{
        id: string;
    }>;
    reprendre(user: AuthenticatedUser, dto: ReprendreClesDto): Promise<{
        reprises: number;
        ecartees: {
            section: string;
            motif: string;
        }[];
    }>;
    supprimerCle(user: AuthenticatedUser, cleId: string): Promise<{
        supprime: boolean;
    }>;
    proposition(user: AuthenticatedUser, cleId: string, date?: string): Promise<{
        cle: {
            id: string;
            libelle: string;
            sectionSource: {
                intitule: string;
                code: string;
            };
        };
        date: string;
        exerciceClos: boolean;
        ods: {
            lignes: {
                code: string | null;
                sectionId: string;
                debit: number;
                credit: number;
            }[];
            compteId: string;
            numero: string;
            intitule: string;
            solde: number;
        }[];
        total: number;
    }>;
    repartir(user: AuthenticatedUser, cleId: string, dto: RepartirDto): Promise<{
        ods: number;
        total: number;
    }>;
    couts(user: AuthenticatedUser, exerciceId: string): Promise<{
        exercice: {
            id: string;
            dateDebut: string;
            dateFin: string;
        };
        comportementsFigesLe: string | null;
        declarations: {
            charges: {
                comportement: import("./comportement-gestion").Comportement | null;
                partVariablePct: number | null;
                compteId: string;
                numero: string;
                intitule: string;
                montant: number;
            }[];
            produitsVentiles: number;
            calcul: import("./cout-production").CoutDeProduction;
            capaciteNormale: number;
            activiteReelle: number;
            quantiteProduite: number | null;
            id: string;
            sectionId: string;
            section: {
                intitule: string;
                code: string;
            };
            unite: string;
            source: string;
        }[];
    }>;
    declarerCout(user: AuthenticatedUser, dto: DeclarerCoutProductionDto): Promise<{
        id: string;
    }>;
    supprimerCout(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
