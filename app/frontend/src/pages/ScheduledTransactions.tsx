import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
  getScheduledTransactions,
  createScheduledTransaction,
  updateScheduledTransaction,
  deleteScheduledTransaction,
  applyScheduledTransactions,
  getCategories,
  getMembers,
} from '../api';
import type { ScheduledTransaction, Category, Member, TransactionType } from '../types';

const formatAmount = (n: number) => n.toLocaleString('ja-JP');

// day_of_month is limited to 1-28 to avoid month-length differences
const DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => i + 1);

interface FormState {
  name: string;
  type: TransactionType;
  amount: string;
  category_id: string;
  member_id: string;
  day_of_month: string;
  memo: string;
  is_active: boolean;
}

const defaultForm = (): FormState => ({
  name: '',
  type: 'expense',
  amount: '',
  category_id: '',
  member_id: '',
  day_of_month: '1',
  memo: '',
  is_active: true,
});

export default function ScheduledTransactions() {
  const [schedules, setSchedules] = useState<ScheduledTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSt, setEditingSt] = useState<ScheduledTransaction | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [applyMonth, setApplyMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, m] = await Promise.all([
        getScheduledTransactions(),
        getCategories(),
        getMembers(),
      ]);
      setSchedules(s);
      setCategories(c);
      setMembers(m);
    } catch {
      alert('データの取得に失敗しました。通信状況を確認してください。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredCategories = categories.filter(c => c.type === form.type);
  const activeCount = schedules.filter(s => s.is_active).length;

  // --- Modal open/close ---
  const openCreate = () => {
    setEditingSt(null);
    setForm(defaultForm());
    setShowModal(true);
  };

  const openEdit = (st: ScheduledTransaction) => {
    setEditingSt(st);
    setForm({
      name: st.name,
      type: st.type,
      amount: String(st.amount),
      category_id: st.category_id ? String(st.category_id) : '',
      member_id: st.member_id ? String(st.member_id) : '',
      day_of_month: String(st.day_of_month),
      memo: st.memo,
      is_active: st.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.amount) return;
    const amountNum = parseFloat(form.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('金額は1以上の数値を入力してください');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      amount: amountNum,
      category_id: form.category_id ? parseInt(form.category_id) : null,
      member_id: form.member_id ? parseInt(form.member_id) : null,
      day_of_month: parseInt(form.day_of_month),
      memo: form.memo,
      is_active: form.is_active,
    };
    try {
      if (editingSt) {
        await updateScheduledTransaction(editingSt.id, payload);
      } else {
        await createScheduledTransaction(payload);
      }
      setShowModal(false);
      load();
    } catch {
      alert('保存に失敗しました。通信状況を確認してください。');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('この固定費を削除しますか？')) return;
    try {
      await deleteScheduledTransaction(id);
      load();
    } catch {
      alert('削除に失敗しました。通信状況を確認してください。');
    }
  };

  // --- Bulk apply to the selected month ---
  const handleApply = async () => {
    if (!applyMonth) return;
    const [year, month] = applyMonth.split('-').map(Number);
    if (!confirm(`${year}年${month}月分の固定費を一括登録しますか？（登録済みの項目はスキップされます）`)) return;
    setApplying(true);
    try {
      const result = await applyScheduledTransactions(year, month);
      alert(`${result.year}年${result.month}月分: ${result.applied}件を登録しました（${result.skipped}件はスキップ）`);
    } catch {
      alert('一括登録に失敗しました。通信状況を確認してください。');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">固定費の自動入力</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          ＋ 新規作成
        </button>
      </div>

      {/* Bulk apply */}
      <div className="card st-apply">
        <div className="st-apply-label">
          <span className="form-label" style={{ marginBottom: 0 }}>一括登録する月</span>
          <span className="st-apply-hint">有効な固定費をその月の取引として登録します</span>
        </div>
        <div className="st-apply-controls">
          <input
            type="month"
            className="form-control st-apply-month"
            value={applyMonth}
            onChange={e => setApplyMonth(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={handleApply}
            disabled={applying || !applyMonth || activeCount === 0}
          >
            {applying ? '登録中...' : '一括登録'}
          </button>
        </div>
      </div>

      {/* Schedule List */}
      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : schedules.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            <p>固定費が登録されていません。「＋ 新規作成」から追加してください。</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {schedules.map((st, i) => (
            <div
              key={st.id}
              className={`st-item ${i > 0 ? 'st-item-border' : ''} ${st.is_active ? '' : 'st-item-inactive'}`}
            >
              <div className="st-icon-lg">
                {st.category?.icon || (st.type === 'income' ? '💰' : st.type === 'deduction' ? '📋' : '💸')}
              </div>
              <div className="st-item-info">
                <div className="st-item-top">
                  <span className="st-item-name">{st.name}</span>
                  {st.member && (
                    <span className="st-item-badge" style={{ background: st.member.color + '22', color: st.member.color }}>
                      {st.member.name}
                    </span>
                  )}
                  {!st.is_active && <span className="st-item-badge st-item-badge-inactive">無効</span>}
                </div>
                <div className="st-item-sub">
                  {st.category?.name || '未分類'}{st.memo ? ` ・ ${st.memo}` : ''}
                </div>
                <div className="st-item-day">毎月{st.day_of_month}日</div>
              </div>
              <div className="st-item-right">
                <div className={`st-item-amount ${st.type === 'income' ? 'amount-income' : st.type === 'deduction' ? 'amount-deduction' : 'amount-expense'}`}>
                  {st.type === 'income' ? '+' : '-'}¥{formatAmount(st.amount)}
                </div>
                <div className="st-item-actions">
                  <button className="btn-icon" onClick={() => openEdit(st)} title="編集">✏️</button>
                  <button className="btn-icon" onClick={() => handleDelete(st.id)} title="削除">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Entry Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editingSt ? '固定費を編集' : '固定費を追加'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="tabs" style={{ marginBottom: 20 }}>
              <button className={`tab ${form.type === 'expense' ? 'active' : ''}`}
                onClick={() => setForm(f => ({ ...f, type: 'expense', category_id: '' }))}>支出</button>
              <button className={`tab ${form.type === 'income' ? 'active' : ''}`}
                onClick={() => setForm(f => ({ ...f, type: 'income', category_id: '' }))}>収入</button>
              <button className={`tab ${form.type === 'deduction' ? 'active' : ''}`}
                onClick={() => setForm(f => ({ ...f, type: 'deduction', category_id: '' }))}>控除</button>
            </div>

            <div className="form-group">
              <label className="form-label">予定名</label>
              <input
                type="text"
                className="form-control"
                placeholder="例: 家賃、電気代"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">金額（円）</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]+"
                className="form-control"
                placeholder="0"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">登録日（毎月）</label>
              <select className="form-control" value={form.day_of_month}
                onChange={e => setForm(f => ({ ...f, day_of_month: e.target.value }))}>
                {DAY_OPTIONS.map(d => (
                  <option key={d} value={d}>{d}日</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">カテゴリ</label>
              <select className="form-control" value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">選択してください</option>
                {filteredCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>

            {members.length > 0 && (
              <div className="form-group">
                <label className="form-label">メンバー</label>
                <select className="form-control" value={form.member_id}
                  onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}>
                  <option value="">選択しない</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">メモ</label>
              <input
                type="text"
                className="form-control"
                placeholder="任意のメモ"
                value={form.memo}
                onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="st-checkbox">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                />
                有効（一括登録の対象にする）
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>キャンセル</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name.trim() || !form.amount}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .st-apply {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 16px;
          padding: 16px 20px;
        }
        .st-apply-label {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .st-apply-hint {
          font-size: 12px;
          color: var(--color-text-secondary);
        }
        .st-apply-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .st-apply-month {
          width: auto;
        }

        .st-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
        }
        .st-item-border {
          border-top: 1px solid var(--color-border);
        }
        .st-item-inactive {
          opacity: 0.55;
        }
        .st-icon-lg {
          font-size: 24px;
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-bg);
          border-radius: 50%;
          flex-shrink: 0;
        }
        .st-item-info {
          flex: 1;
          min-width: 0;
        }
        .st-item-top {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .st-item-name {
          font-weight: 600;
          font-size: 15px;
        }
        .st-item-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 1px 8px;
          border-radius: 99px;
        }
        .st-item-badge-inactive {
          background: var(--color-bg);
          color: var(--color-text-secondary);
        }
        .st-item-sub {
          font-size: 13px;
          color: var(--color-text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .st-item-day {
          font-size: 12px;
          color: var(--color-text-secondary);
          margin-top: 2px;
        }
        .st-item-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
          flex-shrink: 0;
        }
        .st-item-amount {
          font-size: 16px;
        }
        .st-item-actions {
          display: flex;
          gap: 2px;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .st-item:hover .st-item-actions {
          opacity: 1;
        }
        .st-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          cursor: pointer;
        }
        @media (max-width: 600px) {
          .st-item-actions {
            opacity: 1;
          }
          .st-apply-controls {
            width: 100%;
          }
          .st-apply-month {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}
