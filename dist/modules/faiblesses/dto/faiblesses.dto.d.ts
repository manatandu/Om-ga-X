import { OrigineFaiblesse, QualificationFaiblesse, StatutFaiblesse } from '@prisma/client';
export declare class CreerRegistreFaiblessesDto {
    exerciceId: string;
    origine: OrigineFaiblesse;
    libelle: string;
    emetteur?: string;
    dateLettre?: string;
    referenceLettre?: string;
}
export declare class AjouterFaiblesseDto {
    reference: string;
    intitule: string;
    description: string;
    effetPotentiel: string;
    recommandation?: string;
    indicateursA7?: string[];
    qualification?: QualificationFaiblesse;
    constatePar?: string;
    echeanceRemediation?: string;
}
export declare class QualifierDto {
    qualification: QualificationFaiblesse;
    justification: string;
}
export declare class CommuniquerDto {
    communiqueeLe: string;
    communiqueeA: string;
}
export declare class ReponseDirectionDto {
    reponseDirection: string;
    reponseDirectionPar?: string;
}
export declare class SuivreDto {
    statut: StatutFaiblesse;
    verificationCabinet?: string;
    motifNonRemediation?: string;
}
export declare class ReporterDto {
    registreCibleId: string;
    reference?: string;
    communicationReconduite?: string;
    motifNonRemediation?: string;
    echeanceRemediation?: string;
}
export declare class EscaladerDto {
    motif: string;
}
export declare class ClorerRegistreDto {
    motifCloture?: string;
}
