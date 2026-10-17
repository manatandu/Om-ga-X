import { JOURS_ESSAI } from '../plateforme/abonnements/facturation-abonnements';
import { motDePasseTireAuSort } from '../plateforme/reinitialisation-admin';
export declare const ORIGINE_INSCRIPTION_ESSAI = "INSCRIPTION_ESSAI";
export declare function finDeLEssai(debut: Date): Date;
export { JOURS_ESSAI, motDePasseTireAuSort };
export declare const FENETRE_RENVOI_HEURES = 72;
export declare const ATTENTE_ENTRE_DEUX_ENVOIS_MINUTES = 10;
export declare function renvoiPossible(compte: {
    doitChangerMotDePasse: boolean;
    createdAt: Date;
    sessionsInvalidesAvant: Date | null;
}, maintenant: Date): boolean;
export declare function estUnDossierDEssai(licence: {
    type: string;
    dateDebut: Date;
    dateExpiration: Date | null;
} | null | undefined): boolean;
export declare function avisInscriptionEssai(motDePasseProvisoire: string, finEssai: Date, nouveau: boolean): {
    sujet: string;
    corps: string;
    corpsGarde: string;
};
