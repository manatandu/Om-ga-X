import { ArgumentMetadata, ParseUUIDPipe, PipeTransform } from '@nestjs/common';
import { PrismaService } from './prisma.service';
export declare const MESSAGE_JOURNAL_ILLISIBLE = "Le param\u00E8tre journalId, quand il est donn\u00E9, doit \u00EAtre un identifiant de journal valide \u00B7 un identifiant illisible n'est jamais lu comme un journal vide.";
export declare const MESSAGE_JOURNAL_HORS_DOSSIER = "Journal introuvable dans ce dossier.";
export declare class JournalFacultatifDuDossier implements PipeTransform<unknown, Promise<string | undefined>> {
    private readonly prisma;
    static readonly format: ParseUUIDPipe;
    constructor(prisma: PrismaService);
    transform(valeur: unknown, metadata: ArgumentMetadata): Promise<string | undefined>;
}
export declare const JOURNAL_FACULTATIF: typeof JournalFacultatifDuDossier;
