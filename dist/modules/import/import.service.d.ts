import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { ClasseCompte, ModeReportANouveau, Referentiel } from '@prisma/client';
import { AnalyserImportDto, ExecuterImportDto, TypeImport } from './dto/import.dto';
type LectureDevise = {
    enDevise: false;
} | {
    enDevise: true;
    refus: string;
} | {
    enDevise: true;
    refus: null;
    deviseId: string;
    montantDevise: number;
    coursApplique?: number;
};
export declare function lireDeviseDeLaLigne(codeDevise: string, texteMontantDevise: string, texteCours: string, numero: string, devisesParCode: Map<string, {
    id: string;
    code: string;
}>, montantFrancs: number): LectureDevise;
export interface EcartReferentiel {
    autre: Referentiel;
    intituleAutre: string;
    intituleDuDossier: string | null;
}
export declare function intituleDUnAutreReferentiel(numero: string, intitule: string, referentiel: Referentiel): EcartReferentiel | null;
export declare function messageEcartReferentiel(numero: string, referentiel: Referentiel, ecart: EcartReferentiel): string;
export interface AnomalieImport {
    ligne: number;
    message: string;
}
export interface RapportImport {
    type: TypeImport;
    simulation: boolean;
    lignesLues: number;
    comptesCrees: number;
    comptesReconnus: number;
    ecrituresCreees: number;
    lignesEcritureCreees: number;
    totalDebit: number;
    totalCredit: number;
    anomalies: AnomalieImport[];
}
export declare function modeReportPourClasse(classe: ClasseCompte, numero: string, referentiel: Referentiel): ModeReportANouveau;
export declare class ImportService {
    private readonly prisma;
    private readonly ecritureService;
    constructor(prisma: PrismaService, ecritureService: EcritureService);
    analyser(dto: AnalyserImportDto): Promise<{
        colonnes: string[];
        separateur: string | null;
        nombreLignes: number;
        apercu: string[][];
        champs: {
            cle: string;
            libelle: string;
            obligatoire: boolean;
        }[];
        mappingPropose: Record<string, string | null>;
        manquants: string[];
    }>;
    private indexDe;
    private valeur;
    private classeDe;
    executer(tenantId: string, createdBy: string, dto: ExecuterImportDto): Promise<RapportImport>;
    private importerPlanComptes;
    private importerBalance;
    private importerEcritures;
    private contexte;
}
export {};
