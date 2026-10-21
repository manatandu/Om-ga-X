import { PrismaService } from '../../common/prisma.service';
import { RegleCompte } from './regles-comptes-sycebnl';
export declare class DossierRevisionService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    static regleDe(numero: string, table: RegleCompte[]): RegleCompte | null;
    regles(referentiel: string | undefined): RegleCompte[];
    dossier(tenantId: string, exerciceId: string, referentiel?: string): Promise<{
        comptes: {
            compteId: string;
            numero: string;
            intitule: string;
            debit: number;
            credit: number;
            solde: number;
            ficheNumero: string | null;
            elementsDeControle: string | null;
            exclusions: string | null;
        }[];
    }>;
}
