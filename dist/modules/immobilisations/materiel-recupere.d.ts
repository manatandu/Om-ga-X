import { Referentiel } from '@prisma/client';
export declare function compteStockRecupere(referentiel: Referentiel): {
    racine: string;
    intitule: string;
    source: string;
};
export declare function motifRefusMaterielRecupere(e: {
    referentiel: Referentiel;
    cession: boolean;
    projetDeveloppement: boolean;
    numeroCompteBien: string;
    numeroCompteStock: string | null;
    valeur: number;
    valeurNetteComptable: number;
    source: string | null | undefined;
}): string | null;
