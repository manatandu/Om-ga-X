import { Request, Response } from 'express';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { RestitutionService } from './restitution.service';
export declare class RestitutionController {
    private readonly restitution;
    constructor(restitution: RestitutionService);
    archive(user: AuthenticatedUser, req: Request, res: Response): Promise<void>;
}
