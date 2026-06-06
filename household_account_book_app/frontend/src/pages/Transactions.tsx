import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getTransactions, getMembers, getCategories, createTransaction, updateTransaction, deleteTransaction } from '../api';
import type { Transaction, Member, Category, TransactionType } from '../types';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';

const formatAmount = (n: number) => n.toLocaleString('ja-JP');

// --- URL query param keys ---
const PARAM_TYPES = 'type';
const PARAM_MEMBER_IDS = 'member_id';
const PARAM_CATEGORY_IDS = 'category_id';
const PARAM_DATE_FROM = 'date_from';
const PARAM_DATE_TO = 'date_to';
const PARAM_SORT_BY = 'sort_by';
const PARAM_SORT_ORDER = 'sort_order';
const PARAM_YEAR = 'year';
const PARAM_MONTH = 'month';

type SortBy = 'date' | 'amount' | 'created_at';
type SortOrder = 'asc' | 'desc';

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'income', label: '収入' },
  { value: 'expense', label: '支出' },
  { value: 'deduction', label: '控除' },
];

const SORT_BY_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'date', label: '日付' },
  { value: 'amount', label: '金額' },
  { value: 'created_at', label: '登録日' },
];

interface FormData {
  type: TransactionType;
  amount: string;
  date: string;
  memo: string;
  member_id: string;
  category_id: string;
}

const defaultForm = (): FormData => ({
  type: 'expense',
  amount: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  memo: '',
  member_id: '',
  category_id: '',
});

// Parse a comma-separated string or repeated keys from URLSearchParams into string[]
function getParamValues(params: URLSearchParams, key: string): string[] {
  return params.getAll(key);
}

function getParamIntValues(params: URLSearchParams, key: string): number[] {
  return params.getAll(key).map(Number).filter(n => !isNaN(n));
}

