import { INestApplication } from '@nestjs/common';
export declare function retirerPrefixeApi(url: string): string;
export declare function configurerApplication(app: INestApplication): INestApplication<any>;
export declare const DUREE_CACHE_CONTROLE_CORS = 7200;
export declare function optionsCors(origines: string[] | undefined): {
    origin: boolean | string[];
    credentials: boolean;
    maxAge: number;
};
