import { FonctionLigneModele, SensModeleSaisie, TypeJournal } from '@prisma/client';
export declare class LigneModeleSaisieDto {
    compteId: string;
    sens: SensModeleSaisie;
    libelle?: string;
    montant?: number;
    fonction?: FonctionLigneModele;
    tauxTvaId?: string;
}
export declare class CreerModeleSaisieDto {
    intitule: string;
    journalId?: string;
    typeJournal?: TypeJournal;
    sequenceSaisieId?: string;
    lignes: LigneModeleSaisieDto[];
}
export declare class ModifierModeleSaisieDto {
    intitule?: string;
    journalId?: string | null;
    typeJournal?: TypeJournal | null;
    sequenceSaisieId?: string | null;
    estActif?: boolean;
    lignes?: LigneModeleSaisieDto[];
}