export default function Transactions() {
  const now = new Date();
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive filter/sort state from URL query params
  const year = searchParams.get(PARAM_YEAR) ? Number(searchParams.get(PARAM_YEAR)) : now.getFullYear();
  const month = searchParams.get(PARAM_MONTH) ? Number(searchParams.get(PARAM_MONTH)) : now.getMonth() + 1;
  // Memoized to prevent new array references on every render (avoids infinite useEffect loop)
  const selectedTypes = useMemo(
    () => getParamValues(searchParams, PARAM_TYPES) as TransactionType[],
    [searchParams]
  );
  const selectedMemberIds = useMemo(
    () => getParamIntValues(searchParams, PARAM_MEMBER_IDS),
    [searchParams]
  );
  const selectedCategoryIds = useMemo(
    () => getParamIntValues(searchParams, PARAM_CATEGORY_IDS),
    [searchParams]
  );
  const dateFrom = searchParams.get(PARAM_DATE_FROM) ?? '';
  const dateTo = searchParams.get(PARAM_DATE_TO) ?? '';
  const sortBy = (searchParams.get(PARAM_SORT_BY) as SortBy | null) ?? 'date';
  const sortOrder = (searchParams.get(PARAM_SORT_ORDER) as SortOrder | null) ?? 'desc';

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm());
  const [saving, setSaving] = useState(false);

  // Update a single URL param while preserving others
  const setParam = useCallback((key: string, value: string | string[] | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete(key);
      if (Array.isArray(value)) {
        value.forEach(v => next.append(key, v));
      } else if (value !== null && value !== '') {
        next.set(key, value);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const load = useCallback(() => {
    setLoading(true);
    getTransactions({
      year,
      month,
      type: selectedTypes.length > 0 ? selectedTypes : undefined,
      member_id: selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
      category_id: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
      limit: 200,
    }).then(setTransactions).finally(() => setLoading(false));
  }, [year, month, selectedTypes, selectedMemberIds, selectedCategoryIds, dateFrom, dateTo, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getMembers().then(setMembers);
    getCategories().then(setCategories);
  }, []);

  const filteredCategories = categories.filter(c => c.type === form.type);

  // --- Month navigation ---
  const prevMonth = () => {
    if (month === 1) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set(PARAM_YEAR, String(year - 1));
        next.set(PARAM_MONTH, '12');
        return next;
      }, { replace: true });
    } else {
      setParam(PARAM_MONTH, String(month - 1));
    }
  };
  const nextMonth = () => {
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) return;
    if (month === 12) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set(PARAM_YEAR, String(year + 1));
        next.set(PARAM_MONTH, '1');
        return next;
      }, { replace: true });
    } else {
      setParam(PARAM_MONTH, String(month + 1));
    }
  };

  // --- Type checkbox toggle ---
  const toggleType = (type: TransactionType) => {
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type];
    setParam(PARAM_TYPES, next);
  };

  // --- Member checkbox toggle ---
  const toggleMember = (id: number) => {
    const next = selectedMemberIds.includes(id)
      ? selectedMemberIds.filter(m => m !== id)
      : [...selectedMemberIds, id];
    setParam(PARAM_MEMBER_IDS, next.map(String));
  };

  // --- Category checkbox toggle ---
  const toggleCategory = (id: number) => {
    const next = selectedCategoryIds.includes(id)
      ? selectedCategoryIds.filter(c => c !== id)
      : [...selectedCategoryIds, id];
    setParam(PARAM_CATEGORY_IDS, next.map(String));
  };

  // --- Clear all filters ---
  const clearFilters = () => {
    setSearchParams(prev => {
      const next = new URLSearchParams();
      const keepKeys = [PARAM_YEAR, PARAM_MONTH];
      keepKeys.forEach(k => { const v = prev.get(k); if (v) next.set(k, v); });
      return next;
    }, { replace: true });
  };

  const activeFilterCount =
    selectedTypes.length +
    selectedMemberIds.length +
    selectedCategoryIds.length +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  // --- Modal open/close ---
  const openCreate = () => {
    setEditingTx(null);
    setForm(defaultForm());
    setShowModal(true);
  };

  const openEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setForm({
      type: tx.type,
      amount: String(tx.amount),
      date: tx.date,
      memo: tx.memo,
      member_id: tx.member_id ? String(tx.member_id) : '',
      category_id: tx.category_id ? String(tx.category_id) : '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.amount || !form.date) return;
    const amountNum = parseFloat(form.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('金額は1以上の数値を入力してください');
      return;
    }
    setSaving(true);
    const payload = {
      type: form.type,
      amount: amountNum,
      date: form.date,
      memo: form.memo,
      member_id: form.member_id ? parseInt(form.member_id) : null,
      category_id: form.category_id ? parseInt(form.category_id) : null,
    };
    try {
      if (editingTx) {
        await updateTransaction(editingTx.id, payload);
      } else {
        await createTransaction(payload);
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
    if (!confirm('この記録を削除しますか？')) return;
    try {
      await deleteTransaction(id);
      load();
    } catch {
      alert('削除に失敗しました。通信状況を確認してください。');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">収支管理</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          + 記録する
        </button>
      </div>

      {/* Month Navigator */}
      <div className="month-nav">
        <button className="btn btn-ghost btn-sm" onClick={prevMonth}>&lsaquo;</button>
        <span className="month-label">{year}年{month}月</span>
        <button className="btn btn-ghost btn-sm" onClick={nextMonth}>&rsaquo;</button>
      </div>

      {/* Sort bar + Filter toggle */}
      <div className="tx-toolbar">
        <div className="tx-sort">
          <select
            className="form-control tx-sort-select"
            value={sortBy}
            onChange={e => setParam(PARAM_SORT_BY, e.target.value)}
          >
            {SORT_BY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}順</option>
            ))}
          </select>
          <button
            className={`btn btn-ghost btn-sm tx-sort-order ${sortOrder === 'asc' ? 'active' : ''}`}
            onClick={() => setParam(PARAM_SORT_ORDER, sortOrder === 'asc' ? 'desc' : 'asc')}
            title={sortOrder === 'asc' ? '昇順' : '降順'}
          >
            {sortOrder === 'asc' ? '↑ 昇順' : '↓ 降順'}
          </button>
        </div>
        <button
          className={`btn btn-ghost btn-sm tx-filter-btn ${activeFilterCount > 0 ? 'active' : ''}`}
          onClick={() => setShowFilter(v => !v)}
        >
          フィルタ{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilter && (
        <div className="filter-panel card">
          <div className="filter-panel-header">
            <span className="filter-panel-title">フィルタ条件</span>
            {activeFilterCount > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={clearFilters}>クリア</button>
            )}
          </div>

          {/* Type filter: checkbox, OR join */}
          <div className="filter-section">
            <div className="filter-label">種別</div>
            <div className="filter-checkboxes">
              {TYPE_OPTIONS.map(o => (
                <label key={o.value} className="filter-checkbox-item">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(o.value)}
                    onChange={() => toggleType(o.value)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Member filter: checkbox, OR join */}
          {members.length > 0 && (
            <div className="filter-section">
              <div className="filter-label">メンバー</div>
              <div className="filter-checkboxes">
                {members.map(m => (
                  <label key={m.id} className="filter-checkbox-item">
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.includes(m.id)}
                      onChange={() => toggleMember(m.id)}
                    />
                    <span
                      className="filter-member-badge"
                      style={{ background: m.color + '22', color: m.color }}
                    >
                      {m.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Category filter: checkbox, OR join */}
          {categories.length > 0 && (
            <div className="filter-section">
              <div className="filter-label">カテゴリ</div>
              <div className="filter-checkboxes filter-checkboxes-grid">
                {categories.map(c => (
                  <label key={c.id} className="filter-checkbox-item">
                    <input
                      type="checkbox"
                      checked={selectedCategoryIds.includes(c.id)}
                      onChange={() => toggleCategory(c.id)}
                    />
                    <span>{c.icon} {c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Date range filter */}
          <div className="filter-section">
            <div className="filter-label">日付範囲</div>
            <div className="filter-date-range">
              <input
                type="date"
                className="form-control"
                value={dateFrom}
                onChange={e => setParam(PARAM_DATE_FROM, e.target.value || null)}
              />
              <span className="filter-date-sep">〜</span>
              <input
                type="date"
                className="form-control"
                value={dateTo}
                onChange={e => setParam(PARAM_DATE_TO, e.target.value || null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Transaction List */}
      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : transactions.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <p>条件に一致する記録はありません</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {transactions.map((tx, i) => (
            <div key={tx.id} className={`tx-item ${i > 0 ? 'tx-item-border' : ''}`}>
              <div className="tx-icon-lg">
                {tx.category?.icon || (tx.type === 'income' ? '💰' : tx.type === 'deduction' ? '📋' : '💸')}
              </div>
              <div className="tx-item-info">
                <div className="tx-item-top">
                  <span className="tx-item-cat">{tx.category?.name || '未分類'}</span>
                  {tx.member && (
                    <span className="tx-item-member" style={{ background: tx.member.color + '22', color: tx.member.color }}>
                      {tx.member.name}
                    </span>
                  )}
                </div>
                {tx.memo && <div className="tx-item-memo">{tx.memo}</div>}
                <div className="tx-item-date">{format(parseISO(tx.date), 'M月d日(EEE)', { locale: ja })}</div>
              </div>
              <div className="tx-item-right">
                <div className={`tx-item-amount ${tx.type === 'income' ? 'amount-income' : tx.type === 'deduction' ? 'amount-deduction' : 'amount-expense'}`}>
                  {tx.type === 'income' ? '+' : '-'}¥{formatAmount(tx.amount)}
                </div>
                <div className="tx-item-actions">
                  <button className="btn-icon" onClick={() => openEdit(tx)} title="編集">✏️</button>
                  <button className="btn-icon" onClick={() => handleDelete(tx.id)} title="削除">🗑️</button>
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
              <h2 className="modal-title">{editingTx ? '記録を編集' : '記録を追加'}</h2>
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
              <label className="form-label">金額（円）</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]+"
                className="form-control"
                placeholder="0"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">日付</label>
              <input
                type="date"
                className="form-control"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
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

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>キャンセル</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.amount || !form.date}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .month-nav {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .month-label {
          font-size: 16px;
          font-weight: 700;
          min-width: 100px;
          text-align: center;
        }

        /* Sort toolbar */
        .tx-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .tx-sort {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .tx-sort-select {
          width: auto;
          padding: 5px 10px;
          font-size: 13px;
        }
        .tx-sort-order {
          white-space: nowrap;
        }
        .tx-sort-order.active {
          background: var(--color-primary-light);
          color: var(--color-primary);
          border-color: var(--color-primary-light);
        }
        .tx-filter-btn.active {
          background: var(--color-primary-light);
          color: var(--color-primary);
          border-color: var(--color-primary-light);
        }

        /* Filter panel */
        .filter-panel {
          margin-bottom: 16px;
        }
        .filter-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .filter-panel-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--color-text-secondary);
        }
        .filter-section {
          margin-bottom: 14px;
        }
        .filter-section:last-child {
          margin-bottom: 0;
        }
        .filter-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-secondary);
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .filter-checkboxes {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .filter-checkboxes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 6px;
        }
        .filter-checkbox-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          cursor: pointer;
          user-select: none;
        }
        .filter-checkbox-item input[type="checkbox"] {
          width: 15px;
          height: 15px;
          cursor: pointer;
          accent-color: var(--color-primary);
        }
        .filter-member-badge {
          padding: 1px 8px;
          border-radius: 99px;
          font-size: 12px;
          font-weight: 600;
        }
        .filter-date-range {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .filter-date-range .form-control {
          width: auto;
          flex: 1;
          min-width: 130px;
          font-size: 13px;
        }
        .filter-date-sep {
          color: var(--color-text-secondary);
          font-size: 14px;
          white-space: nowrap;
        }

        /* Transaction list */
        .tx-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
        }
        .tx-item-border {
          border-top: 1px solid var(--color-border);
        }
        .tx-icon-lg {
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
        .tx-item-info {
          flex: 1;
          min-width: 0;
        }
        .tx-item-top {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .tx-item-cat {
          font-weight: 600;
          font-size: 15px;
        }
        .tx-item-member {
          font-size: 11px;
          font-weight: 600;
          padding: 1px 8px;
          border-radius: 99px;
        }
        .tx-item-memo {
          font-size: 13px;
          color: var(--color-text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .tx-item-date {
          font-size: 12px;
          color: var(--color-text-secondary);
          margin-top: 2px;
        }
        .tx-item-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
          flex-shrink: 0;
        }
        .tx-item-amount {
          font-size: 16px;
        }
        .tx-item-actions {
          display: flex;
          gap: 2px;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .tx-item:hover .tx-item-actions {
          opacity: 1;
        }
        @media (max-width: 600px) {
          .tx-item-actions {
            opacity: 1;
          }
          .filter-checkboxes-grid {
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          }
        }
      `}</style>
    </div>
  );
}
