import api from './client';
import type { Member, Category, Transaction, TransactionCreate, MonthlyReport, MonthlyTrend, RangeSummaryResponse } from '../types';

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

// Transactions
export const getTransactions = (params?: {
  year?: number;
  month?: number;
  type?: string;
  member_id?: number;
  skip?: number;
  limit?: number;
}) => api.get<Transaction[]>('/transactions/', { params }).then(r => r.data);

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
