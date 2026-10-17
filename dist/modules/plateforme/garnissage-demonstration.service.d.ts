import { PrismaService } from '../../common/prisma.service';
import { TiersService } from '../tiers/tiers.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { ImmobilisationService } from '../immobilisations/immobilisation.service';
import { PersonnelService } from '../personnel/personnel.service';
import { RapprochementService } from '../rapprochement/rapprochement.service';
import { QuestionnaireService } from '../questionnaire/questionnaire.service';
export declare class GarnissageDemonstrationService {
    private readonly prisma;
    private readonly tiers;
    private readonly ecritures;
    private readonly immobilisations;
    private readonly personnel;
    private readonly rapprochements;
    private readonly questionnaires;
    constructor(prisma: PrismaService, tiers: TiersService, ecritures: EcritureService, immobilisations: ImmobilisationService, personnel: PersonnelService, rapprochements: RapprochementService, questionnaires: QuestionnaireService);
    garnir(tenantId: string, auteurId: string): Promise<{
        tiers: number;
        ecritures: number;
        immobilisations: number;
        bulletins: number;
        crees: number;
        ecartes: string[];
    }>;
    private garnirImmobilisations;
    private garnirPersonnel;
    private garnirRapprochement;
    private garnirQuestionnaire;
}
