import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EditionSelection, Prisma } from '@prisma/client';
import { SelectionsEditionService } from './selections-edition.service';
import { CRITERES_PAR_EDITION, criteresSelectionOuMotif, nomOuMotif } from './selections-edition';

/**
 * LES SÉLECTIONS ENREGISTRÉES (ligne sage-l7, fonction 59) · au dossier, les
 * critères de SON édition seulement, jamais l'exercice ; un journal retiré se
 * dit au rappel.
 */

const DOSSIER = 'dossier-1';
const AUTRE = 'dossier-2';

type Ligne = Record<string, unknown> & { id: string; tenantId: string; edition: EditionSelection; nom: string };

function nouveauFaux() {
  const lignes: Ligne[] = [];
  const journaux = [{ id: 'jnl-od', tenantId: DOSSIER }, { id: 'jnl-voisin', tenantId: AUTRE }];
  let n = 0;
  const filtre = (l: Ligne, where: Record<string, unknown>) => Object.entries(where).every(([k, v]) => l[k] === v);
  const prisma = {
    selectionEdition: {
      findMany: async ({ where, take }: { where: Record<string, unknown>; take?: number }) =>
        lignes
          .filter((l) => filtre(l, where))
          .sort((a, b) => a.nom.localeCompare(b.nom))
          .slice(0, take)
          .map((l) => ({ ...l })),
      count: async ({ where }: { where: Record<string, unknown> }) => lignes.filter((l) => filtre(l, where)).length,
      findFirst: async ({ where }: { where: Record<string, unknown> }) => lignes.find((l) => filtre(l, where)) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (lignes.some((l) => l.tenantId === data.tenantId && l.edition === data.edition && l.nom === data.nom)) {
          throw new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' });
        }
        const l = { id: `sel-${++n}`, creeLe: new Date(), modifieLe: new Date(), ...data } as unknown as Ligne;
        lignes.push(l);
        return { ...l };
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(lignes.find((l) => l.id === where.id)!, data),
      delete: async ({ where }: { where: { id: string } }) => lignes.splice(lignes.findIndex((l) => l.id === where.id), 1)[0],
    },
    journal: {
      findFirst: async ({ where }: { where: { id: string; tenantId: string } }) => journaux.find((j) => j.id === where.id && j.tenantId === where.tenantId) ?? null,
      findMany: async ({ where }: { where: { tenantId: string; id: { in: string[] } } }) =>
        journaux.filter((j) => j.tenantId === where.tenantId && where.id.in.includes(j.id)),
    },
    user: { findMany: async () => [{ id: 'u1', email: 'comptable@cabinet.cd' }] },
  };
  return { service: new SelectionsEditionService(prisma as never), lignes, journaux };
}

