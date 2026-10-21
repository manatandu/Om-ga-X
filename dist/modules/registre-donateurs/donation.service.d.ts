import { Prisma, TypeDonateur } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { CompteLiberalite } from './correspondance-registre';
import { AnnulerDonationDto, FiltreRegistreDto, InscrireDonationDto, ModifierDonationDto, SignerDonationDto } from './dto/donation.dto';
export interface ManquementArticle17 {
    champ: string;
    exigence: string;
}
export interface LigneNonConforme {
    id: string;
    numero: number;
    dateOperation: Date;
    manquements: ManquementArticle17[];
}
export interface MontantCompteLiberalite extends CompteLiberalite {
    montant: number;
    comptes: {
        numero: string;
        intitule: string;
        montant: number;
    }[];
}
export declare class DonationService {
    private readonly prisma;
    private readonly ecritureService;
    constructor(prisma: PrismaService, ecritureService: EcritureService);
    lister(tenantId: string, filtre?: FiltreRegistreDto): Promise<({
        ecriture: {
            id: string;
            libelle: string;
            date: Date;
            numeroPiece: number | null;
        } | null;
    } & {
        id: string;
        nom: string | null;
        createdAt: Date;
        tenantId: string;
        prenoms: string | null;
        nature: import(".prisma/client").$Enums.NatureLiberalite;
        montant: Prisma.Decimal;
        numero: number;
        createdBy: string;
        motifAnnulation: string | null;
        ecritureId: string | null;
        annuleeLe: Date | null;
        dateOperation: Date;
        typeDonateur: import(".prisma/client").$Enums.TypeDonateur;
        domicile: string | null;
        denomination: string | null;
        numeroImmatriculation: string | null;
        numeroIdentificationFiscale: string | null;
        adresseSiegeSocial: string | null;
        adresseElectronique: string | null;
        modeLiberation: import(".prisma/client").$Enums.ModeLiberation;
        designationNature: string | null;
        signeePar: string | null;
        signeeLe: Date | null;
        annulee: boolean;
    } & {
        montant: number;
    })[]>;
    inscrire(tenantId: string, userId: string, dto: InscrireDonationDto): Promise<{
        id: string;
        nom: string | null;
        createdAt: Date;
        tenantId: string;
        prenoms: string | null;
        nature: import(".prisma/client").$Enums.NatureLiberalite;
        montant: Prisma.Decimal;
        numero: number;
        createdBy: string;
        motifAnnulation: string | null;
        ecritureId: string | null;
        annuleeLe: Date | null;
        dateOperation: Date;
        typeDonateur: import(".prisma/client").$Enums.TypeDonateur;
        domicile: string | null;
        denomination: string | null;
        numeroImmatriculation: string | null;
        numeroIdentificationFiscale: string | null;
        adresseSiegeSocial: string | null;
        adresseElectronique: string | null;
        modeLiberation: import(".prisma/client").$Enums.ModeLiberation;
        designationNature: string | null;
        signeePar: string | null;
        signeeLe: Date | null;
        annulee: boolean;
    } & {
        montant: number;
    }>;
    modifier(tenantId: string, id: string, dto: ModifierDonationDto): Promise<{
        id: string;
        nom: string | null;
        createdAt: Date;
        tenantId: string;
        prenoms: string | null;
        nature: import(".prisma/client").$Enums.NatureLiberalite;
        montant: Prisma.Decimal;
        numero: number;
        createdBy: string;
        motifAnnulation: string | null;
        ecritureId: string | null;
        annuleeLe: Date | null;
        dateOperation: Date;
        typeDonateur: import(".prisma/client").$Enums.TypeDonateur;
        domicile: string | null;
        denomination: string | null;
        numeroImmatriculation: string | null;
        numeroIdentificationFiscale: string | null;
        adresseSiegeSocial: string | null;
        adresseElectronique: string | null;
        modeLiberation: import(".prisma/client").$Enums.ModeLiberation;
        designationNature: string | null;
        signeePar: string | null;
        signeeLe: Date | null;
        annulee: boolean;
    } & {
        montant: number;
    }>;
    signer(tenantId: string, id: string, dto: SignerDonationDto): Promise<{
        id: string;
        nom: string | null;
        createdAt: Date;
        tenantId: string;
        prenoms: string | null;
        nature: import(".prisma/client").$Enums.NatureLiberalite;
        montant: Prisma.Decimal;
        numero: number;
        createdBy: string;
        motifAnnulation: string | null;
        ecritureId: string | null;
        annuleeLe: Date | null;
        dateOperation: Date;
        typeDonateur: import(".prisma/client").$Enums.TypeDonateur;
        domicile: string | null;
        denomination: string | null;
        numeroImmatriculation: string | null;
        numeroIdentificationFiscale: string | null;
        adresseSiegeSocial: string | null;
        adresseElectronique: string | null;
        modeLiberation: import(".prisma/client").$Enums.ModeLiberation;
        designationNature: string | null;
        signeePar: string | null;
        signeeLe: Date | null;
        annulee: boolean;
    } & {
        montant: number;
    }>;
    annuler(tenantId: string, id: string, dto: AnnulerDonationDto): Promise<{
        id: string;
        nom: string | null;
        createdAt: Date;
        tenantId: string;
        prenoms: string | null;
        nature: import(".prisma/client").$Enums.NatureLiberalite;
        montant: Prisma.Decimal;
        numero: number;
        createdBy: string;
        motifAnnulation: string | null;
        ecritureId: string | null;
        annuleeLe: Date | null;
        dateOperation: Date;
        typeDonateur: import(".prisma/client").$Enums.TypeDonateur;
        domicile: string | null;
        denomination: string | null;
        numeroImmatriculation: string | null;
        numeroIdentificationFiscale: string | null;
        adresseSiegeSocial: string | null;
        adresseElectronique: string | null;
        modeLiberation: import(".prisma/client").$Enums.ModeLiberation;
        designationNature: string | null;
        signeePar: string | null;
        signeeLe: Date | null;
        annulee: boolean;
    } & {
        montant: number;
    }>;
    rapportConformite(tenantId: string, exerciceId: string): Promise<{
        exercice: {
            id: string;
            dateDebut: Date;
            dateFin: Date;
        };
        existence: {
            registreOuvert: boolean;
            lignesTotalRegistre: number;
            lignesSurExercice: number;
            lignesAnnuleesSurExercice: number;
        };
        numerotation: {
            exigence: string;
            premier: number;
            dernier: number | null;
            trous: number[];
            doublons: number[];
            continue: boolean;
        };
        signature: {
            exigence: string;
            lignesNonSignees: {
                id: string;
                numero: number;
                dateOperation: Date;
                montant: number;
            }[];
        };
        completude: {
            lignesIncompletes: LigneNonConforme[];
        };
        rapprochement: {
            totalRegistre: number;
            totalComptable: number;
            ecart: number;
            rapproche: boolean;
            lecture: string;
            comptesLiberalite: MontantCompteLiberalite[];
            comptesFrontiere: MontantCompteLiberalite[];
            comptesHorsPerimetre: MontantCompteLiberalite[];
            avertissement: string;
        };
    }>;
    private constaterNumerotation;
    private montantDuCompte;
    private ligne;
    private exercice;
    private verifierCoherenceDonateur;
}
export declare function manquementsArticle17(d: {
    typeDonateur: TypeDonateur;
    nom?: string | null;
    prenoms?: string | null;
    domicile?: string | null;
    adresseElectronique?: string | null;
    denomination?: string | null;
    numeroImmatriculation?: string | null;
    numeroIdentificationFiscale?: string | null;
    adresseSiegeSocial?: string | null;
}): ManquementArticle17[];
