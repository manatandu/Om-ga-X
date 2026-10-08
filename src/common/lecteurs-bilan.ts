/**
 * LES BILANS LUS PAR LA CLÔTURE · jetons d'injection, sans import des
 * services d'états. Les modules des états importent `ExerciceModule` · la
 * clôture ne peut donc pas importer leurs services sans cycle. Chaque module
 * d'états enregistre son service sous l'un de ces jetons (`useExisting`), et
 * la clôture le résout à l'appel (`ModuleRef.get`, `strict: false`) pour
 * refuser un bilan qui ne s'équilibre pas (simulation du 2026-10-08).
 */
export const LECTEUR_BILAN_SYSCOHADA_NORMAL = 'LECTEUR_BILAN_SYSCOHADA_NORMAL';
export const LECTEUR_BILAN_SYSCOHADA_SMT = 'LECTEUR_BILAN_SYSCOHADA_SMT';
export const LECTEUR_BILAN_SYCEBNL_ASSOCIATIONS = 'LECTEUR_BILAN_SYCEBNL_ASSOCIATIONS';
export const LECTEUR_BILAN_SYCEBNL_PROJETS = 'LECTEUR_BILAN_SYCEBNL_PROJETS';
export const LECTEUR_BILAN_SYCEBNL_SMT = 'LECTEUR_BILAN_SYCEBNL_SMT';

export interface BilanLuParLaCloture {
  totalActif: number;
  totalPassif: number;
  controle?: { resultatClasses678: number; resultatCompte13: number } | null;
}

export interface LecteurBilan {
  bilan(tenantId: string, exerciceId: string): Promise<BilanLuParLaCloture>;
}
