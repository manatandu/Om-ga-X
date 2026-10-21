import { type ComptesDeLaNature } from './bareme-comptes-013-2025';
type Ref = 'SYSCOHADA' | 'SYCEBNL';
export declare function comptesDeLaNature(referentiel: Ref, cle: string): ComptesDeLaNature;
export declare function naturesDuCompte(referentiel: Ref, numero: string): string[];
export {};
