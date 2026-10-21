import { SensFacture } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EmettreNoteDeCreditDto, EnregistrerFactureDto } from './dto/facture.dto';
import { type MentionsRecopiees } from '../tenant/mentions-societe';
export declare class FacturationService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private dossier;
    private estPersonneMorale;
    private verifiable;
    lister(tenantId: string, params?: {
        sens?: SensFacture;
        du?: string;
        au?: string;
    }): Promise<{
        homologation: {
            readonly omegaxHomologue: false;
            readonly source: "Décret n° 23/10 du 3 mars 2023, art. 3 (7°), 20, 21, 22 et 23";
            readonly qualification: string;
            readonly procedure: string;
            readonly consequence: string;
            readonly qualificationHypothetique: string;
        };
        obligationDAcceptation: {
            readonly source: "Décret n° 23/10 du 3 mars 2023, art. 25 et 27";
            readonly mention: string;
            readonly supportsDeDeduction: readonly [{
                readonly cas: "de façon générale";
                readonly support: "une facture normalisée ou tout autre document en tenant lieu dûment délivré par un assujetti";
                readonly tenuParOmegaX: true;
            }, {
                readonly cas: "en cas d’importation";
                readonly support: "la déclaration de mise à la consommation délivrée par la douane";
                readonly tenuParOmegaX: false;
            }, {
                readonly cas: "en cas de livraison de biens ou de prestation de services à soi-même";
                readonly support: "une facture normalisée à soi-même";
                readonly tenuParOmegaX: false;
            }];
            readonly reserveSupports: string;
        };
        regimeExigibiliteTva: import(".prisma/client").$Enums.RegimeExigibiliteTva;
        periode: {
            du: string | null;
            au: string | null;
        };
        total: number;
        plafond: number;
        tronque: boolean;
        factures: {
            id: string;
            sens: import(".prisma/client").$Enums.SensFacture;
            nature: import(".prisma/client").$Enums.NatureFacture;
            factureAnnulee: {
                id: string;
                numeroSerie: string;
                dateFacture: Date;
            } | null;
            noteDeCredit: {
                id: string;
                numeroSerie: string;
                dateFacture: Date;
            } | null;
            barree: boolean;
            numeroSerie: string;
            dateFacture: Date;
            dateReception: Date | null;
            tiers: {
                id: string;
                nom: string;
                code: string;
            } | null;
            emetteurNom: string;
            emetteurAdresse: string | null;
            emetteurNumeroImpot: string | null;
            contrepartieNom: string;
            contrepartieAdresse: string | null;
            contrepartieNumeroImpot: string | null;
            mentionTvaDebits: boolean;
            mentionsSocieteEmetteur: MentionsRecopiees | null;
            autresImpotsEtTaxes: number | null;
            ecritureId: string | null;
            lignes: {
                id: string;
                ordre: number;
                designation: string;
                quantite: number | null;
                prixUnitaire: number | null;
                montantHT: number | null;
                imposable: boolean;
                tauxApplique: number | null;
                montantTva: number | null;
            }[];
            totaux: import("./mentions-facture").Totaux;
            mentions: import("./mentions-facture").VerificationMentions;
        }[];
    }>;
    enregistrer(tenantId: string, dto: EnregistrerFactureDto): Promise<{
        id: string;
        totaux: import("./mentions-facture").Totaux;
        mentions: import("./mentions-facture").VerificationMentions;
        homologation: {
            readonly omegaxHomologue: false;
            readonly source: "Décret n° 23/10 du 3 mars 2023, art. 3 (7°), 20, 21, 22 et 23";
            readonly qualification: string;
            readonly procedure: string;
            readonly consequence: string;
            readonly qualificationHypothetique: string;
        };
    }>;
    emettreNoteDeCredit(tenantId: string, factureId: string, dto: EmettreNoteDeCreditDto): Promise<{
        id: string;
        nature: import(".prisma/client").$Enums.NatureFacture;
        factureAnnulee: {
            id: string;
            numeroSerie: string;
        };
        totaux: import("./mentions-facture").Totaux;
    }>;
    supprimer(tenantId: string, id: string): Promise<{
        supprimee: boolean;
    }>;
    etatDetaille(tenantId: string, periode: string): Promise<import("./etat-detaille-tva").EtatDetailleTva>;
}
export declare const PLAFOND_LISTE_FACTURES = 500;
