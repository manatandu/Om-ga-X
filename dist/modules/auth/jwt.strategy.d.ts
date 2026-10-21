import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../common/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ChargeJeton } from './session-longue';
type JwtPayload = ChargeJeton;
export declare function sessionRevoquee(iat: number | undefined, sessionsInvalidesAvant: Date | null): boolean;
export declare function extraireJetonDuCookie(req: Request): string | null;
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly prisma;
    private readonly jwt?;
    constructor(config: ConfigService, prisma: PrismaService, jwt?: JwtService | undefined);
    validate(req: Request, payload: JwtPayload): Promise<AuthenticatedUser>;
}
export {};
