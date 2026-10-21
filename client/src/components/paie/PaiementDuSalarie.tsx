import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Aide } from '../chrome/Aide';
import { BoutonsPaie, CHAMP_PAIE, ChampPaie, ModalePaie, useEnvoiPaie } from './ModalePaie';
import { auteurDeLaSaisie, corpsDuVisa, etatDuVisa, peutViser, sourceDuVisa } from '../../lib/visa-rib';
import { LIBELLE_MODE, MODES, type ModePaiement, type PaiementDuSalarieLu, type RibSalarieLu } from '../../lib/paiement-salaires';

/**
 * LIGNE SAGE-L5, FONCTION 75 · LE PAIEMENT DU SALARIÉ, dans le Registre du
 * personnel · le mode convenu (Code du travail, art. 98, al. 2), écrit par qui
 * tient le registre, et les coordonnées bancaires, une STRUCTURE écrite par
 * l'administrateur seul (comme les RIB des tiers), au journal d'audit. Les
 * boutons suivent les routes · `peutEcrire` pour le mode, `estAdmin` pour les
 * RIB.
 */
export function PaiementDuSalarie({ salarieId }: { salarieId: string }) {
  const { peutEcrire, peutValider, estAdmin, utilisateur } = useAuth();
  // Null tant que la fiche n'est pas LUE · « aucun RIB » ne se dit que sur une liste lue.
  const [lu, setLu] = useState<PaiementDuSalarieLu | null>(null);
  const [erreur, setErreur] = useState('');
  const [avis, setAvis] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [modale, setModale] = useState<{ rib: RibSalarieLu | null } | null>(null);
  const jeton = useRef(0);

  const charger = useCallback(() => {
    const moi = ++jeton.current;
    setErreur('');
    api.get<PaiementDuSalarieLu>(`/personnel/salaries/${salarieId}/paiement`).then(
      (r) => {
        if (moi === jeton.current) setLu(r);
      },
      (e: ApiError) => {
        if (moi === jeton.current) setErreur(e.message);
      },
    );
  }, [salarieId]);
  useEffect(() => {
    setLu(null);
    setAvis(null);
    charger();
  }, [charger]);

  const geste = async (fn: () => Promise<unknown>) => {
    setEnvoi(true);
    setErreur('');
    setAvis(null);
    try {
      await fn();
      charger();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Opération refusée.');
      // Refusé (RIB changé, déjà visé) · la fiche se relit, sans quoi elle garderait
      // des coordonnées qui ne sont plus celles de la base.
      charger();
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <section className="mt-3 border-t border-border pt-2 text-[11.5px]">
      <div className="font-bold mb-1 flex items-center gap-1.5">
        Paiement du salaire
        <Aide
          titre="Paiement du salaire"
          texte="Le mode de paiement se convient avec le salarié (« au temps et au lieu convenus ») et se déclare ici · tant qu'il n'est pas dit, le salarié n'entre dans aucun paiement. Virement, chèque et espèces paient tous la rémunération en monnaie, que le Code oppose aux avantages en nature. Le virement part sur le RIB principal, que seul l'administrateur saisit · un RIB modifié en silence détournerait un salaire, et chaque changement est au journal d'audit."
          source="Code du travail, art. 98 et 105 · fiche du compte 42 des deux plans"
        />
        <Aide
          titre="Visa des RIB"
          texte="Quand le dossier exige le visa des RIB (Paramètres du dossier), l'ordre de virement des salaires ne part que sur un RIB principal visé par un administrateur ou un comptable autre que celui qui a saisi ses coordonnées. Changer la banque, le numéro, l'IBAN, le BIC ou la devise fait tomber le visa. Un RIB saisi avant cette règle n'a pas d'auteur connu, et sa réponse le dit."
          source={sourceDuVisa(utilisateur?.tenant.referentiel)}
        />
      </div>
      {erreur && (
        <div role="alert" className="border border-danger/30 bg-danger-soft text-danger px-3 py-1.5 mb-1.5">
          {erreur}
        </div>
      )}
      {avis && (
        <div role="status" className="text-warning mb-1.5">
          {avis}
        </div>
      )}
      {!lu && !erreur && <div className="text-text-dim">Chargement…</div>}
      {lu && (
        <>
          <label className="flex items-center gap-2 mb-2">
            <span className="text-text-dim">Mode de paiement convenu</span>
            {peutEcrire ? (
              <select
                aria-label="Mode de paiement convenu"
                className={`${CHAMP_PAIE} w-auto`}
                disabled={envoi}
                value={lu.modePaiement ?? ''}
                onChange={(e) =>
                  void geste(() => api.post(`/personnel/salaries/${salarieId}/mode-paiement`, { modePaiement: e.target.value === '' ? null : e.target.value }))
                }
              >
                <option value="">Pas encore dit</option>
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {LIBELLE_MODE[m]}
                  </option>
                ))}
              </select>
            ) : (
              <span>{lu.modePaiement ? LIBELLE_MODE[lu.modePaiement as ModePaiement] : 'Pas encore dit'}</span>
            )}
          </label>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1">Banque</th>
                  <th className="text-left px-2 py-1">Titulaire</th>
                  <th className="text-left px-2 py-1">Coordonnées</th>
                  <th className="text-left px-2 py-1">Devise</th>
                  <th className="text-left px-2 py-1">Visa</th>
                  <th className="px-2 py-1 w-[190px]" />
                </tr>
              </thead>
              <tbody>
                {lu.ribs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-1 text-text-dim">
                      Aucun RIB enregistré.
                    </td>
                  </tr>
                )}
                {lu.ribs.map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-1">
                      {r.banque}
                      {r.estPrincipal ? <span className="text-text-dim"> · principal</span> : null}
                    </td>
                    <td className="px-2 py-1">{r.titulaire ?? ''}</td>
                    <td className="px-2 py-1">{r.coordonnees}</td>
                    <td className="px-2 py-1">{r.devise ?? ''}</td>
                    <td className={`px-2 py-1 ${r.visa && !r.visa.vise && r.visa.exige ? 'text-warning' : ''}`} >
                      {r.visa ? etatDuVisa(r.visa) : ''}
                      {r.visa && <span className="block text-text-dim">{auteurDeLaSaisie(r.visa)}</span>}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {peutViser(r.visa, peutValider) && (
                        <button
                          type="button"
                          className="text-sel hover:underline mr-2"
                          disabled={envoi}
                          aria-label={`Viser le RIB ${r.banque}`}
                          onClick={() =>
                            void geste(async () => {
                              const rep = await api.post<{ avertissement: string | null }>(`/personnel/ribs-salaries/${r.id}/viser`, corpsDuVisa(r.visa!));
                              setAvis(rep.avertissement);
                            })
                          }
                        >
                          Viser
                        </button>
                      )}
                      {estAdmin && (
                        <>
                          <button type="button" className="text-sel hover:underline mr-2" onClick={() => setModale({ rib: r })}>
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="text-danger hover:underline"
                            disabled={envoi}
                            onClick={() => void geste(() => api.delete(`/personnel/ribs-salaries/${r.id}`))}
                          >
                            Supprimer
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lu.tronque && <div className="text-warning mt-1">Liste tronquée · {lu.ribs.length} RIB lus sur {lu.total}.</div>}
          {estAdmin && (
            <button type="button" className="mt-1.5 border border-border px-2.5 py-1" onClick={() => setModale({ rib: null })}>
              Ajouter un RIB
            </button>
          )}
        </>
      )}
      {modale && (
        <ModaleRib
          salarieId={salarieId}
          rib={modale.rib}
          onFermer={() => setModale(null)}
          onFait={() => {
            setModale(null);
            setAvis(null);
            charger();
          }}
        />
      )}
    </section>
  );
}

