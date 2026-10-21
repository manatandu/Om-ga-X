import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AccordCadreService } from './accord-cadre.service';
import { DeclarerMainOeuvreDto, DenoncerAccordCadreDto, EnregistrerAccordCadreDto } from './dto/accord-cadre.dto';
export declare class AccordCadreController {
    private readonly accords;
    constructor(accords: AccordCadreService);
    etat(user: AuthenticatedUser, dateReference?: string): Promise<{
        applicable: boolean;
        modele: {
            readonly dureeAnnees: 10;
            readonly preavisMois: 6;
            readonly source: string;
        };
        partMinimaleMainOeuvreLocale: number;
        accords: {
            etat: import("./conditions-ong-etrangere").EtatAccordCadre;
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            reference: string;
            dateSignature: Date;
            dureeAnnees: number;
            taciteReconduction: boolean;
            preavisMois: number | null;
            denonceLe: Date | null;
            motifDenonciation: string | null;
            representationRdc: string | null;
            attestationsBonneConduiteLe: Date | null;
            partMainOeuvreLocale: number | null;
            sourceMainOeuvre: string | null;
            dateMainOeuvre: Date | null;
        }[];
        propositionMainOeuvre: {
            part: number | null;
            effectif: number;
            nationaux: number;
            source: string;
            reserve: string | null;
        } | null;
        dateReference: string;
    }>;
    enregistrer(user: AuthenticatedUser, dto: EnregistrerAccordCadreDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        reference: string;
        dateSignature: Date;
        dureeAnnees: number;
        taciteReconduction: boolean;
        preavisMois: number | null;
        denonceLe: Date | null;
        motifDenonciation: string | null;
        representationRdc: string | null;
        attestationsBonneConduiteLe: Date | null;
        partMainOeuvreLocale: number | null;
        sourceMainOeuvre: string | null;
        dateMainOeuvre: Date | null;
    }>;
    declarerMainOeuvre(user: AuthenticatedUser, id: string, dto: DeclarerMainOeuvreDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        reference: string;
        dateSignature: Date;
        dureeAnnees: number;
        taciteReconduction: boolean;
        preavisMois: number | null;
        denonceLe: Date | null;
        motifDenonciation: string | null;
        representationRdc: string | null;
        attestationsBonneConduiteLe: Date | null;
        partMainOeuvreLocale: number | null;
        sourceMainOeuvre: string | null;
        dateMainOeuvre: Date | null;
    }>;
    denoncer(user: AuthenticatedUser, id: string, dto: DenoncerAccordCadreDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        reference: string;
        dateSignature: Date;
        dureeAnnees: number;
        taciteReconduction: boolean;
        preavisMois: number | null;
        denonceLe: Date | null;
        motifDenonciation: string | null;
        representationRdc: string | null;
        attestationsBonneConduiteLe: Date | null;
        partMainOeuvreLocale: number | null;
        sourceMainOeuvre: string | null;
        dateMainOeuvre: Date | null;
    }>;
}
