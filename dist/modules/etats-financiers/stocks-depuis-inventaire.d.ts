import { PrismaService } from '../../common/prisma.service';
export interface CompteStockNote {
    numero: string;
    intitule: string;
    montant: number;
}
export interface FicheStockNote {
    compteNumero: string;
    designation: string;
    uniteMesure: string | null;
    quantiteComptee: number | null;
    valeurInventaire: number | null;
}
export interface CampagneStockNote {
    libelle: string;
    dateInventaire: Date;
    fiches: FicheStockNote[];
}
export interface LigneNoteStock {
    reference: string;
    designation: string;
    quantite: number | null;
    prixUnitaire: number | null;
    montant: number;
}
export interface NoteStocksDepuisInventaire {
    lignes: LigneNoteStock[];
    quantitesTenues: boolean;
    manques: string[];
    source: string | null;
}
export declare function lignesNoteStocks(comptes: CompteStockNote[], campagne: CampagneStockNote | null): NoteStocksDepuisInventaire;
export declare function motifQuantitesNote2(note: NoteStocksDepuisInventaire, suffixeSansCampagne: string): string;
export declare function chargerCampagneStocks(prisma: PrismaService, tenantId: string, exerciceId: string): Promise<CampagneStockNote | null>;
