import api from './client';
import type { Member, Category, Transaction, TransactionCreate, MonthlyReport, MonthlyTrend, RangeSummaryResponse, ScheduledTransaction, ScheduledTransactionCreate } from '../types';

// Members
export const getMembers = () => api.get<Member[]>('/members/').then(r => r.data);
export const createMember = (data: { name: string; color: string }) => api.post<Member>('/members/', data).then(r => r.data);
export const updateMember = (id: number, data: Partial<{ name: string; color: string }>) => api.put<Member>(`/members/${id}`, data).then(r => r.data);
export const deleteMember = (id: number) => api.delete(`/members/${id}`);

// Categories
export const getCategories = (type?: string) => api.get<Category[]>('/categories/', { params: type ? { type } : {} }).then(r => r.data);
export const createCategory = (data: { name: string; type: string; icon?: string; memo?: string }) => api.post<Category>('/categories/', data).then(r => r.data);
export const updateCategory = (id: number, data: Partial<{ name: string; type: string; icon: string; memo: string }>) => api.put<Category>(`/categories/${id}`, data).then(r => r.data);
export const deleteCategory = (id: number) => api.delete(`/categories/${id}`);

// Transaction filter/sort parameters
export interface GetTransactionsParams {
  year?: number;
  month?: number;
  // Multi-value type filter: sends as ?type=income&type=expense (OR join)
  type?: string[];
  // Multi-value member filter: sends as ?member_id=1&member_id=2 (OR join)
  member_id?: number[];
  // Multi-value category filter: sends as ?category_id=1&category_id=2 (OR join)
  category_id?: number[];
  // Date range filter
  date_from?: string;
  date_to?: string;
  // Sort parameters
  sort_by?: 'date' | 'amount' | 'created_at';
  sort_order?: 'asc' | 'desc';
  skip?: number;
  limit?: number;
}

// Transactions
// Uses URLSearchParams to correctly serialize repeated keys for array parameters
export const getTransactions = (params?: GetTransactionsParams) => {
  const searchParams = new URLSearchParams();
  if (params) {
    if (params.year !== undefined) searchParams.set('year', String(params.year));
    if (params.month !== undefined) searchParams.set('month', String(params.month));
    // Repeated key for OR filter: ?type=income&type=expense
    (params.type ?? []).forEach(v => searchParams.append('type', v));
    (params.member_id ?? []).forEach(v => searchParams.append('member_id', String(v)));
    (params.category_id ?? []).forEach(v => searchParams.append('category_id', String(v)));
    if (params.date_from) searchParams.set('date_from', params.date_from);
    if (params.date_to) searchParams.set('date_to', params.date_to);
    if (params.sort_by) searchParams.set('sort_by', params.sort_by);
    if (params.sort_order) searchParams.set('sort_order', params.sort_order);
    if (params.skip !== undefined) searchParams.set('skip', String(params.skip));
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
  }
  return api.get<Transaction[]>('/transactions/', { params: searchParams }).then(r => r.data);
};

export const createTransaction = (data: TransactionCreate) => api.post<Transaction>('/transactions/', data).then(r => r.data);
export const updateTransaction = (id: number, data: Partial<TransactionCreate>) => api.put<Transaction>(`/transactions/${id}`, data).then(r => r.data);
export const deleteTransaction = (id: number) => api.delete(`/transactions/${id}`);

// Reports
export const getMonthlyReport = (year: number, month: number) => api.get<MonthlyReport>(`/reports/monthly/${year}/${month}`).then(r => r.data);

export const getTrend = (params?: {
  months?: number;
  start_year?: number;
  start_month?: number;
  end_year?: number;
  end_month?: number;
}) => api.get<MonthlyTrend[]>('/reports/trend', { params }).then(r => r.data);

export const getRangeSummary = (params?: {
  start_year?: number;
  start_month?: number;
  end_year?: number;
  end_month?: number;
}) => api.get<RangeSummaryResponse>('/reports/range', { params }).then(r => r.data);

// Scheduled Transactions
export const getScheduledTransactions = (is_active?: boolean) =>
  api.get<ScheduledTransaction[]>('/scheduled-transactions/', {
    params: is_active !== undefined ? { is_active } : {}
  }).then(r => r.data);

export const createScheduledTransaction = (data: ScheduledTransactionCreate) =>
  api.post<ScheduledTransaction>('/scheduled-transactions/', data).then(r => r.data);

export const updateScheduledTransaction = (
  id: number,
  data: Partial<ScheduledTransactionCreate>
) => api.put<ScheduledTransaction>(`/scheduled-transactions/${id}`, data).then(r => r.data);

export const deleteScheduledTransaction = (id: number) =>
  api.delete(`/scheduled-transactions/${id}`);

export const applyScheduledTransactions = () =>
  api.post<{ applied: number; skipped: number }>('/scheduled-transactions/apply').then(r => r.data);
