import { ArgumentMetadata, ParseUUIDPipe, PipeTransform } from '@nestjs/common';
import { PrismaService } from './prisma.service';
export declare const MESSAGE_EXERCICE_REQUIS = "Le param\u00E8tre exerciceId est requis et doit \u00EAtre un identifiant d'exercice valide \u00B7 chaque \u00E9tat et chaque lecture portent sur un seul exercice.";
export declare const MESSAGE_EXERCICE_ILLISIBLE = "Le param\u00E8tre exerciceId, quand il est donn\u00E9, doit \u00EAtre un identifiant d'exercice valide \u00B7 un identifiant illisible n'est jamais lu comme \u00AB tous les exercices \u00BB ni comme un exercice vide.";
export declare const MESSAGE_EXERCICE_HORS_DOSSIER = "Exercice introuvable dans ce dossier.";
export declare function dossierDeLaSession(): string;
export declare function exigerExerciceDuDossier(prisma: PrismaService, exerciceId: string): Promise<void>;
export declare class ExerciceRequisDuDossier implements PipeTransform<unknown, Promise<string>> {
    private readonly prisma;
    static readonly format: ParseUUIDPipe;
    constructor(prisma: PrismaService);
    transform(valeur: unknown, metadata: ArgumentMetadata): Promise<string>;
}
export declare class ExerciceFacultatifDuDossier implements PipeTransform<unknown, Promise<string | undefined>> {
    private readonly prisma;
    static readonly format: ParseUUIDPipe;
    constructor(prisma: PrismaService);
    transform(valeur: unknown, metadata: ArgumentMetadata): Promise<string | undefined>;
}
export declare const EXERCICE_REQUIS: typeof ExerciceRequisDuDossier;
export declare const EXERCICE_FACULTATIF: typeof ExerciceFacultatifDuDossier;
export declare const EXERCICE_D_UNE_CELLULE: ParseUUIDPipe;
export declare function exigerExercice(exerciceId: unknown): asserts exerciceId is string;
