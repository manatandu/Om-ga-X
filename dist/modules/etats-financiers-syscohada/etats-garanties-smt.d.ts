import { FormeJuridiqueSyscohada } from '@prisma/client';
export interface EtatsDesGarantiesDus {
    article: string;
    etats: [string, string];
}
export declare function etatsDesGarantiesDus(forme: FormeJuridiqueSyscohada | null | undefined): EtatsDesGarantiesDus | null;
