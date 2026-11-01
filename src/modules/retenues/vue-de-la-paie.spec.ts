import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NATURES_RETENUES } from './correspondance-retenues';
import { DECLARATIONS_DE_LA_PAIE, NATURES_DE_LA_PAIE, echeancierDeLaPaie, registreDeLaPaie } from './vue-de-la-paie';

/**
 * LE GESTIONNAIRE DE PAIE NE LIT QUE LA PAIE (ligne paie-declarations,
 * relecture MAJEUR 2) · la liste est FERMÉE, le filtre au SERVEUR.
 */
describe('vue de la paie du registre des retenues', () => {
  it('liste fermée · quatre natures et deux déclarations, toutes connues du registre', () => {
    expect([...NATURES_DE_LA_PAIE].sort()).toEqual(['autresOrganismesSociaux', 'cnss', 'inppOnem', 'irppSalaires']);
    expect([...DECLARATIONS_DE_LA_PAIE].sort()).toEqual(['declarationAnnuelleSalaires', 'declarationMensuelleOnem']);
    for (const cle of NATURES_DE_LA_PAIE) expect(NATURES_RETENUES.some((n) => n.cle === cle)).toBe(true);
  });

  it('retire la TVA, la retenue locative, les capitaux mobiliers · totaux recalculés, comptes non rattachés tus', () => {
    const r = registreDeLaPaie({
      natures: [
        { cle: 'cnss', retenu: 100, reverse: 40, solde: 60 },
        { cle: 'tva', retenu: 1000, reverse: 0, solde: 1000 },
        { cle: 'retenueLocative', retenu: 50, reverse: 0, solde: 50 },
        { cle: 'irppSalaires', retenu: 30.5, reverse: 0, solde: 30.5 },
      ],
      totalRetenu: 1180.5,
      totalReverse: 40,
      totalDu: 1140.5,
      comptesNonRattaches: [{ numero: '4471', intitule: 'x' }],
      signalementsDeductibilite: [{ cle: 'retenueLocative' }, { cle: 'irppSalaires' }],
      avertissements: ['Régime de l’impôt sur les sociétés'],
    });
    expect(r.natures.map((n) => n.cle)).toEqual(['cnss', 'irppSalaires']);
    expect(r.totalDu).toBe(90.5);
    expect(r.totalRetenu).toBe(130.5);
    expect(r.comptesNonRattaches).toEqual([]);
    expect(r.signalementsDeductibilite).toEqual([{ cle: 'irppSalaires' }]);
    expect(r.avertissements.join(' ')).not.toContain('sociétés');
    expect(r.vueDeLaPaie).toBe(true);
  });

  it('l’échéancier ne garde que les échéances de la paie, INPP et ONEM ventilés compris', () => {
    const e = echeancierDeLaPaie({
      echeances: [
        { cle: 'inppOnem-inpp', genre: 'REVERSEMENT', montantDu: 10 },
        { cle: 'inppOnem-onem', genre: 'REVERSEMENT', montantDu: 5 },
        { cle: 'tva', genre: 'REVERSEMENT', montantDu: 900 },
        { cle: 'declarationImpotSocietes', genre: 'DECLARATION', montantDu: 0 },
        { cle: 'declarationMensuelleOnem', genre: 'DECLARATION', montantDu: 0 },
      ],
      totalDu: 915,
      avertissements: ['x'],
    });
    expect(e.echeances.map((x) => x.cle)).toEqual(['inppOnem-inpp', 'inppOnem-onem', 'declarationMensuelleOnem']);
    expect(e.totalDu).toBe(15);
  });

  it('le contrôleur filtre pour le gestionnaire de paie, aux deux routes', () => {
    const source = readFileSync(join(__dirname, 'retenues.controller.ts'), 'utf8');
    expect(source).toContain('user.role === RoleUtilisateur.GESTIONNAIRE_PAIE ? registreDeLaPaie(r) : r');
    expect(source).toContain('user.role === RoleUtilisateur.GESTIONNAIRE_PAIE ? echeancierDeLaPaie(e) : e');
  });
});
