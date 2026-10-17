import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ImportService } from './import.service';
import { AnalyserImportDto, ExecuterImportDto } from './dto/import.dto';
export declare class ImportController {
    private readonly importService;
    constructor(importService: ImportService);
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
    executer(user: AuthenticatedUser, dto: ExecuterImportDto): Promise<import("./import.service").RapportImport>;
}
