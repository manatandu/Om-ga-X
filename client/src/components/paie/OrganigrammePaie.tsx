import { useState } from 'react';
import { api } from '../../lib/api';
import { Aide } from '../chrome/Aide';
import { libelleListeBornee } from '../../lib/liste-bornee-personnel';
import { Erreur, useEnvoi, useLecture } from './SuiviPersonnelPaie';

/**
 * LIGNE PAIE-SUITE · DÉPARTEMENTS ET DIRECTIONS · l'organigramme du dossier en
 * arbre libre, ses niveaux nommés par lui, et le rattachement daté de chaque
 * salarié. Règles au serveur (`personnel/organigramme.ts`) · rien n'est jugé
 * ici, une liste non lue n'est jamais dite vide. Les boutons qui écrivent
 * suivent `peutEcrire`.
 */

type SalarieMin = { id: string; nom: string; postNom?: string | null; prenoms?: string | null };
const nomDe = (s: SalarieMin) => [s.nom, s.postNom, s.prenoms].filter(Boolean).join(' ');
const champ = 'border border-border bg-transparent px-1.5 py-0.5';

type Unite = {
  id: string;
  code: string;
  intitule: string;
  niveau: string | null;
  parentId: string | null;
  estActive: boolean;
  profondeur: number;
  chemin: string[];
  orpheline: boolean;
  section: { id: string; code: string; intitule: string; plan: string; estActive: boolean } | null;
  effectifAuJour: number;
  rattachements: number;
  enfants: number;
};
type Organigramme = {
  aujourdhui: string;
  unites: Unite[];
  niveaux: string[];
  sectionsProposables: { id: string; code: string; intitule: string; plan: string }[];
  /** Plus de 50 plans ou plus de 500 sections par plan · la liste proposée est coupée. */
  sectionsTronquees?: boolean;
  total: number;
  tronque: boolean;
  fondement: string;
};
type Historique = {
  rattachements: {
    id: string;
    unite: { code: string; intitule: string; niveau: string | null };
    dateEffet: string;
    creePar: string;
    annuleLe: string | null;
    motifAnnulation: string | null;
    enVigueur: boolean;
  }[];
  total: number;
  tronque: boolean;
};

