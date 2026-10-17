import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RepartitionsAnalytiquesPaieService } from './repartitions-analytiques-paie.service';
import { RepartitionAnalytiquePaieDto, RetraitRepartitionAnalytiqueDto } from './dto/repartition-analytique-paie.dto';
export declare class RepartitionsAnalytiquesPaieController {
    private readonly repartitions;
    constructor(repartitions: RepartitionsAnalytiquesPaieService);
    lire(user: AuthenticatedUser, salarieId: string): Promise<{
        plans: {
            id: string;
            code: string;
            intitule: string;
            ventileLaPaie: boolean;
            sections: {
                id: string;
                intitule: string;
                code: string;
            }[];
            sectionsTronquees: boolean;
        }[];
        plansTronques: boolean;
        versions: {
            id: string;
            planId: string;
            planCode: string;
            planIntitule: string;
            moisEffet: string;
            createdAt: Date;
            retireLe: Date | null;
            motifRetrait: string | null;
            lignes: {
                sectionId: string;
                sectionCode: string;
                sectionIntitule: string;
                pourcentage: number;
            }[];
        }[];
        total: number;
        tronque: boolean;
    }>;
    declarer(user: AuthenticatedUser, salarieId: string, dto: RepartitionAnalytiquePaieDto): Promise<{
        id: string;
        moisEffet: string;
    }>;
    retirer(user: AuthenticatedUser, id: string, dto: RetraitRepartitionAnalytiqueDto): Promise<{
        id: string;
        retireLe: Date | null;
    }>;
}
