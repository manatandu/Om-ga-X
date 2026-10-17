import { ArgumentsHost, BadRequestException, ExceptionFilter, PayloadTooLargeException } from '@nestjs/common';
export declare const REFUS_MULTER: Readonly<Record<string, string>>;
export declare class RefusEnvoi implements ExceptionFilter {
    catch(e: PayloadTooLargeException | BadRequestException, hote: ArgumentsHost): void;
}
