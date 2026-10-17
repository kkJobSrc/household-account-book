import { useEffect, useState } from 'react';
import { getMonthlyReport, getTrend, getCategoryTrend, getRangeSummary, getCategories } from '../api';
import type { MonthlyReport, MonthlyTrend, CategoryTrend, Category, RangeSummaryResponse, TransactionType } from '../types';
import { getCategoryColor } from '../utils/categoryColor';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';

const formatAmount = (n: number) => n.toLocaleString('ja-JP');

// Number of months shown in the monthly trend chart
const TREND_MONTHS = 12;

const TYPE_LABELS: Record<TransactionType, string> = {
  income: '収入',
  expense: '支出',
  deduction: '控除',
};

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

  // Category selection for the monthly trend chart (empty = income/expense totals)
  const [categories, setCategories] = useState<Category[]>([]);
  const [trendCategoryIds, setTrendCategoryIds] = useState<number[]>([]);
  const [categoryTrend, setCategoryTrend] = useState<CategoryTrend[]>([]);

  // タブ
  const [activeTab, setActiveTab] = useState<'monthly' | 'range'>('monthly');

  // 月次タブのアコーディオン開閉状態
  const [monthlyNetIncomeOpen, setMonthlyNetIncomeOpen] = useState(false);
  const [monthlyExpenseRateOpen, setMonthlyExpenseRateOpen] = useState(false);

  // 期間レポートタブ用state
  const [allPeriod, setAllPeriod] = useState(true);
  const [rangeStartYear, setRangeStartYear] = useState(currentYear);
  const [rangeStartMonth, setRangeStartMonth] = useState(1);
  const [rangeEndYear, setRangeEndYear] = useState(currentYear);
  const [rangeEndMonth, setRangeEndMonth] = useState(currentMonth);
  const [rangeData, setRangeData] = useState<RangeSummaryResponse | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);

  // 期間タブのアコーディオン開閉状態
  const [rangeNetIncomeOpen, setRangeNetIncomeOpen] = useState(false);
  const [rangeExpenseRateOpen, setRangeExpenseRateOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getMonthlyReport(year, month),
      getTrend({ months: TREND_MONTHS })
    ]).then(([rep, tr]) => {
      setReport(rep);
      setTrend(tr);
    }).finally(() => setLoading(false));
  }, [year, month]);

  // 期間レポートの初回取得（全期間）
  useEffect(() => {
    fetchRangeSummary(true);
    getCategories().then(setCategories);
  }, []);

  // カテゴリ別の月次推移（カテゴリ選択時のみ取得）
  useEffect(() => {
    if (trendCategoryIds.length === 0) {
      setCategoryTrend([]);
      return;
    }
    getCategoryTrend({ months: TREND_MONTHS, category_id: trendCategoryIds }).then(setCategoryTrend);
  }, [trendCategoryIds]);

  const toggleTrendCategory = (id: number) => {
    setTrendCategoryIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

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

  // Stacked data per category: every month in the window gets a row (missing = 0)
  const trendMonths = Array.from({ length: TREND_MONTHS }, (_, i) => {
    const d = new Date(currentYear, currentMonth - TREND_MONTHS + i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
  const selectedTrendCategories = categories.filter(c => trendCategoryIds.includes(c.id));
  const categoryTrendData = trendMonths.map(({ year: y, month: m }) => {
    const row: Record<string, string | number> = { name: `${m}月` };
    selectedTrendCategories.forEach(c => {
      row[`c${c.id}`] = categoryTrend
        .filter(t => t.year === y && t.month === m && t.category_id === c.id)
        .reduce((sum, t) => sum + t.total, 0);
    });
    return row;
  });

  // Expense breakdown: amount desc (backend order), ratio against the month's expense total
  const expenseTotal = report?.expense_by_category.reduce((sum, c) => sum + c.total, 0) ?? 0;
  const expensePieData = [...(report?.expense_by_category ?? [])]
    .sort((a, b) => b.total - a.total)
    .map(c => ({
      categoryId: c.category_id,
      name: c.category_name,
      value: c.total,
      ratio: expenseTotal > 0 ? (c.total / expenseTotal) * 100 : 0,
    }));

  // 期間レポートのカテゴリ別データ
  const rangeByCatIncome = rangeData?.by_category.filter(c => c.type === 'income') ?? [];
  const rangeByCatExpense = rangeData?.by_category.filter(c => c.type === 'expense') ?? [];
  const rangeByCatDeduction = rangeData?.by_category.filter(c => c.type === 'deduction') ?? [];

  // 月次レポート: 手取り・支出率の計算
  const monthlyTotalIncome = report?.summary.total_income ?? 0;
  const monthlyTotalDeduction = report?.summary.total_deduction ?? 0;
  const monthlyTotalExpense = report?.summary.total_expense ?? 0;
  const monthlyNetIncome = monthlyTotalIncome - monthlyTotalDeduction;
  const monthlyExpenseRateDisplay = monthlyNetIncome > 0
    ? `${(monthlyTotalExpense / monthlyNetIncome * 100).toFixed(1)}%`
    : '--';

  // 期間レポート: 手取り・支出率の計算
  const rangeTotalIncome = rangeData?.total_income ?? 0;
  const rangeTotalDeduction = rangeData?.total_deduction ?? 0;
  const rangeTotalExpense = rangeData?.total_expense ?? 0;
  const rangeNetIncome = rangeTotalIncome - rangeTotalDeduction;
  const rangeExpenseRateDisplay = rangeNetIncome > 0
    ? `${(rangeTotalExpense / rangeNetIncome * 100).toFixed(1)}%`
    : '--';

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

                {/* 手取りアコーディオンカード */}
                <div
                  className="card report-card report-accordion-card"
                  onClick={() => setMonthlyNetIncomeOpen(o => !o)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setMonthlyNetIncomeOpen(o => !o); }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={monthlyNetIncomeOpen}
                >
                  <div className="report-accordion-header">
                    <div>
                      <div className="report-card-label">手取り</div>
                      <div className="report-card-amount amount-income">
                        ¥{formatAmount(monthlyNetIncome)}
                      </div>
                    </div>
                    <span className="report-accordion-toggle">{monthlyNetIncomeOpen ? '△' : '▽'}</span>
                  </div>
                  {monthlyNetIncomeOpen && (
                    <ul className="report-accordion-detail-list">
                      <li className="report-accordion-detail-item">
                        <span className="report-accordion-detail-label">収入</span>
                        <span className="report-accordion-detail-value amount-income">¥{formatAmount(monthlyTotalIncome)}</span>
                      </li>
                      <li className="report-accordion-detail-item">
                        <span className="report-accordion-detail-label">控除</span>
                        <span className="report-accordion-detail-value amount-expense">¥{formatAmount(monthlyTotalDeduction)}</span>
                      </li>
                    </ul>
                  )}
                </div>

                {/* 支出合計カード（変更なし） */}
                <div className="card report-card">
                  <div className="report-card-label">支出合計</div>
                  <div className="report-card-amount amount-expense">
                    ¥{formatAmount(report.summary.total_expense)}
                  </div>
                </div>

                {/* 収支カード（変更なし） */}
                <div className="card report-card">
                  <div className="report-card-label">収支</div>
                  <div className={`report-card-amount ${report.summary.balance >= 0 ? 'amount-income' : 'amount-expense'}`}>
                    {report.summary.balance >= 0 ? '+' : ''}¥{formatAmount(report.summary.balance)}
                  </div>
                </div>

                {/* 支出率アコーディオンカード */}
                <div
                  className="card report-card report-accordion-card"
                  onClick={() => setMonthlyExpenseRateOpen(o => !o)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setMonthlyExpenseRateOpen(o => !o); }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={monthlyExpenseRateOpen}
                >
                  <div className="report-accordion-header">
                    <div>
                      <div className="report-card-label">支出率</div>
                      <div className={`report-card-amount ${monthlyNetIncome > 0 ? 'amount-expense' : ''}`}>
                        {monthlyExpenseRateDisplay}
                      </div>
                    </div>
                    <span className="report-accordion-toggle">{monthlyExpenseRateOpen ? '△' : '▽'}</span>
                  </div>
                  {monthlyExpenseRateOpen && (
                    <ul className="report-accordion-detail-list">
                      {report.by_member.length > 0 ? (
                        report.by_member
                          .sort((a, b) => b.total_expense - a.total_expense)
                          .map((m, i) => {
                            const memberNet = m.total_income - m.total_deduction;
                            const memberRateDisplay = memberNet > 0
                              ? `${(m.total_expense / memberNet * 100).toFixed(1)}%`
                              : '--';
                            return (
                              <li key={i} className="report-accordion-detail-item">
                                <span className="report-accordion-detail-label">{m.member_name}</span>
                                <span className="report-accordion-detail-value">{memberRateDisplay}</span>
                              </li>
                            );
                          })
                      ) : (
                        <li className="report-accordion-detail-item">
                          <span className="report-accordion-detail-label" style={{ color: 'var(--color-text-secondary)' }}>メンバーデータなし</span>
                        </li>
                      )}
                    </ul>
                  )}
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
                          {expensePieData.map(item => (
                            <Cell key={item.categoryId ?? 'none'} fill={getCategoryColor(item.categoryId)} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => `¥${formatAmount(v)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pie-legend">
                      {expensePieData.map(item => (
                        <div key={item.categoryId ?? 'none'} className="pie-legend-item">
                          <span className="pie-legend-dot" style={{ background: getCategoryColor(item.categoryId) }} />
                          <span className="pie-legend-name">{item.name}</span>
                          <span className="pie-legend-ratio">{item.ratio.toFixed(1)}%</span>
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
                  <div className="trend-header">
                    <h2 className="section-title">月次推移（直近{TREND_MONTHS}ヶ月）</h2>
                    {trendCategoryIds.length > 0 && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setTrendCategoryIds([])}>
                        収入・支出の合計に戻す
                      </button>
                    )}
                  </div>

                  {/* Category picker: grouped by type, multiple selection */}
                  <div className="trend-category-picker">
                    {(['expense', 'income', 'deduction'] as TransactionType[]).map(type => {
                      const typeCategories = categories.filter(c => c.type === type);
                      if (typeCategories.length === 0) return null;
                      return (
                        <div key={type} className="trend-category-group">
                          <span className="trend-category-group-label">{TYPE_LABELS[type]}</span>
                          {typeCategories.map(c => {
                            const selected = trendCategoryIds.includes(c.id);
                            return (
                              <button
                                key={c.id}
                                className={`trend-category-chip ${selected ? 'selected' : ''}`}
                                style={selected ? { borderColor: getCategoryColor(c.id), background: getCategoryColor(c.id) + '1f' } : undefined}
                                onClick={() => toggleTrendCategory(c.id)}
                                aria-pressed={selected}
                              >
                                <span className="trend-category-dot" style={{ background: getCategoryColor(c.id) }} />
                                {c.name}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>

                  <ResponsiveContainer width="100%" height={300}>
                    {trendCategoryIds.length === 0 ? (
                      <BarChart data={trendData} margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/10000).toFixed(0)}万`} />
                        <Tooltip formatter={(v: number) => `¥${formatAmount(v)}`} />
                        <Legend />
                        <Bar dataKey="収入" fill="#16a34a" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="支出" fill="#dc2626" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    ) : (
                      <BarChart data={categoryTrendData} margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/10000).toFixed(1)}万`} />
                        <Tooltip formatter={(v: number) => `¥${formatAmount(v)}`} />
                        <Legend />
                        {selectedTrendCategories.map(c => (
                          <Bar key={c.id} dataKey={`c${c.id}`} name={c.name} stackId="category" fill={getCategoryColor(c.id)} stroke="var(--color-surface)" strokeWidth={2} />
                        ))}
                      </BarChart>
                    )}
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

                {/* 手取りアコーディオンカード */}
                <div
                  className="card report-card report-accordion-card"
                  onClick={() => setRangeNetIncomeOpen(o => !o)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setRangeNetIncomeOpen(o => !o); }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={rangeNetIncomeOpen}
                >
                  <div className="report-accordion-header">
                    <div>
                      <div className="report-card-label">手取り</div>
                      <div className="report-card-amount amount-income">
                        ¥{formatAmount(rangeNetIncome)}
                      </div>
                    </div>
                    <span className="report-accordion-toggle">{rangeNetIncomeOpen ? '△' : '▽'}</span>
                  </div>
                  {rangeNetIncomeOpen && (
                    <ul className="report-accordion-detail-list">
                      <li className="report-accordion-detail-item">
                        <span className="report-accordion-detail-label">収入</span>
                        <span className="report-accordion-detail-value amount-income">¥{formatAmount(rangeTotalIncome)}</span>
                      </li>
                      <li className="report-accordion-detail-item">
                        <span className="report-accordion-detail-label">控除</span>
                        <span className="report-accordion-detail-value amount-expense">¥{formatAmount(rangeTotalDeduction)}</span>
                      </li>
                    </ul>
                  )}
                </div>

                {/* 支出合計カード（変更なし） */}
                <div className="card report-card">
                  <div className="report-card-label">支出合計</div>
                  <div className="report-card-amount amount-expense">
                    ¥{formatAmount(rangeData.total_expense)}
                  </div>
                </div>

                {/* 収支カード（変更なし） */}
                <div className="card report-card">
                  <div className="report-card-label">収支</div>
                  <div className={`report-card-amount ${rangeData.balance >= 0 ? 'amount-income' : 'amount-expense'}`}>
                    {rangeData.balance >= 0 ? '+' : ''}¥{formatAmount(rangeData.balance)}
                  </div>
                </div>

                {/* 支出率アコーディオンカード（全体のみ、メンバー別なし） */}
                <div
                  className="card report-card report-accordion-card"
                  onClick={() => setRangeExpenseRateOpen(o => !o)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setRangeExpenseRateOpen(o => !o); }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={rangeExpenseRateOpen}
                >
                  <div className="report-accordion-header">
                    <div>
                      <div className="report-card-label">支出率</div>
                      <div className={`report-card-amount ${rangeNetIncome > 0 ? 'amount-expense' : ''}`}>
                        {rangeExpenseRateDisplay}
                      </div>
                    </div>
                    <span className="report-accordion-toggle">{rangeExpenseRateOpen ? '△' : '▽'}</span>
                  </div>
                  {rangeExpenseRateOpen && (
                    <ul className="report-accordion-detail-list">
                      <li className="report-accordion-detail-item">
                        <span className="report-accordion-detail-label" style={{ color: 'var(--color-text-secondary)' }}>
                          メンバー別データなし
                        </span>
                      </li>
                    </ul>
                  )}
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
        .report-accordion-card {
          cursor: pointer;
          user-select: none;
          text-align: left;
        }
        .report-accordion-card:hover {
          opacity: 0.85;
        }
        .report-accordion-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }
        .report-accordion-toggle {
          font-size: 14px;
          color: var(--color-text-secondary);
          margin-top: 4px;
          flex-shrink: 0;
        }
        .report-accordion-detail-list {
          list-style: none;
          margin: 10px 0 0 0;
          padding: 0;
          border-top: 1px solid var(--color-border);
          padding-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .report-accordion-detail-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
        }
        .report-accordion-detail-label {
          color: var(--color-text-secondary);
          font-weight: 500;
        }
        .report-accordion-detail-value {
          font-weight: 600;
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
        .pie-legend-ratio {
          font-size: 13px;
          color: var(--color-text-secondary);
          min-width: 48px;
          text-align: right;
        }
        .pie-legend-val {
          font-size: 13px;
          font-weight: 600;
          min-width: 72px;
          text-align: right;
        }
        .trend-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .trend-category-picker {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }
        .trend-category-group {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .trend-category-group-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-secondary);
          min-width: 32px;
        }
        .trend-category-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border: 1px solid var(--color-border);
          border-radius: 99px;
          background: var(--color-surface);
          font-size: 13px;
          color: var(--color-text);
          cursor: pointer;
        }
        .trend-category-chip.selected {
          font-weight: 600;
        }
        .trend-category-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
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
