import { Referentiel, TypeTiers } from '@prisma/client';
export type RolePanoplie = 'PRINCIPAL' | 'FACTURES_NON_PARVENUES' | 'AVANCES_VERSEES' | 'A_ETABLIR' | 'AVANCES_RECUES' | 'LITIGIEUSES' | 'DOUTEUSES' | 'LITIGIEUSES_OU_DOUTEUSES';
export interface ComptePanoplie {
    role: RolePanoplie;
    collectif: string;
    libelle: string | null;
}
export declare const PANOPLIES_TIERS: Record<Referentiel, Partial<Record<TypeTiers, readonly ComptePanoplie[]>>>;
export declare function panoplieDuTiers(referentiel: Referentiel, type: TypeTiers): readonly ComptePanoplie[];
export declare const COLLECTIFS_TIERS: Record<Referentiel, Partial<Record<TypeTiers, string>>>;
export declare function numeroCollectif(referentiel: Referentiel, type: TypeTiers): string | null;
export declare function racineCollectif(numero: string): string;
export declare function prochainNumeroIndividuel(racine: string, longueur: number, existants: string[]): string | null;
export declare function numeroIndividuelAligne(racine: string, longueur: number, rang: number | null, existants: string[]): string | null;
export declare function rangSousRacine(numero: string, racine: string): number | null;
export declare function motifRefusNumeroChoisi(numero: string, collectif: string, longueur: number, referentiel: Referentiel): string | null;
export interface LigneBalanceRegroupable {
    compteId: string;
    numero: string;
    intitule: string;
    totalDebit: number;
    totalCredit: number;
    reportDebit: number;
    reportCredit: number;
    mouvementDebit: number;
    mouvementCredit: number;
    solde: number;
}
export declare function regrouperSurCollectifs<L extends LigneBalanceRegroupable>(lignes: L[], collectifDe: Map<string, {
    id: string;
    numero: string;
    intitule: string;
}>): Array<L & {
    regroupe: number;
}>;
