import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { JournalAuditService } from './journal-audit.service';
import { FiltreJournalAuditDto } from './filtre-journal-audit.dto';
export declare class JournalAuditController {
    private readonly service;
    constructor(service: JournalAuditService);
    lister(user: AuthenticatedUser, filtre: FiltreJournalAuditDto): Promise<{
        total: number;
        page: number;
        taille: number;
        evenements: {
            id: string;
            tenantId: string | null;
            rang: number;
            empreinte: string;
            entiteId: string | null;
            horodatage: Date;
            acteurId: string | null;
            acteurEmail: string;
            adresseIp: string | null;
            action: import(".prisma/client").$Enums.ActionAudit;
            entite: string;
            avant: import("@prisma/client/runtime/library").JsonValue | null;
            apres: import("@prisma/client/runtime/library").JsonValue | null;
            empreintePrecedente: string;
        }[];
    }>;
    objets(): import("./libelles-objets-audites").ObjetAudite[];
    verifier(user: AuthenticatedUser): Promise<import("./journal-audit.service").VerdictChaine>;
}
