import { Writable } from 'node:stream';
import { PrismaService } from '../../../common/prisma.service';
export declare const LOT_PIECES = 500;
export declare function nomDeLArchive(dossier: {
    id: string;
    nom: string;
}, jour: Date): string;
export declare class RestitutionService {
    private readonly prisma;
    private readonly journal;
    constructor(prisma: PrismaService);
    nomDeLArchive(tenantId: string, maintenant?: Date): Promise<string>;
    private enTexte;
    private lignesCsv;
    private lignesCsvBrutes;
    private ligneCsv;
    private ligneDuDossierCsv;
    private inventaire;
    produire(tenantId: string, acteur: {
        id: string | null;
        email: string;
        adresseIp: string | null;
    }, sortie: Writable): Promise<void>;
    private contenuDocument;
    private delegueDesPieces;
    private controlesApres;
    private controles;
}
