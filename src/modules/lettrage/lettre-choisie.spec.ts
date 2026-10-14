import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LettrerDto } from './dto/lettrage.dto';
import { lettreBienFormee, motifLettreDejaEmployee, normaliserLettre } from './lettre-choisie';

/**
 * LA LETTRE CHOISIE À LA MAIN (ligne sage-l1, fonction 16) · sa forme suit la
 * suite que le programme écrit (A, ..., Z, AA, ...) · sans quoi la lettre
 * suivante calculée deviendrait fausse.
 */
describe('lettre de lettrage choisie · forme', () => {
  it('admet une à quatre lettres, minuscules comprises, rangées en majuscules', () => {
    for (const l of ['A', 'z', 'Ab', 'ZZZ', 'abcd']) expect(lettreBienFormee(l)).toBe(true);
    expect(normaliserLettre(' kz ')).toBe('KZ');
  });

  it('refuse chiffre, accent, signe, vide et cinq lettres', () => {
    for (const l of ['', 'A1', 'É', 'A-B', 'ABCDE', '1']) expect(lettreBienFormee(l)).toBe(false);
  });

  it('le DTO refuse une lettre mal formée et laisse passer son absence', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const sans = plainToInstance(LettrerDto, { ligneIds: [id, id] });
    expect(await validate(sans)).toHaveLength(0);
    const mauvaise = plainToInstance(LettrerDto, { ligneIds: [id, id], lettre: 'A1' });
    const erreurs = await validate(mauvaise);
    expect(erreurs.map((e) => e.property)).toEqual(['lettre']);
    expect(JSON.stringify(erreurs[0].constraints)).toMatch(/une à quatre lettres/);
  });

  it('le refus nomme la lettre, le compte, le groupe qui la porte et la lettre proposée', () => {
    const m = motifLettreDejaEmployee({ lettre: 'C', compteNumero: '40110001', statutGroupe: 'PARTIEL', lettreProposee: 'F' });
    expect(m).toContain('« C »');
    expect(m).toContain('40110001');
    expect(m).toContain('lettrage partiel (affiché « c »)');
    expect(m).toContain('« F »');
  });
});
