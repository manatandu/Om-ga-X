import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { EnregistrerAffectationDto } from './dto/affectation.dto';
export declare class AffectationService {
    private readonly prisma;
    private readonly ecritureService;
    constructor(prisma: PrismaService, ecritureService: EcritureService);
    preparer(tenantId: string, exerciceId: string): Promise<{
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
                montant: Prisma.Decimal;
                libelle: string | null;
                compteId: string;
                affectationId: string;
            })[];
        } & {
            id: string;
            createdAt: Date;
            tenantId: string;
            montant: Prisma.Decimal;
            exerciceId: string;
            createdBy: string;
            dateDecision: Date;
            organe: string;
            reference: string | null;
            estBenefice: boolean;
            ecritureId: string | null;
        }) | null;
    }>;
    lister(tenantId: string): Promise<({
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
            montant: Prisma.Decimal;
            libelle: string | null;
            compteId: string;
            affectationId: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        montant: Prisma.Decimal;
        exerciceId: string;
        createdBy: string;
        dateDecision: Date;
        organe: string;
        reference: string | null;
        estBenefice: boolean;
        ecritureId: string | null;
    })[]>;
    enregistrer(tenantId: string, createdBy: string, dto: EnregistrerAffectationDto): Promise<{
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
            montant: Prisma.Decimal;
            libelle: string | null;
            compteId: string;
            affectationId: string;
        })[];
        id: string;
        createdAt: Date;
        tenantId: string;
        montant: Prisma.Decimal;
        exerciceId: string;
        createdBy: string;
        dateDecision: Date;
        organe: string;
        reference: string | null;
        estBenefice: boolean;
        ecritureId: string | null;
    }>;
    supprimer(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
    private avertissements;
    private contexte;
    private soldesDuBilan;
    private compteResultat;
    private journalGeneral;
}
