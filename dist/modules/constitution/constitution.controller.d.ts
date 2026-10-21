import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ConstitutionService } from './constitution.service';
export declare class ConstitutionController {
    private readonly constitution;
    constructor(constitution: ConstitutionService);
    parcours(user: AuthenticatedUser): Promise<{
        etapes: {
            produitDetenu: {
                renseigne: boolean;
                champ: string;
                valeur: string | null;
            } | null;
            motifSansProduit: string | null;
            cle: string;
            libelle: string;
            destinataire: string;
            source: string;
            pieces: import("./catalogue-constitution").PieceConstitution[];
            produit: string;
        }[];
        horsParcours: string | null;
        champsPortes: {
            enregistrementSecteur: boolean;
            certificatPlan: boolean;
        };
        formeJuridique: import(".prisma/client").$Enums.FormeJuridiqueEbnl;
        droitEtranger: boolean;
        dateActePersonnalite: Date | null;
        parFondement: {
            LOI: number;
            PRATIQUE_ADMINISTRATIVE: number;
            USAGE_SANS_BASE_LEGALE: number;
        };
    }>;
}
