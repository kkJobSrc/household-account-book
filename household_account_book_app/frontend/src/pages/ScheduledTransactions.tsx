import { useState, useEffect, useCallback } from 'react';
import {
  getScheduledTransactions,
  createScheduledTransaction,
  updateScheduledTransaction,
  deleteScheduledTransaction,
  applyScheduledTransactions,
  getCategories,
  getMembers,
} from '../api';
import type { ScheduledTransaction, ScheduledTransactionCreate, Category, Member, TransactionType } from '../types';

const TYPE_LABELS: Record<TransactionType, string> = {
  income: '収入',
  expense: '支出',
  deduction: '控除',
};

const EMPTY_FORM: ScheduledTransactionCreate = {
  name: '',
  type: 'expense',
  amount: 0,
  category_id: null,
  member_id: null,
  day_of_month: 1,
  memo: '',
  is_active: true,
};

export default function ScheduledTransactions() {
  const [schedules, setSchedules] = useState<ScheduledTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<ScheduledTransaction | null>(null);
  const [form, setForm] = useState<ScheduledTransactionCreate>(EMPTY_FORM);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [applying, setApplying] = useState(false);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAll = useCallback(async () => {
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
      showToast('データの取得に失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filteredCategories = categories.filter(c => c.type === form.type);

  const handleOpenCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const handleOpenEdit = (st: ScheduledTransaction) => {
    setEditTarget(st);
    setForm({
      name: st.name,
      type: st.type,
      amount: st.amount,
      category_id: st.category_id,
      member_id: st.member_id,
      day_of_month: st.day_of_month,
      memo: st.memo,
      is_active: st.is_active,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditTarget(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editTarget) {
        await updateScheduledTransaction(editTarget.id, form);
        showToast('固定費を更新しました', 'success');
      } else {
        await createScheduledTransaction(form);
        showToast('固定費を登録しました', 'success');
      }
      handleCancel();
      fetchAll();
    } catch {
      showToast(editTarget ? '更新に失敗しました' : '登録に失敗しました', 'error');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`「${name}」を削除しますか？`)) return;
    try {
      await deleteScheduledTransaction(id);
      showToast('固定費を削除しました', 'success');
      fetchAll();
    } catch {
      showToast('削除に失敗しました', 'error');
    }
  };

  const handleApply = async () => {
    if (!window.confirm('今月分の固定費を一括入力しますか？（既に入力済みの項目はスキップされます）')) return;
    setApplying(true);
    try {
      const result = await applyScheduledTransactions();
      showToast(`${result.applied}件を入力しました（${result.skipped}件はスキップ）`, 'success');
      fetchAll();
    } catch {
      showToast('一括入力に失敗しました', 'error');
    } finally {
      setApplying(false);
    }
  };

  const handleFormChange = (field: keyof ScheduledTransactionCreate, value: string | number | boolean | null) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      // タイプが変わったらカテゴリをリセット
      if (field === 'type') {
        updated.category_id = null;
      }
      return updated;
    });
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>読み込み中...</div>;
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000,
          padding: '0.75rem 1.25rem',
          borderRadius: '8px',
          backgroundColor: toast.type === 'success' ? '#4caf50' : '#f44336',
          color: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          fontSize: '0.9rem',
        }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>固定費の自動入力</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handleApply}
            disabled={applying || schedules.filter(s => s.is_active).length === 0}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: '#ff9800',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: applying ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              opacity: applying ? 0.7 : 1,
            }}
          >
            {applying ? '処理中...' : '今月分を一括入力'}
          </button>
          <button
            onClick={handleOpenCreate}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            + 新規登録
          </button>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900,
        }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '10px', padding: '2rem',
            width: '100%', maxWidth: '480px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ marginTop: 0 }}>{editTarget ? '固定費を編集' : '固定費を登録'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>予定名 *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => handleFormChange('name', e.target.value)}
                  placeholder="例: 家賃、電気代"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>種別 *</label>
                <select
                  value={form.type}
                  onChange={e => handleFormChange('type', e.target.value as TransactionType)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                >
                  <option value="expense">支出</option>
                  <option value="income">収入</option>
                  <option value="deduction">控除</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>金額 (円) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={form.amount || ''}
                  onChange={e => handleFormChange('amount', Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>引き落とし日 *</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={28}
                  value={form.day_of_month}
                  onChange={e => handleFormChange('day_of_month', Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                />
                <small style={{ color: '#666', fontSize: '0.8rem' }}>
                  1〜28の日付を入力してください（月末日の違いを避けるため）
                </small>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>カテゴリ</label>
                <select
                  value={form.category_id ?? ''}
                  onChange={e => handleFormChange('category_id', e.target.value ? Number(e.target.value) : null)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                >
                  <option value="">未選択</option>
                  {filteredCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>メンバー</label>
                <select
                  value={form.member_id ?? ''}
                  onChange={e => handleFormChange('member_id', e.target.value ? Number(e.target.value) : null)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                >
                  <option value="">未選択</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>メモ</label>
                <input
                  type="text"
                  value={form.memo ?? ''}
                  onChange={e => handleFormChange('memo', e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.is_active ?? true}
                    onChange={e => handleFormChange('is_active', e.target.checked)}
                  />
                  <span style={{ fontWeight: 'bold' }}>有効</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleCancel}
                  style={{
                    padding: '0.5rem 1.25rem', borderRadius: '6px',
                    border: '1px solid #ccc', cursor: 'pointer', backgroundColor: '#fff',
                  }}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1.25rem', borderRadius: '6px',
                    backgroundColor: '#1976d2', color: '#fff', border: 'none',
                    cursor: 'pointer', fontWeight: 'bold',
                  }}
                >
                  {editTarget ? '更新する' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      {schedules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          固定費が登録されていません。「+ 新規登録」から追加してください。
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>予定名</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>種別</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>金額</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>日付</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>カテゴリ</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>メンバー</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>状態</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(st => (
                <tr
                  key={st.id}
                  style={{
                    borderBottom: '1px solid #e0e0e0',
                    opacity: st.is_active ? 1 : 0.5,
                    backgroundColor: st.is_active ? '#fff' : '#fafafa',
                  }}
                >
                  <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{st.name}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{
                      display: 'inline-block', padding: '0.2rem 0.5rem',
                      borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold',
                      backgroundColor: st.type === 'income' ? '#e8f5e9' : st.type === 'expense' ? '#fce4ec' : '#fff3e0',
                      color: st.type === 'income' ? '#2e7d32' : st.type === 'expense' ? '#c62828' : '#e65100',
                    }}>
                      {TYPE_LABELS[st.type]}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                    ¥{st.amount.toLocaleString()}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>毎月{st.day_of_month}日</td>
                  <td style={{ padding: '0.75rem' }}>{st.category?.name ?? '—'}</td>
                  <td style={{ padding: '0.75rem' }}>
                    {st.member ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{
                          display: 'inline-block', width: '10px', height: '10px',
                          borderRadius: '50%', backgroundColor: st.member.color,
                        }} />
                        {st.member.name}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block', padding: '0.2rem 0.5rem',
                      borderRadius: '4px', fontSize: '0.8rem',
                      backgroundColor: st.is_active ? '#e8f5e9' : '#f5f5f5',
                      color: st.is_active ? '#2e7d32' : '#757575',
                    }}>
                      {st.is_active ? '有効' : '無効'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleOpenEdit(st)}
                        style={{
                          padding: '0.25rem 0.75rem', borderRadius: '4px',
                          border: '1px solid #1976d2', color: '#1976d2',
                          backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.85rem',
                        }}
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(st.id, st.name)}
                        style={{
                          padding: '0.25rem 0.75rem', borderRadius: '4px',
                          border: '1px solid #f44336', color: '#f44336',
                          backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.85rem',
                        }}
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
