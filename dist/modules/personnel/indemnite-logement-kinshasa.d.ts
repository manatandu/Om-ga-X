import type { NatureElementPaie } from './assiettes-paie';
export declare const RESERVE_INDEMNITE_LOGEMENT_KINSHASA: string;
export declare function reserveIndemniteLogementKinshasa(elements: readonly {
    nature: NatureElementPaie | string;
    montantFc: number;
    enNature?: boolean;
}[], ville: string | null | undefined, moisDePaie: string): string | null;
