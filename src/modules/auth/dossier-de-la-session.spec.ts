import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * LE DOSSIER NE SE LIT QUE DANS LA SESSION (ligne multi-dossiers, 2026-11-01).
 *
 * Une personne peut tenir plusieurs dossiers. Le dossier de chaque requête est
 * celui de la ligne `User` que le jeton désigne (`sub`), relue par
 * `JwtStrategy`, posée sur `request.user`, et c'est lui que le cloisonnement
 * et le journal d'audit lisent (`audit-contexte.interceptor.ts`). Changer de
 * dossier est un GESTE (`POST /auth/changer-dossier`), jamais un paramètre
 * d'une autre requête · un `?dossier=` ou un en-tête qui changerait le dossier
 * en passant laisserait une page d'un dossier écrire dans un autre.
 *
 * Ce spec lit la SOURCE par sa structure · il tombe le jour où un contrôleur
 * reçoit un dossier en paramètre, en requête ou en en-tête hors de la console
 * de l'éditeur, ou le jour où le dossier de la session vient d'ailleurs que de
 * la ligne du jeton.
 */
const RACINE = join(__dirname, '..', '..', '..');

function fichiers(dossier: string): string[] {
  const sortie: string[] = [];
  for (const nom of readdirSync(join(RACINE, dossier))) {
    const relatif = `${dossier}/${nom}`;
    if (statSync(join(RACINE, relatif)).isDirectory()) sortie.push(...fichiers(relatif));
    else if (nom.endsWith('.ts') && !nom.endsWith('.spec.ts')) sortie.push(relatif);
  }
  return sortie;
}

const lire = (f: string) => readFileSync(join(RACINE, f), 'utf8');

/** Le corps d'une méthode, de son nom à son accolade fermante. */
function corps(texte: string, signature: string): string {
  const debut = texte.indexOf(signature);
  if (debut < 0) throw new Error(`introuvable · ${signature}`);
  let i = texte.indexOf('{', debut + signature.length);
  let profondeur = 0;
  const depart = i;
  for (; i < texte.length; i++) {
    if (texte[i] === '{') profondeur++;
    else if (texte[i] === '}' && --profondeur === 0) break;
  }
  return texte.slice(depart, i + 1);
}

describe('le dossier ne se lit que dans la session', () => {
  it('JwtStrategy pose le dossier de la ligne désignée par le jeton, et d’elle seule', () => {
    const strategie = corps(lire('src/modules/auth/jwt.strategy.ts'), 'async validate(');
    expect(strategie).toMatch(/this\.prisma\.user\.findUnique\(\{\s*where: \{ id: payload\.sub \}/);
    // Une seule affectation du dossier, depuis la ligne relue.
    expect(strategie.match(/tenantId: [^,\n]+/g)).toEqual(['tenantId: user.tenantId', 'tenantId: user.tenantId']);
    // Le compte de connexion d'une appartenance rattachée n'apporte que la
    // révocation, le mot de passe provisoire et le second facteur · jamais le dossier.
    const inclusion = strategie.slice(strategie.indexOf('compteDeConnexion: {'), strategie.indexOf('compteDeConnexion: {') + 200);
    expect(inclusion).not.toMatch(/tenantId/);
  });

  it('le contexte d’audit, que le cloisonnement lit, vient de request.user', () => {
    expect(lire('src/common/audit/audit-contexte.interceptor.ts')).toMatch(/tenantId: utilisateur\.tenantId/);
  });

  it('aucun contrôleur ne reçoit un dossier en paramètre, en requête ou en en-tête, hors de la console de l’éditeur', () => {
    const fautifs: string[] = [];
    for (const f of fichiers('src').filter((x) => x.endsWith('.controller.ts'))) {
      const texte = lire(f);
      for (const m of texte.matchAll(/@(Query|Param|Headers)\(\s*'([^']+)'/g)) {
        if (!/^(tenantid|dossierid|dossier|x-tenant|x-dossier)$/i.test(m[2])) continue;
        // La console de l'éditeur agit sur un cabinet NOMMÉ · c'est son objet,
        // derrière `OperateurPlateformeGuard`, et elle ne lit aucune donnée du
        // client (CLAUDE.md § 8).
        if (f === 'src/modules/plateforme/plateforme.controller.ts' && m[1] === 'Param' && m[2] === 'tenantId') continue;
        // Le siège d'un groupe lit les biens d'une de SES cellules · le service
        // ne l'admet que dans le périmètre du groupe, construit sur le dossier
        // de la session (`perimetreDeGroupe`), jamais reçu.
        if (f === 'src/modules/immobilisations/transfert-groupe.controller.ts' && m[1] === 'Param' && m[2] === 'dossierId') continue;
        fautifs.push(`${f} · @${m[1]}('${m[2]}')`);
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('aucun code ne lit un dossier dans un en-tête de requête', () => {
    const fautifs = fichiers('src').filter((f) => /headers\s*\[\s*['"]x-(tenant|dossier)/i.test(lire(f)));
    expect(fautifs).toEqual([]);
  });

  it('le changement de dossier est un geste unique, servi par une seule route', () => {
    const appelants = fichiers('src').filter((f) => /\.changerDeDossier\(/.test(lire(f)));
    expect(appelants).toEqual(['src/modules/auth/auth.controller.ts']);
    const route = lire('src/modules/auth/auth.controller.ts');
    expect(route).toMatch(/@UseGuards\(JwtAuthGuard\)\s*@Post\('changer-dossier'\)/);
    // Le dossier visé est au CORPS, jamais en paramètre d'adresse.
    const methode = route.slice(route.indexOf('async changerDossier('), route.indexOf('\n  }\n', route.indexOf('async changerDossier(')));
    expect(methode).toMatch(/@Body\(\) dto: ChangerDossierDto/);
    expect(methode).toMatch(/changerDeDossier\(user\.userId, dto\.dossierId,/);
  });

  it('le dossier visé se cherche parmi les seules appartenances de la personne de la session', () => {
    const service = corps(lire('src/modules/auth/auth.service.ts'), 'async changerDeDossier(');
    expect(service).toMatch(/compteDeLaSession\(userId\)/);
    expect(service).toMatch(/appartenanceDansLeDossier\(this\.prisma, compteId, dossierId\)/);
    expect(service).toMatch(/const compteId = idDuCompteDeConnexion\(ligne\)/);
  });
});
