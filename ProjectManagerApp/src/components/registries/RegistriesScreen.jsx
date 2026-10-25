import { useState } from 'react';
import './RegistriesScreen.css';
import {
  loadRegistries,
  saveRegistries,
  addContractor,
  updateContractor,
  deleteContractor,
  addTeam,
  updateTeam,
  deleteTeam,
  addWorker,
  updateWorker,
  deleteWorker,
} from '../../utils/Registries';
import { loadIdentity } from '../../utils/Identity';
import { useI18n } from '../../i18n/useI18n.js';
import IdentityPicker from './IdentityPicker';

const TABS = [
  { id: 'contractors', labelKey: 'registries.tabContractors' },
  { id: 'teams', labelKey: 'registries.tabTeams' },
  { id: 'workers', labelKey: 'registries.tabWorkers' },
];

const TRADE_SUGGESTION_KEYS = [
  'registries.tradeGeneral',
  'registries.tradeHelper',
  'registries.tradeSteelFixer',
  'registries.tradeFormworkFixer',
  'registries.tradeCarpenter',
  'registries.tradeElectrician',
  'registries.tradeWelder',
  'registries.tradeMechanic',
  'registries.tradeDriver',
  'registries.tradeSurveyor',
  'registries.tradeLabTechnician',
  'registries.tradeInspector',
];

const toNumOrEmpty = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : '';
};

// A team's defaultSize is "auto" while it equals its member count; the
// moment the user types a different value it becomes manual. Clearing
// the size input (or the ↻ button) returns it to automatic.
const isAutoSized = (team) => team.defaultSize === team.memberWorkerIds.length;

// After members change indirectly (worker deletion), keep teams that
// were auto-sized still tracking their new member count.
const syncAutoTeams = (teamsBefore, teamsAfter) =>
  teamsAfter.map((after) => {
    const before = teamsBefore.find((t) => t.id === after.id);
    return before && isAutoSized(before) ? { ...after, defaultSize: after.memberWorkerIds.length } : after;
  });

