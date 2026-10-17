// Fixed color per category, derived from the category id so a category keeps
// the same color across months and charts (no DB column needed).
// Index = category id - 1. The order is tuned to the existing categories: the 15 expense
// categories (ids 1-9 and 14-19) get a set checked with the dataviz palette validator
// (light mode, adjacent pairs in id order): lightness, chroma, normal-vision separation and
// contrast pass; CVD separation is in the warn band, which is acceptable because category
// names are always shown next to the color. Ids 10-13 are income/deduction categories.
const CATEGORY_PALETTE = [
  '#2563eb', '#16a34a', '#d97706', '#0284c7', '#7c3aed',
  '#0891b2', '#db2777', '#65a30d', '#9f1239', '#0e7490',
  '#a16207', '#be185d', '#4338ca', '#ea580c', '#4f46e5',
  '#dc2626', '#0d9488', '#c026d3', '#92400e', '#15803d',
];

// Used for transactions without a category
const UNCATEGORIZED_COLOR = '#a8a29e';

export const getCategoryColor = (categoryId: number | null | undefined): string => {
  if (categoryId === null || categoryId === undefined) return UNCATEGORIZED_COLOR;
  return CATEGORY_PALETTE[(categoryId - 1 + CATEGORY_PALETTE.length) % CATEGORY_PALETTE.length];
};