export function OngletOrganigramme({ salaries, peutEcrire }: { salaries: SalarieMin[]; peutEcrire: boolean }) {
  const { donnees, erreur, setErreur, relire } = useLecture(() => api.get<Organigramme>('/personnel/organigramme'), 'organigramme');
  const { envoi, envoyer } = useEnvoi(relire, setErreur);
  const [u, setU] = useState({ code: '', intitule: '', niveau: '', parentId: '', sectionAnalytiqueId: '' });
  const [deplacement, setDeplacement] = useState<Record<string, string>>({});

  const creer = () =>
    void envoyer(async () => {
      await api.post('/personnel/organigramme', {
        code: u.code,
        intitule: u.intitule,
        ...(u.niveau.trim() ? { niveau: u.niveau.trim() } : {}),
        ...(u.parentId ? { parentId: u.parentId } : {}),
        ...(u.sectionAnalytiqueId ? { sectionAnalytiqueId: u.sectionAnalytiqueId } : {}),
      });
      setU({ code: '', intitule: '', niveau: '', parentId: '', sectionAnalytiqueId: '' });
    });

  return (
    <div className="ecran-seul max-w-[1240px] text-[11.5px] space-y-4">
      <Erreur m={erreur} />
      <section>
        <div className="font-semibold mb-1 flex items-center gap-1.5">
          Organigramme
          <Aide
            titre="Départements et directions"
            texte={`${donnees?.fondement ?? ''} Une unité a un code, un intitulé, un niveau que vous nommez (Direction, Département, Service…) et une unité parente, sans limite de profondeur. Elle peut renvoyer à une section analytique, que la répartition analytique de la paie propose alors pour ses salariés. Une unité qui porte un rattachement ne se supprime pas · elle se met en sommeil et ne reçoit plus de salarié.`}
            source="Code du travail, art. 212 · organisation propre à l'entité"
          />
        </div>
        {donnees === null && !erreur && <div className="text-text-dim">Lecture de l&apos;organigramme…</div>}
        {donnees && libelleListeBornee(donnees, donnees.unites.length, 'unités') && (
          <div className="text-warning">{libelleListeBornee(donnees, donnees.unites.length, 'unités')}</div>
        )}
        {donnees && donnees.unites.length === 0 && <div className="text-text-dim">Aucune unité.</div>}
        {donnees && donnees.unites.length > 0 && (
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left px-2 py-1">Unité</th>
                <th className="text-left px-2 py-1">Niveau</th>
                <th className="text-left px-2 py-1">Section proposée</th>
                <th className="text-right px-2 py-1">Effectif au {donnees.aujourdhui}</th>
                <th className="px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {donnees.unites.map((x) => (
                <tr key={x.id} className={x.estActive ? '' : 'text-text-dim'}>
                  <td className="px-2 py-1" style={{ paddingLeft: `${0.5 + x.profondeur * 1.25}rem` }}>
                    {x.code} · {x.intitule}
                    {!x.estActive && ' · en sommeil'}
                    {x.orpheline && <span className="text-warning"> · unité parente non lue</span>}
                  </td>
                  <td className="px-2 py-1">{x.niveau ?? ''}</td>
                  <td className="px-2 py-1">
                    {x.section ? `${x.section.plan} · ${x.section.code} ${x.section.intitule}${x.section.estActive ? '' : ' (inactive)'}` : ''}
                  </td>
                  <td className="px-2 py-1 text-right">{x.effectifAuJour}</td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">
                    {peutEcrire && (
                      <span className="inline-flex gap-1.5 items-center">
                        <select
                          aria-label={`Déplacer ${x.code} sous`}
                          value={deplacement[x.id] ?? ''}
                          onChange={(e) => setDeplacement({ ...deplacement, [x.id]: e.target.value })}
                          className={champ}
                        >
                          <option value="">Déplacer sous…</option>
                          <option value="RACINE">Racine de l&apos;organigramme</option>
                          {donnees.unites
                            .filter((p) => p.id !== x.id && !p.chemin.slice(0, -1).includes(x.code) && p.estActive)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.chemin.join(' / ')}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          className="hover:underline"
                          disabled={envoi || !deplacement[x.id]}
                          onClick={() =>
                            void envoyer(() =>
                              api.patch(`/personnel/organigramme/${x.id}`, { parentId: deplacement[x.id] === 'RACINE' ? null : deplacement[x.id] }),
                            )
                          }
                        >
                          Déplacer
                        </button>
                        <button
                          type="button"
                          className="text-sel hover:underline"
                          disabled={envoi}
                          onClick={() => void envoyer(() => api.patch(`/personnel/organigramme/${x.id}`, { estActive: !x.estActive }))}
                        >
                          {x.estActive ? 'Mettre en sommeil' : 'Réactiver'}
                        </button>
                        {x.rattachements === 0 && x.enfants === 0 && (
                          <button
                            type="button"
                            className="text-danger hover:underline"
                            disabled={envoi}
                            onClick={() => window.confirm(`Supprimer l'unité ${x.code} ?`) && void envoyer(() => api.delete(`/personnel/organigramme/${x.id}`))}
                          >
                            Supprimer
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {peutEcrire && donnees && (
          <div className="flex flex-wrap gap-1.5 mt-2 items-center">
            <input aria-label="Code de l'unité" placeholder="Code" value={u.code} onChange={(e) => setU({ ...u, code: e.target.value })} className={`${champ} w-[90px]`} />
            <input aria-label="Intitulé de l'unité" placeholder="Intitulé" value={u.intitule} onChange={(e) => setU({ ...u, intitule: e.target.value })} className={`${champ} w-[220px]`} />
            <input
              aria-label="Niveau de l'unité"
              placeholder="Niveau (Direction, Service…)"
              list="niveaux-organigramme"
              value={u.niveau}
              onChange={(e) => setU({ ...u, niveau: e.target.value })}
              className={`${champ} w-[170px]`}
            />
            <datalist id="niveaux-organigramme">
              {donnees.niveaux.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <select aria-label="Unité parente" value={u.parentId} onChange={(e) => setU({ ...u, parentId: e.target.value })} className={champ}>
              <option value="">Sans unité parente</option>
              {donnees.unites
                .filter((p) => p.estActive)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.chemin.join(' / ')}
                  </option>
                ))}
            </select>
            <select aria-label="Section analytique proposée" value={u.sectionAnalytiqueId} onChange={(e) => setU({ ...u, sectionAnalytiqueId: e.target.value })} className={champ}>
              <option value="">Sans section analytique</option>
              {donnees.sectionsProposables.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.plan} · {s.code} {s.intitule}
                </option>
              ))}
            </select>
            {donnees.sectionsTronquees && (
              <span className="text-warning">Sections tronquées · seules les 500 premières de chacun des 50 premiers plans sont proposées.</span>
            )}
            <button type="button" className="bg-sel text-white font-semibold px-3 py-1" disabled={envoi} onClick={creer}>
              Créer l&apos;unité
            </button>
          </div>
        )}
      </section>
      {donnees && <RattachementsDuSalarie salaries={salaries} unites={donnees.unites} peutEcrire={peutEcrire} onChange={relire} />}
    </div>
  );
}

function RattachementsDuSalarie({
  salaries,
  unites,
  peutEcrire,
  onChange,
}: {
  salaries: SalarieMin[];
  unites: Unite[];
  peutEcrire: boolean;
  onChange: () => void;
}) {
  const [salarieId, setSalarieId] = useState(salaries.length === 1 ? salaries[0].id : '');
  const { donnees, erreur, setErreur, relire } = useLecture(
    salarieId ? () => api.get<Historique>(`/personnel/salaries/${salarieId}/rattachements`) : null,
    `rattachements-${salarieId}`,
  );
  const { envoi, envoyer } = useEnvoi(() => {
    relire();
    onChange();
  }, setErreur);
  const [r, setR] = useState({ uniteId: '', dateEffet: '' });
  const [motifs, setMotifs] = useState<Record<string, string>>({});
  return (
    <section>
      <div className="font-semibold mb-1 flex items-center gap-1.5">
        Rattachement des salariés
        <Aide
          titre="Rattachement daté"
          texte="Un salarié se rattache à une unité à une date d'effet · une mutation est un rattachement nouveau, l'historique reste. Une saisie fausse s'annule avec son motif, et reste lue. Une unité en sommeil ne reçoit plus de rattachement."
          source="Règle d'OmegaX · aucun texte n'impose l'organisation interne"
        />
      </div>
      <select aria-label="Salarié" value={salarieId} onChange={(e) => setSalarieId(e.target.value)} className={champ}>
        <option value="">Salarié…</option>
        {salaries.map((s) => (
          <option key={s.id} value={s.id}>
            {nomDe(s)}
          </option>
        ))}
      </select>
      <Erreur m={erreur} />
      {salarieId && donnees === null && !erreur && <div className="text-text-dim mt-1">Lecture de l&apos;historique…</div>}
      {donnees && libelleListeBornee(donnees, donnees.rattachements.length, 'rattachements') && (
        <div className="text-warning">{libelleListeBornee(donnees, donnees.rattachements.length, 'rattachements')}</div>
      )}
      {donnees && donnees.rattachements.length === 0 && <div className="text-text-dim mt-1">Aucun rattachement · ce salarié n&apos;est rattaché à aucune unité.</div>}
      {donnees && donnees.rattachements.length > 0 && (
        <table className="w-full mt-1">
          <thead>
            <tr>
              <th className="text-left px-2 py-1">À partir du</th>
              <th className="text-left px-2 py-1">Unité</th>
              <th className="text-left px-2 py-1">Saisi par</th>
              <th className="px-2 py-1" />
            </tr>
          </thead>
          <tbody>
            {donnees.rattachements.map((x) => (
              <tr key={x.id} className={x.annuleLe ? 'text-text-dim line-through' : x.enVigueur ? 'font-semibold' : ''}>
                <td className="px-2 py-1">{x.dateEffet}</td>
                <td className="px-2 py-1">
                  {x.unite.code} · {x.unite.intitule}
                  {x.enVigueur && ' · en vigueur'}
                  {x.annuleLe && <span className="no-underline"> · annulé ({x.motifAnnulation})</span>}
                </td>
                <td className="px-2 py-1">{x.creePar}</td>
                <td className="px-2 py-1 text-right">
                  {peutEcrire && !x.annuleLe && (
                    <span className="inline-flex gap-1 items-center">
                      <input
                        aria-label="Motif de l'annulation"
                        placeholder="Motif"
                        value={motifs[x.id] ?? ''}
                        onChange={(e) => setMotifs({ ...motifs, [x.id]: e.target.value })}
                        className={`${champ} w-[160px]`}
                      />
                      <button
                        type="button"
                        className="text-danger hover:underline"
                        disabled={envoi || (motifs[x.id] ?? '').trim().length < 3}
                        onClick={() => void envoyer(() => api.post(`/personnel/rattachements/${x.id}/annulation`, { motif: motifs[x.id] }))}
                      >
                        Annuler
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {peutEcrire && salarieId && donnees && (
        <div className="flex flex-wrap gap-1.5 mt-2 items-center">
          <select aria-label="Unité du rattachement" value={r.uniteId} onChange={(e) => setR({ ...r, uniteId: e.target.value })} className={champ}>
            <option value="">Unité…</option>
            {unites
              .filter((x) => x.estActive)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.chemin.join(' / ')}
                </option>
              ))}
          </select>
          <input aria-label="Date d'effet du rattachement" type="date" value={r.dateEffet} onChange={(e) => setR({ ...r, dateEffet: e.target.value })} className={champ} />
          <button
            type="button"
            className="bg-sel text-white font-semibold px-3 py-1"
            disabled={envoi || !r.uniteId || !r.dateEffet}
            onClick={() =>
              void envoyer(async () => {
                await api.post(`/personnel/salaries/${salarieId}/rattachements`, r);
                setR({ uniteId: '', dateEffet: '' });
              })
            }
          >
            Rattacher
          </button>
        </div>
      )}
    </section>
  );
}
