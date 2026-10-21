import { ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
export declare class FiltrePannes extends BaseExceptionFilter {
    catch(exception: unknown, hote: ArgumentsHost): void;
}
export declare function statutDe(exception: unknown): number;
