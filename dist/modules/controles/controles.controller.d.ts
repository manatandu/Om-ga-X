import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ClasseCompte } from '@prisma/client';
import { ControlesService } from './controles.service';
import { DossierRevisionService } from './dossier-revision.service';
export declare class ControlesController {
    private readonly controles;
    private readonly revision;
    constructor(controles: ControlesService, revision: DossierRevisionService);
    reglesComptes(user: AuthenticatedUser): Promise<import("./regles-comptes-sycebnl").RegleCompte[]>;
    dossierRevision(user: AuthenticatedUser, exerciceId: string): Promise<{
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
    analyser(user: AuthenticatedUser, exerciceId: string): Promise<import("./controles.service").RapportControles>;
    caisse(user: AuthenticatedUser, exerciceId: string): Promise<import("./controles.service").ControleCaisse[]>;
    evolutionMensuelle(user: AuthenticatedUser, exerciceId: string, classe?: ClasseCompte): Promise<{
        exerciceId: string;
        mois: {
            cle: string;
            libelle: string;
        }[];
        comptes: {
            compteId: string;
            numero: string;
            intitule: string;
            classe: import(".prisma/client").$Enums.ClasseCompte;
            report: number;
            valeurs: number[];
            cumul: number;
            soldeFinal: number;
            moisAberrant: null;
        }[];
        classe: import(".prisma/client").$Enums.ClasseCompte | null;
        totaux: number[] | null;
    }>;
    comptesDormants(user: AuthenticatedUser, mois?: string): Promise<{
        compteId: string;
        numero: string;
        intitule: string;
        classe: import(".prisma/client").$Enums.ClasseCompte;
        estActif: boolean;
        dernierMouvement: string | null;
        nombreEcritures: number;
        solde: number;
        jamaisMouvemente: boolean;
    }[]>;
}
