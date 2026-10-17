import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { TauxTvaService } from '../tva/taux-tva.service';
import { LettrageService } from '../lettrage/lettrage.service';
import { AnnulerMouvementDto, AnnulerReclassementDto, AnnulerRecuperationTvaDto, AnnulerRevueDto, CorrigerParResultatDto, DeclarerCreanceOuvertureDto, DesignerFacturesDto, Lettrer416Dto, PerteCreanceDto, ReclasserCreanceDto, RecouvrementCreanceDto, RecupererTvaCreanceDto, RetirerDesignationDto, RevoirDepreciationDto } from './dto/creances-douteuses.dto';
export declare const PLAFOND_CREANCES_LISTEES = 500;
export declare const PLAFOND_CANDIDATES_CORRECTION = 50;
export declare const PLAFOND_COMPTES_416_491 = 200;
export declare const ECHEANCE_VERROU_CREANCES_MS: number;
export declare const MOTIF_VERROU_CREANCES = "Une op\u00E9ration sur les cr\u00E9ances douteuses est en cours sur ce dossier \u00B7 r\u00E9essayez apr\u00E8s sa fin.";
export declare class CreancesDouteusesService {
    private readonly prisma;
    private readonly ecritures;
    private readonly lettrage;
    private readonly tva;
    private readonly journalServeur;
    constructor(prisma: PrismaService, ecritures: EcritureService, lettrage: LettrageService, tva: TauxTvaService);
    private sousVerrou;
    private compenser;
    private statutDansTx;
    private supprimerBrouillardDansTx;
    private regime;
    private exercice;
    private journal;
    private compteParId;
    private compteDetail;
    private compte416DuTiers;
    private aUnANouveau;
    private aUnReportProvisoire;
    private chaine;
    private solde;
    private creance;
    private refuserSiCorrigee;
    private methodeDeLaCreance;
    private enPlace;
    private reste;
    private resteFinal;
    private motifSoldeReconstitue;
    private soldeAuPlusTard;
    private compte491Choisi;
    comptes(tenantId: string, exerciceId: string, numero?: string): Promise<{
        referentiel: import(".prisma/client").$Enums.Referentiel;
        soldesProvisoires: boolean;
        creances: {
            id: string;
            numero: string;
            intitule: string;
            tiers: string | null;
            solde: number;
            propose416: {
                LITIGIEUSE: string | null;
                DOUTEUSE: string | null;
            };
            propre416: {
                LITIGIEUSE: string | null;
                DOUTEUSE: string | null;
            };
            refusCotisations: string | null;
            avertissementCotisations: string | null;
        }[];
        tronque: boolean;
        plafond: number;
        filtreNumero: string | null;
        comptes416: {
            id: string;
            numero: string;
            intitule: string;
        }[];
        comptes491: {
            id: string;
            numero: string;
            intitule: string;
        }[];
        listes416491: {
            plafond: number;
            total416: number;
            tronque416: boolean;
            total491: number;
            tronque491: boolean;
        };
    }>;
    lister(tenantId: string, exerciceId: string): Promise<{
        exercice: {
            id: string;
            dateDebut: Date;
            dateFin: Date;
            statut: import(".prisma/client").$Enums.StatutExercice;
        };
        systemeMinimal: boolean;
        total: number;
        tronque: boolean;
        annulations: {
            revues: {
                total: number;
                tronque: boolean;
            };
            mouvements: {
                total: number;
                tronque: boolean;
            };
        };
        creances: {
            retirable: boolean;
            revuesAnnulees: {
                id: string;
                annuleeLe: Date | null;
                motif: string | null;
            }[];
            mouvementsAnnules: {
                id: string;
                type: import(".prisma/client").$Enums.TypeMouvementCreanceDouteuse;
                date: Date;
                montant: number;
                annuleeLe: Date | null;
                motif: string | null;
            }[];
            correction: {
                ecritureId: string;
                date: Date;
                piece: string;
                motif: string | null;
                le: Date | null;
                effective: boolean;
            } | null;
            correctionOfferte: boolean;
            id: string;
            nature: import(".prisma/client").$Enums.NatureCreanceDouteuse;
            compteCreance: {
                id: string;
                numero: string;
                intitule: string;
            };
            tiers: string | null;
            compte416: {
                id: string;
                numero: string;
                intitule: string;
            };
            compte491: {
                id: string;
                numero: string;
                intitule: string;
            };
            dateReclassement: Date;
            declareeOuverture: boolean;
            sourceDeclaration: string | null;
            montant: number;
            motif: string;
            pieces: Prisma.JsonValue;
            ecritureReclassementId: string | null;
            resteALaCloture: number;
            resteFinal: number;
            depreciationOuverture: number;
            depreciationALaCloture: number;
            revueAFaire: boolean;
            mouvementsSansRevue: number;
            comptePertePropose: string | null;
            revue: {
                id: string;
                date: Date;
                depreciationNecessaire: number;
                depreciationEnPlace: number;
                ecart: number;
                motif: string;
                pieces: Prisma.JsonValue;
                ecritureId: string | null;
            } | null;
            revues: {
                id: string;
                exerciceId: string;
                date: Date;
                depreciationNecessaire: number;
                ecart: number;
                motif: string;
                ecritureId: string | null;
            }[];
            mouvements: {
                id: string;
                type: import(".prisma/client").$Enums.TypeMouvementCreanceDouteuse;
                date: Date;
                montant: number;
                motif: string;
                pieces: Prisma.JsonValue;
                ecritureId: string | null;
            }[];
        }[];
        rapprochement: {
            provisoire: boolean;
            reportProvisoire: boolean;
            solde416: number;
            resteModule: number;
            solde491: number;
            depreciationModule: number;
            horsModule491: number;
        };
    }>;
    private rapprochementDuModule;
    private horsModule491;
    private presenter;
    private pieces;
    reclasser(tenantId: string, userId: string, dto: ReclasserCreanceDto): Promise<{
        montant: number;
        avertissement: string | null;
        id: string;
        createdAt: Date;
        tenantId: string;
        nature: import(".prisma/client").$Enums.NatureCreanceDouteuse;
        exerciceId: string;
        createdBy: string;
        motifAnnulation: string | null;
        annuleeLe: Date | null;
        annuleePar: string | null;
        annulation: Prisma.JsonValue | null;
        motif: string;
        compteCreanceId: string;
        compte416Id: string;
        compte491Id: string;
        dateReclassement: Date;
        pieces: Prisma.JsonValue;
        ecritureReclassementId: string | null;
        declareeOuverture: boolean;
        sourceDeclaration: string | null;
        depreciationOuverture: Prisma.Decimal;
        methodeCotisationsReclassement: import(".prisma/client").$Enums.MethodeCotisationsAuReclassement | null;
        corrigeeParResultatLe: Date | null;
        corrigeeParResultatPar: string | null;
        motifCorrectionResultat: string | null;
        ecritureCorrectionResultatId: string | null;
    }>;
    private reclasserSousVerrou;
    designerFactures(tenantId: string, userId: string, id: string, dto: DesignerFacturesDto): Promise<{
        id: string;
        retireeLe: string | null;
        motifRetrait: string | null;
        ligneEcritureId: string;
        montant: number;
        date: string;
        libelle: string;
        numeroPiece: number | null;
        montantFacture: number;
    }[]>;
    facturesDesignees(tenantId: string, creanceId: string): Promise<{
        id: string;
        retireeLe: string | null;
        motifRetrait: string | null;
        ligneEcritureId: string;
        montant: number;
        date: string;
        libelle: string;
        numeroPiece: number | null;
        montantFacture: number;
    }[]>;
    facturesCandidates(tenantId: string, id: string): Promise<{
        tronque: boolean;
        annulee: boolean;
        factures: {
            ligneEcritureId: string;
            date: string;
            libelle: string;
            numeroPiece: number | null;
            montant: number;
            ouvert: number;
            aNouveau: boolean;
            lettragePartage: boolean;
            designeePar: string[];
        }[];
    }>;
    static ouvertDeLaLigne(l: {
        debit: unknown;
        credit: unknown;
        lettrage: {
            statut: string;
            solde: unknown;
        } | null;
    }): number;
    retirerDesignation(tenantId: string, userId: string, id: string, designationId: string, dto: RetirerDesignationDto): Promise<{
        id: string;
        retireeLe: string | null;
        motifRetrait: string | null;
        ligneEcritureId: string;
        montant: number;
        date: string;
        libelle: string;
        numeroPiece: number | null;
        montantFacture: number;
    }[]>;
    private facturesADesigner;
    declarer(tenantId: string, userId: string, dto: DeclarerCreanceOuvertureDto): Promise<{
        avertissement: string | null;
        information?: string | undefined;
        montant: number;
        depreciationOuverture: number;
        borneProvisoire: boolean;
        id: string;
        createdAt: Date;
        tenantId: string;
        nature: import(".prisma/client").$Enums.NatureCreanceDouteuse;
        exerciceId: string;
        createdBy: string;
        motifAnnulation: string | null;
        annuleeLe: Date | null;
        annuleePar: string | null;
        annulation: Prisma.JsonValue | null;
        motif: string;
        compteCreanceId: string;
        compte416Id: string;
        compte491Id: string;
        dateReclassement: Date;
        pieces: Prisma.JsonValue;
        ecritureReclassementId: string | null;
        declareeOuverture: boolean;
        sourceDeclaration: string | null;
        methodeCotisationsReclassement: import(".prisma/client").$Enums.MethodeCotisationsAuReclassement | null;
        corrigeeParResultatLe: Date | null;
        corrigeeParResultatPar: string | null;
        motifCorrectionResultat: string | null;
        ecritureCorrectionResultatId: string | null;
    }>;
    private declarerSousVerrou;
    private positionEnDeviseOuverte;
    private positionsEnDevise;
    private soldesALOuverture;
    private dejaPorteALOuverture;
    private entreeRevue;
    revoir(tenantId: string, userId: string, id: string, dto: RevoirDepreciationDto): Promise<{
        depreciationNecessaire: number;
        depreciationEnPlace: number;
        ecart: number;
        avertissement: string | null;
        id: string;
        createdAt: Date;
        tenantId: string;
        exerciceId: string;
        createdBy: string;
        date: Date;
        motifAnnulation: string | null;
        ecritureId: string | null;
        annuleeLe: Date | null;
        annuleePar: string | null;
        annulation: Prisma.JsonValue | null;
        motif: string;
        pieces: Prisma.JsonValue;
        creanceId: string;
    }>;
    private revoirSousVerrou;
    propositionRevue(tenantId: string, id: string, exerciceId: string): Promise<{
        depreciationEnPlace: number;
        resteALaCloture: number;
        dateRevue: string;
        comptes: {
            compte491: string;
            dotation: "6594";
            reprise: "7594";
        };
        resteNegatif: string | null;
        dejaRevue: boolean;
        revuePosterieure: string | null;
        anterieursSansRevue: string[];
        dotationRefuseeSmt: string | null;
        dotationRefuseeImpaye: string | null;
        avertissementMethode: string | null;
    }>;
    annulerRevue(tenantId: string, userId: string, id: string, revueId: string, dto: AnnulerRevueDto): Promise<{
        annulee: boolean;
        annulation: Record<string, unknown>;
    }>;
    private annulerRevueSousVerrou;
    private mouvement;
    private perteAvecTva;
    private taxeEncaissementDeclaree;
    private lettrerSiEteinte;
    private lignesOuvertesDeLaCreance;
    propositionLettrage416(tenantId: string, id: string, exerciceId: string): Promise<{
        eteinte: boolean;
        compte416: string;
        ouvertes: number;
        aApporter: number;
        aNouveaux: {
            id: string;
            date: string;
            numeroPiece: number | null;
            libelle: string | null;
            montant: number;
        }[];
        tronque: boolean;
        propose: string[];
    }>;
    lettrer416(tenantId: string, userId: string, id: string, dto: Lettrer416Dto): Promise<{
        pose: true;
        code: string;
    }>;
    private ecrituresDeLaCreance;
    private lettrerSiEteinteSansEchec;
    private groupeRetourEtPerte;
    private groupeDuModule;
    perte(tenantId: string, userId: string, id: string, dto: PerteCreanceDto): Promise<{
        montant: number;
        montantTva: number;
        montantTvaAnnulee: number;
        montantHt: number;
        lettrage416: {
            pose: true;
            code: string;
        } | {
            pose: false;
            motif: string;
            aDesigner?: true;
        } | null;
        lettrageOrigine: {
            pose: true;
            code: string;
            motif?: undefined;
        } | {
            pose: false;
            motif: string;
            code?: undefined;
        };
        avertissement: string | null;
        information: string;
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TypeMouvementCreanceDouteuse;
        tenantId: string;
        exerciceId: string;
        createdBy: string;
        date: Date;
        motifAnnulation: string | null;
        ecritureId: string | null;
        annuleeLe: Date | null;
        annuleePar: string | null;
        annulation: Prisma.JsonValue | null;
        motif: string;
        pieces: Prisma.JsonValue;
        creanceId: string;
        detailTva: Prisma.JsonValue | null;
        ecriturePerteId: string | null;
    } | {
        montant: number;
        lettrage416: {
            pose: true;
            code: string;
        } | {
            pose: false;
            motif: string;
            aDesigner?: true;
        } | null;
        avertissement: string | null;
        information: string | null;
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TypeMouvementCreanceDouteuse;
        tenantId: string;
        exerciceId: string;
        createdBy: string;
        date: Date;
        motifAnnulation: string | null;
        ecritureId: string | null;
        annuleeLe: Date | null;
        annuleePar: string | null;
        annulation: Prisma.JsonValue | null;
        motif: string;
        pieces: Prisma.JsonValue;
        creanceId: string;
        montantTva: Prisma.Decimal;
        montantTvaAnnulee: Prisma.Decimal;
        detailTva: Prisma.JsonValue | null;
        ecriturePerteId: string | null;
    }>;
    recouvrement(tenantId: string, userId: string, id: string, dto: RecouvrementCreanceDto): Promise<{
        montant: number;
        montantTva: number;
        montantTvaAnnulee: number;
        montantHt: number;
        lettrage416: {
            pose: true;
            code: string;
        } | {
            pose: false;
            motif: string;
            aDesigner?: true;
        } | null;
        lettrageOrigine: {
            pose: true;
            code: string;
            motif?: undefined;
        } | {
            pose: false;
            motif: string;
            code?: undefined;
        };
        avertissement: string | null;
        information: string;
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TypeMouvementCreanceDouteuse;
        tenantId: string;
        exerciceId: string;
        createdBy: string;
        date: Date;
        motifAnnulation: string | null;
        ecritureId: string | null;
        annuleeLe: Date | null;
        annuleePar: string | null;
        annulation: Prisma.JsonValue | null;
        motif: string;
        pieces: Prisma.JsonValue;
        creanceId: string;
        detailTva: Prisma.JsonValue | null;
        ecriturePerteId: string | null;
    } | {
        montant: number;
        lettrage416: {
            pose: true;
            code: string;
        } | {
            pose: false;
            motif: string;
            aDesigner?: true;
        } | null;
        avertissement: string | null;
        information: string | null;
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TypeMouvementCreanceDouteuse;
        tenantId: string;
        exerciceId: string;
        createdBy: string;
        date: Date;
        motifAnnulation: string | null;
        ecritureId: string | null;
        annuleeLe: Date | null;
        annuleePar: string | null;
        annulation: Prisma.JsonValue | null;
        motif: string;
        pieces: Prisma.JsonValue;
        creanceId: string;
        montantTva: Prisma.Decimal;
        montantTvaAnnulee: Prisma.Decimal;
        detailTva: Prisma.JsonValue | null;
        ecriturePerteId: string | null;
    }>;
    candidatesCorrection(tenantId: string, id: string): Promise<{
        reste: number;
        comptes: {
            compte416: string;
            compte491: string;
        };
        total: number;
        tronque: boolean;
        ecritures: {
            id: string;
            date: string;
            piece: string;
            libelle: string;
            credit416: number;
            debit491: number;
            depreciationEnPlace: number;
        }[];
    }>;
    corrigerParResultat(tenantId: string, userId: string, id: string, dto: CorrigerParResultatDto): Promise<{
        avertissement: string | null;
        id: string;
        corrigeeParResultatLe: Date | null;
        motifCorrectionResultat: string | null;
        ecritureCorrectionResultatId: string | null;
    }>;
    private corrigerParResultatSousVerrou;
    retirerCreance(tenantId: string, id: string): Promise<{
        retire: boolean;
    }>;
    annulerReclassement(tenantId: string, userId: string, id: string, dto: AnnulerReclassementDto): Promise<{
        information?: string | undefined;
        annule: boolean;
        annulation: Record<string, unknown>;
    }>;
    private annulerReclassementSousVerrou;
    retirerMouvement(tenantId: string, userId: string, id: string, mouvementId: string): Promise<{
        perteRetiree?: {
            lettrageDefait?: string | undefined;
            ecritureId: string;
            numeroPiece: number | null;
        } | undefined;
        lettrageDefait?: string | undefined;
        retire: boolean;
    }>;
    annulerMouvement(tenantId: string, userId: string, id: string, mouvementId: string, dto: AnnulerMouvementDto): Promise<{
        information?: string | undefined;
        decalage?: string | undefined;
        lettrageOrigine?: {
            pose: true;
            code: string;
            information?: string;
        } | {
            pose: false;
            motif: string;
        } | null | undefined;
        annule: boolean;
        annulation: Record<string, unknown>;
    }>;
    private annulerMouvementSousVerrou;
    private lireRecuperation;
    private static entreePertes;
    private static presenterRecuperations;
    propositionRecuperation(tenantId: string, id: string): Promise<{
        factures: {
            dejaRecuperee: boolean;
            designationId: string;
            ligneEcritureId: string;
            libelle: string;
            numeroPiece: number | null;
            dateFacture: string;
            designe: number;
            recouvre: number;
            impayeTtc: number;
            impayeHt: number;
            tvaCorrespondante: number;
            recuperable: import("./recuperation-tva").TaxeRecuperable[];
            tvaRecuperable: number;
            annulable: import("./recuperation-tva").TaxeRecuperable[];
            tvaAnnulable: number;
            motifs: string[];
            mention: string;
        }[];
        ouverte: boolean;
        motif: string | null;
        derniereConstatation: string | null;
        finDuDroit: string | null;
        derniereDateEcriture: string | null;
        derniereDateEcritureTrimestrielle: string | null;
        finDerniereLiquidation: string | null;
        reserveAncienMoteur: string | null;
        recuperations: {
            id: string;
            date: string;
            montantTva: number;
            montantHt: number;
            detail: Prisma.JsonValue;
            motif: string;
            ecriture: {
                id: string;
                numeroPiece: number | null;
                statut: import(".prisma/client").$Enums.StatutEcriture;
            } | null;
            exerciceClos: boolean;
            annuleeLe: string | null;
            motifAnnulation: string | null;
        }[];
    }>;
    recupererTva(tenantId: string, userId: string, id: string, dto: RecupererTvaCreanceDto): Promise<{
        id: string;
        montantTva: number;
        montantHt: number;
        factures: {
            designationId: string;
            libelle: string;
            tva: number;
            mention: string;
        }[];
        information: string | null;
        reserveAncienMoteur: string | null;
    }>;
    annulerRecuperation(tenantId: string, userId: string, id: string, recuperationId: string, dto: AnnulerRecuperationTvaDto): Promise<{
        annulee: boolean;
        annulation: Record<string, unknown>;
    }>;
    private refuserSiRecuperee;
}
