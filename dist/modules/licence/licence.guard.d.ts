import { CanActivate, ExecutionContext } from '@nestjs/common';
import { LicenceService } from './licence.service';
export declare class LicenceGuard implements CanActivate {
    private readonly licenceService;
    constructor(licenceService: LicenceService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
