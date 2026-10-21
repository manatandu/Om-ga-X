import { MethodeValorisationStock, SensMouvementStock } from '@prisma/client';
export declare class CreerArticleStockDto {
    compteId: string;
    code: string;
    designation: string;
    uniteMesure: string;
    methodeValorisation: MethodeValorisationStock;
}
export declare class EnregistrerMouvementStockDto {
    date: string;
    sens: SensMouvementStock;
    quantite: number;
    cout?: number;
    piece: string;
    libelle?: string;
    ecritureId?: string;
}
export declare class AnnulerMouvementStockDto {
    motif: string;
}
export declare class ComptagePhysiqueDto {
    articleId: string;
    quantitePhysique: number;
    coutUnitaireBoni?: number;
    sourceCoutBoni?: string;
}
export declare class ConfronterInventaireDto {
    dateComptage: string;
    comptages: ComptagePhysiqueDto[];
}
export declare class EnregistrerRegularisationInventaireDto extends ConfronterInventaireDto {
    exerciceId: string;
    journalId: string;
    date: string;
    libelle?: string;
    reference?: string;
}
