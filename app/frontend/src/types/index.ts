export type TransactionType = 'income' | 'expense' | 'deduction';

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
  scheduled_transaction_id?: number | null;
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

export interface ScheduledTransaction {
  id: number;
  name: string;
  type: TransactionType;
  amount: number;
  category_id: number | null;
  member_id: number | null;
  day_of_month: number;
  memo: string;
  is_active: boolean;
  created_at: string;
  member: Member | null;
  category: Category | null;
}

export interface ScheduledTransactionCreate {
  name: string;
  type: TransactionType;
  amount: number;
  category_id?: number | null;
  member_id?: number | null;
  day_of_month: number;
  memo?: string;
  is_active?: boolean;
}

export interface MonthlySummary {
  year: number;
  month: number;
  total_income: number;
  total_expense: number;
  total_deduction: number;
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
  total_deduction: number;
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
  total_deduction: number;
  balance: number;
}

export interface RangeSummaryByCat {
  category_id: number | null;
  category_name: string;
  type: 'income' | 'expense' | 'deduction';
  total: number;
}

export interface RangeSummaryByMember {
  member_id: number | null;
  member_name: string;
  color: string;
  total_income: number;
  total_expense: number;
}

export interface RangeSummaryResponse {
  period_label: string;
  total_income: number;
  total_expense: number;
  total_deduction: number;
  balance: number;
  by_category: RangeSummaryByCat[];
  by_member: RangeSummaryByMember[];
}

export type OcrStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ReceiptImage {
  id: number;
  member_id: number | null;
  file_hash: string;
  file_size: number;
  width: number;
  height: number;
  mime_type: string;
  ocr_status: OcrStatus;
  ocr_processed_at: string | null;
  created_at: string;
}

export interface ReceiptImageUploadResult extends ReceiptImage {
  duplicate: boolean;
}

export interface RejectedFile {
  filename: string;
  reason: string;
}

export interface ReceiptImageUploadResponse {
  uploaded: ReceiptImageUploadResult[];
  rejected: RejectedFile[];
}
