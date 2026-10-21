export declare class CodeDoubleAuthDto {
    code: string;
}
export declare class DesactiverDoubleAuthDto extends CodeDoubleAuthDto {
    motDePasseActuel: string;
}
export declare class ActiverDoubleAuthDto extends CodeDoubleAuthDto {
    motDePasseActuel: string;
}
export declare class RegenererCodesSecoursDto extends CodeDoubleAuthDto {
    motDePasseActuel: string;
}
