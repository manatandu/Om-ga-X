import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { EtatsFinanciersSyscohadaService } from '../etats-financiers-syscohada/etats-financiers-syscohada.service';
import { CumulService } from '../consolidation/cumul.service';
import { PerimetreService } from '../consolidation/perimetre.service';
import { PosteConsolidation } from '../consolidation/cumul-consolidation';
import { ActiviteIfrsDto, EffetChangeIfrsDto, MouvementCpIfrsDto, NotesIfrsDto, PremiereApplicationIfrsDto, RegleConsolidationIfrsDto, RegleIfrsDto, RetraitementIfrsDto, TresorerieIfrsDto } from './dto/ifrs.dto';
import { EtatsIfrs } from './etats-ifrs';
import { EtatsIfrsConsolides } from './etats-ifrs-consolides';
import { TableauFluxIfrs } from './flux-tresorerie-ifrs';
import { PremiereApplication } from './premiere-application-ifrs';
import { VariationCapitauxPropres } from './variation-capitaux-propres-ifrs';
export declare class IfrsService {
    private readonly prisma;
    private readonly ecritures;
    private readonly etatsSyscohada;
    private readonly cumuls;
    private readonly perimetre;
    constructor(prisma: PrismaService, ecritures: EcritureService, etatsSyscohada: EtatsFinanciersSyscohadaService, cumuls: CumulService, perimetre: PerimetreService);
    private exercice;
    private retraitementsDe;
    private precedent;
    private mouvementsDe;
    private blocVariation;
    private calculer;
    private capitauxPropresSyscohada;
    private premiereApplication;
    private fluxDe;
    private cafgParCategorie;
    private controlerCafg;
    private perimetreTresorerie;
    etat(tenantId: string, exerciceId: string): Promise<{
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
            id: string;
            createdAt: Date;
            tenantId: string;
            montant: Prisma.Decimal;
            exerciceId: string;
            consolide: boolean;
            justification: string;
            categorie: import(".prisma/client").$Enums.CategorieEffetChangeIfrs;
        } | null;
        fluxTresorerie: {
            n: TableauFluxIfrs | null;
            motifN: string | null;
            n1: TableauFluxIfrs | null;
            motifN1: string | null;
        };
        dejaAdoptant: boolean;
        regles: {
            id: string;
            createdAt: Date;
            tenantId: string;
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
            createdAt: Date;
            tenantId: string;
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
            createdAt: Date;
            tenantId: string;
            exerciceId: string;
            libelle: string;
            fondement: string;
            aLaTransition: boolean;
            correctionErreur: boolean;
            consolide: boolean;
        }[];
        rubriques: import("./rubriques-ifrs").RubriqueIfrs[];
        groupes: Record<string, string>;
        n: EtatsIfrs;
        n1: EtatsIfrs | null;
        motifN1: string | null;
        premiereApplication: PremiereApplication | null;
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
            n: VariationCapitauxPropres | null;
            motifN: string | null;
            n1: VariationCapitauxPropres | null;
            motifN1: string | null;
            mouvements: {
                montant: number;
                id: string;
                createdAt: Date;
                type: import(".prisma/client").$Enums.TypeMouvementCpIfrs;
                tenantId: string;
                exerciceId: string;
                libelle: string;
                consolide: boolean;
                composante: import(".prisma/client").$Enums.ComposanteCpIfrs;
                justification: string;
            }[];
        };
    }>;
    etatConsolide(tenantId: string, exerciceId: string): Promise<{
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
            createdAt: Date;
            tenantId: string;
            prefixe: string;
            rubrique: string;
        }[];
        reglesConsolidation: {
            id: string;
            createdAt: Date;
            tenantId: string;
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
            createdAt: Date;
            tenantId: string;
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
            poste: PosteConsolidation;
            libelle: string;
        }[];
        decouvertsDansTresorerie: boolean | null;
        tresorerieGroupeEnDevises: boolean | null;
        premierExerciceIfrsConsolideId: string | null;
        dejaAdoptantConsolide: boolean;
        exemptionRegroupementsC1: boolean | null;
        effetChange: {
            id: string;
            createdAt: Date;
            tenantId: string;
            montant: Prisma.Decimal;
            exerciceId: string;
            consolide: boolean;
            justification: string;
            categorie: import(".prisma/client").$Enums.CategorieEffetChangeIfrs;
        } | null;
    } | {
        n: EtatsIfrsConsolides;
        motifN: null;
        n1: EtatsIfrsConsolides | null;
        motifN1: string | null;
        fluxTresorerie: {
            n: TableauFluxIfrs | null;
            motifN: string | null;
            n1: TableauFluxIfrs | null;
            motifN1: string | null;
        };
        premiereApplication: PremiereApplication | null;
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
            createdAt: Date;
            tenantId: string;
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
            n: VariationCapitauxPropres | null;
            motifN: string | null;
            n1: VariationCapitauxPropres | null;
            motifN1: string | null;
            mouvements: {
                montant: number;
                id: string;
                createdAt: Date;
                type: import(".prisma/client").$Enums.TypeMouvementCpIfrs;
                tenantId: string;
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
            createdAt: Date;
            tenantId: string;
            prefixe: string;
            rubrique: string;
        }[];
        reglesConsolidation: {
            id: string;
            createdAt: Date;
            tenantId: string;
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
            createdAt: Date;
            tenantId: string;
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
            poste: PosteConsolidation;
            libelle: string;
        }[];
        decouvertsDansTresorerie: boolean | null;
        tresorerieGroupeEnDevises: boolean | null;
        premierExerciceIfrsConsolideId: string | null;
        dejaAdoptantConsolide: boolean;
        exemptionRegroupementsC1: boolean | null;
        effetChange: {
            id: string;
            createdAt: Date;
            tenantId: string;
            montant: Prisma.Decimal;
            exerciceId: string;
            consolide: boolean;
            justification: string;
            categorie: import(".prisma/client").$Enums.CategorieEffetChangeIfrs;
        } | null;
    }>;
    private premiereApplicationConsolidee;
    private fluxConsolideDe;
    ajouterRegleConsolidation(tenantId: string, dto: RegleConsolidationIfrsDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        rubrique: string;
        poste: string;
    }>;
    supprimerRegleConsolidation(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
    declarerNotes(tenantId: string, dto: NotesIfrsDto): Promise<{
        id: string;
        tenantId: string;
        contenu: Prisma.JsonValue;
        exerciceId: string;
        updatedAt: Date;
        consolide: boolean;
        ifrs12: Prisma.JsonValue | null;
    }>;
    declarerNotesIfrs12(tenantId: string, dto: NotesIfrsDto): Promise<{
        id: string;
        tenantId: string;
        contenu: Prisma.JsonValue;
        exerciceId: string;
        updatedAt: Date;
        consolide: boolean;
        ifrs12: Prisma.JsonValue | null;
    }>;
    declarerTresorerie(tenantId: string, dto: TresorerieIfrsDto): Promise<{
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
    declarerEffetChange(tenantId: string, dto: EffetChangeIfrsDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        montant: Prisma.Decimal;
        exerciceId: string;
        consolide: boolean;
        justification: string;
        categorie: import(".prisma/client").$Enums.CategorieEffetChangeIfrs;
    }>;
    supprimerEffetChange(tenantId: string, exerciceId: string, consolide?: boolean): Promise<{
        supprime: boolean;
    }>;
    declarerPremiereApplication(tenantId: string, dto: PremiereApplicationIfrsDto): Promise<{
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
    declarerActivite(tenantId: string, dto: ActiviteIfrsDto): Promise<{
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
    ajouterRegle(tenantId: string, dto: RegleIfrsDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        prefixe: string;
        rubrique: string;
    }>;
    supprimerRegle(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
    ajouterRetraitement(tenantId: string, dto: RetraitementIfrsDto): Promise<{
        lignes: {
            id: string;
            tenantId: string;
            montant: Prisma.Decimal;
            ordre: number;
            rubrique: string;
            retraitementId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        exerciceId: string;
        libelle: string;
        fondement: string;
        aLaTransition: boolean;
        correctionErreur: boolean;
        consolide: boolean;
        partMinoritairesResultat: Prisma.Decimal | null;
        partMinoritairesOci: Prisma.Decimal | null;
        partMinoritairesCapitauxPropres: Prisma.Decimal | null;
    }>;
    supprimerRetraitement(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
    ajouterMouvementCp(tenantId: string, dto: MouvementCpIfrsDto): Promise<{
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TypeMouvementCpIfrs;
        tenantId: string;
        montant: Prisma.Decimal;
        exerciceId: string;
        libelle: string;
        consolide: boolean;
        composante: import(".prisma/client").$Enums.ComposanteCpIfrs;
        justification: string;
    }>;
    supprimerMouvementCp(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
}
