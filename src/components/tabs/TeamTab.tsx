import React, { useEffect, useState } from 'react';
import { Building2, Users, Plus, X, Mail, ShieldCheck, Lock } from 'lucide-react';
import {
  fetchOrgs, addOrg, deleteOrg, fetchMembers, addMember, deleteMember,
  fetchAccountMembers, fetchAllProfiles, upsertAccountMember, removeAccountMember,
  type ProjectOrg, type TeamMember, type AccountMember, type AppProfile,
} from '../../lib/api/team';
import { PROJECT_ROLES, roleLabel, isAdmin } from '../../lib/roles';

interface TeamTabProps { projectId?: string; userRole?: string; }

export function TeamTab({ projectId, userRole }: TeamTabProps) {
  const canManage = isAdmin(userRole);
  const [orgs, setOrgs] = useState<ProjectOrg[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [accounts, setAccounts] = useState<AccountMember[]>([]);
  const [profiles, setProfiles] = useState<AppProfile[]>([]);
  const [addingOrg, setAddingOrg] = useState(false);
  const [addingMem, setAddingMem] = useState(false);
  const [addingAcc, setAddingAcc] = useState(false);
  const [accForm, setAccForm] = useState({ userId: '', role: 'Author' });
  const [orgForm, setOrgForm] = useState({ name: '', role: 'Tư vấn thiết kế', discipline: '', contactPerson: '', contactEmail: '' });
  const [memForm, setMemForm] = useState({ name: '', email: '', role: 'Author', organization: '', discipline: '' });

  useEffect(() => {
    if (!projectId) return;
    fetchOrgs(projectId).then(setOrgs).catch(e => console.error(e));
    fetchMembers(projectId).then(setMembers).catch(e => console.error(e));
    fetchAccountMembers(projectId).then(setAccounts).catch(e => console.error(e));
    if (isAdmin(userRole)) fetchAllProfiles().then(setProfiles).catch(e => console.error(e));
  }, [projectId, userRole]);

  // ---- Phân quyền tài khoản (RBAC) ----
  const handleAddAccount = async () => {
    if (!projectId || !accForm.userId) { alert('Chọn tài khoản.'); return; }
    try {
      await upsertAccountMember(projectId, accForm.userId, accForm.role);
      setAccounts(await fetchAccountMembers(projectId));
      setAccForm({ userId: '', role: 'Author' });
      setAddingAcc(false);
    } catch (e: any) { alert('Không gán được quyền: ' + (e?.message ?? e)); }
  };
  const handleChangeAccountRole = async (userId: string, role: string) => {
    if (!projectId) return;
    try {
      await upsertAccountMember(projectId, userId, role);
      setAccounts(prev => prev.map(a => a.userId === userId ? { ...a, role } : a));
    } catch (e: any) { alert('Không đổi được vai trò: ' + (e?.message ?? e)); }
  };
  const handleRemoveAccount = async (userId: string) => {
    if (!projectId) return;
    try { await removeAccountMember(projectId, userId); setAccounts(prev => prev.filter(a => a.userId !== userId)); }
    catch (e: any) { alert('Không gỡ được thành viên: ' + (e?.message ?? e)); }
  };
  const assignedIds = new Set(accounts.map(a => a.userId));

  const handleAddOrg = async () => {
    if (!projectId || !orgForm.name.trim()) { alert('Nhập tên đơn vị.'); return; }
    const o = await addOrg(projectId, orgForm);
    if (o) setOrgs(prev => [...prev, o]);
    setOrgForm({ name: '', role: 'Tư vấn thiết kế', discipline: '', contactPerson: '', contactEmail: '' });
    setAddingOrg(false);
  };
  const handleAddMem = async () => {
    if (!projectId || !memForm.name.trim()) { alert('Nhập tên thành viên.'); return; }
    const m = await addMember(projectId, memForm);
    if (m) setMembers(prev => [...prev, m]);
    setMemForm({ name: '', email: '', role: 'Author', organization: '', discipline: '' });
    setAddingMem(false);
  };
  const delOrg = async (id: string) => { await deleteOrg(id); setOrgs(prev => prev.filter(o => o.id !== id)); };
  const delMem = async (id: string) => { await deleteMember(id); setMembers(prev => prev.filter(m => m.id !== id)); };

  const inputCls = "px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs focus:outline-none focus:border-primary";

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-surface-container-lowest p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-lg font-bold text-on-surface flex items-center gap-2"><Users size={20} className="text-primary" /> Đơn vị & Thành viên tham gia dự án</h2>
          <p className="text-[12px] text-on-surface-variant mt-0.5">Danh sách các tổ chức và nhân sự tham gia, vai trò và bộ môn phụ trách.</p>
        </div>

        {/* PHÂN QUYỀN TÀI KHOẢN (RBAC) */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5"><ShieldCheck size={14} /> Phân quyền tài khoản ({accounts.length})</h3>
            {canManage ? (
              <button onClick={() => setAddingAcc(v => !v)} className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"><Plus size={12} /> Gán quyền tài khoản</button>
            ) : (
              <span className="text-[10px] text-on-surface-variant flex items-center gap-1"><Lock size={11} /> Chỉ Quản trị gán quyền</span>
            )}
          </div>
          <p className="text-[11px] text-on-surface-variant">Tài khoản thật có hiệu lực quyền trong dự án (RBAC). Chỉ <b>Approver/Manager</b> được phát hành, <b>Checker/Approver/Manager</b> được phê duyệt.</p>
          {canManage && addingAcc && (
            <div className="bg-surface border border-outline-variant/60 rounded-xl p-3 grid grid-cols-2 md:grid-cols-3 gap-2">
              <select value={accForm.userId} onChange={e => setAccForm({ ...accForm, userId: e.target.value })} className={`col-span-2 md:col-span-1 ${inputCls} cursor-pointer`}>
                <option value="">— Chọn tài khoản —</option>
                {profiles.filter(p => !assignedIds.has(p.id)).map(p => <option key={p.id} value={p.id}>{p.fullName || p.email || p.id.slice(0, 8)}{p.email ? ` (${p.email})` : ''}</option>)}
              </select>
              <select value={accForm.role} onChange={e => setAccForm({ ...accForm, role: e.target.value })} className={`${inputCls} cursor-pointer`}>
                {PROJECT_ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
              <div className="flex gap-2 justify-end items-center"><button onClick={() => setAddingAcc(false)} className="text-xs font-bold text-on-surface-variant">Hủy</button><button onClick={handleAddAccount} className="bg-primary text-on-primary text-xs font-bold px-3 py-2 rounded-lg">Gán</button></div>
            </div>
          )}
          <div className="bg-surface border border-outline-variant/50 rounded-xl overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-surface-container"><tr className="text-[10px] uppercase tracking-wider text-outline">
                <th className="text-left font-bold py-2.5 px-3">Tài khoản</th>
                <th className="text-left font-bold py-2.5 px-2">Email</th>
                <th className="text-left font-bold py-2.5 px-2">Vai trò (RBAC)</th>
                <th className="py-2.5 px-2"></th>
              </tr></thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-6 text-on-surface-variant text-xs">Chưa gán quyền cho tài khoản nào.</td></tr>
                ) : accounts.map(a => (
                  <tr key={a.userId} className="border-t border-outline-variant/30 hover:bg-surface-container/30">
                    <td className="py-2 px-3 font-semibold text-on-surface">{a.fullName}</td>
                    <td className="py-2 px-2 text-on-surface-variant font-mono text-[11px]">{a.email}</td>
                    <td className="py-2 px-2">
                      {canManage ? (
                        <select value={PROJECT_ROLES.includes(a.role as any) ? a.role : 'Viewer'} onChange={e => handleChangeAccountRole(a.userId, e.target.value)} className="bg-surface-container border border-outline-variant/60 rounded-md px-2 py-1 text-[11px] font-semibold cursor-pointer">
                          {PROJECT_ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                        </select>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{roleLabel(a.role)}</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">{canManage && <button onClick={() => handleRemoveAccount(a.userId)} className="text-on-surface-variant hover:text-error"><X size={13} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ĐƠN VỊ */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5"><Building2 size={14} /> Đơn vị tham gia ({orgs.length})</h3>
            <button onClick={() => setAddingOrg(v => !v)} className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"><Plus size={12} /> Thêm đơn vị</button>
          </div>
          {addingOrg && (
            <div className="bg-surface border border-outline-variant/60 rounded-xl p-3 grid grid-cols-2 md:grid-cols-3 gap-2">
              <input value={orgForm.name} onChange={e => setOrgForm({ ...orgForm, name: e.target.value })} placeholder="Tên đơn vị *" className={`col-span-2 md:col-span-1 ${inputCls}`} />
              <select value={orgForm.role} onChange={e => setOrgForm({ ...orgForm, role: e.target.value })} className={`${inputCls} cursor-pointer`}>
                {['Chủ đầu tư', 'Sở xây dựng', 'Tư vấn thiết kế', 'Tư vấn thẩm tra', 'Tư vấn giám sát', 'Tư vấn BIM', 'Nhà thầu thi công', 'Khác'].map(r => <option key={r}>{r}</option>)}
              </select>
              <input value={orgForm.discipline} onChange={e => setOrgForm({ ...orgForm, discipline: e.target.value })} placeholder="Bộ môn" className={inputCls} />
              <input value={orgForm.contactPerson} onChange={e => setOrgForm({ ...orgForm, contactPerson: e.target.value })} placeholder="Người liên hệ" className={inputCls} />
              <input value={orgForm.contactEmail} onChange={e => setOrgForm({ ...orgForm, contactEmail: e.target.value })} placeholder="Email" className={inputCls} />
              <div className="flex gap-2 justify-end items-center"><button onClick={() => setAddingOrg(false)} className="text-xs font-bold text-on-surface-variant">Hủy</button><button onClick={handleAddOrg} className="bg-primary text-on-primary text-xs font-bold px-3 py-2 rounded-lg">Lưu</button></div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {orgs.map(o => (
              <div key={o.id} className="bg-surface border border-outline-variant/50 rounded-xl p-4 group relative">
                <button onClick={() => delOrg(o.id)} className="absolute top-3 right-3 text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100"><X size={13} /></button>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">{o.name.slice(0, 2).toUpperCase()}</div>
                  <div className="min-w-0"><div className="font-bold text-[13px] text-on-surface truncate">{o.name}</div><div className="text-[10.5px] text-primary font-semibold">{o.role}</div></div>
                </div>
                {o.discipline && <div className="text-[11px] text-on-surface-variant">Bộ môn: {o.discipline}</div>}
                {o.contactPerson && <div className="text-[11px] text-on-surface-variant">Liên hệ: {o.contactPerson}</div>}
                {o.contactEmail && <div className="text-[11px] text-outline flex items-center gap-1"><Mail size={11} /> {o.contactEmail}</div>}
              </div>
            ))}
            {orgs.length === 0 && <div className="text-xs text-on-surface-variant col-span-full py-4 text-center">Chưa có đơn vị.</div>}
          </div>
        </section>

        {/* THÀNH VIÊN */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5"><Users size={14} /> Thành viên ({members.length})</h3>
            <button onClick={() => setAddingMem(v => !v)} className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"><Plus size={12} /> Thêm thành viên</button>
          </div>
          {addingMem && (
            <div className="bg-surface border border-outline-variant/60 rounded-xl p-3 grid grid-cols-2 md:grid-cols-3 gap-2">
              <input value={memForm.name} onChange={e => setMemForm({ ...memForm, name: e.target.value })} placeholder="Họ tên *" className={inputCls} />
              <input value={memForm.email} onChange={e => setMemForm({ ...memForm, email: e.target.value })} placeholder="Email" className={inputCls} />
              <select value={memForm.role} onChange={e => setMemForm({ ...memForm, role: e.target.value })} className={`${inputCls} cursor-pointer`}>
                {PROJECT_ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
              <input value={memForm.organization} onChange={e => setMemForm({ ...memForm, organization: e.target.value })} placeholder="Đơn vị" className={inputCls} />
              <input value={memForm.discipline} onChange={e => setMemForm({ ...memForm, discipline: e.target.value })} placeholder="Bộ môn" className={inputCls} />
              <div className="flex gap-2 justify-end items-center"><button onClick={() => setAddingMem(false)} className="text-xs font-bold text-on-surface-variant">Hủy</button><button onClick={handleAddMem} className="bg-primary text-on-primary text-xs font-bold px-3 py-2 rounded-lg">Lưu</button></div>
            </div>
          )}
          <div className="bg-surface border border-outline-variant/50 rounded-xl overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-surface-container"><tr className="text-[10px] uppercase tracking-wider text-outline">
                <th className="text-left font-bold py-2.5 px-3">Họ tên</th>
                <th className="text-left font-bold py-2.5 px-2">Email</th>
                <th className="text-left font-bold py-2.5 px-2">Vai trò</th>
                <th className="text-left font-bold py-2.5 px-2">Đơn vị</th>
                <th className="text-left font-bold py-2.5 px-2">Bộ môn</th>
                <th className="py-2.5 px-2"></th>
              </tr></thead>
              <tbody>
                {members.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-on-surface-variant text-xs">Chưa có thành viên.</td></tr>
                ) : members.map(m => (
                  <tr key={m.id} className="border-t border-outline-variant/30 hover:bg-surface-container/30">
                    <td className="py-2 px-3 font-semibold text-on-surface flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-[10px] shrink-0">{m.name.split(' ').map(w => w[0]).slice(-2).join('')}</div>
                      {m.name}
                    </td>
                    <td className="py-2 px-2 text-on-surface-variant font-mono text-[11px]">{m.email}</td>
                    <td className="py-2 px-2"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{roleLabel(m.role)}</span></td>
                    <td className="py-2 px-2 text-on-surface-variant">{m.organization}</td>
                    <td className="py-2 px-2 text-on-surface-variant">{m.discipline}</td>
                    <td className="py-2 px-2 text-right"><button onClick={() => delMem(m.id)} className="text-on-surface-variant hover:text-error"><X size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
