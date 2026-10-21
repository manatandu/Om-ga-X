import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreancesDouteusesService } from './creances-douteuses.service';
import { AnnulerMouvementDto, AnnulerReclassementDto, AnnulerRecuperationTvaDto, AnnulerRevueDto, CorrigerParResultatDto, DeclarerCreanceOuvertureDto, DesignerFacturesDto, Lettrer416Dto, PerteCreanceDto, ReclasserCreanceDto, RecouvrementCreanceDto, RecupererTvaCreanceDto, RetirerDesignationDto, RevoirDepreciationDto } from './dto/creances-douteuses.dto';
export declare class CreancesDouteusesController {
    private readonly service;
    constructor(service: CreancesDouteusesService);
    lister(user: AuthenticatedUser, exerciceId: string): Promise<{
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
            pieces: import("@prisma/client/runtime/library").JsonValue;
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
                pieces: import("@prisma/client/runtime/library").JsonValue;
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
                pieces: import("@prisma/client/runtime/library").JsonValue;
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
    comptes(user: AuthenticatedUser, exerciceId: string, numero?: string): Promise<{
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
    propositionRevue(user: AuthenticatedUser, id: string, exerciceId: string): Promise<{
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
    reclasser(user: AuthenticatedUser, dto: ReclasserCreanceDto): Promise<{
        montant: number;
        avertissement: string | null;
        nature: import(".prisma/client").$Enums.NatureCreanceDouteuse;
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        motifAnnulation: string | null;
        exerciceId: string;
        annuleeLe: Date | null;
        annuleePar: string | null;
        annulation: import("@prisma/client/runtime/library").JsonValue | null;
        motif: string;
        compteCreanceId: string;
        compte416Id: string;
        compte491Id: string;
        dateReclassement: Date;
        pieces: import("@prisma/client/runtime/library").JsonValue;
        ecritureReclassementId: string | null;
        declareeOuverture: boolean;
        sourceDeclaration: string | null;
        depreciationOuverture: import("@prisma/client/runtime/library").Decimal;
        methodeCotisationsReclassement: import(".prisma/client").$Enums.MethodeCotisationsAuReclassement | null;
        corrigeeParResultatLe: Date | null;
        corrigeeParResultatPar: string | null;
        motifCorrectionResultat: string | null;
        ecritureCorrectionResultatId: string | null;
    }>;
    declarer(user: AuthenticatedUser, dto: DeclarerCreanceOuvertureDto): Promise<{
        avertissement: string | null;
        information?: string | undefined;
        montant: number;
        depreciationOuverture: number;
        borneProvisoire: boolean;
        nature: import(".prisma/client").$Enums.NatureCreanceDouteuse;
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        motifAnnulation: string | null;
        exerciceId: string;
        annuleeLe: Date | null;
        annuleePar: string | null;
        annulation: import("@prisma/client/runtime/library").JsonValue | null;
        motif: string;
        compteCreanceId: string;
        compte416Id: string;
        compte491Id: string;
        dateReclassement: Date;
        pieces: import("@prisma/client/runtime/library").JsonValue;
        ecritureReclassementId: string | null;
        declareeOuverture: boolean;
        sourceDeclaration: string | null;
        methodeCotisationsReclassement: import(".prisma/client").$Enums.MethodeCotisationsAuReclassement | null;
        corrigeeParResultatLe: Date | null;
        corrigeeParResultatPar: string | null;
        motifCorrectionResultat: string | null;
        ecritureCorrectionResultatId: string | null;
    }>;
    revoir(user: AuthenticatedUser, id: string, dto: RevoirDepreciationDto): Promise<{
        depreciationNecessaire: number;
        depreciationEnPlace: number;
        ecart: number;
        avertissement: string | null;
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        date: Date;
        motifAnnulation: string | null;
        exerciceId: string;
        ecritureId: string | null;
        annuleeLe: Date | null;
        annuleePar: string | null;
        annulation: import("@prisma/client/runtime/library").JsonValue | null;
        motif: string;
        pieces: import("@prisma/client/runtime/library").JsonValue;
        creanceId: string;
    }>;
    perte(user: AuthenticatedUser, id: string, dto: PerteCreanceDto): Promise<{
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
        type: import(".prisma/client").$Enums.TypeMouvementCreanceDouteuse;
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        date: Date;
        motifAnnulation: string | null;
        exerciceId: string;
        ecritureId: string | null;
        annuleeLe: Date | null;
        annuleePar: string | null;
        annulation: import("@prisma/client/runtime/library").JsonValue | null;
        motif: string;
        pieces: import("@prisma/client/runtime/library").JsonValue;
        creanceId: string;
        detailTva: import("@prisma/client/runtime/library").JsonValue | null;
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
        type: import(".prisma/client").$Enums.TypeMouvementCreanceDouteuse;
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        date: Date;
        motifAnnulation: string | null;
        exerciceId: string;
        ecritureId: string | null;
        annuleeLe: Date | null;
        annuleePar: string | null;
        annulation: import("@prisma/client/runtime/library").JsonValue | null;
        motif: string;
        pieces: import("@prisma/client/runtime/library").JsonValue;
        creanceId: string;
        montantTva: import("@prisma/client/runtime/library").Decimal;
        montantTvaAnnulee: import("@prisma/client/runtime/library").Decimal;
        detailTva: import("@prisma/client/runtime/library").JsonValue | null;
        ecriturePerteId: string | null;
    }>;
    propositionLettrage416(user: AuthenticatedUser, id: string, exerciceId: string): Promise<{
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
    lettrer416(user: AuthenticatedUser, id: string, dto: Lettrer416Dto): Promise<{
        pose: true;
        code: string;
    }>;
    factures(user: AuthenticatedUser, id: string): Promise<{
        designees: {
            id: string;
            retireeLe: string | null;
            motifRetrait: string | null;
            ligneEcritureId: string;
            montant: number;
            date: string;
            libelle: string;
            numeroPiece: number | null;
            montantFacture: number;
        }[];
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
    designerFactures(user: AuthenticatedUser, id: string, dto: DesignerFacturesDto): Promise<{
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
    retirerDesignation(user: AuthenticatedUser, id: string, designationId: string, dto: RetirerDesignationDto): Promise<{
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
    recouvrement(user: AuthenticatedUser, id: string, dto: RecouvrementCreanceDto): Promise<{
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
        type: import(".prisma/client").$Enums.TypeMouvementCreanceDouteuse;
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        date: Date;
        motifAnnulation: string | null;
        exerciceId: string;
        ecritureId: string | null;
        annuleeLe: Date | null;
        annuleePar: string | null;
        annulation: import("@prisma/client/runtime/library").JsonValue | null;
        motif: string;
        pieces: import("@prisma/client/runtime/library").JsonValue;
        creanceId: string;
        detailTva: import("@prisma/client/runtime/library").JsonValue | null;
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
        type: import(".prisma/client").$Enums.TypeMouvementCreanceDouteuse;
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        date: Date;
        motifAnnulation: string | null;
        exerciceId: string;
        ecritureId: string | null;
        annuleeLe: Date | null;
        annuleePar: string | null;
        annulation: import("@prisma/client/runtime/library").JsonValue | null;
        motif: string;
        pieces: import("@prisma/client/runtime/library").JsonValue;
        creanceId: string;
        montantTva: import("@prisma/client/runtime/library").Decimal;
        montantTvaAnnulee: import("@prisma/client/runtime/library").Decimal;
        detailTva: import("@prisma/client/runtime/library").JsonValue | null;
        ecriturePerteId: string | null;
    }>;
    retirer(user: AuthenticatedUser, id: string): Promise<{
        retire: boolean;
    }>;
    annulerRevue(user: AuthenticatedUser, id: string, revueId: string, dto: AnnulerRevueDto): Promise<{
        annulee: boolean;
        annulation: Record<string, unknown>;
    }>;
    candidatesCorrection(user: AuthenticatedUser, id: string): Promise<{
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
    corrigerParResultat(user: AuthenticatedUser, id: string, dto: CorrigerParResultatDto): Promise<{
        avertissement: string | null;
        id: string;
        corrigeeParResultatLe: Date | null;
        motifCorrectionResultat: string | null;
        ecritureCorrectionResultatId: string | null;
    }>;
    annulerReclassement(user: AuthenticatedUser, id: string, dto: AnnulerReclassementDto): Promise<{
        information?: string | undefined;
        annule: boolean;
        annulation: Record<string, unknown>;
    }>;
    annulerMouvement(user: AuthenticatedUser, id: string, mouvementId: string, dto: AnnulerMouvementDto): Promise<{
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
    retirerMouvement(user: AuthenticatedUser, id: string, mouvementId: string): Promise<{
        perteRetiree?: {
            lettrageDefait?: string | undefined;
            ecritureId: string;
            numeroPiece: number | null;
        } | undefined;
        lettrageDefait?: string | undefined;
        retire: boolean;
    }>;
    propositionRecuperation(user: AuthenticatedUser, id: string): Promise<{
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
            detail: import("@prisma/client/runtime/library").JsonValue;
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
    recupererTva(user: AuthenticatedUser, id: string, dto: RecupererTvaCreanceDto): Promise<{
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
    annulerRecuperation(user: AuthenticatedUser, id: string, recuperationId: string, dto: AnnulerRecuperationTvaDto): Promise<{
        annulee: boolean;
        annulation: Record<string, unknown>;
    }>;
}
