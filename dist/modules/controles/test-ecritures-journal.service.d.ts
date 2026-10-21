import { PrismaService } from '../../common/prisma.service';
export declare const PLAFOND_SELECTION_ISA_240 = 50000;
export declare class TestEcrituresJournalService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    selection(tenantId: string, exerciceId: string, plafond?: number): Promise<{
        exercice: {
            dateDebut: Date;
            dateFin: Date;
            dateArreteComptes: Date | null;
        };
        criteres: import("./test-ecritures-journal").CritereIsa240[];
        seuils: {
            readonly joursFinDePeriode: 7;
            readonly longueurLibelleCourt: 12;
            readonly pasMontantRond: 1000000;
            readonly planckMontantRond: 1000000;
            readonly mouvementsCompteRare: 2;
        };
        totalEcritures: number;
        totalRetenues: number;
        tronque: boolean;
        parCritere: {
            cle: string;
            titre: string;
            nombre: number;
        }[];
        selection: {
            id: string;
            date: Date;
            journal: string;
            numeroPiece: number | null;
            reference: string | null;
            libelle: string;
            montant: number;
            statut: import(".prisma/client").$Enums.StatutEcriture;
            saisieLe: Date;
            saisiePar: string;
            roleAuteur: import(".prisma/client").$Enums.RoleUtilisateur | null;
            valideeLe: Date | null;
            valideePar: string | null;
            joursEntreDateEtSaisie: number;
            comptesRares: string[];
            criteres: string[];
        }[];
    }>;
}
