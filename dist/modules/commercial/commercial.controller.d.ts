import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CommercialService } from './commercial.service';
import { EmettreDevisDto, EnregistrerReponseDto, ListerDevisDto, RevoquerDevisDto } from './dto/devis.dto';
export declare class CommercialController {
    private readonly commercial;
    constructor(commercial: CommercialService);
    lister(user: AuthenticatedUser, filtre: ListerDevisDto): Promise<{
        dateReference: string;
        aucuneConditionDeForme: {
            readonly article: "AUDCG art. 240";
            readonly mention: string;
        };
        delaisDeConformite: readonly [{
            readonly cle: "APPARENT";
            readonly libelle: "Défaut de conformité apparent le jour de la prise de livraison";
            readonly delai: "un mois à compter de la livraison, sous peine de déchéance";
            readonly article: "AUDCG art. 258";
        }, {
            readonly cle: "CACHE";
            readonly libelle: "Défaut de conformité caché le jour de la prise de livraison";
            readonly delai: "un an à compter du jour où le défaut a été constaté ou aurait dû l’être";
            readonly article: "AUDCG art. 259";
        }];
        periode: {
            du: string | null;
            au: string | null;
        };
        total: number;
        plafond: number;
        tronque: boolean;
        devis: {
            id: string;
            emetteur: import(".prisma/client").$Enums.EmetteurOffre;
            numero: string;
            dateEmission: Date;
            dateReception: Date | null;
            delaiJours: number | null;
            declareeIrrevocable: boolean;
            nature: import(".prisma/client").$Enums.NatureOperationVente;
            clientNom: string;
            objet: string | null;
            mentionsSocieteEmetteur: import("../tenant/mentions-societe").MentionsRecopiees | null;
            natureReponse: import(".prisma/client").$Enums.NatureReponseDevis | null;
            dateReponse: Date | null;
            detailReponse: string | null;
            revoqueLe: Date | null;
            motifRevocation: string | null;
            contrePropositionDeId: string | null;
            contrePropositionId: string | null;
            lignes: {
                id: string;
                ordre: number;
                designation: string;
                quantite: number;
                prixUnitaire: number;
                montantHT: number;
            }[];
            totalHT: number;
            prixPresume: {
                readonly article: "AUDCG art. 263";
                readonly mention: "Le prix exprimé dans le contrat est présumé convenu hors taxes.";
            };
            perimetre: import("./vente-commerciale").Perimetre;
            qualification: import("./vente-commerciale").QualificationOffre;
            etat: import("./vente-commerciale").EtatCalcule;
            revocabilite: import("./vente-commerciale").Revocabilite;
        }[];
    }>;
    emettre(user: AuthenticatedUser, dto: EmettreDevisDto): Promise<{
        id: string;
        emetteur: import(".prisma/client").$Enums.EmetteurOffre;
        numero: string;
        dateEmission: Date;
        dateReception: Date | null;
        delaiJours: number | null;
        declareeIrrevocable: boolean;
        nature: import(".prisma/client").$Enums.NatureOperationVente;
        clientNom: string;
        objet: string | null;
        mentionsSocieteEmetteur: import("../tenant/mentions-societe").MentionsRecopiees | null;
        natureReponse: import(".prisma/client").$Enums.NatureReponseDevis | null;
        dateReponse: Date | null;
        detailReponse: string | null;
        revoqueLe: Date | null;
        motifRevocation: string | null;
        contrePropositionDeId: string | null;
        contrePropositionId: string | null;
        lignes: {
            id: string;
            ordre: number;
            designation: string;
            quantite: number;
            prixUnitaire: number;
            montantHT: number;
        }[];
        totalHT: number;
        prixPresume: {
            readonly article: "AUDCG art. 263";
            readonly mention: "Le prix exprimé dans le contrat est présumé convenu hors taxes.";
        };
        perimetre: import("./vente-commerciale").Perimetre;
        qualification: import("./vente-commerciale").QualificationOffre;
        etat: import("./vente-commerciale").EtatCalcule;
        revocabilite: import("./vente-commerciale").Revocabilite;
    }>;
    enregistrerReponse(user: AuthenticatedUser, id: string, dto: EnregistrerReponseDto): Promise<{
        id: string;
        emetteur: import(".prisma/client").$Enums.EmetteurOffre;
        numero: string;
        dateEmission: Date;
        dateReception: Date | null;
        delaiJours: number | null;
        declareeIrrevocable: boolean;
        nature: import(".prisma/client").$Enums.NatureOperationVente;
        clientNom: string;
        objet: string | null;
        mentionsSocieteEmetteur: import("../tenant/mentions-societe").MentionsRecopiees | null;
        natureReponse: import(".prisma/client").$Enums.NatureReponseDevis | null;
        dateReponse: Date | null;
        detailReponse: string | null;
        revoqueLe: Date | null;
        motifRevocation: string | null;
        contrePropositionDeId: string | null;
        contrePropositionId: string | null;
        lignes: {
            id: string;
            ordre: number;
            designation: string;
            quantite: number;
            prixUnitaire: number;
            montantHT: number;
        }[];
        totalHT: number;
        prixPresume: {
            readonly article: "AUDCG art. 263";
            readonly mention: "Le prix exprimé dans le contrat est présumé convenu hors taxes.";
        };
        perimetre: import("./vente-commerciale").Perimetre;
        qualification: import("./vente-commerciale").QualificationOffre;
        etat: import("./vente-commerciale").EtatCalcule;
        revocabilite: import("./vente-commerciale").Revocabilite;
    }>;
    revoquer(user: AuthenticatedUser, id: string, dto: RevoquerDevisDto): Promise<{
        id: string;
        emetteur: import(".prisma/client").$Enums.EmetteurOffre;
        numero: string;
        dateEmission: Date;
        dateReception: Date | null;
        delaiJours: number | null;
        declareeIrrevocable: boolean;
        nature: import(".prisma/client").$Enums.NatureOperationVente;
        clientNom: string;
        objet: string | null;
        mentionsSocieteEmetteur: import("../tenant/mentions-societe").MentionsRecopiees | null;
        natureReponse: import(".prisma/client").$Enums.NatureReponseDevis | null;
        dateReponse: Date | null;
        detailReponse: string | null;
        revoqueLe: Date | null;
        motifRevocation: string | null;
        contrePropositionDeId: string | null;
        contrePropositionId: string | null;
        lignes: {
            id: string;
            ordre: number;
            designation: string;
            quantite: number;
            prixUnitaire: number;
            montantHT: number;
        }[];
        totalHT: number;
        prixPresume: {
            readonly article: "AUDCG art. 263";
            readonly mention: "Le prix exprimé dans le contrat est présumé convenu hors taxes.";
        };
        perimetre: import("./vente-commerciale").Perimetre;
        qualification: import("./vente-commerciale").QualificationOffre;
        etat: import("./vente-commerciale").EtatCalcule;
        revocabilite: import("./vente-commerciale").Revocabilite;
    }>;
}
