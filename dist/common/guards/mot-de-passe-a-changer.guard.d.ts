import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
export declare class MotDePasseAChangerGuard implements CanActivate {
    private readonly reflector;
    constructor(reflector: Reflector);
    canActivate(contexte: ExecutionContext): boolean;
}
