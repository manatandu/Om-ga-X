import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RapprochementController } from './rapprochement.controller';
import { PropositionsRapprochementDto } from './dto/rapprochement.dto';
import { FENETRE_JOURS_DEFAUT, FENETRE_JOURS_MAX } from './releve-bancaire';

/**
 * PAQUET 1, B9 · LA FENÊTRE DE DATES DES PROPOSITIONS EST FACULTATIVE.
 *
 * Relevé sur vraie base · `GET /rapprochements/:id/propositions` sans
 * `fenetreJours` rendait 400 « Validation failed (numeric string is
 * expected) ». Le ValidationPipe global (`transform: true`) convertissait le
 * paramètre ABSENT en NaN avant que `ParseIntPipe({ optional: true })` ne le
 * lise, et le défaut du service (quinze jours) n'était jamais atteint.
 */
const PIPE_GLOBAL = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const lire = (requete: Record<string, unknown>) =>
  PIPE_GLOBAL.transform(requete, { type: 'query', metatype: PropositionsRapprochementDto }) as Promise<PropositionsRapprochementDto>;

describe('la fenêtre de dates des propositions (B9)', () => {
  it('absente, elle passe le pipe global et laisse le défaut au service', async () => {
    const dto = await lire({});
    expect(dto.fenetreJours).toBeUndefined();
    // Le défaut est celui que l'écran propose, convention d'OmegaX.
    expect(FENETRE_JOURS_DEFAUT).toBe(15);
  });

  it('lisible, elle devient un entier', async () => {
    expect((await lire({ fenetreJours: '15' })).fenetreJours).toBe(15);
    expect((await lire({ fenetreJours: '0' })).fenetreJours).toBe(0);
    expect((await lire({ fenetreJours: String(FENETRE_JOURS_MAX) })).fenetreJours).toBe(FENETRE_JOURS_MAX);
  });

  it('illisible, un 400 qui NOMME la fenêtre', async () => {
    for (const valeur of ['abc', '1e2', '0x10', '-1', '', '12.5']) {
      const refus = await lire({ fenetreJours: valeur }).catch((e: unknown) => e);
      expect(refus).toBeInstanceOf(BadRequestException);
      expect(JSON.stringify((refus as BadRequestException).getResponse())).toMatch(/Fenêtre de dates/);
    }
  });

  it('au-delà de la plage de l’écran, refusée · la date bornée sortait du calendrier (500)', async () => {
    const refus = await lire({ fenetreJours: String(FENETRE_JOURS_MAX + 1) }).catch((e: unknown) => e);
    expect(refus).toBeInstanceOf(BadRequestException);
    const tresGrande = await lire({ fenetreJours: '99999999999' }).catch((e: unknown) => e);
    expect(tresGrande).toBeInstanceOf(BadRequestException);
  });

  it('un paramètre répété est refusé, jamais lu en partie', async () => {
    const refus = await lire({ fenetreJours: ['10', '20'] }).catch((e: unknown) => e);
    expect(refus).toBeInstanceOf(BadRequestException);
  });

  it('la route lit la requête par ce DTO, et non par un ParseIntPipe', () => {
    const types = Reflect.getMetadata('design:paramtypes', RapprochementController.prototype, 'proposer') as unknown[];
    expect(types).toContain(PropositionsRapprochementDto);
    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, RapprochementController, 'proposer') as Record<
      string,
      { pipes?: unknown[] }
    >;
    const pipes = Object.values(args).flatMap((a) => a.pipes ?? []);
    expect(pipes.some((p) => (p as object).constructor?.name === 'ParseIntPipe')).toBe(false);
  });
});
