import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsHexadecimal, IsUUID, Length, ValidateNested } from 'class-validator';
import { PLAFOND_VISAS_PAR_GESTE } from '../circuit-visa.service';

/** Une pièce à viser et l'empreinte du contenu que l'écran a montré (`circuit-visa.ts`, règle 5). */
export class PieceAViserDto {
  @IsUUID()
  id!: string;

  /** SHA-256 en hexadécimal · celle que le brouillard a servie. */
  @IsHexadecimal()
  @Length(64, 64)
  empreinte!: string;
}

export class ViserEcrituresDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PLAFOND_VISAS_PAR_GESTE)
  @ValidateNested({ each: true })
  @Type(() => PieceAViserDto)
  pieces!: PieceAViserDto[];
}

export class RetirerVisasDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PLAFOND_VISAS_PAR_GESTE)
  @IsUUID(undefined, { each: true })
  ecritureIds!: string[];
}
