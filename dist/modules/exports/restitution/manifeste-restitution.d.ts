export interface EnTeteManifeste {
    dossier: {
        id: string;
        nom: string;
        referentiel: string;
    };
    demandeePar: string;
    horodatage: string;
    maillon: {
        rang: number;
        empreinte: string;
    };
    lignesParTable: Record<string, number>;
}
export declare function ecrireManifeste(e: EnTeteManifeste): string;