describe('sélections enregistrées · au dossier', () => {
  it('une sélection garde les critères de son édition, sans valeur vide, et se rappelle avec son auteur', async () => {
    const f = nouveauFaux();
    await f.service.creer(DOSSIER, 'u1', EditionSelection.JOURNAL, '  Achats du premier trimestre ', {
      journalId: 'jnl-od',
      dateDebut: '2026-01-01',
      dateFin: '2026-03-31',
      recherche: '',
      inclureBrouillard: false,
    });
    const l = await f.service.lister(DOSSIER, EditionSelection.JOURNAL);
    expect(l.selections.map((s) => [s.nom, s.criteres, s.creePar, s.journalIntrouvable])).toEqual([
      ['Achats du premier trimestre', { journalId: 'jnl-od', dateDebut: '2026-01-01', dateFin: '2026-03-31', inclureBrouillard: false }, 'comptable@cabinet.cd', false],
    ]);
    // Une autre édition, un autre dossier · rien ne s'y voit.
    expect((await f.service.lister(DOSSIER, EditionSelection.IMPRESSION_DIFFEREE)).total).toBe(0);
    expect((await f.service.lister(AUTRE, EditionSelection.JOURNAL)).total).toBe(0);
  });

  it('un même nom dans la même édition est refusé, avec ses deux issues', async () => {
    const f = nouveauFaux();
    await f.service.creer(DOSSIER, 'u1', EditionSelection.JOURNAL, 'Banque', { compte: '52' });
    await expect(f.service.creer(DOSSIER, 'u1', EditionSelection.JOURNAL, 'Banque', { compte: '521' })).rejects.toThrow(
      /porte déjà le nom « Banque » · remplacez-la ou choisissez un autre nom/,
    );
    // La même dans une autre édition passe.
    await f.service.creer(DOSSIER, 'u1', EditionSelection.IMPRESSION_DIFFEREE, 'Banque', { nature: 'BALANCE' });
  });

  it('le journal d’un autre dossier, l’exercice, une clé inconnue ou une date illisible sont refusés', async () => {
    const f = nouveauFaux();
    await expect(f.service.creer(DOSSIER, 'u1', EditionSelection.JOURNAL, 'X', { journalId: 'jnl-voisin' })).rejects.toThrow(/Journal introuvable/);
    await expect(f.service.creer(DOSSIER, 'u1', EditionSelection.JOURNAL, 'X', { exerciceId: 'e' })).rejects.toThrow(/ne garde pas l'exercice/);
    await expect(f.service.creer(DOSSIER, 'u1', EditionSelection.JOURNAL, 'X', { format: 'plat' })).rejects.toThrow(/Critère inconnu/);
    await expect(f.service.creer(DOSSIER, 'u1', EditionSelection.JOURNAL, 'X', { dateDebut: '31/03/2026' })).rejects.toThrow(/AAAA-MM-JJ/);
    await expect(f.service.creer(DOSSIER, 'u1', EditionSelection.JOURNAL, '   ', {})).rejects.toThrow(/nom de la sélection est exigé/);
    expect(f.lignes).toHaveLength(0);
  });

  it('remplacer change les critères, jamais l’édition ni le nom ; supprimer retire la sélection du seul dossier', async () => {
    const f = nouveauFaux();
    const s = await f.service.creer(DOSSIER, 'u1', EditionSelection.IMPRESSION_DIFFEREE, 'Grand livre à plat', { nature: 'GRAND_LIVRE', format: 'plat' });
    await f.service.remplacer(DOSSIER, s.id, { nature: 'GRAND_LIVRE', format: 'fpm' });
    expect(f.lignes[0]).toMatchObject({ nom: 'Grand livre à plat', edition: EditionSelection.IMPRESSION_DIFFEREE, criteres: { nature: 'GRAND_LIVRE', format: 'fpm' } });
    await expect(f.service.remplacer(DOSSIER, s.id, { format: 'pdf' })).rejects.toThrow(/« fpm », « plat »/);
    await expect(f.service.supprimer(AUTRE, s.id)).rejects.toThrow(/introuvable/);
    await f.service.supprimer(DOSSIER, s.id);
    expect(f.lignes).toHaveLength(0);
  });

  it('un journal retiré depuis l’enregistrement se dit au rappel', async () => {
    const f = nouveauFaux();
    await f.service.creer(DOSSIER, 'u1', EditionSelection.JOURNAL, 'OD', { journalId: 'jnl-od' });
    f.journaux.splice(0, 1);
    const l = await f.service.lister(DOSSIER, EditionSelection.JOURNAL);
    expect(l.selections[0].journalIntrouvable).toBe(true);
  });
});

describe('sélections enregistrées · règles pures', () => {
  it('les critères du journal sont exactement les filtres de sa fenêtre, relus dans sa source', () => {
    // Un filtre ajouté à la fenêtre sans entrer ici serait REFUSÉ à
    // l'enregistrement · la règle et l'écran se tiennent par ce test.
    const source = readFileSync(join(__dirname, '../../../../client/src/pages/JournalPage.tsx'), 'utf8');
    const bloc = source.slice(source.indexOf('interface Filtres {'), source.indexOf('\n}', source.indexOf('interface Filtres {')));
    const filtres = [...bloc.matchAll(/^  (\w+): /gm)].map((m) => m[1]);
    expect(filtres.length).toBeGreaterThan(5);
    expect(Object.keys(CRITERES_PAR_EDITION.JOURNAL).sort()).toEqual(filtres.sort());
    expect(Object.keys(CRITERES_PAR_EDITION.JOURNAL)).not.toContain('exerciceId');
    expect(Object.keys(CRITERES_PAR_EDITION.IMPRESSION_DIFFEREE)).not.toContain('exerciceId');
  });

  it('un booléen reste un booléen, un nom se borne', () => {
    expect(criteresSelectionOuMotif(EditionSelection.JOURNAL, { inclureBrouillard: 'false' })).toEqual({ motif: 'Critère « inclureBrouillard » · oui ou non.' });
    expect(criteresSelectionOuMotif(EditionSelection.JOURNAL, [])).toEqual({ motif: 'Les critères de la sélection sont illisibles.' });
    expect(nomOuMotif('x'.repeat(61))).toEqual({ motif: 'Le nom de la sélection tient en 60 caractères au plus.' });
  });
});
