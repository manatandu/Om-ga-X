import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  dossierDeLEcran,
  enteteDuDossier,
  estRefusDossierChange,
  oublierDossierDeLEcran,
  poserDossierDeLEcran,
  rechargerSurLeDossierOuvert,
} from './dossier-de-l-ecran';

/**
 * LE DOSSIER DE L'ONGLET (ligne multi-dossiers, relecture B1). Ce qui casserait
 * en silence · un onglet resté sur le dossier A qui écrirait dans B après un
 * changement de dossier fait dans un autre onglet, le cookie étant partagé.
 */
const src = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8');

describe('le dossier que l’onglet affiche', () => {
  beforeEach(() => oublierDossierDeLEcran());

  it('se pose à la première lecture, puis se compare', () => {
    expect(poserDossierDeLEcran('A')).toBe('POSE');
    expect(poserDossierDeLEcran('A')).toBe('IDENTIQUE');
    expect(poserDossierDeLEcran('B')).toBe('CHANGE');
    // Un dossier changé ne remplace pas celui de l'onglet · c'est le serveur qui juge.
    expect(dossierDeLEcran()).toBe('A');
  });

  it('l’en-tête part sur ce qui modifie, jamais sur une lecture', () => {
    expect(enteteDuDossier('POST')).toEqual({});
    poserDossierDeLEcran('A');
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) expect(enteteDuDossier(m)).toEqual({ 'X-Dossier': 'A' });
    expect(enteteDuDossier('GET')).toEqual({});
    expect(enteteDuDossier('HEAD')).toEqual({});
    expect(enteteDuDossier(undefined)).toEqual({});
  });

  it('seul le 409 marqué « dossier changé » est le refus de l’autre onglet', () => {
    expect(estRefusDossierChange(409, { dossierChange: true })).toBe(true);
    expect(estRefusDossierChange(409, { message: 'conflit' })).toBe(false);
    expect(estRefusDossierChange(403, { dossierChange: true })).toBe(false);
    expect(estRefusDossierChange(409, null)).toBe(false);
  });

  it('recharge une seule fois', () => {
    // Sans fenêtre (environnement des tests), l'alerte et le hachage tombent
    // dans leur `catch` · le rechargement part tout de même, une fois.
    let n = 0;
    rechargerSurLeDossierOuvert(() => n++);
    rechargerSurLeDossierOuvert(() => n++);
    expect(n).toBe(1);
  });

  it('les deux voies d’envoi portent l’en-tête, et le refus recharge', () => {
    const api = src('lib', 'api.ts');
    expect(api).toContain('enteteDuDossier(options.method)');
    expect(api).toContain("enteteDuDossier('POST')");
    expect(api).toContain('if (estRefusDossierChange(res.status, body)) rechargerSurLeDossierOuvert();');
  });
});
