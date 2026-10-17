import { JeuEtatsFinanciersSycebnl, Referentiel, SystemeComptableSyscohada } from '@prisma/client';
export declare class InscriptionEssaiDto {
    nomEntite: string;
    referentiel: Referentiel;
    email: string;
    jeuEtatsFinanciersSycebnl?: JeuEtatsFinanciersSycebnl;
    systemeComptableSyscohada?: SystemeComptableSyscohada;
}
