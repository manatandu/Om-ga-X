import { ArgumentMetadata, ParseUUIDPipe, PipeTransform } from '@nestjs/common';
import { PrismaService } from './prisma.service';
export declare const MESSAGE_COMPTE_ILLISIBLE = "Le param\u00E8tre compteId, quand il est donn\u00E9, doit \u00EAtre un identifiant de compte valide \u00B7 un identifiant illisible n'est jamais lu comme un compte sans mouvement.";
export declare const MESSAGE_COMPTE_HORS_DOSSIER = "Compte introuvable dans ce dossier.";
export declare class CompteFacultatifDuDossier implements PipeTransform<unknown, Promise<string | undefined>> {
    private readonly prisma;
    static readonly format: ParseUUIDPipe;
    constructor(prisma: PrismaService);
    transform(valeur: unknown, metadata: ArgumentMetadata): Promise<string | undefined>;
}
export declare const COMPTE_FACULTATIF: typeof CompteFacultatifDuDossier;
