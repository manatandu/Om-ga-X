import { LigneEcritureDto } from './creer-ecriture.dto';
export declare class ModifierEcritureDto {
    date?: string;
    libelle?: string;
    reference?: string;
    lignes?: LigneEcritureDto[];
    confirmerComptesEnSommeil?: boolean;
}
export declare class ValiderEcrituresDto {
    ecritureIds: string[];
    secondRegardNom?: string;
    secondRegardMotif?: string;
}
export declare class ValiderJusquaDto {
    exerciceId: string;
    dateLimite: string;
    journalId?: string;
    secondRegardNom?: string;
    secondRegardMotif?: string;
}
export declare class TransfererEcritureDto {
    journalId: string;
    reporterAuPremierJourOuvert?: boolean;
}
