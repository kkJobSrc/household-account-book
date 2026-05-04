export type TransactionType = 'income' | 'expense';

export interface Member {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  type: TransactionType;
  icon: string;
  memo: string;
  created_at: string;
}

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  date: string;
  memo: string;
  member_id: number | null;
  category_id: number | null;
  member: Member | null;
  category: Category | null;
  created_at: string;
}

export interface TransactionCreate {
  type: TransactionType;
  amount: number;
  date: string;
  memo?: string;
  member_id?: number | null;
  category_id?: number | null;
}

export interface MonthlySummary {
  year: number;
  month: number;
  total_income: number;
  total_expense: number;
  balance: number;
}

export interface CategorySummary {
  category_id: number | null;
  category_name: string;
  total: number;
  count: number;
}

export interface MemberSummary {
  member_id: number | null;
  member_name: string;
  total_expense: number;
  total_income: number;
}

export interface MonthlyReport {
  summary: MonthlySummary;
  expense_by_category: CategorySummary[];
  income_by_category: CategorySummary[];
  by_member: MemberSummary[];
}

export interface MonthlyTrend {
  year: number;
  month: number;
  total_income: number;
  total_expense: number;
  balance: number;
}
