import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { champsEscompteEcart, payeParDefaut, roleEscompte, roleServi, type ComptesEscompteEcart } from './escompte-reglement';

// Aucun import de « vitest » · convention du dépôt.

/**
 * ESCOMPTE ET ÉCART À L'ÉCRAN (ligne sage-l2, fonction 36) · ce qui casserait
 * en silence · un escompte illisible envoyé comme « aucun », la case « Solder
 * l'écart » perdue, un compte choisi envoyé sans son geste, ou des rôles que
 * le serveur n'a jamais servis.
 */
describe('les champs du corps', () => {
  it('rien saisi · rien envoyé, le dû entier', () => {
    expect(champsEscompteEcart({ escompteSaisi: '', solderEcart: false, compteEscompteId: undefined, compteEcartId: undefined })).toEqual({ champs: {} });
  });

  it('un escompte à la française, son compte choisi, la case cochée et son compte', () => {
    expect(champsEscompteEcart({ escompteSaisi: '1 250,5', solderEcart: true, compteEscompteId: 'c773', compteEcartId: 'c6588' })).toEqual({
      champs: { escompte: 1250.5, compteEscompteId: 'c773', solderEcart: true, compteEcartId: 'c6588' },
    });
  });

  it('un compte choisi sans son geste ne part pas', () => {
    expect(champsEscompteEcart({ escompteSaisi: '', solderEcart: false, compteEscompteId: 'c773', compteEcartId: 'c6588' })).toEqual({ champs: {} });
  });

  it('illisible ou non positif · dit avant l’envoi, jamais lu comme zéro', () => {
    expect(champsEscompteEcart({ escompteSaisi: 'douze', solderEcart: false, compteEscompteId: undefined, compteEcartId: undefined })).toEqual({
      motif: "L'escompte est illisible (« douze »).",
    });
    expect(champsEscompteEcart({ escompteSaisi: '0', solderEcart: false, compteEscompteId: undefined, compteEcartId: undefined })).toEqual({
      motif: expect.stringMatching(/strictement positif/),
    });
  });

  it('le payé par défaut est le dû moins l’escompte lisible', () => {
    expect(payeParDefaut(600, '12')).toBe(588);
    expect(payeParDefaut(600, '')).toBe(600);
    expect(payeParDefaut(600, 'x')).toBe(600);
  });
});

describe('les rôles servis par le serveur', () => {
  const servis: ComptesEscompteEcart = {
    seuil: null,
    roles: [
      { role: 'ESCOMPTE_OBTENU', racine: '773', comptes: [], proposeId: null, motif: 'Aucun compte' },
      { role: 'ECART_REGLEMENT', racine: '6588', comptes: [], proposeId: null, motif: 'Aucun compte' },
    ],
  };

  it('le sens choisit l’escompte, comme au serveur', () => {
    expect(roleEscompte('FOURNISSEUR')).toBe('ESCOMPTE_OBTENU');
    expect(roleEscompte('CLIENT')).toBe('ESCOMPTE_ACCORDE');
    expect(roleServi(servis, 'ESCOMPTE_OBTENU')?.racine).toBe('773');
    expect(roleServi(servis, 'ESCOMPTE_ACCORDE')).toBeNull();
    expect(roleServi(null, 'ECART_REGLEMENT')).toBeNull();
  });

  it('les noms de rôle et la route sont ceux du serveur, lus dans sa source', () => {
    const regles = readFileSync(join(__dirname, '../../../src/modules/reglements/ecart-escompte.ts'), 'utf8');
    expect(regles).toContain("export type RoleEcartEscompte = 'ESCOMPTE_OBTENU' | 'ESCOMPTE_ACCORDE' | 'ECART_REGLEMENT';");
    expect(regles).toContain("return sens === 'FOURNISSEUR' ? 'ESCOMPTE_OBTENU' : 'ESCOMPTE_ACCORDE';");
    const controleur = readFileSync(join(__dirname, '../../../src/modules/reglements/reglements.controller.ts'), 'utf8');
    expect(controleur).toContain("@Get('comptes-escompte-ecart')");
    const dto = readFileSync(join(__dirname, '../../../src/modules/reglements/reglements.dto.ts'), 'utf8');
    for (const champ of ['escompte?: number;', 'solderEcart?: boolean;', 'compteEscompteId?: string;', 'compteEcartId?: string;']) expect(dto).toContain(champ);
  });
});
