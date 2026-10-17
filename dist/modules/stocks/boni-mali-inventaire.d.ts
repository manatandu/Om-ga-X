import { Referentiel } from '@prisma/client';
import { type MethodeValorisation, type MouvementAValoriser } from './valorisation-stocks';
export type SensDifferenceInventaire = 'BONI' | 'MALI';
export type MotifRefusBoniMali = 'INVENTAIRE_INTERMITTENT' | 'QUANTITE_PHYSIQUE_ABSENTE' | 'MAGASIN_NON_VALORISABLE' | 'HORS_VARIATION_AUTOMATIQUE' | 'PAS_UN_COMPTE_DE_STOCK' | 'COUT_DU_BONI_NON_FOURNI';
export interface ArticleAConfronter {
    articleId: string;
    code: string;
    designation: string;
    uniteMesure: string;
    compteNumero: string;
    compteIntitule: string;
    methode: MethodeValorisation;
    mouvements: MouvementAValoriser[];
    quantitePhysique: number | null;
    coutUnitaireBoni?: number | null;
    sourceCoutBoni?: string | null;
}
export interface DifferenceInventaire {
    articleId: string;
    code: string;
    designation: string;
    uniteMesure: string;
    compteNumero: string;
    compteIntitule: string;
    methode: MethodeValorisation;
    sens: SensDifferenceInventaire;
    quantiteComptable: number;
    quantitePhysique: number;
    ecartQuantite: number;
    coutUnitaireRetenu: number;
    montant: number;
    fondementDuCout: string;
    compteVariation: string;
    intituleVariation: string;
}
export interface ArticleSansDifference {
    articleId: string;
    code: string;
    quantite: number;
}
export interface RefusBoniMali {
    articleId: string | null;
    code: string | null;
    motif: MotifRefusBoniMali;
    explication: string;
}
export interface ConfrontationInventaire {
    differences: DifferenceInventaire[];
    sansDifference: ArticleSansDifference[];
    refus: RefusBoniMali[];
    totalBoni: number;
    totalMali: number;
}
export declare function confronterInventaire(articles: ArticleAConfronter[], referentiel: Referentiel, modeInventaire: 'PERMANENT' | 'INTERMITTENT'): ConfrontationInventaire;
export interface LigneRegularisation {
    compte: string;
    intitule: string;
    libelle: string;
    sens: 'DEBIT' | 'CREDIT';
    montant: number;
}
export declare function lignesDeLaRegularisation(differences: DifferenceInventaire[]): LigneRegularisation[];
