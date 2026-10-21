import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { DesactualisationDemantelementDto, RepriseDemantelementDto } from './dto/immobilisation.dto';
export declare const COMPTES_DEMANTELEMENT: {
    readonly provision: "1984";
    readonly desactualisation: "6971";
    readonly repriseExploitation: "7911";
    readonly repriseFinanciere: "7971";
};
export declare class DemantelementService {
    private readonly prisma;
    private readonly ecritures;
    constructor(prisma: PrismaService, ecritures: EcritureService);
    valeurActualisee(coutFutur: number, tauxPourcent: number, annees: number): {
        valeurActualisee: number;
    };
    private composant;
    private regime;
    private exercicesManquants;
    private compte;
    etat(tenantId: string, id: string, exerciceId: string): Promise<{
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
    private proposition;
    desactualiser(tenantId: string, userId: string, id: string, dto: DesactualisationDemantelementDto): Promise<{
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
        repriseExploitation: Prisma.Decimal | null;
        repriseFinanciere: Prisma.Decimal | null;
        motifReprise: import(".prisma/client").$Enums.MotifRepriseDemantelement | null;
    }>;
    reprendre(tenantId: string, userId: string, id: string, dto: RepriseDemantelementDto): Promise<{
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
        repriseExploitation: Prisma.Decimal | null;
        repriseFinanciere: Prisma.Decimal | null;
        motifReprise: import(".prisma/client").$Enums.MotifRepriseDemantelement | null;
    }>;
    private enregistrer;
}
