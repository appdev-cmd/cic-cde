// Form no-code tạo bộ quy tắc riêng cho dự án. Người dùng ghép:
//   loại quy tắc → nhóm cấu kiện A/B (chọn IFC category + lọc thuộc tính) → ngưỡng → mức độ.
// Lưu thành 1 rule_set (is_preset=false, project_id) chứa 1..n rules.
import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, Loader2, Save, ChevronDown, ChevronRight } from 'lucide-react';
import {
  createRuleSet, createRule,
  type RuleParams, type PropertyFilter, type RuleSeverity, type ElementGroup,
} from '../../lib/api/ruleCheck';

interface RuleFormModalProps {
  projectId: string;
  getModelCategories?: () => { modelId: string; modelName: string; categories: string[] }[];
  onClose: () => void;
  onSaved: (newSetId: string) => void;
}

interface DraftRule {
  key: string;
  name: string;
  ruleType: 'clash' | 'clearance';
  groupA: ElementGroup;
  groupB: ElementGroup;
  threshold: number; // tolerance (clash) hoặc minDistance (clearance)
  severity: RuleSeverity;
}

const emptyGroup = (): ElementGroup => ({ categories: [], propertyFilters: [] });
const newDraft = (): DraftRule => ({
  key: Math.random().toString(36).slice(2),
  name: '', ruleType: 'clash',
  groupA: emptyGroup(), groupB: emptyGroup(),
  threshold: 0.01, severity: 'medium',
});

const OP_LABEL: Record<PropertyFilter['op'], string> = {
  eq: '=', neq: '≠', contains: 'chứa', gt: '>', lt: '<', exists: 'tồn tại',
};

