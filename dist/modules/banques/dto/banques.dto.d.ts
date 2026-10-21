export declare class BanqueDto {
    intitule: string;
    adresse?: string;
    codePostal?: string;
    ville?: string;
    pays?: string;
    telephone?: string;
    email?: string;
    contact?: string;
}
export declare class ModifierBanqueDto {
    intitule?: string;
    adresse?: string;
    codePostal?: string;
    ville?: string;
    pays?: string;
    telephone?: string;
    email?: string;
    contact?: string;
}
export declare class RibDto {
    abrege?: string;
    devise?: string;
    codeBic?: string;
    codeBanque?: string;
    codeGuichet?: string;
    numeroCompte?: string;
    cle?: string;
    iban?: string;
    commentaire?: string;
    journalId?: string;
}
export declare class LibelleDto {
    code: string;
    intitule: string;
}
export declare class ModifierLibelleDto {
    code?: string;
    intitule?: string;
}
