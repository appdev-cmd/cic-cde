import React, { useEffect, useState } from 'react';
import { ListChecks, Plus, X, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { fetchTasks, addTask, updateTaskStatus, deleteTask, type DeliveryTask } from '../../lib/api/tasks';

interface TasksTabProps { projectId?: string; }

const STATUSES = ['Chưa bắt đầu', 'Đang làm', 'Hoàn thành'];
const statusColor = (s: string) =>
  s === 'Hoàn thành' ? 'bg-success/10 text-success border-success/20'
  : s === 'Đang làm' ? 'bg-warning/10 text-warning border-warning/20'
  : 'bg-surface-container text-on-surface-variant border-outline-variant/30';

const isOverdue = (t: DeliveryTask) => t.status !== 'Hoàn thành' && t.dueDate && new Date(t.dueDate) < new Date(new Date().toDateString());

export function TasksTab({ projectId }: TasksTabProps) {
  const [tasks, setTasks] = useState<DeliveryTask[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', discipline: '', format: 'IFC', milestone: '', dueDate: '', assignee: '' });

  useEffect(() => {
    if (projectId) fetchTasks(projectId).then(setTasks).catch(e => console.error(e));
  }, [projectId]);

  const handleAdd = async () => {
    if (!projectId || !form.title.trim()) { alert('Nhập tên sản phẩm/nhiệm vụ.'); return; }
    const t = await addTask(projectId, { ...form, status: 'Chưa bắt đầu' });
    if (t) setTasks(prev => [...prev, t]);
    setForm({ title: '', discipline: '', format: 'IFC', milestone: '', dueDate: '', assignee: '' });
    setAdding(false);
  };
  const cycleStatus = (t: DeliveryTask) => {
    const next = STATUSES[(STATUSES.indexOf(t.status) + 1) % STATUSES.length];
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: next } : x));
    updateTaskStatus(t.id, next);
  };
  const handleDelete = async (id: string) => { await deleteTask(id); setTasks(prev => prev.filter(t => t.id !== id)); };

  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'Hoàn thành').length;
  const overdue = tasks.filter(isOverdue).length;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-surface-container-lowest p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks size={20} className="text-primary" />
            <div>
              <h2 className="text-lg font-bold text-on-surface">Kế hoạch bàn giao thông tin & Nhiệm vụ</h2>
              <p className="text-[12px] text-on-surface-variant">MIDP/TIDP — danh mục thông tin cần bàn giao, người phụ trách, thời hạn.</p>
            </div>
          </div>
          <button onClick={() => setAdding(true)} className="bg-primary text-on-primary font-bold text-xs px-4 py-2 rounded-lg hover:bg-primary/95 flex items-center gap-1.5">
            <Plus size={14} /> Thêm nhiệm vụ
          </button>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Tổng nhiệm vụ', value: total, color: 'text-on-surface', icon: <ListChecks size={16} className="text-outline" /> },
            { label: 'Hoàn thành', value: done, color: 'text-success', icon: <CheckCircle2 size={16} className="text-success" /> },
            { label: 'Trễ hạn', value: overdue, color: 'text-error', icon: <AlertTriangle size={16} className="text-error" /> },
          ].map(k => (
            <div key={k.label} className="bg-surface border border-outline-variant/50 rounded-xl p-4 flex items-center justify-between">
              <div><div className="text-[10px] font-bold text-outline uppercase tracking-wider">{k.label}</div><div className={`text-2xl font-extrabold mt-0.5 ${k.color}`}>{k.value}</div></div>
              {k.icon}
            </div>
          ))}
        </div>

        {adding && (
          <div className="bg-surface border border-outline-variant/60 rounded-xl p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Tên sản phẩm/thông tin *" className="col-span-2 md:col-span-3 px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-medium focus:outline-none focus:border-primary" />
            <input value={form.discipline} onChange={e => setForm({ ...form, discipline: e.target.value })} placeholder="Bộ môn" className="px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs focus:outline-none focus:border-primary" />
            <select value={form.format} onChange={e => setForm({ ...form, format: e.target.value })} className="px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-medium cursor-pointer focus:outline-none focus:border-primary">
              {['IFC', 'PDF', 'DWG', 'COBie', 'Office'].map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <input value={form.milestone} onChange={e => setForm({ ...form, milestone: e.target.value })} placeholder="Mốc bàn giao" className="px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs focus:outline-none focus:border-primary" />
            <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs focus:outline-none focus:border-primary" />
            <input value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })} placeholder="Người phụ trách" className="px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs focus:outline-none focus:border-primary" />
            <div className="col-span-2 md:col-span-3 flex gap-2 justify-end">
              <button onClick={() => setAdding(false)} className="text-xs font-bold text-on-surface-variant px-3 py-2">Hủy</button>
              <button onClick={handleAdd} className="bg-primary text-on-primary text-xs font-bold px-4 py-2 rounded-lg">Lưu</button>
            </div>
          </div>
        )}

        {/* Bảng nhiệm vụ */}
        <div className="bg-surface border border-outline-variant/50 rounded-xl overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-surface-container">
              <tr className="text-[10px] uppercase tracking-wider text-outline">
                <th className="text-left font-bold py-2.5 px-3">Sản phẩm / Thông tin</th>
                <th className="text-left font-bold py-2.5 px-2">Bộ môn</th>
                <th className="text-center font-bold py-2.5 px-2">Định dạng</th>
                <th className="text-left font-bold py-2.5 px-2">Mốc</th>
                <th className="text-center font-bold py-2.5 px-2">Thời hạn</th>
                <th className="text-left font-bold py-2.5 px-2">Phụ trách</th>
                <th className="text-center font-bold py-2.5 px-2">Trạng thái</th>
                <th className="py-2.5 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-on-surface-variant text-xs">Chưa có nhiệm vụ. Bấm "Thêm nhiệm vụ".</td></tr>
              ) : tasks.map(t => (
                <tr key={t.id} className="border-t border-outline-variant/30 hover:bg-surface-container/30">
                  <td className="py-2 px-3 font-semibold text-on-surface">{t.title}</td>
                  <td className="py-2 px-2 text-on-surface-variant">{t.discipline}</td>
                  <td className="py-2 px-2 text-center"><span className="text-[10px] font-bold bg-surface-container px-1.5 py-0.5 rounded">{t.format}</span></td>
                  <td className="py-2 px-2 text-on-surface-variant">{t.milestone}</td>
                  <td className={`py-2 px-2 text-center font-mono ${isOverdue(t) ? 'text-error font-bold' : 'text-on-surface-variant'}`}>
                    {t.dueDate ? new Date(t.dueDate).toLocaleDateString('vi-VN') : '—'}
                    {isOverdue(t) && <AlertTriangle size={11} className="inline ml-1 -mt-0.5" />}
                  </td>
                  <td className="py-2 px-2 text-on-surface-variant">{t.assignee}</td>
                  <td className="py-2 px-2 text-center">
                    <button onClick={() => cycleStatus(t)} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor(t.status)}`} title="Bấm để đổi trạng thái">
                      {t.status}
                    </button>
                  </td>
                  <td className="py-2 px-2 text-right"><button onClick={() => handleDelete(t.id)} className="text-on-surface-variant hover:text-error"><X size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10.5px] text-outline leading-relaxed flex items-center gap-1">
          <Clock size={12} /> Bấm nhãn trạng thái để chuyển: Chưa bắt đầu → Đang làm → Hoàn thành. Nhiệm vụ quá hạn được tô đỏ.
        </p>
      </div>
    </div>
  );
}
