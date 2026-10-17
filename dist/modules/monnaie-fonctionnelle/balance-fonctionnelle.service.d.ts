import { PrismaService } from '../../common/prisma.service';
export type OuvertureFonctionnelle = 'AUCUNE' | 'EXERCICE_PRECEDENT' | 'CONVERTIE_A_SA_DATE';
export declare class BalanceFonctionnelleService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    static coursApplicable(cours: {
        date: Date;
        cours: number;
    }[], date: Date): number | null;
    static convertirLigne(ligne: {
        debit: number;
        credit: number;
        deviseCode: string | null;
        montantDevise: number | null;
    }, monnaieFonctionnelle: string, coursDeLEcriture: number): {
        debit: number;
        credit: number;
        exacte: boolean;
    };
    static readonly MENTION_SANS_VALEUR_LEGALE: string;
    balance(tenantId: string, exerciceId: string): Promise<{
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
            ouverture: OuvertureFonctionnelle;
        };
    }>;
    private jeuFonctionnel;
    private lireEcritures;
}
