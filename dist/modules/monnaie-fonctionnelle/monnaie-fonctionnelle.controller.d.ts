import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { BalanceFonctionnelleService } from './balance-fonctionnelle.service';
export declare class MonnaieFonctionnelleController {
    private readonly balanceFonctionnelle;
    constructor(balanceFonctionnelle: BalanceFonctionnelleService);
    balance(user: AuthenticatedUser, exerciceId: string): Promise<{
        monnaie: string;
        monnaieTenue: string;
        exercice: {
            dateDebut: string;
            dateFin: string;
        };
        mention: string;
        lignes: {
            compteId: string;
            numero: string;
            intitule: string;
            ouvertureDebit: number;
            ouvertureCredit: number;
            debit: number;
            credit: number;
            solde: number;
        }[];
        totaux: {
            debit: number;
            credit: number;
            ecartDeConversion: number;
            dontOuverture: number;
        };
        origine: {
            lignes: number;
            lignesExactes: number;
            lignesConverties: number;
            ecritures: number;
            ouverture: import("./balance-fonctionnelle.service").OuvertureFonctionnelle;
        };
    }>;
}
