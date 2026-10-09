import { partsAuResultatEnInstance } from './resultat-en-instance';

describe('partsAuResultatEnInstance · le 130 se solde d’abord (paquet 1, A6)', () => {
  it('prend le 1301 créditeur jusqu’au montant à affecter, le reste au 131', () => {
    const r = partsAuResultatEnInstance([{ compteId: 'a', numero: '13010000', solde: -300_000 }], true, 1_000_000);
    expect(r).toEqual({ parts: [{ compteId: 'a', numero: '13010000', montant: 300_000 }], reste: 700_000 });
  });

  it('ne prend jamais plus que le montant à affecter', () => {
    const r = partsAuResultatEnInstance([{ compteId: 'a', numero: '13010000', solde: -1_500_000 }], true, 1_000_000);
    expect(r.parts[0].montant).toBe(1_000_000);
    expect(r.reste).toBe(0);
  });

  it('ignore un solde du mauvais sens et le 1309 pour un bénéfice', () => {
    const r = partsAuResultatEnInstance(
      [
        { compteId: 'a', numero: '13010000', solde: 50_000 },
        { compteId: 'b', numero: '13090000', solde: 200_000 },
      ],
      true,
      1_000_000,
    );
    expect(r).toEqual({ parts: [], reste: 1_000_000 });
  });

  it('prend le 1309 débiteur pour une perte', () => {
    const r = partsAuResultatEnInstance([{ compteId: 'b', numero: '13090000', solde: 400_000 }], false, 400_000);
    expect(r).toEqual({ parts: [{ compteId: 'b', numero: '13090000', montant: 400_000 }], reste: 0 });
  });
});
