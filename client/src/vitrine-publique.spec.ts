import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * LA PAGE PUBLIQUE (/vitrine/) NE DIT QUE CE QUI EST VRAI DU LOGICIEL.
 *
 * C'est une page STATIQUE de `client/public/` : aucun build, aucun typage, aucun test de
 * rendu ne la touche. Firebase Hosting réécrit `**` vers `index.html` · un lien ou un
 * fichier faux n'y est jamais un 404, c'est une page qui s'ouvre sur autre chose. Ce spec
 * relit donc les trois fichiers et les confronte à ce qu'ils affirment :
 *   · aucune ressource externe (CSP `script-src 'self'`, `font-src 'self'`), aucun script
 *     en ligne ;
 *   · chaque lien interne pointe une route qui existe, chaque police un fichier présent ;
 *   · le lien d'essai ne s'offre que sur une porte LUE ouverte, comme l'écran de connexion ;
 *   · chaque intitulé de compte cité est celui du plan semé, des deux référentiels ;
 *   · les comptes de notes sont ceux du règlement, et les phrases de la page sur le
 *     refus d'une écriture déséquilibrée et sur la piste de saisie ont leur code ;
 *   · la charte (aucune couleur d'accent, contrastes AA, filet interrompu) et le
 *     mouvement réduit.
 * Le tiret cadratin est écrit échappé ici, jamais en clair (CLAUDE.md § 4).
 */
const CLIENT = join(__dirname, '..');
const DEPOT = join(CLIENT, '..');
const lire = (chemin: string) => readFileSync(join(DEPOT, chemin), 'utf8');
const html = lire('client/public/vitrine/index.html');
const css = lire('client/public/vitrine/vitrine.css');
const js = lire('client/public/vitrine/vitrine.js');
const toutes = { 'index.html': html, 'vitrine.css': css, 'vitrine.js': js };

describe('la page publique reste dans la politique de sécurité du site', () => {
  it('aucune adresse externe, aucun script ni gestionnaire en ligne', () => {
    for (const [nom, texte] of Object.entries(toutes)) {
      // Les commentaires de licence ne citent aucune adresse · rien de http(s) hors mailto.
      expect(texte).not.toMatch(/https?:\/\//i);
    }
    expect(html).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/i);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    expect(html).not.toMatch(/<style[\s>]/i);
    expect(html).not.toMatch(/javascript:/i);
    // Toute ressource chargée est de notre origine.
    const refs = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
    for (const r of refs) {
      expect(/^(\/|#|mailto:|vitrine\.(css|js)\?v=)/.test(r)).toBe(true);
    }
  });

  it('les polices et les logos cités existent, servis depuis /polices/ et /', () => {
    const urls = [...css.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      expect(u.startsWith('/polices/')).toBe(true);
      expect(existsSync(join(CLIENT, 'public', u))).toBe(true);
    }
    for (const f of ['/logo-omegax-blanc.svg', '/icone.svg']) {
      expect(html).toContain(f);
      expect(existsSync(join(CLIENT, 'public', f))).toBe(true);
    }
    // La marque est un TRACÉ, jamais du texte composé (charte § 9 bis).
    expect(html).toMatch(/<img src="\/logo-omegax-blanc\.svg"[^>]*alt="OmegaX"/);
    expect(css).not.toMatch(/font-family:[^;}]*(Arial|Helvetica|Inter|Roboto|Impact)/i);
  });

  it('la feuille de style et le script portent la même version, sans quoi un cache d’une heure sert un mélange', () => {
    const css_v = html.match(/vitrine\.css\?v=(\d+)/)?.[1];
    const js_v = html.match(/vitrine\.js\?v=(\d+)/)?.[1];
    expect(css_v).toBeTruthy();
    expect(css_v).toBe(js_v);
  });
});

describe('chaque lien interne mène quelque part de vrai', () => {
  const app = readFileSync(join(CLIENT, 'src', 'App.tsx'), 'utf8');
  const liens = [...html.matchAll(/href="\/#(\/[^"]+)"/g)].map((m) => m[1]);

  it('les liens du cahier des charges sont là, et chacun est une route du HashRouter', () => {
    for (const l of ['/essai', '/connexion', '/contrat-de-licence', '/confidentialite', '/questions-frequentes']) {
      expect(liens).toContain(l);
    }
    for (const l of new Set(liens)) expect(app).toContain(`path="${l}"`);
  });

  it('les ancres de la page existent', () => {
    for (const a of [...html.matchAll(/href="#([a-z-]+)"/g)].map((m) => m[1])) {
      expect(html).toContain(`id="${a}"`);
    }
  });
});

describe('l’essai ne s’annonce que sur une porte lue ouverte', () => {
  it('la page lit le même état que l’écran de connexion et que l’écran d’essai', () => {
    const route = '/auth/inscription-essai/etat';
    expect(js).toContain(`'/api${route}'`);
    for (const page of ['AuthPage.tsx', 'EssaiPage.tsx']) {
      expect(readFileSync(join(CLIENT, 'src', 'pages', page), 'utf8')).toContain(route);
    }
    // Même critère que `essaiOuvert` de lib/essai.ts · ouverte vaut vrai ET une durée lue.
    expect(js).toMatch(/e\.ouverte === true/);
    expect(js).toMatch(/typeof e\.joursEssai === 'number'/);
    const lib = readFileSync(join(CLIENT, 'src', 'lib', 'essai.ts'), 'utf8');
    expect(lib).toContain("o?.ouverte === true && typeof o.joursEssai === 'number'");
  });

  it('tout lien d’essai part CACHÉ : lecture absente, échouée ou fermée, il ne se montre pas', () => {
    const essais = [...html.matchAll(/<a [^>]*data-essai[^>]*>/g)].map((m) => m[0]);
    expect(essais.length).toBeGreaterThanOrEqual(2);
    for (const a of essais) expect(a).toMatch(/\shidden(\s|>)/);
    // Le bloc d'appel « essayez » part caché lui aussi, le bloc neutre est celui qui se voit d'abord.
    expect(html).toMatch(/<div data-avec-essai hidden>/);
    expect(html).toMatch(/<div data-sans-essai>/);
    // Une lecture qui échoue est tue, jamais lue comme « ouverte ».
    expect(js).toMatch(/\.catch\(function \(\) \{[^}]*\}\)/);
    // Une lecture ne porte ni Content-Type ni jeton CSRF (CLAUDE.md § 6, temps de chargement).
    expect(js).not.toMatch(/Content-Type|X-CSRF-Token/i);
  });

  it('le texte par défaut ne promet aucune durée : la durée vient de la lecture', () => {
    // Le libellé du bouton caché est réécrit avec la durée lue ; le bloc neutre n'en cite aucune.
    expect(js).toContain("'Essayer gratuitement ' + jours + ' jours'");
    const neutre = html.match(/<div data-sans-essai>([\s\S]*?)<\/div>/)?.[1] ?? '';
    expect(neutre).not.toMatch(/\d+\s*jours/);
  });
});

describe('les intitulés de comptes cités sont ceux du plan semé', () => {
  const semis = {
    SYCEBNL: lire('src/modules/comptes/compte-seed.ts'),
    SYSCOHADA: lire('src/modules/comptes/compte-seed-syscohada.ts'),
  } as const;
  const dans = (ref: 'SYCEBNL' | 'SYSCOHADA', numero: string, libelle: string) => {
    const n = numero.padEnd(8, '0');
    const echappe = libelle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Semis SYCEBNL : ['41810000', 'libellé'] · semis SYSCOHADA : d('41810000', 'libellé', ...).
    return new RegExp(`['"]${n}['"],\\s*['"]${echappe}['"]`).test(semis[ref]);
  };

  for (const ref of ['SYCEBNL', 'SYSCOHADA'] as const) {
    it(`les trois lignes du plan ${ref} de la page existent à l’identique dans son semis`, () => {
      const bloc = html.match(new RegExp(`<article class="plan(?: revele)?" data-ref="${ref}"[\\s\\S]*?</article>`))?.[0] ?? '';
      const lignes = [...bloc.matchAll(/<th scope="row" class="code">(\d+)<\/th><td>([^<]+)<\/td>/g)];
      expect(lignes.length).toBe(3);
      for (const [, numero, libelle] of lignes) {
        expect(dans(ref, numero, libelle.replace(/&amp;/g, '&'))).toBe(true);
      }
    });
  }

  it('un numéro, deux sens : la page montre bien un numéro commun aux deux plans et un sujet à deux numéros', () => {
    const num = (ref: string) =>
      [...(html.match(new RegExp(`<article class="plan(?: revele)?" data-ref="${ref}"[\\s\\S]*?</article>`))?.[0] ?? '').matchAll(/class="code">(\d+)</g)].map((m) => m[1]);
    const a = num('SYCEBNL');
    const b = num('SYSCOHADA');
    expect(a.filter((x) => b.includes(x)).sort()).toEqual(['192', '4181']);
    // La retraite obligatoire : 4321 au SYCEBNL, 4313 au SYSCOHADA (CLAUDE.md, passation de paie).
    expect(a).toContain('4321');
    expect(b).toContain('4313');
  });
});

describe('les nombres et les phrases de la page ont leur source dans le dépôt', () => {
  const reglement = lire('CLAUDE.md');

  it('les nombres de notes annexes sont ceux du règlement', () => {
    const sycebnl = reglement.match(/professionnels \((\d+) notes\), projets de développement \((\d+)\), SMT \((\d+)\)/);
    expect(sycebnl).not.toBeNull();
    const nb = (ref: string) =>
      [...(html.match(new RegExp(`<article class="plan(?: revele)?" data-ref="${ref}"[\\s\\S]*?</article>`))?.[0] ?? '').matchAll(/data-vers="(\d+)"/g)].map((m) => m[1]);
    expect(nb('SYCEBNL')).toEqual([sycebnl![1], sycebnl![2], sycebnl![3]]);
    const normal = reglement.match(/(\d+) notes du ch\. 6/);
    expect(nb('SYSCOHADA')).toEqual([normal![1]]);
    // Le nombre est écrit en clair, égal à sa source, jamais animé vers elle (charte § 9 bis).
    for (const m of html.matchAll(/data-vers="(\d+)">([^<]*)</g)) expect(m[2]).toBe(m[1]);
  });

  it('« une écriture déséquilibrée n’est pas enregistrée » : le serveur la refuse', () => {
    const service = lire('src/modules/comptabilite/ecriture.service.ts');
    expect(service).toContain('Écriture déséquilibrée');
    expect(service).toContain('est déséquilibrée');
    // La pièce d'essai refuse au même centime près (écart nul, montant non nul).
    expect(js).toMatch(/ec === 0 && d > 0/);
  });

  it('« qui a saisi, qui a validé et quand » : la piste existe en base', () => {
    const schema = lire('prisma/schema.prisma');
    for (const champ of ['createdBy', 'createdAt', 'valideeBy', 'valideeAt']) expect(schema).toContain(champ);
  });

  it('« journal d’audit chaîné par empreintes » : la chaîne existe', () => {
    expect(existsSync(join(DEPOT, 'src/common/audit'))).toBe(true);
    expect(reglement).toContain("Chaque événement porte l'empreinte du précédent");
  });

  it('la sauvegarde chaque nuit, restaurée pour contrôle, est un workflow du dépôt', () => {
    const wf = lire('.github/workflows/sauvegarde-base.yml');
    expect(wf).toMatch(/cron:/);
    expect(wf.toLowerCase()).toContain('restaur');
  });

  it('« ne se modifie plus » : le livre ne se défait que par un négatif, dit aussi par le règlement', () => {
    expect(reglement).toMatch(/Aucun\s+chemin de dévalidation n'existe dans ce dépôt/);
  });

  it('aucune promesse que le code ne tient pas : pas de « bientôt », ni de chiffre de clientèle', () => {
    for (const [nom, t] of Object.entries(toutes)) {
      expect(t.toLowerCase()).not.toMatch(/bient[oô]t disponible|coming soon|témoignage|ils nous font confiance|clients? satisfaits|[0-9]+\s*(\+|%)?\s*(clients|cabinets|utilisateurs)/);
    }
    // Aucun nom de modèle d'IA dans ce qui est poussé (CLAUDE.md § 4).
    for (const [nom, t] of Object.entries(toutes)) expect(t).not.toMatch(/claude|anthropic|gpt|sonnet|opus|chatgpt/i);
  });
});

describe('la charte : encre, blanc, gris, aucune couleur d’accent', () => {
  const hexa = [...css.matchAll(/#([0-9a-f]{3,8})\b/gi)].map((m) => `#${m[1].toLowerCase()}`);
  const ADMISES = new Set([
    '#2a1f5c', // encre de cachet (ENCRE)
    '#4a4078', // survol de l'encre
    '#1d1a2e', // texte
    '#5b5670', // discret
    '#75718e', // mots pas encore lus
    '#c9c4da', // règle
    '#dedbe8', // filet
    '#fff', //
    '#f6f5fa', // lavis
    '#b52e26', // signal d'erreur, seul rouge de la page
    '#4f3ba8', // violet de l'échelle (--a-600) · étiquettes et cases du pointage
    '#cec6f0', // lilas de l'échelle (--a-200) · ce qui ressort sur l'encre
    '#8a79d6', // lilas vif (--a-400) · jamais sous un texte
    '#e6e1f8', // brume (--a-100) · trait de la frise, survol
  ]);

  it('toute couleur de la feuille de style est de la charte, la liste est fermée', () => {
    // Le site du cabinet porte un or (#e3a93c, #a96f12) et une nuit (#1b1342) · la page
    // d'OmegaX reprend sa composition, jamais ses couleurs (demande de Manasse du 2026-10-25).
    for (const h of ['#e3a93c', '#a96f12', '#f0b94d', '#1b1342', '#e8590c']) expect(hexa).not.toContain(h);
    for (const h of new Set(hexa)) expect(ADMISES.has(h)).toBe(true);
    // Les transparences ne sont posées que sur l'encre et sur le blanc.
    for (const m of css.matchAll(/rgba\(([^)]+)\)/g)) {
      expect(/^(255,255,255|42,31,92|79,59,168),/.test(m[1].replace(/\s/g, ''))).toBe(true);
    }
  });

  it('les contrastes des textes sur leurs fonds tiennent AA (4,5 pour 1), mesurés sur les jetons', () => {
    const jeton = (nom: string) => css.match(new RegExp(`--${nom}:(#[0-9a-f]{3,6})`, 'i'))![1];
    const lum = (hex: string) => {
      const h = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const rapport = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const fond = jeton('fond');
    const lavis = jeton('lavis');
    for (const t of ['texte', 'discret', 'attente', 'encre', 'signal']) {
      expect(rapport(jeton(t), fond)).toBeGreaterThanOrEqual(4.5);
    }
    for (const t of ['texte', 'discret', 'encre', 'signal']) {
      expect(rapport(jeton(t), lavis)).toBeGreaterThanOrEqual(4.5);
    }
    expect(rapport(jeton('violet'), fond)).toBeGreaterThanOrEqual(4.5);
    expect(rapport(jeton('violet'), lavis)).toBeGreaterThanOrEqual(4.5);
    expect(rapport(jeton('lilas'), jeton('encre'))).toBeGreaterThanOrEqual(4.5);
    // Le blanc sur l'encre (bouton plein, bandeau d'appel).
    expect(rapport('#ffffff', jeton('encre'))).toBeGreaterThanOrEqual(4.5);
    expect(rapport(jeton('encre'), lavis)).toBeGreaterThanOrEqual(4.5);
  });

  it('le filet de clôture suit la charte : vide de 13,3 % plafonné à 24 px, jamais un cadre', () => {
    expect(css).toContain('--vide:min(24px,13.3%)');
    expect(html.match(/<div class="filet" aria-hidden="true"><\/div>/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it('le titre de la page tient en deux à quatre mots de marque et la description dit ce que fait le logiciel', () => {
    expect(html).toMatch(/<title>OmegaX · comptabilité SYCEBNL et SYSCOHADA<\/title>/);
    expect(html).toContain('name="description"');
    expect(html).toContain('<meta name="theme-color" content="#2a1f5c">');
  });
});

describe('le mouvement sert la lecture et se coupe', () => {
  it('prefers-reduced-motion coupe animations et transitions, et rend visible ce que le mouvement cachait', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{[\s\S]*animation:none!important;transition:none!important/);
    expect(css).toMatch(/prefers-reduced-motion:reduce\)\{[\s\S]*\.js \.revele,\.js \.mot,\.js \.registre-heros tr\{opacity:1!important/);
    expect(js).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
  });

  it('sans script, rien n’est caché : seules les règles préfixées par .js masquent, et le script pose .js', () => {
    // Une apparition sans .js laisserait la page blanche à qui n'exécute pas le script.
    const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of sansCommentaires.matchAll(/([^{}]+)\{[^{}]*opacity:0[;}]/g)) {
      const sel = m[1].trim();
      if (sel.startsWith('from') || sel === '.tampon' || sel.startsWith('.haut')) continue;
      for (const s of sel.split(',')) expect(s.trim().startsWith('.js ')).toBe(true);
    }
    expect(js).toContain("classList.add('js')");
    // Sans IntersectionObserver, tout est marqué vu d'emblée.
    expect(js).toMatch(/!\('IntersectionObserver' in window\)/);
  });

  it('aucun cachet tournant ni rotation sans fin (demande de Manasse du 2026-10-25), aucun compteur', () => {
    expect(css).not.toMatch(/infinite/);
    expect(css).not.toMatch(/rotate\(360deg\)/);
    expect(html).not.toMatch(/textPath/);
    // Les nombres s'écrivent en clair, jamais animés vers leur valeur.
    expect(js).not.toMatch(/data-vers/);
    for (const m of html.matchAll(/data-vers="(\d+)">([^<]*)</g)) expect(m[2]).toBe(m[1]);
  });

  it('rien n’est caché sans script, sauf les contrôles interactifs (sinon des boutons sans effet)', () => {
    expect(html).toMatch(/id="valider" hidden/);
    expect(html).toMatch(/id="remettre" hidden/);
    expect(html.match(/ readonly>/g)!.length).toBe(2);
    // Les deux plans se montrent côte à côte, sans bascule qui en cacherait un.
    expect(html).not.toMatch(/id="bascule"/);
    expect(html.match(/<article class="plan revele" data-ref="(SYCEBNL|SYSCOHADA)"/g)!.length).toBe(2);
    // Aucun style en ligne · la politique de sécurité du site le refuserait.
    expect(html).not.toMatch(/\sstyle="/);
  });

  it('les champs de montant restent à 16 px au moins sur téléphone (pas de zoom à la saisie)', () => {
    expect(css).toMatch(/\.piece input\{font-size:16px/);
  });

  it('la durée des mouvements reste sobre : rien au-delà de 1,2 s, et les animations sont nommées', () => {
    // Les durées seules · un délai d'entrée (le journal du bandeau qui s'inscrit) n'est pas une durée.
    for (const m of css.matchAll(/(?:animation|transition)(?!-delay)[^;}]*?(\d*\.?\d+)s/g)) {
      expect(Number(m[1])).toBeLessThanOrEqual(1.2);
    }
    expect([...css.matchAll(/@keyframes (\w+)/g)].map((m) => m[1]).sort()).toEqual(['entre', 'ligne', 'mot', 'poser']);
  });

  it('le journal du bandeau boucle : ses totaux sont égaux et la somme de ses lignes', () => {
    const fig = html.match(/<figure class="registre-heros"[\s\S]*?<\/figure>/)?.[0] ?? '';
    const montant = (t: string) => Number(t.replace(/&#8239;/g, '').replace(',', '.'));
    const lignes = [...(fig.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '').matchAll(/<tr><td>[\s\S]*?<\/td><td class="num">([^<]*)<\/td><td class="num">([^<]*)<\/td><\/tr>/g)];
    expect(lignes.length).toBe(4);
    const d = lignes.reduce((s, l) => s + (l[1] ? montant(l[1]) : 0), 0);
    const c = lignes.reduce((s, l) => s + (l[2] ? montant(l[2]) : 0), 0);
    const totaux = fig.match(/Totaux<\/th><td class="num">([^<]*)<\/td><td class="num">([^<]*)</)!;
    expect(d).toBe(c);
    expect(montant(totaux[1])).toBe(d);
    expect(montant(totaux[2])).toBe(c);
    // Ses comptes existent dans les deux plans semés (le dossier fictif n'a pas de référentiel dit).
    const semis = [lire('src/modules/comptes/compte-seed.ts'), lire('src/modules/comptes/compte-seed-syscohada.ts')];
    for (const n of new Set([...fig.matchAll(/class="code">(\d+)</g)].map((m) => m[1]))) {
      for (const s of semis) expect(s).toContain(`'${n.padEnd(8, '0')}'`);
    }
  });
});
