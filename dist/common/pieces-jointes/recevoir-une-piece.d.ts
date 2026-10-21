import type { Response } from 'express';
export declare function RecevoirUnePiece(): <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;
export declare function servirLaPiece(res: Response, piece: {
    nomFichier: string;
    typeMime: string;
    contenu: Uint8Array;
}): void;
