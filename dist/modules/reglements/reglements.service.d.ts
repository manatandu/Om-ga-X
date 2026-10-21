import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { LettrageService } from '../lettrage/lettrage.service';
import { EnregistrerReglementsDto, PasserEcartChangeDto } from './reglements.dto';
import { OrdresVirementService } from './ordres-virement.service';
import { type CompteCandidat, type RoleEcartEscompte } from './ecart-escompte';
import { type SensReglement } from './reglement-tiers';
export declare class ReglementsService {
    private readonly prisma;
    private readonly ecritures;
    private readonly lettrage;
    private readonly ordres;
    private readonly journalServeur;
    constructor(prisma: PrismaService, ecritures: EcritureService, lettrage: LettrageService, ordres: OrdresVirementService);
    echeances(tenantId: string, exerciceId: string, sens: SensReglement, jusquau?: string): Promise<{
        compteId: string;
        numero: string;
        intitule: string;
        tiers: string | null;
        creanceReclassee: {
            compte416: string;
            date: string;
        } | null;
        lignes: {
            id: string;
            compteId: string;
            echeance: Date;
            date: Date;
            journalCode: string;
            numeroPiece: number | null;
            reference: string | null;
            libelle: string;
            montant: number;
            deviseId: string | null;
            deviseCode: string | null;
            montantDevise: number | null;
            coursApplique: number | null;
            regleParLettrageACheval: {
                groupe: string;
                montant: number;
            } | null;
            regleParLettragePartiel: {
                deviseIndeterminee?: boolean | undefined;
                groupe: string;
                montant: number;
            } | null;
        }[];
        aNouveauProvisoireEcartees: number;
    }[]>;
    private creancesReclasseesDesComptes;
    enregistrer(tenantId: string, userId: string, dto: EnregistrerReglementsDto, email?: string): Promise<{
        reglements: {
            ecartReglement?: number | undefined;
            escompte?: number | undefined;
            montantDevise?: number | undefined;
            ecartChange?: number | undefined;
            compte: string;
            ecritureId: string;
            montant: number;
            partiel: boolean;
            lettre: string;
        }[];
        ordre: {
            total: Prisma.Decimal;
            id: string;
            numero: number;
        } | null;
        avertissements: string[];
    }>;
    comptesEscompteEcart(tenantId: string, sens: SensReglement): Promise<{
        seuil: number | null;
        roles: {
            role: RoleEcartEscompte;
            racine: string;
            comptes: CompteCandidat[];
            proposeId: string | null;
            motif: string | null;
        }[];
    }>;
    private candidatsEcartEscompte;
    private seuilEcartReglement;
    private preparerEnDevise;
    passerEcartChange(tenantId: string, userId: string, dto: PasserEcartChangeDto): Promise<{
        ecritureId: string;
        ecart: number;
        compte: string;
        lettre: string;
        statut: "SOLDE";
        date: Date;
        dateValeur: Date | null;
        avertissement: string | null;
    }>;
}
export declare function motifANouveauProvisoire(numero: string): string;
export declare function avecLeMode<L extends {
    compteId: string;
}>(modeReglementId: string | null, comptesQuiPaient: readonly string[], lignes: L[]): Array<L & {
    modeReglementId?: string;
}>;
