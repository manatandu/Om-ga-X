import { JeuNotesAnnexes, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { ExerciceService } from '../exercice/exercice.service';
import { EtatsFinanciersProjetBudgetService } from '../etats-financiers/etats-financiers-projet-budget.service';
import { EtatsFinanciersService } from '../etats-financiers/etats-financiers.service';
import { NoteCalculee, RubriqueEnAttente } from './note-annexe.types';
export { LOT_LECTURE, lireParLots } from '../../common/lecture-par-lots';
export interface RattachementSansRubrique {
    codeNote: string;
    cleRubrique: string;
    compteId: string;
    numero: string;
}
export declare function estRubriqueRattachable(jeu: JeuNotesAnnexes, codeNote: string, cleRubrique: string): boolean;
type ParametresDeBalance = Parameters<EcritureService['balance']>;
export declare function cleDeLectureDeBalance(parametres: ParametresDeBalance): string;
export declare function balanceMemorisee(ecritureService: EcritureService): EcritureService;
export declare class NoteAnnexeService {
    private readonly ecritureService;
    private readonly exerciceService;
    private readonly prisma;
    private readonly budgetService;
    private readonly etatsFinanciersService;
    constructor(ecritureService: EcritureService, exerciceService: ExerciceService, prisma: PrismaService, budgetService: EtatsFinanciersProjetBudgetService, etatsFinanciersService: EtatsFinanciersService);
    private rubriqueRattachable;
    private verifierJeuDuDossier;
    rattacher(tenantId: string, userId: string, jeu: JeuNotesAnnexes, codeNote: string, cleRubrique: string, compteId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        compteId: string;
        jeu: import(".prisma/client").$Enums.JeuNotesAnnexes;
        codeNote: string;
        cleRubrique: string;
    }>;
    private rubriqueQuiLitDeja;
    detacher(tenantId: string, jeu: JeuNotesAnnexes, codeNote: string, cleRubrique: string, compteId: string): Promise<{
        detache: boolean;
    }>;
    private calculerRubrique;
    private colonnesDeMouvement;
    private resoudreRubriques;
    private calculerNote;
    private chargerVentilationParNature;
    private chargerEcheances;
    private static readonly LOT_LECTURE;
    private parLots;
    private chargerRattachements;
    private chargerSaisies;
    private celluleSaisissable;
    enregistrerSaisie(tenantId: string, userId: string, exerciceId: string, jeu: JeuNotesAnnexes, codeNote: string, cleRubrique: string, colonne: number, valeur: string | number | null, rang?: number): Promise<{
        rang: number;
        id: string;
        tenantId: string;
        updatedAt: Date;
        exerciceId: string;
        jeu: import(".prisma/client").$Enums.JeuNotesAnnexes;
        motifRetrait: string | null;
        codeNote: string;
        cleRubrique: string;
        colonne: number;
        valeurTexte: string | null;
        valeurNombre: Prisma.Decimal | null;
        updatedBy: string;
    } | {
        efface: boolean;
    }>;
    retirerSaisieFormatAnterieur(tenantId: string, userId: string, exerciceId: string, jeu: JeuNotesAnnexes, codeNote: string, motif: string): Promise<{
        retirees: number;
    }>;
    private ecrireCellule;
    private notesDuJeu;
    private injecterDateArrete;
    private injecterExecutionBudgetaire;
    private etatsSurLaBalanceDeLAppel;
    private injecterIndicateursFinanciers;
    private injecterFicheSyntheseSyscohada;
    private injecterPassifsEventuels;
    private injecterTransfertDepreciation;
    notesAssociations(tenantId: string, exerciceId: string): Promise<{
        notes: NoteCalculee[];
        exerciceN1Disponible: boolean;
        rattachementsSansRubrique: RattachementSansRubrique[];
        groupesLusLigneALigne: import("../lettrage/reste-des-lignes-ouvertes").GroupesLusLigneALigne;
        ficheRecapitulative: {
            code: string;
            titre: string;
            applicable: boolean;
            rubriquesEnAttente: RubriqueEnAttente[];
        }[];
        couverture: {
            transcrites: number;
            attendues: number;
        };
    }>;
    notesProjet(tenantId: string, exerciceId: string): Promise<{
        notes: NoteCalculee[];
        exerciceN1Disponible: boolean;
        rattachementsSansRubrique: RattachementSansRubrique[];
        groupesLusLigneALigne: import("../lettrage/reste-des-lignes-ouvertes").GroupesLusLigneALigne;
        ficheRecapitulative: {
            code: string;
            titre: string;
            applicable: boolean;
            rubriquesEnAttente: RubriqueEnAttente[];
        }[];
        couverture: {
            transcrites: number;
            attendues: number;
        };
    }>;
    notesSyscohada(tenantId: string, exerciceId: string): Promise<{
        notes: NoteCalculee[];
        exerciceN1Disponible: boolean;
        rattachementsSansRubrique: RattachementSansRubrique[];
        groupesLusLigneALigne: import("../lettrage/reste-des-lignes-ouvertes").GroupesLusLigneALigne;
        ficheRecapitulative: {
            code: string;
            titre: string;
            applicable: boolean;
            rubriquesEnAttente: RubriqueEnAttente[];
        }[];
        couverture: {
            transcrites: number;
            attendues: number;
        };
    }>;
}
