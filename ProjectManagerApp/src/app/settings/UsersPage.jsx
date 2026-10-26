import { CloudUpload, LogIn, MailPlus, UserMinus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useI18n } from '../../i18n/useI18n.js';
import { useProject } from '../../state/projectContext.js';
import {
  cancelInvite,
  inviteMember,
  listInvites,
  listMembers,
  listOrgMembers,
  refreshAccount,
  removeMember,
  removeOrgMember,
  setMemberRole,
  setOrgRole,
} from '../../sync/account.js';
import { isSignedIn } from '../../sync/session.js';
import { Button, Card, ConfirmDialog, EmptyState, Field, IconButton, Input, Select, StatusBadge, useToast } from '../../ui/index.js';
import { ROLES, actionsFor, can } from '../../utils/permissions.js';
import { Page } from '../Page.jsx';
import { useServerConfig, useSession } from '../account/useAccount.js';
import a from '../account/Account.module.css';
import s from './Settings.module.css';

/** The project's members, and (when allowed) the company members and open invitations. */
const fetchPeople = async ({ serverId, orgId, manage, manageOrg }) => {
  const out = { members: [], orgMembers: [], invites: [], error: '' };
  const res = await listMembers(serverId);
  if (res.ok) out.members = res.members;
  else out.error = res.code;
  if (manageOrg && orgId) {
    const org = await listOrgMembers(orgId);
    if (org.ok) out.orgMembers = org.members;
  }
  if (manage && orgId) {
    const inv = await listInvites(orgId);
    if (inv.ok) out.invites = inv.invites.filter((i) => i.projectId === serverId || i.projectId === null);
  }
  return out;
};

function RoleSelect({ value, onChange, label, disabled }) {
  const { t } = useI18n();
  return (
    <Select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {ROLES.map((role) => (
        <option key={role} value={role}>
          {t(`account.role.${role}`)}
        </option>
      ))}
    </Select>
  );
}

/** A list of people with a role each; editable when `manage`. */
function MemberList({ members, me, manage, onRole, onRemove }) {
  const { t } = useI18n();
  if (members.length === 0) return <p className={s.muted}>{t('account.membersEmpty')}</p>;
  return (
    <div className={a.memberList}>
      {members.map((m) => (
        <div key={m.userId} className={a.member}>
          <div className={a.memberText}>
            <span className={a.memberName}>
              {m.name || m.email}
              {m.userId === me ? ` (${t('account.you')})` : ''}
            </span>
            <span className={a.memberEmail} dir="ltr">
              {m.email}
            </span>
          </div>
          <div className={a.memberRole}>
            {manage ? (
              <RoleSelect value={m.role} label={`${t('account.inviteRole')} — ${m.name || m.email}`} onChange={(role) => onRole(m, role)} />
            ) : (
              <StatusBadge tone="neutral">{t(`account.role.${m.role}`)}</StatusBadge>
            )}
          </div>
          {manage && <IconButton icon={UserMinus} label={`${t('account.removeMember')} — ${m.name || m.email}`} onClick={() => onRemove(m)} />}
        </div>
      ))}
    </div>
  );
}

