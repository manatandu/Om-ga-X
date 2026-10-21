import { PrismaService } from '../../common/prisma.service';
import { Prisma, StatutEcriture } from '@prisma/client';
import { ConfirmerCorrespondancesDto, DeclarerDepartDto, DeclarerEncoursDto, ImporterReleveDto, OuvrirRapprochementDto } from './dto/rapprochement.dto';
export declare const PLAFOND_LIGNES_RAPPROCHEMENT = 5000;
export interface RegleOuverture {
    ancre: boolean;
    dateDepart: Date | null;
}
export declare function estANouveauEcarte(ecriture: {
    estGenereeParCloture: boolean;
    estSoldeDesComptesDeGestion: boolean;
}): boolean;
export declare function filtreANouveauEcarte(): Prisma.EcritureWhereInput;
export declare function estFondueDansLeDepart(ecriture: {
    date: Date;
}, regle: RegleOuverture): boolean;
export declare function estEcarteeDuPointage(ecriture: {
    estGenereeParCloture: boolean;
    estSoldeDesComptesDeGestion: boolean;
    date: Date;
    statut?: StatutEcriture;
}, regle: RegleOuverture): boolean;
export declare function filtreEcarteDuPointage(regle: RegleOuverture): Prisma.EcritureWhereInput;
export declare const MOTIF_POINTAGE_SITUATION: string;
export declare function motifRefusANouveau(regle: RegleOuverture): string;
export declare function motifRefusFondue(date: Date, dateDepart: Date): string;
export declare function motifRefusPointage(ecriture: {
    estGenereeParCloture: boolean;
    estSoldeDesComptesDeGestion: boolean;
    date: Date;
    statut: StatutEcriture;
}, regle: RegleOuverture): string | null;
export declare function ecartDOuverture(soldeLivre: number, soldeDepart: number, encours: number): number;
export declare function aNouveauEnTrop(ecriture: {
    estGenereeParCloture: boolean;
    estSoldeDesComptesDeGestion: boolean;
    exerciceId: string;
}, place: {
    ancre: boolean;
    departDeclare: boolean;
    premierExerciceId: string | null;
}): boolean;
export interface OuvertureRapprochement {
    soldeDepart: number | null;
    dateDepart: Date | null;
    soldeLivre: number | null;
    encours: number;
    ecart: number | null;
    motif: string | null;
}
export declare class RapprochementService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private trouverCompteTresorerie;
    private depart;
    private ouverture;
    private trouverRapprochement;
    lister(tenantId: string, compteId?: string): Promise<({
        compte: {
            id: string;
            tenantId: string;
            estActif: boolean;
            numero: string;
            intitule: string;
            classe: import(".prisma/client").$Enums.ClasseCompte;
            typeCompte: import(".prisma/client").$Enums.TypeCompteDetailTotal;
            modeReportANouveau: import(".prisma/client").$Enums.ModeReportANouveau;
            estRetenu: boolean;
            lettrable: boolean;
            collectifId: string | null;
            tauxTvaDefautId: string | null;
            codeRetraitementFiscal: string | null;
            comportementGestion: import(".prisma/client").$Enums.ComportementGestion | null;
            partVariableGestionPct: Prisma.Decimal | null;
            bailleurId: string | null;
            porteFondsContrepartieEtat: boolean;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutRapprochement;
        createdBy: string;
        compteId: string;
        dateReleve: Date;
        soldeReleve: Prisma.Decimal;
        clotureAt: Date | null;
        soldeDepartDeclare: Prisma.Decimal | null;
        dateDepart: Date | null;
        rouvertAt: Date | null;
        rouvertBy: string | null;
        motifReouverture: string | null;
    })[]>;
    ouvrir(tenantId: string, userId: string, dto: OuvrirRapprochementDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutRapprochement;
        createdBy: string;
        compteId: string;
        dateReleve: Date;
        soldeReleve: Prisma.Decimal;
        clotureAt: Date | null;
        soldeDepartDeclare: Prisma.Decimal | null;
        dateDepart: Date | null;
        rouvertAt: Date | null;
        rouvertBy: string | null;
        motifReouverture: string | null;
    }>;
    obtenir(tenantId: string, id: string): Promise<{
        rapprochement: {
            id: string;
            tenantId: string;
            createdAt: Date;
            statut: import(".prisma/client").$Enums.StatutRapprochement;
            createdBy: string;
            compteId: string;
            dateReleve: Date;
            soldeReleve: Prisma.Decimal;
            clotureAt: Date | null;
            soldeDepartDeclare: Prisma.Decimal | null;
            dateDepart: Date | null;
            rouvertAt: Date | null;
            rouvertBy: string | null;
            motifReouverture: string | null;
        };
        premier: boolean;
        soldeDepart: number | null;
        soldePointe: number | null;
        ecart: number | null;
        equilibre: boolean;
        ecartReleve: number | null;
        ouverture: OuvertureRapprochement | null;
        releve: {
            id: string;
            rang: number;
            date: Date;
            libelle: string;
            reference: string | null;
            debit: number;
            credit: number;
            ligneEcritureIds: string[];
            encoursIds: string[];
        }[];
        tronque: boolean;
        totalLignes: number;
        aNouveauEcartes: number;
        fonduesDansLeDepart: number;
        lignes: {
            id: string;
            date: Date;
            journalCode: string;
            libelle: string;
            reference: string | null;
            debit: number;
            credit: number;
            pointee: boolean;
            ligneReleveId: string | null;
        }[];
        encours: {
            id: string;
            date: Date;
            libelle: string;
            debit: number;
            credit: number;
            pointee: boolean;
            ligneReleveId: string | null;
            declareIci: boolean;
        }[];
    }>;
    private assurerEnCours;
    pointer(tenantId: string, id: string, ligneIds: string[]): Promise<{
        nombreLignes: number;
    }>;
    depointer(tenantId: string, id: string, ligneIds: string[]): Promise<{
        nombreLignes: number;
    }>;
    private assurerPremierEnCours;
    declarerDepart(tenantId: string, id: string, dto: DeclarerDepartDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutRapprochement;
        createdBy: string;
        compteId: string;
        dateReleve: Date;
        soldeReleve: Prisma.Decimal;
        clotureAt: Date | null;
        soldeDepartDeclare: Prisma.Decimal | null;
        dateDepart: Date | null;
        rouvertAt: Date | null;
        rouvertBy: string | null;
        motifReouverture: string | null;
    }>;
    declarerEncours(tenantId: string, userId: string, id: string, dto: DeclarerEncoursDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        date: Date;
        libelle: string;
        declareSurId: string;
        pointeSurId: string | null;
        ligneReleveId: string | null;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
    }>;
    retirerEncours(tenantId: string, id: string, encoursId: string): Promise<{
        supprime: boolean;
    }>;
    pointerEncours(tenantId: string, id: string, encoursIds: string[]): Promise<{
        nombreEncours: number;
    }>;
    depointerEncours(tenantId: string, id: string, encoursIds: string[]): Promise<{
        nombreEncours: number;
    }>;
    cloturer(tenantId: string, id: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutRapprochement;
        createdBy: string;
        compteId: string;
        dateReleve: Date;
        soldeReleve: Prisma.Decimal;
        clotureAt: Date | null;
        soldeDepartDeclare: Prisma.Decimal | null;
        dateDepart: Date | null;
        rouvertAt: Date | null;
        rouvertBy: string | null;
        motifReouverture: string | null;
    }>;
    annuler(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
    rouvrir(tenantId: string, userId: string, id: string, motif: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutRapprochement;
        createdBy: string;
        compteId: string;
        dateReleve: Date;
        soldeReleve: Prisma.Decimal;
        clotureAt: Date | null;
        soldeDepartDeclare: Prisma.Decimal | null;
        dateDepart: Date | null;
        rouvertAt: Date | null;
        rouvertBy: string | null;
        motifReouverture: string | null;
    }>;
    private motifGel;
    private correspondancesDuReleve;
    importerReleve(tenantId: string, id: string, dto: ImporterReleveDto): Promise<{
        nombreLignes: number;
    }>;
    retirerReleve(tenantId: string, id: string): Promise<{
        nombreLignes: number;
    }>;
    proposer(tenantId: string, id: string, fenetreJours?: number): Promise<{
        fenetreJours: number;
        propositions: {
            ligneEcritureIds: string[];
            encoursIds: string[];
            ligneReleveId: string;
            motif: "REFERENCE" | "MONTANT_DATE";
        }[];
        lignesReleveSansProposition: number;
    }>;
    confirmer(tenantId: string, id: string, dto: ConfirmerCorrespondancesDto): Promise<{
        nombreCorrespondances: number;
    }>;
    dissocier(tenantId: string, id: string, ligneReleveId: string): Promise<{
        nombreLignes: number;
    }>;
}
