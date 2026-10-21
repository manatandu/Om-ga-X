import { JeuEtatsFinanciersSycebnl, Referentiel, TypeCompteDetailTotal } from '@prisma/client';
export declare const COMPTES_DE_FONDS_PROJET: string[];
export declare function motifRefusFondsContrepartieEtat(c: {
    referentiel: Referentiel;
    jeu: JeuEtatsFinanciersSycebnl | null;
    numero: string;
    typeCompte: TypeCompteDetailTotal;
    bailleurId: string | null;
}): string | null;
