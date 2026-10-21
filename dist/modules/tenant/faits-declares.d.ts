import type { ReponseFait } from './dto/parametres-dossier.dto';
export declare function donneesAssujettissementTva(reponse: ReponseFait | undefined, assujettiTva: boolean | undefined): {
    assujettiTva?: boolean;
    assujettissementTvaRepondu?: boolean;
};
export declare function donneesVenteBiensServices(reponse: ReponseFait | undefined): {
    venteBiensServices?: boolean | null;
};
export declare function faitAssujettissementTva(t: {
    assujettiTva: boolean;
    assujettissementTvaRepondu: boolean;
}): boolean | null;