function ModaleRib({ salarieId, rib, onFermer, onFait }: { salarieId: string; rib: RibSalarieLu | null; onFermer: () => void; onFait: () => void }) {
  const [f, setF] = useState({
    banque: rib?.banque ?? '',
    titulaire: rib?.titulaire ?? '',
    iban: rib?.iban ?? '',
    codeBanque: rib?.codeBanque ?? '',
    codeGuichet: rib?.codeGuichet ?? '',
    numeroCompte: rib?.numeroCompte ?? '',
    cle: rib?.cle ?? '',
    codeBic: rib?.codeBic ?? '',
    devise: rib?.devise ?? '',
    estPrincipal: rib?.estPrincipal ?? false,
  });
  const { envoi, erreur, setErreur, envoyer } = useEnvoiPaie(onFait);
  const valider = () => {
    if (!f.banque.trim()) {
      setErreur("La banque se nomme · l'ordre de virement l'imprime.");
      return;
    }
    const corps = { ...f, banque: f.banque.trim() };
    void envoyer(() => (rib ? api.patch(`/personnel/ribs-salaries/${rib.id}`, corps) : api.post(`/personnel/salaries/${salarieId}/ribs`, corps)));
  };
  const champ = (cle: Exclude<keyof typeof f, 'estPrincipal'>, libelle: string) => (
    <ChampPaie libelle={libelle}>
      <input value={f[cle]} onChange={(e) => setF({ ...f, [cle]: e.target.value })} className={CHAMP_PAIE} />
    </ChampPaie>
  );
  return (
    <ModalePaie
      titre={rib ? 'Modifier le RIB du salarié' : 'Ajouter un RIB au salarié'}
      envoi={envoi}
      erreur={erreur}
      onFermer={onFermer}
      onValider={valider}
      pied={<BoutonsPaie envoi={envoi} onFermer={onFermer} valider="Enregistrer" />}
    >
      {champ('banque', 'Banque')}
      {champ('titulaire', 'Titulaire du compte')}
      {champ('iban', 'IBAN')}
      {champ('codeBanque', 'Code banque')}
      {champ('codeGuichet', 'Code guichet')}
      {champ('numeroCompte', 'Numéro de compte')}
      {champ('cle', 'Clé')}
      {champ('codeBic', 'BIC')}
      {champ('devise', 'Devise')}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={f.estPrincipal} onChange={(e) => setF({ ...f, estPrincipal: e.target.checked })} />
        RIB principal
      </label>
    </ModalePaie>
  );
}