export function RuleFormModal({ projectId, getModelCategories, onClose, onSaved }: RuleFormModalProps) {
  const [setName, setSetName] = useState('');
  const [standardRef, setStandardRef] = useState('');
  const [drafts, setDrafts] = useState<DraftRule[]>([newDraft()]);
  const [saving, setSaving] = useState(false);

  // Union IFC category từ các mô hình đang nạp (nếu không có → để trống, người dùng gõ tay)
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    (getModelCategories?.() ?? []).forEach(m => m.categories.forEach(c => set.add(c)));
    return Array.from(set).sort();
  }, [getModelCategories]);

  const updateDraft = (key: string, patch: Partial<DraftRule>) =>
    setDrafts(prev => prev.map(d => d.key === key ? { ...d, ...patch } : d));

  const canSave = setName.trim() && drafts.every(d =>
    d.name.trim() && d.groupA.categories.length > 0 && d.groupB.categories.length > 0);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const rs = await createRuleSet(projectId, setName.trim(), standardRef.trim() || undefined);
      if (!rs) { alert('Không tạo được bộ quy tắc.'); return; }
      for (let i = 0; i < drafts.length; i++) {
        const d = drafts[i];
        const params: RuleParams = {
          groupA: d.groupA,
          groupB: d.groupB,
          condition: d.ruleType === 'clash' ? 'intersect' : 'min_distance',
          ...(d.ruleType === 'clash' ? { tolerance: d.threshold } : { minDistance: d.threshold }),
        };
        await createRule({
          ruleSetId: rs.id, name: d.name.trim(), ruleType: d.ruleType,
          params, severity: d.severity, sortOrder: i,
        });
      }
      onSaved(rs.id);
    } catch (e: any) {
      alert('Lỗi khi lưu: ' + (e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-inverse-on-surface/40 backdrop-blur-[2px] flex items-center justify-center z-[120] p-4" onClick={onClose}>
      <div className="bg-surface-container-lowest w-full max-w-2xl max-h-[88vh] rounded-2xl shadow-2xl border border-outline-variant flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center shrink-0">
          <h3 className="font-bold text-[15px] text-on-surface">Tạo bộ quy tắc riêng</h3>
          <button onClick={onClose} className="p-1 text-on-surface-variant hover:bg-surface-container rounded-full"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
          {/* Tên bộ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Tên bộ quy tắc *</label>
              <input
                value={setName} onChange={e => setSetName(e.target.value)}
                placeholder="VD: Kiểm tra phối hợp dự án A"
                className="mt-1 w-full text-[12px] bg-surface border border-outline-variant/60 rounded-lg px-2.5 py-2 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Tham chiếu (tùy chọn)</label>
              <input
                value={standardRef} onChange={e => setStandardRef(e.target.value)}
                placeholder="VD: TCVN 4319:2012"
                className="mt-1 w-full text-[12px] bg-surface border border-outline-variant/60 rounded-lg px-2.5 py-2 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>

          {drafts.map((d, idx) => (
            <RuleCard
              key={d.key}
              draft={d}
              index={idx}
              canRemove={drafts.length > 1}
              availableCategories={availableCategories}
              onChange={patch => updateDraft(d.key, patch)}
              onRemove={() => setDrafts(prev => prev.filter(x => x.key !== d.key))}
            />
          ))}

          <button
            onClick={() => setDrafts(prev => [...prev, newDraft()])}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-outline text-on-surface-variant text-[12px] font-semibold hover:bg-surface-container hover:text-on-surface"
          >
            <Plus size={14} /> Thêm quy tắc
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-outline-variant flex items-center justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-outline text-on-surface text-[12px] font-semibold hover:bg-surface-container">Hủy</button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-[12px] font-bold hover:bg-primary/95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lưu bộ quy tắc
          </button>
        </div>
      </div>
    </div>
  );
}

interface RuleCardProps {
  draft: DraftRule;
  index: number;
  canRemove: boolean;
  availableCategories: string[];
  onChange: (patch: Partial<DraftRule>) => void;
  onRemove: () => void;
}

const RuleCard: React.FC<RuleCardProps> = ({ draft, index, canRemove, availableCategories, onChange, onRemove }) => {
  const isClash = draft.ruleType === 'clash';
  return (
    <div className="border border-outline-variant/60 rounded-xl p-3.5 space-y-3 bg-surface-container-low/20">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-primary">Quy tắc {index + 1}</span>
        {canRemove && (
          <button onClick={onRemove} className="text-error hover:bg-error/10 p-1 rounded" title="Xóa quy tắc">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Tên + loại */}
      <div className="grid grid-cols-[1fr_140px] gap-2">
        <div>
          <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Tên quy tắc *</label>
          <input
            value={draft.name} onChange={e => onChange({ name: e.target.value })}
            placeholder="VD: Ống nước xuyên dầm"
            className="mt-1 w-full text-[12px] bg-surface border border-outline-variant/60 rounded-lg px-2.5 py-1.5 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Loại</label>
          <select
            value={draft.ruleType}
            onChange={e => onChange({ ruleType: e.target.value as 'clash' | 'clearance', threshold: e.target.value === 'clash' ? 0.01 : 1.0 })}
            className="mt-1 w-full text-[12px] bg-surface border border-outline-variant/60 rounded-lg px-2 py-1.5 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          >
            <option value="clash">Va chạm cứng</option>
            <option value="clearance">Khoảng cách tối thiểu</option>
          </select>
        </div>
      </div>

      {/* Nhóm A/B */}
      <div className="grid grid-cols-2 gap-2">
        <GroupPicker label="Nhóm cấu kiện A" group={draft.groupA} availableCategories={availableCategories} onChange={g => onChange({ groupA: g })} />
        <GroupPicker label="Nhóm cấu kiện B" group={draft.groupB} availableCategories={availableCategories} onChange={g => onChange({ groupB: g })} />
      </div>

      {/* Điều kiện + ngưỡng + mức độ */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Điều kiện</label>
          <div className="mt-1 text-[11.5px] text-on-surface px-2.5 py-1.5 bg-surface-container rounded-lg">
            {isClash ? 'Giao cắt' : 'Cách nhau <'}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-outline uppercase tracking-wider">
            {isClash ? 'Dung sai (m)' : 'Ngưỡng (m)'}
          </label>
          <input
            type="number" step="0.01" min="0"
            value={draft.threshold}
            onChange={e => onChange({ threshold: parseFloat(e.target.value) || 0 })}
            className="mt-1 w-full text-[12px] bg-surface border border-outline-variant/60 rounded-lg px-2.5 py-1.5 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Mức độ</label>
          <select
            value={draft.severity}
            onChange={e => onChange({ severity: e.target.value as RuleSeverity })}
            className="mt-1 w-full text-[12px] bg-surface border border-outline-variant/60 rounded-lg px-2 py-1.5 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          >
            <option value="low">Thấp</option>
            <option value="medium">Trung bình</option>
            <option value="high">Cao</option>
            <option value="critical">Nghiêm trọng</option>
          </select>
        </div>
      </div>
    </div>
  );
};

function GroupPicker({ label, group, availableCategories, onChange }: {
  label: string;
  group: ElementGroup;
  availableCategories: string[];
  onChange: (g: ElementGroup) => void;
}) {
  const [catOpen, setCatOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(group.propertyFilters.length > 0);
  const [manualCat, setManualCat] = useState('');

  const toggleCat = (c: string) => {
    const has = group.categories.includes(c);
    onChange({ ...group, categories: has ? group.categories.filter(x => x !== c) : [...group.categories, c] });
  };
  const addManualCat = () => {
    const c = manualCat.trim().toUpperCase();
    if (c && !group.categories.includes(c)) onChange({ ...group, categories: [...group.categories, c] });
    setManualCat('');
  };

  const addFilter = () =>
    onChange({ ...group, propertyFilters: [...group.propertyFilters, { pset: '', name: '', op: 'eq', value: '' }] });
  const updateFilter = (i: number, patch: Partial<PropertyFilter>) =>
    onChange({ ...group, propertyFilters: group.propertyFilters.map((f, j) => j === i ? { ...f, ...patch } : f) });
  const removeFilter = (i: number) =>
    onChange({ ...group, propertyFilters: group.propertyFilters.filter((_, j) => j !== i) });

  return (
    <div className="border border-outline-variant/40 rounded-lg p-2 bg-surface">
      <label className="text-[10px] font-bold text-outline uppercase tracking-wider">{label} *</label>

      {/* Chip category đã chọn */}
      <div className="mt-1 flex flex-wrap gap-1 min-h-[22px]">
        {group.categories.map(c => (
          <span key={c} className="inline-flex items-center gap-1 text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
            {c}
            <button onClick={() => toggleCat(c)} className="hover:text-error"><X size={9} /></button>
          </span>
        ))}
        {group.categories.length === 0 && <span className="text-[10px] text-on-surface-variant italic">Chưa chọn category</span>}
      </div>

      {/* Chọn từ danh sách category có sẵn */}
      <button onClick={() => setCatOpen(!catOpen)} className="mt-1 flex items-center gap-1 text-[10.5px] text-primary font-semibold">
        {catOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />} Chọn category
      </button>
      {catOpen && (
        <div className="mt-1 max-h-32 overflow-y-auto custom-scrollbar border border-outline-variant/40 rounded p-1 space-y-0.5">
          {availableCategories.length === 0 && (
            <div className="text-[10px] text-on-surface-variant p-1">
              Chưa nạp mô hình — gõ tay category IFC bên dưới.
            </div>
          )}
          {availableCategories.map(c => (
            <label key={c} className="flex items-center gap-1.5 text-[10.5px] px-1 py-0.5 hover:bg-surface-container rounded cursor-pointer">
              <input type="checkbox" checked={group.categories.includes(c)} onChange={() => toggleCat(c)} className="w-3 h-3 accent-[var(--md-sys-color-primary,#2563eb)]" />
              <span className="font-mono text-on-surface">{c}</span>
            </label>
          ))}
          {/* Nhập tay */}
          <div className="flex gap-1 pt-1 border-t border-outline-variant/30">
            <input
              value={manualCat} onChange={e => setManualCat(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManualCat(); } }}
              placeholder="IFCWALL..."
              className="flex-1 text-[10px] font-mono bg-surface-container border border-outline-variant/40 rounded px-1.5 py-1 text-on-surface outline-none"
            />
            <button onClick={addManualCat} className="text-primary"><Plus size={13} /></button>
          </div>
        </div>
      )}

      {/* Lọc thuộc tính (tùy chọn) */}
      <button onClick={() => setFilterOpen(!filterOpen)} className="mt-1.5 flex items-center gap-1 text-[10.5px] text-on-surface-variant font-semibold hover:text-on-surface">
        {filterOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />} Lọc thuộc tính ({group.propertyFilters.length})
      </button>
      {filterOpen && (
        <div className="mt-1 space-y-1">
          {group.propertyFilters.map((f, i) => (
            <div key={i} className="flex flex-col gap-1 p-1.5 bg-surface-container rounded border border-outline-variant/30">
              <div className="flex gap-1">
                <input value={f.pset} onChange={e => updateFilter(i, { pset: e.target.value })} placeholder="Pset"
                  className="flex-1 min-w-0 text-[9.5px] font-mono bg-surface border border-outline-variant/40 rounded px-1 py-0.5 text-on-surface outline-none" />
                <input value={f.name} onChange={e => updateFilter(i, { name: e.target.value })} placeholder="Thuộc tính"
                  className="flex-1 min-w-0 text-[9.5px] font-mono bg-surface border border-outline-variant/40 rounded px-1 py-0.5 text-on-surface outline-none" />
                <button onClick={() => removeFilter(i)} className="text-error shrink-0"><Trash2 size={11} /></button>
              </div>
              <div className="flex gap-1">
                <select value={f.op} onChange={e => updateFilter(i, { op: e.target.value as PropertyFilter['op'] })}
                  className="text-[9.5px] bg-surface border border-outline-variant/40 rounded px-1 py-0.5 text-on-surface outline-none">
                  {(Object.keys(OP_LABEL) as PropertyFilter['op'][]).map(op => <option key={op} value={op}>{OP_LABEL[op]}</option>)}
                </select>
                {f.op !== 'exists' && (
                  <input value={String(f.value ?? '')} onChange={e => updateFilter(i, { value: e.target.value })} placeholder="Giá trị"
                    className="flex-1 min-w-0 text-[9.5px] bg-surface border border-outline-variant/40 rounded px-1 py-0.5 text-on-surface outline-none" />
                )}
              </div>
            </div>
          ))}
          <button onClick={addFilter} className="flex items-center gap-1 text-[10px] text-primary font-semibold">
            <Plus size={11} /> Thêm điều kiện lọc
          </button>
        </div>
      )}
    </div>
  );
}
