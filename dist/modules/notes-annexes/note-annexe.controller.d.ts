import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { NoteAnnexeService } from './note-annexe.service';
import { RattacherDto } from './dto/rattachement.dto';
import { RetirerFormatAnterieurDto, SaisirNoteDto } from './dto/saisie-note.dto';
export declare class NoteAnnexeController {
    private readonly noteAnnexeService;
    constructor(noteAnnexeService: NoteAnnexeService);
    associations(user: AuthenticatedUser, exerciceId: string): Promise<{
        notes: import("./note-annexe.types").NoteCalculee[];
        exerciceN1Disponible: boolean;
        rattachementsSansRubrique: import("./note-annexe.service").RattachementSansRubrique[];
        groupesLusLigneALigne: import("../lettrage/reste-des-lignes-ouvertes").GroupesLusLigneALigne;
        ficheRecapitulative: {
            code: string;
            titre: string;
            applicable: boolean;
            rubriquesEnAttente: import("./note-annexe.types").RubriqueEnAttente[];
        }[];
        couverture: {
            transcrites: number;
            attendues: number;
        };
    }>;
    projet(user: AuthenticatedUser, exerciceId: string): Promise<{
        notes: import("./note-annexe.types").NoteCalculee[];
        exerciceN1Disponible: boolean;
        rattachementsSansRubrique: import("./note-annexe.service").RattachementSansRubrique[];
        groupesLusLigneALigne: import("../lettrage/reste-des-lignes-ouvertes").GroupesLusLigneALigne;
        ficheRecapitulative: {
            code: string;
            titre: string;
            applicable: boolean;
            rubriquesEnAttente: import("./note-annexe.types").RubriqueEnAttente[];
        }[];
        couverture: {
            transcrites: number;
            attendues: number;
        };
    }>;
    rattacher(user: AuthenticatedUser, dto: RattacherDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        compteId: string;
        jeu: import(".prisma/client").$Enums.JeuNotesAnnexes;
        codeNote: string;
        cleRubrique: string;
    }>;
    detacher(user: AuthenticatedUser, dto: RattacherDto): Promise<{
        detache: boolean;
    }>;
    saisir(user: AuthenticatedUser, dto: SaisirNoteDto): Promise<{
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
        valeurNombre: import("@prisma/client/runtime/library").Decimal | null;
        updatedBy: string;
    } | {
        efface: boolean;
    }>;
    retirerFormatAnterieur(user: AuthenticatedUser, dto: RetirerFormatAnterieurDto): Promise<{
        retirees: number;
    }>;
}
