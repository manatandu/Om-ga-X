import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { modulesAvecLaPaie, paieAActiver } from './amorce-paie';
import { libellePiecesDePaieAuBrouillard, piecesDePaieAuBrouillard } from './retenues-brouillard';

// Aucun import de « vitest » · convention du dépôt.

describe('amorce « Activer la Paie » (ligne paie-declarations)', () => {
  it('ne se montre que sur une liste LUE qui ne porte pas la paie', () => {
    expect(paieAActiver(['REVISION'])).toBe(true);
    expect(paieAActiver([])).toBe(true);
    expect(paieAActiver(['PAIE', 'IFRS'])).toBe(false);
    // Dossier pas encore chargé · rien n'est proposé.
    expect(paieAActiver(undefined)).toBe(false);
    expect(paieAActiver(null)).toBe(false);
  });

  it('active la paie sans retirer les autres modules ni la doubler', () => {
    expect(modulesAvecLaPaie(['REVISION', 'IFRS'])).toEqual(['REVISION', 'IFRS', 'PAIE']);
    expect(modulesAvecLaPaie(['PAIE'])).toEqual(['PAIE']);
  });

  it('se pose à l’ouverture du registre du personnel et au démarrage guidé', () => {
    const personnel = readFileSync(join(__dirname, '../pages/PersonnelPage.tsx'), 'utf8');
    const demarrage = readFileSync(join(__dirname, '../components/DemarrageGuide.tsx'), 'utf8');
    expect(personnel).toContain('<AmorcePaie modulesActives={utilisateur?.tenant.modulesActives} />');
    expect(demarrage).toContain('<AmorcePaie modulesActives={modules} onActive={setModules} />');
  });
});

describe('Retenues · la paie au brouillard se dit (ligne paie-declarations)', () => {
  it('lit le nombre du serveur, zéro quand il ne le sert pas', () => {
    expect(piecesDePaieAuBrouillard({ piecesDePaieAuBrouillard: 2 }, null)).toBe(2);
    expect(piecesDePaieAuBrouillard(null, { piecesDePaieAuBrouillard: 1 })).toBe(1);
    expect(piecesDePaieAuBrouillard({}, null)).toBe(0);
    expect(piecesDePaieAuBrouillard(null, null)).toBe(0);
  });

  it('dit que le registre ne les lit pas, et le geste qui les y fait entrer', () => {
    expect(libellePiecesDePaieAuBrouillard(1)).toContain('1 pièce de paie est encore au brouillard');
    expect(libellePiecesDePaieAuBrouillard(3)).toContain('3 pièces de paie sont encore au brouillard');
    expect(libellePiecesDePaieAuBrouillard(3)).toContain('Validez-les au journal');
  });
});
