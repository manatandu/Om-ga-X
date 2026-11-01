import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  DeclarerCreanceOuvertureDto,
  PerteCreanceDto,
  ReclasserCreanceDto,
} from './creances-douteuses.dto';

/**
 * FACULTATIF NE VEUT PAS DIRE NULLABLE (relecture TypeScript d'A7, mineur 1).
 * Les comptes, le motif, les pièces et les listes des créances douteuses
 * étaient sous `@IsOptional()` seul · un `null` passait la porte, et seul le
 * service, qui le lisait comme une absence, évitait l'effet faux. Il est
 * refusé en 400 nommé, l'absence reste admise.
 */
function erreurs(
  classe: new () => object,
  corps: Record<string, unknown>,
): string[] {
  return validateSync(plainToInstance(classe, corps)).map((e) => e.property);
}

describe('créances douteuses · un champ facultatif ne vaut pas null', () => {
  it('reclassement · compte 416, compte 491 et factures refusés à null, admis absents', () => {
    const base = {
      exerciceId: 'x',
      journalId: 'j',
      date: '2026-03-01',
      compteCreanceId: 'c',
      nature: 'DOUTEUSE',
      montant: 10,
      motif: 'Client en difficulté',
      pieces: [],
    };
    const absents = erreurs(ReclasserCreanceDto, base);
    for (const champ of ['compte416Id', 'compte491Id', 'factures']) {
      expect(absents).not.toContain(champ);
      expect(
        erreurs(ReclasserCreanceDto, { ...base, [champ]: null }),
      ).toContain(champ);
    }
  });

  it('perte · compte de la perte et duplicatas refusés à null', () => {
    const base = {
      exerciceId: 'x',
      journalId: 'j',
      date: '2026-03-01',
      montant: 10,
      motif: 'Irrécouvrable',
      pieces: [],
    };
    for (const champ of ['comptePerteId', 'duplicatas']) {
      expect(erreurs(PerteCreanceDto, base)).not.toContain(champ);
      expect(erreurs(PerteCreanceDto, { ...base, [champ]: null })).toContain(
        champ,
      );
    }
  });

  it('déclaration d’ouverture · motif et pièces refusés à null', () => {
    const base = {
      exerciceId: 'x',
      compteCreanceId: 'c',
      compte416Id: 'd',
      nature: 'DOUTEUSE',
      montant: 10,
      depreciationOuverture: 0,
      source: 'Balance reprise',
    };
    for (const champ of ['motif', 'pieces', 'compte491Id']) {
      expect(erreurs(DeclarerCreanceOuvertureDto, base)).not.toContain(champ);
      expect(
        erreurs(DeclarerCreanceOuvertureDto, { ...base, [champ]: null }),
      ).toContain(champ);
    }
  });
});
