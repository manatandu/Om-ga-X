import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
export declare class AuditContexteInterceptor implements NestInterceptor {
    intercept(contexte: ExecutionContext, suite: CallHandler): Observable<unknown>;
}
