import { PrismaService } from '../../common/prisma.service';
import { EtatsFinanciersSyscohadaService } from '../etats-financiers-syscohada/etats-financiers-syscohada.service';
import { CumulService } from './cumul.service';
import { TableauFluxConsolide, VariationCapitauxPropres } from './flux-capitaux-consolides';
import { PerimetreService } from './perimetre.service';
export declare const NOTES_D4C_NON_PRODUITES: string;
export declare class EtatsConsolidesService {
    private readonly prisma;
    private readonly cumuls;
    private readonly perimetre;
    private readonly etatsIndividuels;
    constructor(prisma: PrismaService, cumuls: CumulService, perimetre: PerimetreService, etatsIndividuels: EtatsFinanciersSyscohadaService);
    private resolveurs;
    etats(tenantId: string, exerciceId: string): Promise<{
        bilan: {
            actif: import("./etats-consolides").LigneEtatConsolide[];
            passif: import("./etats-consolides").LigneEtatConsolide[];
        };
        compteDeResultat: import("./etats-consolides").LigneEtatConsolide[];
        controles: import("./etats-consolides").ControleEtatConsolide[];
        publiable: boolean;
        bilanEtResultatPubliables: boolean;
        motifsNonPubliable: string[];
        comparatif: {
            disponible: boolean;
            motif: string | null;
        };
        tableauDesFlux: TableauFluxConsolide;
        variationCapitauxPropres: VariationCapitauxPropres | null;
        notePerimetre: import("./note-perimetre").NotePerimetre;
        avertissements: string[];
        reserves: string[];
    }>;
}
