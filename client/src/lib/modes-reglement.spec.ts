// Aucun import de « vitest » · convention du dépôt, le spec tourne aussi sous jest.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { journalProposeParLeMode, LIBELLES_NATURES, libelleMode, modesProposables, NATURES, PLAFOND_MODES_REGLEMENT } from './modes-reglement';

/**
 * LE MIROIR DES NATURES (ligne sage-l2, fonction 1) · l'écran recopie
 * l'énumération du schéma et les libellés du serveur. Une nature ajoutée au
 * schéma et absente de l'écran ne se choisirait jamais ; un libellé qui
 * diverge ferait dire à l'écran « Virement » là où l'avertissement de
 * l'art. 59 bis dit autre chose.
 */
const RACINE = join(__dirname, '../../..');

describe('le miroir des natures', () => {
  it('suit l’énumération NatureModeReglement du schéma, dans son ordre', () => {
    const schema = readFileSync(join(RACINE, 'prisma/schema.prisma'), 'utf8');
    const bloc = schema.slice(schema.indexOf('enum NatureModeReglement {'), schema.indexOf('}', schema.indexOf('enum NatureModeReglement {')));
    const valeurs = bloc.split('\n').slice(1).map((l) => l.trim()).filter((l) => /^[A-Z_]+$/.test(l));
    expect(valeurs.length).toBeGreaterThan(0);
    expect([...NATURES]).toEqual(valeurs);
  });

  it('reprend mot pour mot les libellés et le plafond du serveur', () => {
    const serveur = readFileSync(join(RACINE, 'src/modules/reglements/modes-reglement.ts'), 'utf8');
    for (const n of NATURES) expect(serveur).toContain(`${n}: '${LIBELLES_NATURES[n]}'`);
    expect(serveur).toContain(`PLAFOND_MODES_REGLEMENT = ${PLAFOND_MODES_REGLEMENT};`);
  });
});

describe('les modes proposés', () => {
  const modes = [
    { id: 'a', estActif: true, code: 'CHQ', intitule: 'Chèque' },
    { id: 'b', estActif: false, code: 'ESP', intitule: 'Espèces' },
  ];

  it('un mode en sommeil reste proposé s’il est celui de la fiche · sinon un enregistrement l’effacerait', () => {
    expect(modesProposables(modes, 'b').map((m) => m.id)).toEqual(['a', 'b']);
    expect(modesProposables(modes, null).map((m) => m.id)).toEqual(['a']);
    expect(libelleMode(modes[1])).toBe('ESP · Espèces (en sommeil)');
  });

  it('le journal du mode ne se présélectionne que s’il est offert', () => {
    const offerts = [{ id: 'bq' }];
    expect(journalProposeParLeMode({ journalId: 'bq' }, offerts)).toBe('bq');
    expect(journalProposeParLeMode({ journalId: 'ca' }, offerts)).toBeNull();
    expect(journalProposeParLeMode({ journalId: null }, offerts)).toBeNull();
    expect(journalProposeParLeMode(null, offerts)).toBeNull();
  });
});