function RolesCard() {
  const { t } = useI18n();
  return (
    <Card title={t('account.rolesTitle')} titleAs="h2" padding="md" className={s.wide}>
      <div className={a.roles}>
        {ROLES.map((role) => (
          <section key={role} className={a.roleCard}>
            <h3>{t(`account.role.${role}`)}</h3>
            <ul>
              {actionsFor(role).map((action) => (
                <li key={action}>{t(`account.action.${action}`)}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  );
}

/**
 * /settings/users — the people of the open project and their roles; an
 * admin invites by e-mail, changes roles and removes members, and manages
 * the company roles. Needs a signed-in account and a shared project.
 */
export default function UsersPage() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const { project } = useProject();
  const session = useSession();
  const config = useServerConfig();
  const signedIn = isSignedIn(session, config);
  const serverId = project?.serverId && !project.revoked ? project.serverId : null;
  const orgId = session.org?.id || null;
  const projectRole = serverId ? session.projectRoles[serverId] : null;
  const manage = can(projectRole, 'members.manage');
  const manageOrg = can(session.org?.role, 'members.manage');

  const [members, setMembers] = useState([]);
  const [orgMembers, setOrgMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [draft, setDraft] = useState({ email: '', role: 'site' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // { kind: 'project' | 'org', member }

  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!signedIn || !serverId) return undefined;
    let ignore = false;
    fetchPeople({ serverId, orgId, manage, manageOrg }).then((res) => {
      if (ignore) return;
      setMembers(res.members);
      setOrgMembers(res.orgMembers);
      setInvites(res.invites);
      if (res.error) setError(res.error);
    });
    return () => {
      ignore = true;
    };
  }, [signedIn, serverId, orgId, manage, manageOrg, version]);

  const act = async (fn, done) => {
    setBusy(true);
    setError('');
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setError(res.code);
      return res;
    }
    if (done) toast({ title: typeof done === 'function' ? done(res) : done });
    await refreshAccount();
    setVersion((n) => n + 1);
    return res;
  };

  const invite = (e) => {
    e.preventDefault();
    act(
      () => inviteMember({ orgId, serverId, email: draft.email, role: draft.role }),
      (res) => t(res.status === 'invited' ? 'account.inviteSent' : 'account.inviteAdded', { email: draft.email.trim().toLowerCase() })
    ).then((res) => res.ok && setDraft({ ...draft, email: '' }));
  };

  if (!signedIn) {
    return (
      <Page area="settings">
        <Card padding="md">
          <EmptyState
            icon={LogIn}
            title={t('account.tabUsers')}
            body={t('account.usersNeedSignIn')}
            action={
              <Button variant="primary" icon={LogIn} onClick={() => navigate('/login?next=/settings/users')}>
                {t('account.signInToServer')}
              </Button>
            }
          />
        </Card>
      </Page>
    );
  }

  if (!serverId) {
    return (
      <Page area="settings">
        <div className={s.grid}>
          <Card padding="md" className={s.wide}>
            <EmptyState
              icon={CloudUpload}
              title={t('account.tabUsers')}
              body={t('account.usersNotShared')}
              action={
                <Button as={Link} to="/settings/server" variant="primary" icon={CloudUpload}>
                  {t('account.uploadTitle')}
                </Button>
              }
            />
          </Card>
          <RolesCard />
        </div>
      </Page>
    );
  }

  const errorBox = error ? (
    <p className={a.error} role="alert">
      {t(`account.err.${error}`)}
    </p>
  ) : null;

  return (
    <Page area="settings">
      <div className={s.grid}>
        <Card title={t('account.members')} subtitle={t('account.usersLead')} titleAs="h2" padding="md" className={s.wide}>
          <div className={s.rows}>
            <MemberList
              members={members}
              me={session.user.id}
              manage={manage}
              onRole={(m, role) => act(() => setMemberRole(serverId, m.userId, role), t('account.roleChanged'))}
              onRemove={(m) => setConfirm({ kind: 'project', member: m })}
            />
            {!manage && <p className={s.muted}>{t('account.usersNoRight')}</p>}
            {manage && (
              <form className={a.inviteRow} onSubmit={invite}>
                <Field label={t('account.email')}>
                  <Input type="email" dir="ltr" inputMode="email" required placeholder={t('account.inviteEmailPh')} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                </Field>
                <Field label={t('account.inviteRole')}>
                  <RoleSelect value={draft.role} label={t('account.inviteRole')} onChange={(role) => setDraft({ ...draft, role })} />
                </Field>
                <Button type="submit" variant="primary" icon={MailPlus} disabled={busy || !draft.email.trim()}>
                  {t('account.invite')}
                </Button>
              </form>
            )}
            {errorBox}
            {manage && invites.length > 0 && (
              <>
                <h3 className={s.label}>{t('account.invites')}</h3>
                <div className={a.memberList}>
                  {invites.map((inv) => (
                    <div key={inv.id} className={a.member}>
                      <div className={a.memberText}>
                        <span className={a.memberEmail} dir="ltr">
                          {inv.email}
                        </span>
                      </div>
                      <StatusBadge tone="neutral">{t(`account.role.${inv.role}`)}</StatusBadge>
                      <IconButton icon={X} label={`${t('account.cancelInvite')} — ${inv.email}`} onClick={() => act(() => cancelInvite(inv.id))} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>

        {manageOrg && (
          <Card title={t('account.orgMembers')} subtitle={t('account.orgMembersLead')} titleAs="h2" padding="md" className={s.wide}>
            <MemberList
              members={orgMembers}
              me={session.user.id}
              manage
              onRole={(m, role) => act(() => setOrgRole(orgId, m.userId, role), t('account.roleChanged'))}
              onRemove={(m) => setConfirm({ kind: 'org', member: m })}
            />
          </Card>
        )}

        <RolesCard />
      </div>
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm ? t(confirm.kind === 'org' ? 'account.removeOrgTitle' : 'account.removeTitle', { name: confirm.member.name || confirm.member.email }) : ''}
        message={confirm ? t(confirm.kind === 'org' ? 'account.removeOrgBody' : 'account.removeBody') : ''}
        confirmLabel={t('account.removeMember')}
        tone="danger"
        onConfirm={() => {
          const { kind, member } = confirm;
          act(() => (kind === 'org' ? removeOrgMember(orgId, member.userId) : removeMember(serverId, member.userId)));
        }}
      />
    </Page>
  );
}
