import { renderToStaticMarkup } from 'react-dom/server';
import { GroupesLusLigneALigne } from './GroupesLusLigneALigne';

/** Paquet 1, B5 · une ligne, la raison en infobulle ; rien quand il n'y a rien. */
describe('GroupesLusLigneALigne', () => {
  it('rend une ligne qui nomme le groupe, la raison en infobulle', () => {
    const html = renderToStaticMarkup(
      <GroupesLusLigneALigne groupes={{ total: 1, groupes: [{ code: 'aa', compte: '41110001' }], tronque: false }} />,
    );
    expect(html).toMatch(/^<p [^>]*title="[^"]+"[^>]*>1 groupe de lettrage lu ligne à ligne/);
    expect(html).toContain('aa (41110001)');
  });

  it('rien quand la lecture n’en a trouvé aucun, ni quand le serveur ne le sert pas', () => {
    expect(renderToStaticMarkup(<GroupesLusLigneALigne groupes={{ total: 0, groupes: [], tronque: false }} />)).toBe('');
    expect(renderToStaticMarkup(<GroupesLusLigneALigne groupes={undefined} />)).toBe('');
  });
});
