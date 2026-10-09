import { readFileSync } from 'fs';
import { join } from 'path';
import { corpsConnexion, issueConnexion } from './connexion';

// Pas d'import de « vitest » · convention du dépôt (voir calcul.spec.ts).

/**
 * LA CONNEXION · la case « Rester connecté » et le code voyagent ensemble, et
 * la réponse ne demande que deux choses à l'écran, un code ou l'entrée.
 * L'opérateur de la console reste connecté comme tout utilisateur depuis le
 * 2026-10-09 (décision de Manasse, « Long, console redemandée ») · l'avis
 * « session courte » qui s'affichait avant d'entrer est retiré.
 */

describe('le corps de la connexion', () => {
  it('la case voyage au premier appel', () => {
    expect(corpsConnexion({ email: 'a@b.cd', motDePasse: 'x', resterConnecte: true, codeRequis: false, code: '' })).toEqual({
      email: 'a@b.cd',
      motDePasse: 'x',
      resterConnecte: true,
    });
  });

  it('et avec le code du second facteur, comme le mot de passe', () => {
    expect(
      corpsConnexion({ email: 'a@b.cd', motDePasse: 'x', resterConnecte: true, codeRequis: true, code: ' 123456 ' }),
    ).toEqual({ email: 'a@b.cd', motDePasse: 'x', resterConnecte: true, code: '123456' });
  });
});

describe('ce que la réponse demande à l’écran', () => {
  it('un code attendu', () => {
    expect(issueConnexion({ deuxiemeFacteurRequis: true })).toEqual({ etape: 'CODE_REQUIS' });
  });

  it('une session ouverte · l’entrée, sans avis', () => {
    expect(issueConnexion({ csrfToken: 'j', sessionLongue: true })).toEqual({ etape: 'OUVERTE', csrfToken: 'j' });
    expect(issueConnexion({ csrfToken: 'j', sessionLongue: false })).toEqual({ etape: 'OUVERTE', csrfToken: 'j' });
  });

  it('le serveur n’écrit plus d’avis de session courte · la prémisse relue sur sa source', () => {
    const service = readFileSync(join(__dirname, '..', '..', '..', 'src', 'modules', 'auth', 'auth.service.ts'), 'utf8');
    expect(service).toContain("return emettreSession(this.jwt, user.id, { longue, connexionComplete: 'maintenant' });");
  });
});

describe('l’écran d’ouverture entre dès que la session est ouverte', () => {
  const page = readFileSync(join(__dirname, '..', 'pages', 'AuthPage.tsx'), 'utf8');

  it('la réponse passe par issueConnexion, puis l’entrée', () => {
    const envoi = page.slice(page.indexOf('const onSubmit = async'), page.indexOf('const champClasse'));
    expect(envoi).toContain('corpsConnexion({ email, motDePasse, resterConnecte, codeRequis, code })');
    expect(envoi).toContain('const issue = issueConnexion(res);');
    expect(envoi).toContain("await seConnecter(issue.csrfToken);\n      navigate('/');");
  });
});
