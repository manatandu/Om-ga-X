import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADRESSE_DU_LOGICIEL, ADRESSE_DU_SITE, redirectionDuSite } from './adresse-du-site';

const lieu = (hostname: string, hash = '', pathname = '/', search = '') => ({ hostname, pathname, search, hash });

describe('le site et le logiciel ne partagent pas leur adresse', () => {
  it('la racine de l’adresse du site ouvre la page publique, pas la connexion', () => {
    expect(redirectionDuSite(lieu(ADRESSE_DU_SITE))).toBe('/vitrine/');
    expect(redirectionDuSite(lieu(ADRESSE_DU_SITE, '#'))).toBe('/vitrine/');
    expect(redirectionDuSite(lieu('OmegaX.VMGConsulting.net'))).toBe('/vitrine/');
  });

  it('une page du logiciel demandée sous l’adresse du site part vers le logiciel, ancre gardée', () => {
    expect(redirectionDuSite(lieu(ADRESSE_DU_SITE, '#/connexion'))).toBe('https://oomega.web.app/#/connexion');
    expect(redirectionDuSite(lieu(ADRESSE_DU_SITE, '#/essai'))).toBe('https://oomega.web.app/#/essai');
    expect(redirectionDuSite(lieu(ADRESSE_DU_SITE, '#/contrat-de-licence', '/', '?v=1'))).toBe('https://oomega.web.app/?v=1#/contrat-de-licence');
  });

  it('toute autre adresse est laissée telle quelle · le logiciel, les aperçus, le poste sur site', () => {
    for (const h of ['oomega.web.app', 'oomega.firebaseapp.com', 'oomega--apercu-x1.web.app', 'localhost', '192.168.1.10', 'omegax.vmgconsulting.net.exemple.test']) {
      expect(redirectionDuSite(lieu(h))).toBeNull();
      expect(redirectionDuSite(lieu(h, '#/connexion'))).toBeNull();
    }
  });

  it('l’adresse du logiciel est celle que cite le contrat de licence', () => {
    const contrat = readFileSync(join(__dirname, '..', '..', '..', 'src', 'modules', 'conditions-licence', 'conditions-de-licence.ts'), 'utf8');
    expect(contrat).toContain(`à l’adresse ${ADRESSE_DU_LOGICIEL.replace('https://', '')}`);
  });

  it('l’aiguillage joue avant tout rendu et avant la télémétrie', () => {
    const entree = readFileSync(join(__dirname, '..', 'main.tsx'), 'utf8');
    const aiguillage = entree.indexOf('redirectionDuSite(window.location)');
    expect(aiguillage).toBeGreaterThan(-1);
    expect(aiguillage).toBeLessThan(entree.indexOf('demarrerTelemetrieInterface();'));
    expect(aiguillage).toBeLessThan(entree.indexOf('createRoot'));
  });
});
