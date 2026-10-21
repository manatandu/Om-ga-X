import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AffectationService } from './affectation.service';
import { EnregistrerAffectationDto } from './dto/affectation.dto';
export declare class AffectationController {
    private readonly affectation;
    constructor(affectation: AffectationService);
    lister(user: AuthenticatedUser): Promise<({
        exercice: {
            id: string;
            dateDebut: Date;
            dateFin: Date;
        };
        ecriture: {
            id: string;
            statut: import(".prisma/client").$Enums.StatutEcriture;
            date: Date;
            numeroPiece: number | null;
        } | null;
        lignes: ({
            compte: {
                numero: string;
                intitule: string;
            };
        } & {
            id: string;
            montant: import("@prisma/client/runtime/library").Decimal;
            libelle: string | null;
            compteId: string;
            affectationId: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        montant: import("@prisma/client/runtime/library").Decimal;
        exerciceId: string;
        createdBy: string;
        dateDecision: Date;
        organe: string;
        reference: string | null;
        estBenefice: boolean;
        ecritureId: string | null;
    })[]>;
    preparer(user: AuthenticatedUser, exerciceId: string): Promise<{
        exercice: {
            id: string;
            dateDebut: Date;
            dateFin: Date;
        };
        referentiel: import(".prisma/client").$Enums.Referentiel;
        formeJuridiqueSyscohada: import(".prisma/client").$Enums.FormeJuridiqueSyscohada | null;
        capitalRacine: string | null;
        montant: number;
        estBenefice: boolean;
        pertesAnterieures: number;
        capitalSocial: number;
        reserveLegaleExistante: number;
        reserveLegale: {
            dotation: number | null;
            motif: string;
        };
        destinations: {
            id: string;
            numero: string;
            intitule: string;
        }[];
        avertissementCapital: string | null;
        existante: ({
            lignes: ({
                compte: {
                    numero: string;
                    intitule: string;
                };
            } & {
                id: string;
                montant: import("@prisma/client/runtime/library").Decimal;
                libelle: string | null;
                compteId: string;
                affectationId: string;
            })[];
        } & {
            id: string;
            createdAt: Date;
            tenantId: string;
            montant: import("@prisma/client/runtime/library").Decimal;
            exerciceId: string;
            createdBy: string;
            dateDecision: Date;
            organe: string;
            reference: string | null;
            estBenefice: boolean;
            ecritureId: string | null;
        }) | null;
    }>;
    enregistrer(user: AuthenticatedUser, dto: EnregistrerAffectationDto): Promise<{
        avertissements: string[];
        ecriture: {
            id: string;
            statut: import(".prisma/client").$Enums.StatutEcriture;
            date: Date;
            numeroPiece: number | null;
        } | null;
        lignes: ({
            compte: {
                numero: string;
                intitule: string;
            };
        } & {
            id: string;
            montant: import("@prisma/client/runtime/library").Decimal;
            libelle: string | null;
            compteId: string;
            affectationId: string;
        })[];
        id: string;
        createdAt: Date;
        tenantId: string;
        montant: import("@prisma/client/runtime/library").Decimal;
        exerciceId: string;
        createdBy: string;
        dateDecision: Date;
        organe: string;
        reference: string | null;
        estBenefice: boolean;
        ecritureId: string | null;
    }>;
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
