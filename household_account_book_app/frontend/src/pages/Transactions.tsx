import { useEffect, useState, useCallback } from 'react';
import { getTransactions, getMembers, getCategories, createTransaction, updateTransaction, deleteTransaction } from '../api';
import type { Transaction, Member, Category, TransactionType } from '../types';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';

const formatAmount = (n: number) => n.toLocaleString('ja-JP');

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

export default function Transactions() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [filterType, setFilterType] = useState<string>('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getTransactions({
      year,
      month,
      type: filterType === 'all' ? undefined : filterType,
      limit: 200
    }).then(setTransactions).finally(() => setLoading(false));
  }, [year, month, filterType]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getMembers().then(setMembers);
    getCategories().then(setCategories);
  }, []);

  const filteredCategories = categories.filter(c => c.type === form.type);

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
    setSaving(true);
    const payload = {
      type: form.type,
      amount: parseFloat(form.amount),
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

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) return;
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">収支管理</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          ＋ 記録する
        </button>
      </div>

      {/* Month Navigator */}
      <div className="month-nav">
        <button className="btn btn-ghost btn-sm" onClick={prevMonth}>‹</button>
        <span className="month-label">{year}年{month}月</span>
        <button className="btn btn-ghost btn-sm" onClick={nextMonth}>›</button>
      </div>

      {/* Summary row */}
      <div className="tx-summary-row">
        <span className="amount-income">収入 ¥{formatAmount(totalIncome)}</span>
        <span className="tx-summary-sep">|</span>
        <span className="amount-expense">支出 ¥{formatAmount(totalExpense)}</span>
        <span className="tx-summary-sep">|</span>
        <span className={totalIncome - totalExpense >= 0 ? 'amount-income' : 'amount-expense'}>
          収支 {totalIncome - totalExpense >= 0 ? '+' : ''}¥{formatAmount(totalIncome - totalExpense)}
        </span>
      </div>

      {/* Type Filter */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {[['all','すべて'],['expense','支出'],['income','収入']].map(([v,l]) => (
          <button key={v} className={`tab ${filterType === v ? 'active' : ''}`} onClick={() => setFilterType(v)}>
            {l}
          </button>
        ))}
      </div>

      {/* Transaction List */}
      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : transactions.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <p>この月の記録はありません</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {transactions.map((tx, i) => (
            <div key={tx.id} className={`tx-item ${i > 0 ? 'tx-item-border' : ''}`}>
              <div className="tx-icon-lg">
                {tx.category?.icon || (tx.type === 'income' ? '💰' : '💸')}
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
                <div className={`tx-item-amount ${tx.type === 'income' ? 'amount-income' : 'amount-expense'}`}>
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

      {/* Modal */}
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
            </div>

            <div className="form-group">
              <label className="form-label">金額（円）</label>
              <input
                type="number"
                className="form-control"
                placeholder="0"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                min="1"
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
        .tx-summary-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 16px;
        }
        .tx-summary-sep {
          color: var(--color-border);
        }
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
        }
      `}</style>
    </div>
  );
}