const RegistriesScreen = ({ onChange }) => {
  const { t, dir } = useI18n();
  const [registries, setRegistries] = useState(loadRegistries);
  const [activeTab, setActiveTab] = useState('contractors');
  const [identity, setIdentity] = useState(loadIdentity);
  const [identityOpen, setIdentityOpen] = useState(false);

  // Every mutation flows through commit: update state, persist, notify.
  const commit = (next) => {
    setRegistries(next);
    saveRegistries(next);
    onChange?.(next);
  };

  /* ---------- contractors ---------- */
  const handleAddContractor = () => commit(addContractor(registries));

  const handleDeleteContractor = (contractor) => {
    const name = contractor.name || t('registries.unnamed');
    if (!window.confirm(t('registries.confirmDeleteContractor', { name }))) return;
    commit(deleteContractor(registries, contractor.id));
  };

  const patchContractor = (id, patch) => commit(updateContractor(registries, id, patch));

  /* ---------- workers ---------- */
  const handleAddWorker = () => commit(addWorker(registries));

  const handleDeleteWorker = (worker) => {
    const teamsUsing = registries.teams.filter(
      (t) => t.memberWorkerIds.includes(worker.id) || t.foremanWorkerId === worker.id
    ).length;
    const suffix =
      teamsUsing > 0 ? t('registries.confirmDeleteWorkerTeams', { count: teamsUsing }) : '';
    const name = worker.name || t('registries.unnamed');
    if (!window.confirm(t('registries.confirmDeleteWorker', { name }) + suffix)) return;
    const next = deleteWorker(registries, worker.id);
    commit({ ...next, teams: syncAutoTeams(registries.teams, next.teams) });
  };

  const patchWorker = (id, patch) => commit(updateWorker(registries, id, patch));

  /* ---------- teams ---------- */
  const handleAddTeam = () => commit(addTeam(registries, { name: t('registries.newTeam') }));

  const handleDeleteTeam = (team) => {
    const name = team.name || t('registries.unnamed');
    if (!window.confirm(t('registries.confirmDeleteTeam', { name }))) return;
    commit(deleteTeam(registries, team.id));
  };

  const patchTeam = (id, patch) => commit(updateTeam(registries, id, patch));

  const handleToggleMember = (team, workerId) => {
    const memberWorkerIds = team.memberWorkerIds.includes(workerId)
      ? team.memberWorkerIds.filter((id) => id !== workerId)
      : [...team.memberWorkerIds, workerId];
    const patch = isAutoSized(team) ? { memberWorkerIds, defaultSize: memberWorkerIds.length } : { memberWorkerIds };
    commit(updateTeam(registries, team.id, patch));
  };

  // Empty input → back to automatic; any typed value → manual.
  const handleTeamSizeInput = (team, value) => {
    if (value === '') {
      commit(updateTeam(registries, team.id, { defaultSize: team.memberWorkerIds.length }));
      return;
    }
    commit(updateTeam(registries, team.id, { defaultSize: toNumOrEmpty(value) }));
  };

  const counts = {
    contractors: registries.contractors.length,
    teams: registries.teams.length,
    workers: registries.workers.length,
  };

  const identityName = identity.name.trim();

  return (
    <div className="registries-screen" dir={dir}>
      {/* ── Header ── */}
      <div className="reg-header">
        <h2 className="reg-title">{t('registries.title')}</h2>
        <p className="reg-subtitle">{t('registries.subtitle')}</p>
      </div>

      {/* ── Summary strip ── */}
      <div className="reg-summary">
        <div className="reg-sum-card">
          <span className="reg-sum-label">{t('registries.tabContractors')}</span>
          <span className="reg-sum-value">{counts.contractors}</span>
        </div>
        <div className="reg-sum-card">
          <span className="reg-sum-label">{t('registries.tabTeams')}</span>
          <span className="reg-sum-value">{counts.teams}</span>
        </div>
        <div className="reg-sum-card">
          <span className="reg-sum-label">{t('registries.tabWorkers')}</span>
          <span className="reg-sum-value">{counts.workers}</span>
        </div>
        <div className="reg-sum-card">
          <span className="reg-sum-label">{t('registries.currentIdentity')}</span>
          <span className="reg-identity-name">{identityName || t('registries.identityUnset')}</span>
          <span className="reg-identity-role">
            {identity.role ? identity.role : t('registries.identityRoleHint')}
          </span>
          <button className="reg-btn ghost xs" onClick={() => setIdentityOpen(true)}>
            {identityName ? t('registries.change') : t('registries.identityPick')}
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="reg-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`reg-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {t(tab.labelKey)}
            <span className="reg-tab-count">{counts[tab.id]}</span>
          </button>
        ))}
      </div>

      {/* ── Contractors tab ── */}
      {activeTab === 'contractors' && (
        <div className="reg-section">
          <div className="reg-section-head">
            <h3>
              {t('registries.tabContractors')}<span className="reg-count"> ({counts.contractors})</span>
            </h3>
            <button className="reg-btn" onClick={handleAddContractor}>{t('registries.addContractor')}</button>
          </div>
          {counts.contractors === 0 ? (
            <div className="reg-empty">{t('registries.contractorsEmpty')}</div>
          ) : (
            <div className="reg-table-wrap">
              <table className="reg-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('registries.colContractorName')}</th>
                    <th>{t('registries.colPhone')}</th>
                    <th>{t('common.notes')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {registries.contractors.map((contractor, idx) => (
                    <tr key={contractor.id}>
                      <td className="reg-rownum">{idx + 1}</td>
                      <td>
                        <input
                          className="reg-input"
                          value={contractor.name || ''}
                          onChange={(e) => patchContractor(contractor.id, { name: e.target.value })}
                          placeholder={t('registries.contractorNamePh')}
                        />
                      </td>
                      <td>
                        <input
                          className="reg-input reg-input-phone"
                          value={contractor.phone || ''}
                          onChange={(e) => patchContractor(contractor.id, { phone: e.target.value })}
                          placeholder="07XX XXX XXXX"
                        />
                      </td>
                      <td>
                        <input
                          className="reg-input reg-input-notes"
                          value={contractor.notes || ''}
                          onChange={(e) => patchContractor(contractor.id, { notes: e.target.value })}
                          placeholder={t('registries.contractorNotesPh')}
                        />
                      </td>
                      <td>
                        <button
                          className="reg-icon-btn danger"
                          onClick={() => handleDeleteContractor(contractor)}
                          title={t('registries.deleteContractorTitle')}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Teams tab ── */}
      {activeTab === 'teams' && (
        <div className="reg-section">
          <div className="reg-section-head">
            <h3>
              {t('registries.tabTeams')}<span className="reg-count"> ({counts.teams})</span>
            </h3>
            <button className="reg-btn" onClick={handleAddTeam}>{t('registries.addTeam')}</button>
          </div>
          {counts.teams === 0 ? (
            <div className="reg-empty">{t('registries.teamsEmpty')}</div>
          ) : (
            <div className="reg-team-grid">
              {registries.teams.map((team) => {
                const auto = isAutoSized(team);
                return (
                  <div className="reg-team-card" key={team.id}>
                    <div className="reg-team-head">
                      <input
                        className="reg-input reg-team-name"
                        value={team.name || ''}
                        onChange={(e) => patchTeam(team.id, { name: e.target.value })}
                        placeholder={t('registries.teamNamePh')}
                      />
                      <button
                        className="reg-icon-btn danger"
                        onClick={() => handleDeleteTeam(team)}
                        title={t('registries.deleteTeamTitle')}
                      >
                        ✕
                      </button>
                    </div>

                    <div className="reg-team-row">
                      <label className="reg-label">{t('registries.colForeman')}</label>
                      <select
                        className="reg-select"
                        value={team.foremanWorkerId || ''}
                        onChange={(e) => patchTeam(team.id, { foremanWorkerId: e.target.value || null })}
                      >
                        <option value="">{t('registries.noForeman')}</option>
                        {registries.workers.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name || t('registries.unnamed')}{w.trade ? ` — ${w.trade}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="reg-team-row">
                      <label className="reg-label">
                        {t('registries.colMembers')}<span className="reg-count"> ({team.memberWorkerIds.length})</span>
                      </label>
                      {registries.workers.length === 0 ? (
                        <div className="reg-members-hint">{t('registries.noWorkersHint')}</div>
                      ) : (
                        <div className="reg-chips">
                          {registries.workers.map((w) => {
                            const active = team.memberWorkerIds.includes(w.id);
                            const foreman = team.foremanWorkerId === w.id;
                            return (
                              <button
                                key={w.id}
                                type="button"
                                className={`reg-chip ${active ? 'active' : ''} ${foreman ? 'foreman' : ''}`}
                                onClick={() => handleToggleMember(team, w.id)}
                                title={foreman ? t('registries.foremanChipTitle') : t('registries.memberChipTitle')}
                              >
                                {foreman ? '★ ' : ''}{w.name || t('registries.unnamed')}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="reg-team-row">
                      <label className="reg-label">{t('registries.colDefaultSize')}</label>
                      <div className="reg-size-control">
                        <input
                          className="reg-input reg-input-num"
                          type="number"
                          min="0"
                          value={team.defaultSize ?? 0}
                          onChange={(e) => handleTeamSizeInput(team, e.target.value)}
                          placeholder={String(team.memberWorkerIds.length)}
                          title={t('registries.sizeTitle')}
                        />
                        {auto ? (
                          <span className="reg-size-mode">{t('registries.sizeAuto')}</span>
                        ) : (
                          <button
                            className="reg-size-reset"
                            onClick={() => patchTeam(team.id, { defaultSize: team.memberWorkerIds.length })}
                            title={t('registries.sizeResetTitle')}
                          >
                            {t('registries.sizeReset')}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="reg-team-row">
                      <label className="reg-label">{t('common.notes')}</label>
                      <input
                        className="reg-input"
                        value={team.notes || ''}
                        onChange={(e) => patchTeam(team.id, { notes: e.target.value })}
                        placeholder={t('registries.teamNotesPh')}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Workers tab ── */}
      {activeTab === 'workers' && (
        <div className="reg-section">
          <div className="reg-section-head">
            <h3>
              {t('registries.tabWorkers')}<span className="reg-count"> ({counts.workers})</span>
            </h3>
            <button className="reg-btn" onClick={handleAddWorker}>{t('registries.addWorker')}</button>
          </div>
          {counts.workers === 0 ? (
            <div className="reg-empty">{t('registries.workersEmpty')}</div>
          ) : (
            <div className="reg-table-wrap">
              <table className="reg-table workers">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('common.name')}</th>
                    <th>{t('registries.colTrade')}</th>
                    <th>{t('registries.colDailyRate', { unit: t('registries.currencyUnit') })}</th>
                    <th>{t('registries.colPhone')}</th>
                    <th>{t('common.notes')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {registries.workers.map((worker, idx) => (
                    <tr key={worker.id}>
                      <td className="reg-rownum">{idx + 1}</td>
                      <td>
                        <input
                          className="reg-input"
                          value={worker.name || ''}
                          onChange={(e) => patchWorker(worker.id, { name: e.target.value })}
                          placeholder={t('registries.workerNamePh')}
                        />
                      </td>
                      <td>
                        <input
                          className="reg-input"
                          list="reg-trade-options"
                          value={worker.trade || ''}
                          onChange={(e) => patchWorker(worker.id, { trade: e.target.value })}
                          placeholder={t('registries.tradePh')}
                        />
                      </td>
                      <td className="reg-num">
                        <input
                          className="reg-input reg-input-num"
                          type="number"
                          min="0"
                          value={worker.dailyRate ?? ''}
                          onChange={(e) =>
                            patchWorker(worker.id, {
                              dailyRate: e.target.value === '' ? '' : toNumOrEmpty(e.target.value),
                            })
                          }
                          placeholder="0"
                          title={t('registries.dailyRateTitle')}
                        />
                      </td>
                      <td>
                        <input
                          className="reg-input reg-input-phone"
                          value={worker.phone || ''}
                          onChange={(e) => patchWorker(worker.id, { phone: e.target.value })}
                          placeholder="07XX XXX XXXX"
                        />
                      </td>
                      <td>
                        <input
                          className="reg-input reg-input-notes"
                          value={worker.notes || ''}
                          onChange={(e) => patchWorker(worker.id, { notes: e.target.value })}
                        />
                      </td>
                      <td>
                        <button
                          className="reg-icon-btn danger"
                          onClick={() => handleDeleteWorker(worker)}
                          title={t('registries.deleteWorkerTitle')}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="reg-trade-options">
                {TRADE_SUGGESTION_KEYS.map((key) => (
                  <option key={key} value={t(key)} />
                ))}
              </datalist>
            </div>
          )}
        </div>
      )}

      {/* ── Identity stub ── */}
      <IdentityPicker
        open={identityOpen}
        onClose={() => setIdentityOpen(false)}
        onSaved={(saved) => setIdentity(saved)}
      />
    </div>
  );
};

export default RegistriesScreen;
