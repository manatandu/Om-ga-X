import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { DesactualisationDemantelementDto, RepriseDemantelementDto } from './dto/immobilisation.dto';
import { DemantelementService } from './demantelement.service';
export declare class DemantelementController {
    private readonly service;
    constructor(service: DemantelementService);
    valeurActualisee(cout: string, taux: string, annees: string): {
        valeurActualisee: number;
    };
    etat(user: AuthenticatedUser, id: string, exerciceId: string): Promise<{
        repriseFaite: boolean;
        composantRepris: boolean;
        systemeMinimal: boolean;
        provisionInitiale: number | null;
        cumulDesactualisations: number;
        provision: number;
        coutFutur: number | null;
        tauxPourcent: number | null;
        mouvements: {
            id: string;
            nature: import(".prisma/client").$Enums.NatureMouvementDemantelement;
            date: Date;
            montant: number;
            repriseExploitation: number | null;
            repriseFinanciere: number | null;
            motifReprise: import(".prisma/client").$Enums.MotifRepriseDemantelement | null;
        }[];
        desactualisation: {
            mois: number;
            provisionOuverture: number;
            montant: number;
            motifRefus: string | null;
        };
        reprise: {
            exploitation: number;
            financiere: number;
            total: number;
        } | null;
    }>;
    desactualiser(user: AuthenticatedUser, id: string, dto: DesactualisationDemantelementDto): Promise<{
        montant: number;
        nature: import(".prisma/client").$Enums.NatureMouvementDemantelement;
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        date: Date;
        exerciceId: string;
        ecritureId: string;
        immobilisationId: string;
        repriseExploitation: import("@prisma/client/runtime/library").Decimal | null;
        repriseFinanciere: import("@prisma/client/runtime/library").Decimal | null;
        motifReprise: import(".prisma/client").$Enums.MotifRepriseDemantelement | null;
    }>;
    reprendre(user: AuthenticatedUser, id: string, dto: RepriseDemantelementDto): Promise<{
        montant: number;
        nature: import(".prisma/client").$Enums.NatureMouvementDemantelement;
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        date: Date;
        exerciceId: string;
        ecritureId: string;
        immobilisationId: string;
        repriseExploitation: import("@prisma/client/runtime/library").Decimal | null;
        repriseFinanciere: import("@prisma/client/runtime/library").Decimal | null;
        motifReprise: import(".prisma/client").$Enums.MotifRepriseDemantelement | null;
    }>;
}
