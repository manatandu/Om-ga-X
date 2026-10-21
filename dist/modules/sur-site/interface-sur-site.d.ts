import { INestApplication } from '@nestjs/common';
import { Response } from 'express';
export declare const POLITIQUE_INTERFACE: string;
export declare function entetesInterface(res: Response, chemin: string): void;
export declare function servirInterfaceSurSite(app: INestApplication, dossier: string | undefined): boolean;
