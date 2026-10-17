import { Referentiel } from '@prisma/client';
export declare const MOTIF_CODE_ACTIVITE_SYCEBNL = "Le code activit\u00E9 principale est celui de la NOTE 36 du SYSCOHADA (AUDCIF Titre IX ch. 6) \u00B7 un dossier SYCEBNL n'en porte pas.";
export declare const MOTIF_CODE_ACTIVITE_FORMAT = "Le code activit\u00E9 principale s'\u00E9crit sur six chiffres, groupe puis poste (AUDCIF Titre IX ch. 6, NOTE 36) \u00B7 par exemple 031003.";
export declare function normaliserCodeActivite(valeur: string | null | undefined): string | null | undefined;
export declare function motifRefusCodeActivite(referentiel: Referentiel, code: string | null | undefined): string | null;
export declare function avertissementCodeActivite(code: string | null | undefined): string | null;
