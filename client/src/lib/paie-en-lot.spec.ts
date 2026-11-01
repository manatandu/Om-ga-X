import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { corpsAEmettre, emettreLesCoches, entierSaisi, prerempliParametres, type CorpsPropose } from './paie-en-lot';

const CORPS: CorpsPropose = { moisDePaie: '2026-03', elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire du contrat', montantFc: 800000 }] };

describe('paie en lot · ce qui casserait en silence', () => {
  it('un champ vide est « pas encore dit », jamais zéro', () => {
    expect(entierSaisi('')).toBeNull();
    expect(entierSaisi(' 12 ')).toBe(12);
    expect(entierSaisi('1,5')).toBeUndefined();
  });

  it('les personnes à charge ne partent que saisies · jamais celles du registre', () => {
    expect(corpsAEmettre(CORPS, '')).toBe(CORPS);
    expect(corpsAEmettre(CORPS, '3')).toEqual({ ...CORPS, personnesACharge: 3 });
    expect(corpsAEmettre(CORPS, 'x')).toHaveProperty('refus');
  });

  it('un refus n’arrête pas les autres et garde son motif', async () => {
    const issues = await emettreLesCoches(
      [
        { salarieId: 'a', nomComplet: 'A', corps: CORPS },
        { salarieId: 'b', nomComplet: 'B', corps: CORPS },
        { salarieId: 'c', nomComplet: 'C', corps: CORPS },
      ],
      async (id) => {
        if (id === 'b') throw new Error('INPP non chiffrée');
        return { numero: id === 'a' ? 1 : 2 };
      },
      (e) => (e as Error).message,
    );
    expect(issues).toEqual([
      { salarieId: 'a', nomComplet: 'A', emis: true, numero: 1 },
      { salarieId: 'b', nomComplet: 'B', emis: false, motif: 'INPP non chiffrée' },
      { salarieId: 'c', nomComplet: 'C', emis: true, numero: 2 },
    ]);
  });

  it('le préremplissage n’écrase jamais un champ tapé', () => {
    const p = { natureEmployeurInpp: 'PRIVE' as const, regimeSalarial: null, effectifInpp: 0, joursPayes: null };
    expect(prerempliParametres({ natureInpp: '', effectifInpp: '', regimeSalarial: '', joursPayes: '' }, p)).toEqual({
      natureInpp: 'PRIVE',
      // Zéro déclaré est une réponse · il se reprend.
      effectifInpp: '0',
      regimeSalarial: '',
      joursPayes: '',
    });
    expect(prerempliParametres({ natureInpp: 'PUBLIC', effectifInpp: '7', regimeSalarial: '', joursPayes: '20' }, p)).toMatchObject({
      natureInpp: 'PUBLIC',
      effectifInpp: '7',
      joursPayes: '20',
    });
  });

  it('l’émission en lot passe par la route unitaire, cases décochées par défaut', () => {
    const src = fs.readFileSync(path.join(__dirname, '../components/paie/PaieEnLot.tsx'), 'utf8');
    expect(src).toMatch(/api\.post<\{ numero: number \}>\(`\/personnel\/salaries\/\$\{salarieId\}\/bulletins`, corps\)/);
    expect(src).toMatch(/useState<Record<string, boolean>>\(\{\}\)/);
    // Une case ne se coche que sur une ligne émissible.
    expect(src).toMatch(/l\.etat === 'EMISSIBLE' && peutEcrire && \(/);
  });
});
