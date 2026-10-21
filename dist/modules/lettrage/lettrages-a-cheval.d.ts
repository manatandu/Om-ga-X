import type { PrismaService } from '../../common/prisma.service';
import { type Referentiel } from '../reglements/ecart-change-realise';
type Lecteur = Pick<PrismaService, 'lettrage' | 'ligneEcriture' | 'cloture'>;
export declare function motifLettrageADeuxExercices(lignes: Array<{
    ecriture: {
        exerciceId: string;
        date: Date;
    };
}>, compte: {
    numero: string;
    modeReportANouveau: string;
}): string | null;
export interface LettrageACheval {
    lettrageId: string;
    code: string;
    statut: 'PARTIEL' | 'SOLDE';
    compteNumero: string;
    auDetail: boolean;
    autresExercices: Array<{
        dateDebut: Date;
        dateFin: Date;
        clos: boolean;
    }>;
    fige: boolean;
    ecartNonPasse: number | null;
    denouement: Date;
}
export declare const PLAFOND_LETTRAGES_A_CHEVAL = 200;
export interface LettragesACheval {
    groupes: LettrageACheval[];
    tronque: boolean;
}
export declare function lettragesACheval(prisma: Lecteur, p: {
    tenantId: string;
    exerciceId: string;
}): Promise<LettragesACheval>;
export declare function nommerLettrageACheval(g: LettrageACheval): string;
export declare function issueLettrageACheval(g: LettrageACheval): string;
export declare function issueEcartACheval(g: LettrageACheval, referentiel: Referentiel): string;
export {};
