import { useEffect, useState } from 'react';
import { getMembers, createMember, updateMember, deleteMember, getCategories, createCategory, updateCategory, deleteCategory } from '../api';
import type { Member, Category } from '../types';

const COLORS = ['#2563eb','#16a34a','#dc2626','#d97706','#7c3aed','#0891b2','#be185d','#065f46'];

export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tab, setTab] = useState<'members' | 'categories'>('members');
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberColor, setMemberColor] = useState(COLORS[0]);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'expense' | 'income'>('expense');
  const [catIcon, setCatIcon] = useState('');
  const [catMemo, setCatMemo] = useState('');
  const [saving, setSaving] = useState(false);

  const loadMembers = () => getMembers().then(setMembers);
  const loadCategories = () => getCategories().then(setCategories);

  useEffect(() => {
    loadMembers();
    loadCategories();
  }, []);

  const openCreateMember = () => {
    setEditingMember(null);
    setMemberName('');
    setMemberColor(COLORS[0]);
    setShowMemberModal(true);
  };

  const openEditMember = (m: Member) => {
    setEditingMember(m);
    setMemberName(m.name);
    setMemberColor(m.color);
    setShowMemberModal(true);
  };

  const saveMember = async () => {
    if (!memberName.trim()) return;
    setSaving(true);
    try {
      if (editingMember) {
        await updateMember(editingMember.id, { name: memberName, color: memberColor });
      } else {
        await createMember({ name: memberName, color: memberColor });
      }
      setShowMemberModal(false);
      loadMembers();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMember = async (id: number) => {
    if (!confirm('このメンバーを削除しますか？')) return;
    await deleteMember(id);
    loadMembers();
  };

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCatName(''); setCatType('expense'); setCatIcon(''); setCatMemo('');
    setShowCatModal(true);
  };

  const openEditCategory = (c: Category) => {
    setEditingCategory(c);
    setCatName(c.name);
    setCatType(c.type as 'expense' | 'income');
    setCatIcon(c.icon);
    setCatMemo(c.memo ?? '');
    setShowCatModal(true);
  };

  const saveCategory = async () => {
    if (!catName.trim()) return;
    setSaving(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, { name: catName, type: catType, icon: catIcon, memo: catMemo });
      } else {
        await createCategory({ name: catName, type: catType, icon: catIcon, memo: catMemo });
      }
      setShowCatModal(false);
      loadCategories();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCat = async (id: number) => {
    if (!confirm('このカテゴリを削除しますか？')) return;
    await deleteCategory(id);
    loadCategories();
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">メンバー・カテゴリ</h1>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        <button className={`tab ${tab === 'members' ? 'active' : ''}`} onClick={() => setTab('members')}>
          👥 メンバー
        </button>
        <button className={`tab ${tab === 'categories' ? 'active' : ''}`} onClick={() => setTab('categories')}>
          🏷️ カテゴリ
        </button>
      </div>

      {tab === 'members' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={openCreateMember}>＋ メンバー追加</button>
          </div>
          {members.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">👥</div>
                <p>メンバーがいません</p>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {members.map((m, i) => (
                <div key={m.id} className={`member-row ${i > 0 ? 'member-row-border' : ''}`}>
                  <div className="member-avatar" style={{ background: m.color }}>
                    {m.name.charAt(0)}
                  </div>
                  <div className="member-name">{m.name}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEditMember(m)}>編集</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteMember(m.id)}>削除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'categories' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={openCreateCategory}>＋ カテゴリ追加</button>
          </div>

          <div style={{ marginBottom: 24 }}>
            <h3 className="cat-section-title">💸 支出カテゴリ</h3>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {expenseCategories.length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}>カテゴリなし</div>
              ) : expenseCategories.map((c, i) => (
                <div key={c.id} className={`cat-row ${i > 0 ? 'cat-row-border' : ''}`}>
                  <span className="cat-icon">{c.icon || '📦'}</span>
                  <div className="cat-info">
                    <span className="cat-name">{c.name}</span>
                    {c.memo && <span className="cat-memo">{c.memo}</span>}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEditCategory(c)}>編集</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCat(c.id)}>削除</button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="cat-section-title">💰 収入カテゴリ</h3>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {incomeCategories.length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}>カテゴリなし</div>
              ) : incomeCategories.map((c, i) => (
                <div key={c.id} className={`cat-row ${i > 0 ? 'cat-row-border' : ''}`}>
                  <span className="cat-icon">{c.icon || '💼'}</span>
                  <div className="cat-info">
                    <span className="cat-name">{c.name}</span>
                    {c.memo && <span className="cat-memo">{c.memo}</span>}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEditCategory(c)}>編集</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCat(c.id)}>削除</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Member Modal */}
      {showMemberModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowMemberModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editingMember ? 'メンバーを編集' : 'メンバーを追加'}</h2>
              <button className="modal-close" onClick={() => setShowMemberModal(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">名前</label>
              <input type="text" className="form-control" placeholder="例: お父さん"
                value={memberName} onChange={e => setMemberName(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">カラー</label>
              <div className="color-picker">
                {COLORS.map(c => (
                  <button
                    key={c}
                    className={`color-swatch ${memberColor === c ? 'selected' : ''}`}
                    style={{ background: c }}
                    onClick={() => setMemberColor(c)}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowMemberModal(false)}>キャンセル</button>
              <button className="btn btn-primary" onClick={saveMember} disabled={saving || !memberName.trim()}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCatModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCatModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editingCategory ? 'カテゴリを編集' : 'カテゴリを追加'}</h2>
              <button className="modal-close" onClick={() => setShowCatModal(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">種別</label>
              <div className="tabs">
                <button className={`tab ${catType === 'expense' ? 'active' : ''}`} onClick={() => setCatType('expense')}>支出</button>
                <button className={`tab ${catType === 'income' ? 'active' : ''}`} onClick={() => setCatType('income')}>収入</button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">カテゴリ名</label>
              <input type="text" className="form-control" placeholder="例: 外食"
                value={catName} onChange={e => setCatName(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">アイコン（絵文字）</label>
              <input type="text" className="form-control" placeholder="例: 🍜"
                value={catIcon} onChange={e => setCatIcon(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">メモ</label>
              <input type="text" className="form-control" placeholder="任意のメモ"
                value={catMemo} onChange={e => setCatMemo(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowCatModal(false)}>キャンセル</button>
              <button className="btn btn-primary" onClick={saveCategory} disabled={saving || !catName.trim()}>
                {saving ? '保存中...' : editingCategory ? '保存' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .member-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 20px;
        }
        .member-row-border {
          border-top: 1px solid var(--color-border);
        }
        .member-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 16px;
          flex-shrink: 0;
        }
        .member-name {
          flex: 1;
          font-weight: 600;
          font-size: 15px;
        }
        .color-picker {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .color-swatch {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 3px solid transparent;
          cursor: pointer;
          transition: transform 0.1s;
        }
        .color-swatch.selected {
          border-color: var(--color-text);
          transform: scale(1.15);
        }
        .cat-section-title {
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 10px;
          color: var(--color-text-secondary);
        }
        .cat-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
        }
        .cat-row-border {
          border-top: 1px solid var(--color-border);
        }
        .cat-icon {
          font-size: 20px;
          width: 32px;
          text-align: center;
        }
        .cat-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .cat-name {
          font-weight: 500;
        }
        .cat-memo {
          font-size: 12px;
          color: var(--color-text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
