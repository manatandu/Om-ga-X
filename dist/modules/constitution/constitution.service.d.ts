import { PrismaService } from '../../common/prisma.service';
export declare class ConstitutionService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    parcours(tenantId: string): Promise<{
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
