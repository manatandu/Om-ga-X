import { Prisma } from '@prisma/client';
import { Lecteur } from './reglements-de-tresorerie';
export interface ComptesDeDette {
    comptes: string[];
    exclusions?: string[];
}
export interface PosteDeRattachement {
    ref: string;
    comptes: string[];
    exclusions?: string[];
}
export interface DetteLue {
    ligneId: string;
    compteId: string;
    montant: number;
    ecritureOrigineId: string | null;
}
export interface DettesParPoste {
    parRef: Map<string, number>;
    nonRattache: number;
}
export declare function filtreComptes(c: ComptesDeDette): Prisma.CompteWhereInput;
export declare function dettesALOuverture(db: Lecteur, tenantId: string, exerciceId: string, comptes: ComptesDeDette): Promise<DetteLue[]>;
export declare function dettesALaCloture(db: Lecteur, tenantId: string, exercice: {
    id: string;
    dateDebut: Date;
    dateFin: Date;
}, comptes: ComptesDeDette): Promise<DetteLue[]>;
export declare function dettesParPoste(db: Lecteur, tenantId: string, dettes: DetteLue[], postes: PosteDeRattachement[]): Promise<DettesParPoste>;
export declare const POSTES_NATURE_DETTE_FOURNISSEUR: PosteDeRattachement[];
export declare function dettesFournisseursNeesDImmobilisations(db: Lecteur, tenantId: string, exercice: {
    id: string;
    dateDebut: Date;
    dateFin: Date;
}, comptes: ComptesDeDette): Promise<{
    ouverture: number;
    cloture: number;
}>;
