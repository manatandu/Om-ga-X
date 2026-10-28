import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * TOUT CHEMIN QUI RÉÉCRIT LE CONTENU D'UNE ÉCRITURE NOMME SON AUTEUR (ligne
 * microfina-m1, constat de l'audit de sécurité du 2026-10-25).
 *
 * La faille ne venait d'aucune règle fausse · elle venait d'un chemin qui
 * réécrivait le brouillard sans rien dire de son auteur (`modifier`, la
 * réimputation au brouillard). Un chemin NOUVEAU qui remplacerait les lignes
 * d'une écriture sans poser `contenuChange` rouvrirait la même faille, sous
 * des tests verts. Ce test découpe les MÉTHODES du service et exige, dans
 * toute méthode qui remplace les lignes d'une écriture existante (mise à
 * jour de la tête avec de nouvelles lignes, ou changement du compte de lignes
 * existantes), l'appel qui nomme l'auteur. La validation rejoue en plus
 * l'empreinte du contenu visé · ce test garde le double regard, que
 * l'empreinte seule ne garde pas.
 */

function methodes(source: string): Map<string, string> {
  const re = /^ {2}(?:private |public )?(?:async )?([a-zA-Z]\w*)(?:<[^>]*>)?\(/gm;
  const debuts: { nom: string; i: number }[] = [];
  for (let m = re.exec(source); m; m = re.exec(source)) debuts.push({ nom: m[1], i: m.index });
  const r = new Map<string, string>();
  debuts.forEach((d, k) => r.set(d.nom, source.slice(d.i, debuts[k + 1]?.i ?? source.length)));
  return r;
}

/** L'argument de chaque appel `motif(` du corps, parenthèses équilibrées · jamais une distance en caractères. */
function argumentsDe(corps: string, motif: string): string[] {
  const r: string[] = [];
  for (let i = corps.indexOf(motif); i >= 0; i = corps.indexOf(motif, i + 1)) {
    const debut = i + motif.length - 1;
    let profondeur = 0;
    for (let k = debut; k < corps.length; k++) {
      if (corps[k] === '(') profondeur++;
      else if (corps[k] === ')' && --profondeur === 0) {
        r.push(corps.slice(debut, k + 1));
        break;
      }
    }
  }
  return r;
}

const SERVICE = readFileSync(join(__dirname, 'ecriture.service.ts'), 'utf8');

describe('les chemins qui réécrivent le contenu d’une écriture nomment leur auteur', () => {
  const corps = methodes(SERVICE);

  it('le découpage trouve les méthodes · sinon rien n’est vérifié', () => {
    for (const nom of ['modifier', 'reimputer', 'transfererDansUnJournalOrdinaire', 'modifierPieceDuModule', 'valider']) {
      expect(corps.has(nom)).toBe(true);
    }
  });

  it('toute méthode qui remplace des lignes ou change leur compte pose contenuChange', () => {
    const reecrivent = [...corps.entries()].filter(
      ([, c]) =>
        // De nouvelles lignes posées par la mise à jour d'une tête existante.
        argumentsDe(c, 'ecriture.update(').some((a) => /lignes: \{\s*create/.test(a) || /\{ lignes: \{ create/.test(a)) ||
        // Le compte de lignes existantes changé en place.
        argumentsDe(c, 'ligneEcriture.updateMany(').some((a) => /data: \{ compteId/.test(a)),
    );
    expect(reecrivent.map(([n]) => n).sort()).toEqual(['modifier', 'modifierPieceDuModule', 'reimputer']);
    const sansAuteur = reecrivent.filter(([, c]) => !c.includes('contenuChange(')).map(([n]) => n);
    expect(sansAuteur).toEqual([]);
  });

  it('le transfert, qui change le journal et le numéro, nomme aussi son auteur', () => {
    expect(corps.get('transfererDansUnJournalOrdinaire')).toContain('contenuChange(auteur');
  });

  it('la modification ne retombe jamais sur createdBy quand l’auteur manque', () => {
    // `options.auteur ?? null` · un auteur absent est INCONNU, jamais le créateur.
    expect(corps.get('modifier')).toContain('contenuChange(options.auteur ?? null');
    expect(corps.get('modifier')).not.toMatch(/contenuChange\([^)]*createdBy/);
  });
});

describe('les portes passent l’utilisateur de la session', () => {
  const controleur = readFileSync(join(__dirname, 'ecriture.controller.ts'), 'utf8');
  it('PATCH /ecritures/:id et le transfert', () => {
    expect(controleur).toContain('this.ecritureService.modifier(user.tenantId, id, dto, { jugerLaCaisse: true, auteur: user.userId })');
    expect(controleur).toContain('this.ecritureService.transfererDansUnJournalOrdinaire(user.tenantId, id, dto, user.userId)');
  });

  it('la déclaration d’un à-nouveau complété en place nomme son auteur', () => {
    const declaration = readFileSync(join(__dirname, '..', 'devises', 'declaration-devise-a-nouveau.service.ts'), 'utf8');
    const corps = methodes(declaration).get('declarerAuBrouillard') ?? '';
    expect(corps).toContain('contenuChange(base.createdBy');
  });
});

describe('la validation lit l’auteur et le visa sous verrou', () => {
  // La validation se fait par tranches (relecture M5) · chaque tranche, dans
  // SA transaction, verrouille, relit et valide.
  const valider = methodes(SERVICE).get('valider') ?? '';
  const corps = methodes(SERVICE).get('validerUneTranche') ?? '';
  it('relit les traces dans la transaction qui valide, lignes verrouillées', () => {
    expect(valider).toMatch(/transactionJournalisee\(\s*this\.prisma,\s*\(tx\) => this\.validerUneTranche\(tx,/);
    expect(corps).toMatch(/FOR UPDATE/);
    expect(corps).toMatch(/"exercices"[\s\S]*FOR SHARE/);
    expect(corps).toContain('this.refusAvantValidation(');
    expect(corps).toContain('partitionnerLaValidation(');
    expect(corps).toContain('SELECT_TRACES_VISA');
    // Plus aucune comparaison au seul créateur.
    expect(corps).not.toMatch(/\.createdBy === valideeBy/);
  });

  // RELECTURE M2 · la ventilation analytique est du contenu (convention C2) ·
  // toute méthode de l'analytique qui écrit les ventilations d'une ligne nomme
  // l'auteur sur la tête au brouillard.
  it('toute méthode qui écrit les ventilations d’une ligne nomme son auteur', () => {
    const analytique = methodes(readFileSync(join(__dirname, '..', 'analytique', 'analytique.service.ts'), 'utf8'));
    const ecrivent = [...analytique.entries()]
      .filter(([, c]) => /ventilationAnalytique\.(create|createMany|deleteMany|update|updateMany|delete|upsert)\(/.test(c))
      .map(([n]) => n)
      .sort();
    expect(ecrivent).toEqual(['effacerVentilation', 'ventilerLigne']);
    for (const nom of ecrivent) expect(analytique.get(nom)).toContain('poserAuteurDeLaVentilation(tx');
    expect(analytique.get('poserAuteurDeLaVentilation')).toMatch(/FOR UPDATE[\s\S]*contenuChange\(userId/);
  });

  // RELECTURE M3 · l'auteur INCONNU est réservé aux chemins qui n'en ont pas ·
  // tout appel de `modifierPieceDuModule` hors du service nomme l'auteur de son
  // geste (cinquième argument), sans quoi la pièce retouchée par un
  // utilisateur nommé était refusée au double regard.
  it('tout appel de modifierPieceDuModule passe l’auteur du geste', () => {
    const racine = join(__dirname, '..', '..');
    const { execSync } = require('child_process') as typeof import('child_process');
    const fichiers = execSync('grep -rl "modifierPieceDuModule(" --include=*.ts .', { cwd: racine, encoding: 'utf8' })
      .split('\n')
      .filter((f) => f && !f.endsWith('.spec.ts') && !f.endsWith('ecriture.service.ts'));
    expect(fichiers.length).toBeGreaterThan(0);
    for (const f of fichiers) {
      const appels = argumentsDe(readFileSync(join(racine, f), 'utf8'), 'modifierPieceDuModule(');
      expect(appels.length).toBeGreaterThan(0);
      for (const a of appels) {
        // Les arguments de premier niveau · virgules hors accolades, crochets et parenthèses.
        let profondeur = 0;
        let virgules = 0;
        for (const c of a.slice(1, -1)) {
          if ('({['.includes(c)) profondeur++;
          else if (')}]'.includes(c)) profondeur--;
          else if (c === ',' && profondeur === 0) virgules++;
        }
        expect({ f, nombre: virgules + 1 - (/,\s*$/.test(a.slice(1, -1)) ? 1 : 0) }).toEqual({ f, nombre: 5 });
      }
    }
  });
});
