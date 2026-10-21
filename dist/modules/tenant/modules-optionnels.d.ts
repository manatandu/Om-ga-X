import { ModuleOptionnel, TypeLicence } from '@prisma/client';
export declare const MODULES_OPTIONNELS: readonly ModuleOptionnel[];
export declare function normaliserModules(modules: readonly ModuleOptionnel[]): ModuleOptionnel[];
export declare function modulesServis(modulesActives: readonly ModuleOptionnel[] | null | undefined, typeLicence: TypeLicence | null | undefined): ModuleOptionnel[];
