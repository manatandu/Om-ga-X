import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { DonationService } from './donation.service';
import { AnnulerDonationDto, FiltreRegistreDto, InscrireDonationDto, ModifierDonationDto, SignerDonationDto } from './dto/donation.dto';
export declare class DonationController {
    private readonly donationService;
    constructor(donationService: DonationService);
    lister(user: AuthenticatedUser, filtre: FiltreRegistreDto): Promise<({
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
        montant: import("@prisma/client/runtime/library").Decimal;
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
    rapportConformite(user: AuthenticatedUser, exerciceId: string): Promise<{
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
            lignesIncompletes: import("./donation.service").LigneNonConforme[];
        };
        rapprochement: {
            totalRegistre: number;
            totalComptable: number;
            ecart: number;
            rapproche: boolean;
            lecture: string;
            comptesLiberalite: import("./donation.service").MontantCompteLiberalite[];
            comptesFrontiere: import("./donation.service").MontantCompteLiberalite[];
            comptesHorsPerimetre: import("./donation.service").MontantCompteLiberalite[];
            avertissement: string;
        };
    }>;
    inscrire(user: AuthenticatedUser, dto: InscrireDonationDto): Promise<{
        id: string;
        nom: string | null;
        createdAt: Date;
        tenantId: string;
        prenoms: string | null;
        nature: import(".prisma/client").$Enums.NatureLiberalite;
        montant: import("@prisma/client/runtime/library").Decimal;
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
    modifier(user: AuthenticatedUser, id: string, dto: ModifierDonationDto): Promise<{
        id: string;
        nom: string | null;
        createdAt: Date;
        tenantId: string;
        prenoms: string | null;
        nature: import(".prisma/client").$Enums.NatureLiberalite;
        montant: import("@prisma/client/runtime/library").Decimal;
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
    signer(user: AuthenticatedUser, id: string, dto: SignerDonationDto): Promise<{
        id: string;
        nom: string | null;
        createdAt: Date;
        tenantId: string;
        prenoms: string | null;
        nature: import(".prisma/client").$Enums.NatureLiberalite;
        montant: import("@prisma/client/runtime/library").Decimal;
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
    annuler(user: AuthenticatedUser, id: string, dto: AnnulerDonationDto): Promise<{
        id: string;
        nom: string | null;
        createdAt: Date;
        tenantId: string;
        prenoms: string | null;
        nature: import(".prisma/client").$Enums.NatureLiberalite;
        montant: import("@prisma/client/runtime/library").Decimal;
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
}
