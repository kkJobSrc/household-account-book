import { useEffect, useState } from 'react';
import { getMonthlyReport, getTrend, getRangeSummary } from '../api';
import type { MonthlyReport, MonthlyTrend, RangeSummaryResponse } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';

const formatAmount = (n: number) => n.toLocaleString('ja-JP');
const PIE_COLORS = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#065f46','#78716c','#0284c7'];

const YEAR_OPTIONS = Array.from({ length: new Date().getFullYear() - 2019 }, (_, i) => 2020 + i);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function Reports() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 月次レポートタブ用state
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [trend, setTrend] = useState<MonthlyTrend[]>([]);
  const [loading, setLoading] = useState(true);

  // タブ
  const [activeTab, setActiveTab] = useState<'monthly' | 'range'>('monthly');

  // 期間レポートタブ用state
  const [allPeriod, setAllPeriod] = useState(true);
  const [rangeStartYear, setRangeStartYear] = useState(currentYear);
  const [rangeStartMonth, setRangeStartMonth] = useState(1);
  const [rangeEndYear, setRangeEndYear] = useState(currentYear);
  const [rangeEndMonth, setRangeEndMonth] = useState(currentMonth);
  const [rangeData, setRangeData] = useState<RangeSummaryResponse | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getMonthlyReport(year, month),
      getTrend({ months: 12 })
    ]).then(([rep, tr]) => {
      setReport(rep);
      setTrend(tr);
    }).finally(() => setLoading(false));
  }, [year, month]);

  // 期間レポートの初回取得（全期間）
  useEffect(() => {
    fetchRangeSummary(true);
  }, []);

  const fetchRangeSummary = (forceAllPeriod?: boolean) => {
    const isAll = forceAllPeriod !== undefined ? forceAllPeriod : allPeriod;
    setRangeLoading(true);
    setRangeError(null);
    const params = isAll ? undefined : {
      start_year: rangeStartYear,
      start_month: rangeStartMonth,
      end_year: rangeEndYear,
      end_month: rangeEndMonth,
    };
    getRangeSummary(params)
      .then(data => setRangeData(data))
      .catch(err => {
        console.error('getRangeSummary error:', err);
        setRangeError('集計中にエラーが発生しました');
      })
      .finally(() => setRangeLoading(false));
  };

  const handleRangeFetch = () => {
    if (!allPeriod) {
      // 4つすべて揃っているか確認（プルダウンなので常に揃っているが念のため）
      if (!rangeStartYear || !rangeStartMonth || !rangeEndYear || !rangeEndMonth) return;
    }
    fetchRangeSummary();
  };

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

  // 期間レポートのカテゴリ別データ
  const rangeByCatIncome = rangeData?.by_category.filter(c => c.type === 'income') ?? [];
  const rangeByCatExpense = rangeData?.by_category.filter(c => c.type === 'expense') ?? [];
  const rangeByCatDeduction = rangeData?.by_category.filter(c => c.type === 'deduction') ?? [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">レポート</h1>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        <button className={`tab ${activeTab === 'monthly' ? 'active' : ''}`} onClick={() => setActiveTab('monthly')}>
          月次レポート
        </button>
        <button className={`tab ${activeTab === 'range' ? 'active' : ''}`} onClick={() => setActiveTab('range')}>
          期間レポート
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

              {/* Monthly Trend */}
              {trend.length === 0 ? (
                <div className="card" style={{ marginTop: 20 }}>
                  <div className="empty-state">
                    <div className="empty-state-icon">📊</div>
                    <p>まだデータがありません</p>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ marginTop: 20 }}>
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
            </>
          ) : null}
        </div>
      )}

      {activeTab === 'range' && (
        <div>
          {/* Period Selector */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 className="section-title" style={{ marginBottom: 16 }}>集計期間</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={allPeriod}
                  onChange={e => setAllPeriod(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                全期間
              </label>
            </div>
            {!allPeriod && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <select
                  className="form-select"
                  value={rangeStartYear}
                  onChange={e => setRangeStartYear(Number(e.target.value))}
                >
                  {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}年</option>)}
                </select>
                <select
                  className="form-select"
                  value={rangeStartMonth}
                  onChange={e => setRangeStartMonth(Number(e.target.value))}
                >
                  {MONTH_OPTIONS.map(m => <option key={m} value={m}>{m}月</option>)}
                </select>
                <span style={{ color: 'var(--color-text-secondary)' }}>〜</span>
                <select
                  className="form-select"
                  value={rangeEndYear}
                  onChange={e => setRangeEndYear(Number(e.target.value))}
                >
                  {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}年</option>)}
                </select>
                <select
                  className="form-select"
                  value={rangeEndMonth}
                  onChange={e => setRangeEndMonth(Number(e.target.value))}
                >
                  {MONTH_OPTIONS.map(m => <option key={m} value={m}>{m}月</option>)}
                </select>
              </div>
            )}
            <button className="btn btn-primary" onClick={handleRangeFetch} disabled={rangeLoading}>
              {rangeLoading ? '集計中...' : '集計'}
            </button>
          </div>

          {rangeLoading ? (
            <div className="loading">読み込み中...</div>
          ) : rangeError ? (
            <div className="card">
              <p style={{ color: 'var(--color-expense)', textAlign: 'center' }}>{rangeError}</p>
            </div>
          ) : rangeData ? (
            <>
              {/* Period Label */}
              <div style={{ marginBottom: 16, fontWeight: 700, fontSize: 16, color: 'var(--color-text-secondary)' }}>
                集計期間: {rangeData.period_label}
              </div>

              {/* Summary Cards */}
              <div className="report-summary-grid">
                <div className="card report-card">
                  <div className="report-card-label">収入合計</div>
                  <div className="report-card-amount amount-income">
                    ¥{formatAmount(rangeData.total_income)}
                  </div>
                </div>
                <div className="card report-card">
                  <div className="report-card-label">支出合計</div>
                  <div className="report-card-amount amount-expense">
                    ¥{formatAmount(rangeData.total_expense)}
                  </div>
                </div>
                <div className="card report-card">
                  <div className="report-card-label">収支</div>
                  <div className={`report-card-amount ${rangeData.balance >= 0 ? 'amount-income' : 'amount-expense'}`}>
                    {rangeData.balance >= 0 ? '+' : ''}¥{formatAmount(rangeData.balance)}
                  </div>
                </div>
              </div>

              {/* By Category - Income */}
              <div className="card" style={{ marginTop: 20 }}>
                <h2 className="section-title" style={{ marginBottom: 16 }}>カテゴリ別収入</h2>
                {rangeByCatIncome.length === 0 ? (
                  <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '16px 0' }}>データなし</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(120, rangeByCatIncome.length * 40)}>
                    <BarChart
                      data={rangeByCatIncome.map(c => ({ name: c.category_name, 金額: c.total }))}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v/10000).toFixed(0)}万`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                      <Tooltip formatter={(v: number) => `¥${formatAmount(v)}`} />
                      <Bar dataKey="金額" fill="#16a34a" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* By Category - Expense */}
              <div className="card" style={{ marginTop: 20 }}>
                <h2 className="section-title" style={{ marginBottom: 16 }}>カテゴリ別支出</h2>
                {rangeByCatExpense.length === 0 ? (
                  <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '16px 0' }}>データなし</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(120, rangeByCatExpense.length * 40)}>
                    <BarChart
                      data={rangeByCatExpense.map(c => ({ name: c.category_name, 金額: c.total }))}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v/10000).toFixed(0)}万`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                      <Tooltip formatter={(v: number) => `¥${formatAmount(v)}`} />
                      <Bar dataKey="金額" fill="#dc2626" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* By Category - Deduction */}
              <div className="card" style={{ marginTop: 20 }}>
                <h2 className="section-title" style={{ marginBottom: 16 }}>カテゴリ別控除</h2>
                {rangeByCatDeduction.length === 0 ? (
                  <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '16px 0' }}>データなし</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(120, rangeByCatDeduction.length * 40)}>
                    <BarChart
                      data={rangeByCatDeduction.map(c => ({ name: c.category_name, 金額: c.total }))}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v/10000).toFixed(0)}万`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                      <Tooltip formatter={(v: number) => `¥${formatAmount(v)}`} />
                      <Bar dataKey="金額" fill="#d97706" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* By Member */}
              <div className="card" style={{ marginTop: 20 }}>
                <h2 className="section-title" style={{ marginBottom: 16 }}>メンバー別内訳</h2>
                {rangeData.by_member.length === 0 ? (
                  <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '16px 0' }}>データなし</p>
                ) : (
                  <div className="member-report-list">
                    {rangeData.by_member
                      .sort((a, b) => b.total_expense - a.total_expense)
                      .map((m, i) => (
                        <div key={i} className="member-report-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              background: m.color,
                              display: 'inline-block',
                              flexShrink: 0
                            }} />
                            <span className="member-report-name">{m.member_name}</span>
                          </div>
                          <div className="member-report-amounts">
                            <span className="amount-income">収入 ¥{formatAmount(m.total_income)}</span>
                            <span className="amount-expense">支出 ¥{formatAmount(m.total_expense)}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
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
        .form-select {
          padding: 6px 10px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-surface);
          color: var(--color-text);
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
