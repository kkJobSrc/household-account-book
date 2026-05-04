import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMonthlyReport, getTransactions } from '../api';
import type { MonthlyReport, Transaction } from '../types';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

const formatAmount = (n: number) => n.toLocaleString('ja-JP');

export default function Dashboard() {
  const now = new Date();
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    Promise.all([
      getMonthlyReport(year, month),
      getTransactions({ year, month, limit: 5 })
    ]).then(([rep, txs]) => {
      setReport(rep);
      setRecent(txs);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">読み込み中...</div>;

  const summary = report?.summary;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          {format(now, 'yyyy年M月', { locale: ja })}
        </h1>
        <Link to="/transactions" className="btn btn-primary">
          <span>＋</span> 記録する
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="dashboard-grid">
        <div className="card summary-card">
          <div className="summary-label">収入</div>
          <div className="summary-amount amount-income">
            ¥{formatAmount(summary?.total_income ?? 0)}
          </div>
        </div>
        <div className="card summary-card">
          <div className="summary-label">支出</div>
          <div className="summary-amount amount-expense">
            ¥{formatAmount(summary?.total_expense ?? 0)}
          </div>
        </div>
        <div className="card summary-card summary-card-balance">
          <div className="summary-label">収支</div>
          <div className={`summary-amount ${(summary?.balance ?? 0) >= 0 ? 'amount-income' : 'amount-expense'}`}>
            {(summary?.balance ?? 0) >= 0 ? '+' : ''}¥{formatAmount(summary?.balance ?? 0)}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="section-header">
          <h2 className="section-title">最近の記録</h2>
          <Link to="/transactions" className="btn btn-ghost btn-sm">すべて見る</Link>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <p>まだ記録がありません</p>
          </div>
        ) : (
          <div className="tx-list">
            {recent.map(tx => (
              <div key={tx.id} className="tx-row">
                <div className="tx-icon">
                  {tx.category?.icon || (tx.type === 'income' ? '💰' : '💸')}
                </div>
                <div className="tx-info">
                  <div className="tx-category">{tx.category?.name || '未分類'}</div>
                  {tx.memo && <div className="tx-memo">{tx.memo}</div>}
                </div>
                <div className="tx-right">
                  <div className={`tx-amount ${tx.type === 'income' ? 'amount-income' : 'amount-expense'}`}>
                    {tx.type === 'income' ? '+' : '-'}¥{formatAmount(tx.amount)}
                  </div>
                  <div className="tx-date">{format(new Date(tx.date), 'M/d', { locale: ja })}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Expense Categories */}
      {report && report.expense_by_category.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2 className="section-title" style={{ marginBottom: 16 }}>支出カテゴリ</h2>
          <div className="category-bars">
            {report.expense_by_category
              .sort((a, b) => b.total - a.total)
              .slice(0, 5)
              .map(cat => {
                const pct = summary!.total_expense > 0
                  ? Math.round((cat.total / summary!.total_expense) * 100)
                  : 0;
                return (
                  <div key={cat.category_id ?? 'uncategorized'} className="cat-bar-row">
                    <div className="cat-bar-label">{cat.category_name}</div>
                    <div className="cat-bar-track">
                      <div className="cat-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="cat-bar-amount">¥{formatAmount(cat.total)}</div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <style>{`
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 600px) {
          .dashboard-grid {
            grid-template-columns: 1fr 1fr;
          }
          .summary-card-balance {
            grid-column: 1 / -1;
          }
        }
        .summary-card {
          padding: 20px;
        }
        .summary-label {
          font-size: 13px;
          color: var(--color-text-secondary);
          font-weight: 500;
          margin-bottom: 8px;
        }
        .summary-amount {
          font-size: 24px;
          font-weight: 800;
        }
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .section-title {
          font-size: 16px;
          font-weight: 700;
        }
        .tx-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .tx-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid var(--color-border);
        }
        .tx-row:last-child {
          border-bottom: none;
        }
        .tx-icon {
          font-size: 22px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-bg);
          border-radius: 50%;
          flex-shrink: 0;
        }
        .tx-info {
          flex: 1;
          min-width: 0;
        }
        .tx-category {
          font-weight: 600;
          font-size: 14px;
        }
        .tx-memo {
          font-size: 12px;
          color: var(--color-text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .tx-right {
          text-align: right;
          flex-shrink: 0;
        }
        .tx-amount {
          font-size: 15px;
        }
        .tx-date {
          font-size: 12px;
          color: var(--color-text-secondary);
        }
        .category-bars {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .cat-bar-row {
          display: grid;
          grid-template-columns: 80px 1fr 90px;
          align-items: center;
          gap: 10px;
        }
        .cat-bar-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cat-bar-track {
          height: 8px;
          background: var(--color-bg);
          border-radius: 4px;
          overflow: hidden;
        }
        .cat-bar-fill {
          height: 100%;
          background: var(--color-expense);
          border-radius: 4px;
          min-width: 2px;
          transition: width 0.3s;
        }
        .cat-bar-amount {
          font-size: 13px;
          font-weight: 600;
          text-align: right;
        }
      `}</style>
    </div>
  );
}
