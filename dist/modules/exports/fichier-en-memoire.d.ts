import { type Writable } from 'stream';
export declare function produireEnMemoire(ecrire: (ouvrir: (nomFichier: string) => Writable) => Promise<unknown>): Promise<{
    nomFichier: string;
    contenu: Buffer;
}>;
