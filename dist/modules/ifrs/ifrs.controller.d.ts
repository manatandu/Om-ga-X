import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { IfrsService } from './ifrs.service';
import { ActiviteIfrsDto, EffetChangeIfrsDto, MouvementCpIfrsDto, NotesIfrsDto, PremiereApplicationIfrsDto, RegleConsolidationIfrsDto, RegleIfrsDto, RetraitementIfrsDto, TresorerieIfrsDto } from './dto/ifrs.dto';
export declare class IfrsController {
    private readonly ifrs;
    constructor(ifrs: IfrsService);
    etat(user: AuthenticatedUser, exerciceId: string): Promise<{
        notes: {
            declarations: import("./notes-ifrs").DeclarationsNotesIfrs;
            declarationsN1: import("./notes-ifrs").DeclarationsNotesIfrs | null;
            sousTotauxReference: Record<import("./notes-ifrs").SousTotalReference, string>;
            notes: import("./notes-ifrs").NoteIfrs[];
            renvois: Record<string, number[]>;
            motifsNonPubliable: string[];
        };
        activitePrincipale: import(".prisma/client").$Enums.ActivitePrincipaleIfrs | null;
        premierExerciceIfrsId: string | null;
        decouvertsDansTresorerie: boolean | null;
        tresorerieEnDevises: boolean | null;
        effetChange: {
            montant: import("@prisma/client/runtime/library").Decimal;
            id: string;
            tenantId: string;
            createdAt: Date;
            exerciceId: string;
            consolide: boolean;
            justification: string;
            categorie: import(".prisma/client").$Enums.CategorieEffetChangeIfrs;
        } | null;
        fluxTresorerie: {
            n: import("./flux-tresorerie-ifrs").TableauFluxIfrs | null;
            motifN: string | null;
            n1: import("./flux-tresorerie-ifrs").TableauFluxIfrs | null;
            motifN1: string | null;
        };
        dejaAdoptant: boolean;
        regles: {
            id: string;
            tenantId: string;
            createdAt: Date;
            prefixe: string;
            rubrique: string;
        }[];
        retraitements: {
            partMinoritairesResultat: number | null;
            partMinoritairesOci: number | null;
            partMinoritairesCapitauxPropres: number | null;
            lignes: {
                montant: number;
                id: string;
                tenantId: string;
                ordre: number;
                rubrique: string;
                retraitementId: string;
            }[];
            id: string;
            tenantId: string;
            createdAt: Date;
            exerciceId: string;
            libelle: string;
            fondement: string;
            aLaTransition: boolean;
            correctionErreur: boolean;
            consolide: boolean;
        }[];
        exerciceTransitionId: string | null;
        ajustementsTransition: {
            partMinoritairesResultat: number | null;
            partMinoritairesOci: number | null;
            partMinoritairesCapitauxPropres: number | null;
            lignes: {
                montant: number;
                id: string;
                tenantId: string;
                ordre: number;
                rubrique: string;
                retraitementId: string;
            }[];
            id: string;
            tenantId: string;
            createdAt: Date;
            exerciceId: string;
            libelle: string;
            fondement: string;
            aLaTransition: boolean;
            correctionErreur: boolean;
            consolide: boolean;
        }[];
        rubriques: import("./rubriques-ifrs").RubriqueIfrs[];
        groupes: Record<string, string>;
        n: import("./etats-ifrs").EtatsIfrs;
        n1: import("./etats-ifrs").EtatsIfrs | null;
        motifN1: string | null;
        premiereApplication: import("./premiere-application-ifrs").PremiereApplication | null;
        motifPremiereApplication: string | null;
        variationCapitauxPropres: {
            composantes: {
                CAPITAL: {
                    libelle: string;
                    rubriques: string[];
                };
                RESERVES: {
                    libelle: string;
                    rubriques: string[];
                };
                AUTRES_COMPOSANTES: {
                    libelle: string;
                    rubriques: string[];
                };
            };
            n: import("./variation-capitaux-propres-ifrs").VariationCapitauxPropres | null;
            motifN: string | null;
            n1: import("./variation-capitaux-propres-ifrs").VariationCapitauxPropres | null;
            motifN1: string | null;
            mouvements: {
                montant: number;
                type: import(".prisma/client").$Enums.TypeMouvementCpIfrs;
                id: string;
                tenantId: string;
                createdAt: Date;
                exerciceId: string;
                libelle: string;
                consolide: boolean;
                composante: import(".prisma/client").$Enums.ComposanteCpIfrs;
                justification: string;
            }[];
        };
    }>;
    etatConsolide(user: AuthenticatedUser, exerciceId: string): Promise<{
        n: null;
        motifN: string;
        n1: null;
        motifN1: null;
        fluxTresorerie: null;
        variationCapitauxPropres: null;
        notes: null;
        premiereApplication: null;
        motifPremiereApplication: null;
        exerciceTransitionId: null;
        ajustementsTransition: never[];
        activitePrincipale: import(".prisma/client").$Enums.ActivitePrincipaleIfrs | null;
        regles: {
            id: string;
            tenantId: string;
            createdAt: Date;
            prefixe: string;
            rubrique: string;
        }[];
        reglesConsolidation: {
            id: string;
            tenantId: string;
            createdAt: Date;
            rubrique: string;
            poste: string;
        }[];
        retraitements: {
            partMinoritairesResultat: number | null;
            partMinoritairesOci: number | null;
            partMinoritairesCapitauxPropres: number | null;
            lignes: {
                montant: number;
                id: string;
                tenantId: string;
                ordre: number;
                rubrique: string;
                retraitementId: string;
            }[];
            id: string;
            tenantId: string;
            createdAt: Date;
            exerciceId: string;
            libelle: string;
            fondement: string;
            aLaTransition: boolean;
            correctionErreur: boolean;
            consolide: boolean;
        }[];
        rubriques: import("./rubriques-ifrs").RubriqueIfrs[];
        groupes: Record<string, string>;
        postesRanges: {
            rubrique: string;
            fondement: string;
            poste: string;
            libelle: string;
        }[];
        postesADeclarer: {
            poste: import("../consolidation/cumul-consolidation").PosteConsolidation;
            libelle: string;
        }[];
        decouvertsDansTresorerie: boolean | null;
        tresorerieGroupeEnDevises: boolean | null;
        premierExerciceIfrsConsolideId: string | null;
        dejaAdoptantConsolide: boolean;
        exemptionRegroupementsC1: boolean | null;
        effetChange: {
            montant: import("@prisma/client/runtime/library").Decimal;
            id: string;
            tenantId: string;
            createdAt: Date;
            exerciceId: string;
            consolide: boolean;
            justification: string;
            categorie: import(".prisma/client").$Enums.CategorieEffetChangeIfrs;
        } | null;
    } | {
        n: import("./etats-ifrs-consolides").EtatsIfrsConsolides;
        motifN: null;
        n1: import("./etats-ifrs-consolides").EtatsIfrsConsolides | null;
        motifN1: string | null;
        fluxTresorerie: {
            n: import("./flux-tresorerie-ifrs").TableauFluxIfrs | null;
            motifN: string | null;
            n1: import("./flux-tresorerie-ifrs").TableauFluxIfrs | null;
            motifN1: string | null;
        };
        premiereApplication: import("./premiere-application-ifrs").PremiereApplication | null;
        motifPremiereApplication: string | null;
        exerciceTransitionId: string | null;
        ajustementsTransition: {
            partMinoritairesResultat: number | null;
            partMinoritairesOci: number | null;
            partMinoritairesCapitauxPropres: number | null;
            lignes: {
                montant: number;
                id: string;
                tenantId: string;
                ordre: number;
                rubrique: string;
                retraitementId: string;
            }[];
            id: string;
            tenantId: string;
            createdAt: Date;
            exerciceId: string;
            libelle: string;
            fondement: string;
            aLaTransition: boolean;
            correctionErreur: boolean;
            consolide: boolean;
        }[];
        notes: {
            declarations: import("./notes-ifrs").DeclarationsNotesIfrs;
            declarationsN1: import("./notes-ifrs").DeclarationsNotesIfrs | null;
            sousTotauxReference: Record<import("./notes-ifrs").SousTotalReference, string>;
            ifrs12: import("./notes-ifrs12").DeclarationsIfrs12;
            entitesIfrs12: {
                nom: string;
                methode: import("../consolidation/perimetre-consolidation").MethodeConsolidation;
                estConsolidante: boolean;
                pctInteret: number;
                natureControle: import("../consolidation/perimetre-consolidation").NatureControle;
                exclue: boolean;
            }[];
            notes: import("./notes-ifrs").NoteIfrs[];
            renvois: Record<string, number[]>;
            motifsNonPubliable: string[];
        };
        variationCapitauxPropres: {
            composantes: Record<import("./variation-capitaux-propres-ifrs").ComposanteCp, {
                libelle: string;
                rubriques: string[];
            }>;
            n: import("./variation-capitaux-propres-ifrs").VariationCapitauxPropres | null;
            motifN: string | null;
            n1: import("./variation-capitaux-propres-ifrs").VariationCapitauxPropres | null;
            motifN1: string | null;
            mouvements: {
                montant: number;
                type: import(".prisma/client").$Enums.TypeMouvementCpIfrs;
                id: string;
                tenantId: string;
                createdAt: Date;
                exerciceId: string;
                libelle: string;
                consolide: boolean;
                composante: import(".prisma/client").$Enums.ComposanteCpIfrs;
                justification: string;
            }[];
        };
        activitePrincipale: import(".prisma/client").$Enums.ActivitePrincipaleIfrs | null;
        regles: {
            id: string;
            tenantId: string;
            createdAt: Date;
            prefixe: string;
            rubrique: string;
        }[];
        reglesConsolidation: {
            id: string;
            tenantId: string;
            createdAt: Date;
            rubrique: string;
            poste: string;
        }[];
        retraitements: {
            partMinoritairesResultat: number | null;
            partMinoritairesOci: number | null;
            partMinoritairesCapitauxPropres: number | null;
            lignes: {
                montant: number;
                id: string;
                tenantId: string;
                ordre: number;
                rubrique: string;
                retraitementId: string;
            }[];
            id: string;
            tenantId: string;
            createdAt: Date;
            exerciceId: string;
            libelle: string;
            fondement: string;
            aLaTransition: boolean;
            correctionErreur: boolean;
            consolide: boolean;
        }[];
        rubriques: import("./rubriques-ifrs").RubriqueIfrs[];
        groupes: Record<string, string>;
        postesRanges: {
            rubrique: string;
            fondement: string;
            poste: string;
            libelle: string;
        }[];
        postesADeclarer: {
            poste: import("../consolidation/cumul-consolidation").PosteConsolidation;
            libelle: string;
        }[];
        decouvertsDansTresorerie: boolean | null;
        tresorerieGroupeEnDevises: boolean | null;
        premierExerciceIfrsConsolideId: string | null;
        dejaAdoptantConsolide: boolean;
        exemptionRegroupementsC1: boolean | null;
        effetChange: {
            montant: import("@prisma/client/runtime/library").Decimal;
            id: string;
            tenantId: string;
            createdAt: Date;
            exerciceId: string;
            consolide: boolean;
            justification: string;
            categorie: import(".prisma/client").$Enums.CategorieEffetChangeIfrs;
        } | null;
    }>;
    ajouterRegleConsolidation(user: AuthenticatedUser, dto: RegleConsolidationIfrsDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        rubrique: string;
        poste: string;
    }>;
    supprimerRegleConsolidation(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
    declarerActivite(user: AuthenticatedUser, dto: ActiviteIfrsDto): Promise<{
        id: string;
        tenantId: string;
        updatedAt: Date;
        activitePrincipale: import(".prisma/client").$Enums.ActivitePrincipaleIfrs | null;
        premierExerciceIfrsId: string | null;
        dejaAdoptant: boolean;
        premierExerciceIfrsConsolideId: string | null;
        dejaAdoptantConsolide: boolean;
        exemptionRegroupementsC1: boolean | null;
        decouvertsDansTresorerie: boolean | null;
        tresorerieEnDevises: boolean | null;
        tresorerieGroupeEnDevises: boolean | null;
    }>;
    declarerPremiereApplication(user: AuthenticatedUser, dto: PremiereApplicationIfrsDto): Promise<{
        id: string;
        tenantId: string;
        updatedAt: Date;
        activitePrincipale: import(".prisma/client").$Enums.ActivitePrincipaleIfrs | null;
        premierExerciceIfrsId: string | null;
        dejaAdoptant: boolean;
        premierExerciceIfrsConsolideId: string | null;
        dejaAdoptantConsolide: boolean;
        exemptionRegroupementsC1: boolean | null;
        decouvertsDansTresorerie: boolean | null;
        tresorerieEnDevises: boolean | null;
        tresorerieGroupeEnDevises: boolean | null;
    }>;
    declarerNotes(user: AuthenticatedUser, dto: NotesIfrsDto): Promise<{
        contenu: import("@prisma/client/runtime/library").JsonValue;
        id: string;
        tenantId: string;
        updatedAt: Date;
        exerciceId: string;
        consolide: boolean;
        ifrs12: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    declarerNotesIfrs12(user: AuthenticatedUser, dto: NotesIfrsDto): Promise<{
        contenu: import("@prisma/client/runtime/library").JsonValue;
        id: string;
        tenantId: string;
        updatedAt: Date;
        exerciceId: string;
        consolide: boolean;
        ifrs12: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    declarerTresorerie(user: AuthenticatedUser, dto: TresorerieIfrsDto): Promise<{
        id: string;
        tenantId: string;
        updatedAt: Date;
        activitePrincipale: import(".prisma/client").$Enums.ActivitePrincipaleIfrs | null;
        premierExerciceIfrsId: string | null;
        dejaAdoptant: boolean;
        premierExerciceIfrsConsolideId: string | null;
        dejaAdoptantConsolide: boolean;
        exemptionRegroupementsC1: boolean | null;
        decouvertsDansTresorerie: boolean | null;
        tresorerieEnDevises: boolean | null;
        tresorerieGroupeEnDevises: boolean | null;
    }>;
    declarerEffetChange(user: AuthenticatedUser, dto: EffetChangeIfrsDto): Promise<{
        montant: import("@prisma/client/runtime/library").Decimal;
        id: string;
        tenantId: string;
        createdAt: Date;
        exerciceId: string;
        consolide: boolean;
        justification: string;
        categorie: import(".prisma/client").$Enums.CategorieEffetChangeIfrs;
    }>;
    supprimerEffetChange(user: AuthenticatedUser, exerciceId: string, consolide?: string): Promise<{
        supprime: boolean;
    }>;
    ajouterRegle(user: AuthenticatedUser, dto: RegleIfrsDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        prefixe: string;
        rubrique: string;
    }>;
    supprimerRegle(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
    ajouterRetraitement(user: AuthenticatedUser, dto: RetraitementIfrsDto): Promise<{
        lignes: {
            montant: import("@prisma/client/runtime/library").Decimal;
            id: string;
            tenantId: string;
            ordre: number;
            rubrique: string;
            retraitementId: string;
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        exerciceId: string;
        libelle: string;
        fondement: string;
        aLaTransition: boolean;
        correctionErreur: boolean;
        consolide: boolean;
        partMinoritairesResultat: import("@prisma/client/runtime/library").Decimal | null;
        partMinoritairesOci: import("@prisma/client/runtime/library").Decimal | null;
        partMinoritairesCapitauxPropres: import("@prisma/client/runtime/library").Decimal | null;
    }>;
    supprimerRetraitement(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
    ajouterMouvementCp(user: AuthenticatedUser, dto: MouvementCpIfrsDto): Promise<{
        montant: import("@prisma/client/runtime/library").Decimal;
        type: import(".prisma/client").$Enums.TypeMouvementCpIfrs;
        id: string;
        tenantId: string;
        createdAt: Date;
        exerciceId: string;
        libelle: string;
        consolide: boolean;
        composante: import(".prisma/client").$Enums.ComposanteCpIfrs;
        justification: string;
    }>;
    supprimerMouvementCp(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
