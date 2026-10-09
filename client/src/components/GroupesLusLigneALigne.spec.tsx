import { renderToStaticMarkup } from 'react-dom/server';
import { GroupesLusLigneALigne } from './GroupesLusLigneALigne';

/** Paquet 1, B5 · une ligne, la raison en infobulle ; rien quand il n'y a rien. */
describe('GroupesLusLigneALigne', () => {
  it('rend une ligne qui nomme le groupe et son motif, la raison du motif en infobulle (mineur 7)', () => {
    const html = renderToStaticMarkup(
      <GroupesLusLigneALigne groupes={{ total: 1, groupes: [{ code: 'aa', compte: '41110001', motif: 'DEVISE_REGLEE_EN_PARTIE' }], tronque: false }} />,
    );
    expect(html).toMatch(/^<p [^>]*title="Une facture en devise réglée en partie à un autre cours[^"]+"[^>]*>1 groupe de lettrage à la répartition incertaine/);
    expect(html).toContain('aa (41110001, facture en devise réglée en partie)');
  });

  it('dans la relance, l’infobulle dit que le groupe se réclame pour son net (relecture, M2)', () => {
    const html = renderToStaticMarkup(
      <GroupesLusLigneALigne
        lecture="relance"
        groupes={{ total: 1, groupes: [{ code: 'aa', compte: '41110001', motif: 'NEGATIF_SANS_ORIGINE' }], tronque: false }}
      />,
    );
    expect(html).toContain('le groupe se réclame pour son net');
    expect(html).toContain('Le dû est exact');
  });

  it('rien quand la lecture n’en a trouvé aucun, ni quand le serveur ne le sert pas', () => {
    expect(renderToStaticMarkup(<GroupesLusLigneALigne groupes={{ total: 0, groupes: [], tronque: false }} />)).toBe('');
    expect(renderToStaticMarkup(<GroupesLusLigneALigne groupes={undefined} />)).toBe('');
  });
});
