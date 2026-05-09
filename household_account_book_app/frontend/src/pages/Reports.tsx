import { useEffect, useState } from 'react';
import { getMonthlyReport, getTrend } from '../api';
import type { MonthlyReport, MonthlyTrend } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';

const formatAmount = (n: number) => n.toLocaleString('ja-JP');
const PIE_COLORS = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#065f46','#78716c','#0284c7'];

export default function Reports() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [trend, setTrend] = useState<MonthlyTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'monthly' | 'trend'>('monthly');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getMonthlyReport(year, month),
      getTrend(12)
    ]).then(([rep, tr]) => {
      setReport(rep);
      setTrend(tr);
    }).finally(() => setLoading(false));
  }, [year, month]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const trendData = trend.map(t => ({
    name: `${t.month}月`,
    収入: t.total_income,
    支出: t.total_expense,
  }));

  const expensePieData = report?.expense_by_category.map(c => ({
    name: c.category_name,
    value: c.total
  })) ?? [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">レポート</h1>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        <button className={`tab ${activeTab === 'monthly' ? 'active' : ''}`} onClick={() => setActiveTab('monthly')}>
          月次レポート
        </button>
        <button className={`tab ${activeTab === 'trend' ? 'active' : ''}`} onClick={() => setActiveTab('trend')}>
          推移グラフ
        </button>
      </div>

      {activeTab === 'monthly' && (
        <div>
          {/* Month Selector */}
          <div className="month-nav" style={{ marginBottom: 20 }}>
            <button className="btn btn-ghost btn-sm" onClick={prevMonth}>‹</button>
            <span className="month-label" style={{ fontWeight: 700 }}>{year}年{month}月</span>
            <button className="btn btn-ghost btn-sm" onClick={nextMonth}>›</button>
          </div>

          {loading ? (
            <div className="loading">読み込み中...</div>
          ) : report ? (
            <>
              {/* Summary */}
              <div className="report-summary-grid">
                <div className="card report-card">
                  <div className="report-card-label">収入合計</div>
                  <div className="report-card-amount amount-income">
                    ¥{formatAmount(report.summary.total_income)}
                  </div>
                </div>
                <div className="card report-card">
                  <div className="report-card-label">支出合計</div>
                  <div className="report-card-amount amount-expense">
                    ¥{formatAmount(report.summary.total_expense)}
                  </div>
                </div>
                <div className="card report-card">
                  <div className="report-card-label">控除額</div>
                  <div className="report-card-amount amount-expense">
                    ¥{formatAmount(report.summary.total_deduction)}
                  </div>
                </div>
                <div className="card report-card">
                  <div className="report-card-label">収支</div>
                  <div className={`report-card-amount ${report.summary.balance >= 0 ? 'amount-income' : 'amount-expense'}`}>
                    {report.summary.balance >= 0 ? '+' : ''}¥{formatAmount(report.summary.balance)}
                  </div>
                </div>
              </div>

              {/* Expense Pie Chart */}
              {expensePieData.length > 0 && (
                <div className="card" style={{ marginTop: 20 }}>
                  <h2 className="section-title" style={{ marginBottom: 16 }}>支出内訳</h2>
                  <div className="pie-layout">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={expensePieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {expensePieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => `¥${formatAmount(v)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pie-legend">
                      {expensePieData.map((item, i) => (
                        <div key={i} className="pie-legend-item">
                          <span className="pie-legend-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="pie-legend-name">{item.name}</span>
                          <span className="pie-legend-val">¥{formatAmount(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* By Member */}
              {report.by_member.length > 0 && (
                <div className="card" style={{ marginTop: 20 }}>
                  <h2 className="section-title" style={{ marginBottom: 16 }}>メンバー別支出</h2>
                  <div className="member-report-list">
                    {report.by_member
                      .sort((a, b) => b.total_expense - a.total_expense)
                      .map((m, i) => (
                        <div key={i} className="member-report-row">
                          <div className="member-report-name">{m.member_name}</div>
                          <div className="member-report-amounts">
                            <span className="amount-expense">支出 ¥{formatAmount(m.total_expense)}</span>
                            {m.total_income > 0 && (
                              <span className="amount-income">収入 ¥{formatAmount(m.total_income)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {activeTab === 'trend' && (
        <div>
          {loading ? (
            <div className="loading">読み込み中...</div>
          ) : trend.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <p>まだデータがありません</p>
              </div>
            </div>
          ) : (
            <div className="card">
              <h2 className="section-title" style={{ marginBottom: 20 }}>月次推移（直近12ヶ月）</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={trendData} margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/10000).toFixed(0)}万`} />
                  <Tooltip formatter={(v: number) => `¥${formatAmount(v)}`} />
                  <Legend />
                  <Bar dataKey="収入" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="支出" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <style>{`
        .month-nav {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 0;
        }
        .month-label {
          min-width: 100px;
          text-align: center;
        }
        .report-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        @media (max-width: 600px) {
          .report-summary-grid {
            grid-template-columns: 1fr 1fr;
          }
          .report-card:last-child {
            grid-column: 1 / -1;
          }
        }
        .report-card {
          text-align: center;
        }
        .report-card-label {
          font-size: 13px;
          color: var(--color-text-secondary);
          margin-bottom: 8px;
          font-weight: 500;
        }
        .report-card-amount {
          font-size: 20px;
          font-weight: 800;
        }
        .pie-layout {
          display: flex;
          gap: 20px;
          align-items: center;
          flex-wrap: wrap;
        }
        .pie-legend {
          flex: 1;
          min-width: 160px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pie-legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .pie-legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .pie-legend-name {
          flex: 1;
          font-size: 13px;
          color: var(--color-text-secondary);
        }
        .pie-legend-val {
          font-size: 13px;
          font-weight: 600;
        }
        .section-title {
          font-size: 16px;
          font-weight: 700;
        }
        .member-report-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .member-report-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid var(--color-border);
        }
        .member-report-row:last-child {
          border-bottom: none;
        }
        .member-report-name {
          font-weight: 600;
        }
        .member-report-amounts {
          display: flex;
          gap: 16px;
          font-size: 14px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
