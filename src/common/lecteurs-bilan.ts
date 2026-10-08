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

/**
 * LE 585 DU GROUPE LU PAR LA CLÔTURE (G1, relecture du 2026-10-08) · même
 * jeton, même raison · le module du groupe importe déjà ce que la clôture
 * importe. Fiche SYCEBNL du compte 58 · des comptes de passage « internes à
 * l'entité », « soldés à la fin de l'exercice » · l'entité est le GROUPE, et
 * son 585 se lit sur tous ses dossiers. Seul `GroupeService` ouvre le
 * périmètre d'un groupe (`perimetreDeGroupe`, liste fermée par
 * `cloisonnement.spec.ts`) · la clôture passe par lui.
 */
export const LECTEUR_VIREMENTS_GROUPE = 'LECTEUR_VIREMENTS_GROUPE';

export interface VirementsDuGroupe {
  /** Solde net du 585 (débit moins crédit) de tous les dossiers du groupe sur la période, livre-journal seul. */
  solde: number;
  /** Dossiers du groupe sans exercice sur la même période · leur 585 n'est pas lu. */
  dossiersSansExercice: number;
}

export interface LecteurVirementsGroupe {
  virements585DuGroupe(tenantId: string, periode: { dateDebut: Date; dateFin: Date }): Promise<VirementsDuGroupe>;
}
