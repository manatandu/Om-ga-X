import { Writable } from 'stream';
import type { Response } from 'express';
export declare const TYPE_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export declare const RETENUE_AVANT_ENVOI: number;
export declare function envoyerXlsxEnFlux(res: Response, ecrire: (ouvrir: (nomFichier: string) => Writable) => Promise<unknown>, seuil?: number): Promise<void>;
