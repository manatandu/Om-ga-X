import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RepriseSubventionDto } from './dto/immobilisation.dto';
import { RepriseSubventionService } from './reprise-subvention.service';
export declare class RepriseSubventionController {
    private readonly service;
    constructor(service: RepriseSubventionService);
    lister(user: AuthenticatedUser, exerciceId: string): Promise<{
        biens: ({
            subvention: number;
            cumulRepris: number;
            montant: number;
            nature: "EXERCICE";
            motif: string;
            comptes14: {
                compteId: string;
                numero: string;
                montant: number;
            }[];
            fonds: import("./reprise-subvention").FondsRepris | null;
            designation: string;
            dateFin: Date;
            dateSortie: Date | null;
            id: string;
        } | {
            subvention: number;
            cumulRepris: number;
            montant: number;
            nature: import("./reprise-subvention").NatureReprise;
            motif: string | null;
            reserve: string | null;
            reductions: number;
            comptes14: {
                numero: string;
                montant: number;
                compteId: string;
            }[];
            fonds: import("./reprise-subvention").FondsRepris;
            designation: string;
            dateFin: Date;
            dateSortie: Date | null;
            id: string;
        })[];
        tronque: boolean;
    }>;
    proposer(user: AuthenticatedUser, id: string, exerciceId: string, duree?: string): Promise<{
        subvention: number;
        cumulRepris: number;
        montant: number;
        nature: "EXERCICE";
        motif: string;
        comptes14: {
            compteId: string;
            numero: string;
            montant: number;
        }[];
        fonds: import("./reprise-subvention").FondsRepris | null;
        designation: string;
        dateFin: Date;
        dateSortie: Date | null;
    } | {
        subvention: number;
        cumulRepris: number;
        montant: number;
        nature: import("./reprise-subvention").NatureReprise;
        motif: string | null;
        reserve: string | null;
        reductions: number;
        comptes14: {
            numero: string;
            montant: number;
            compteId: string;
        }[];
        fonds: import("./reprise-subvention").FondsRepris;
        designation: string;
        dateFin: Date;
        dateSortie: Date | null;
    }>;
    passer(user: AuthenticatedUser, id: string, dto: RepriseSubventionDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        nature: import(".prisma/client").$Enums.NatureRepriseSubvention;
        montant: import("@prisma/client/runtime/library").Decimal;
        exerciceId: string;
        createdBy: string;
        ecritureId: string;
        immobilisationId: string;
    }>;
}
