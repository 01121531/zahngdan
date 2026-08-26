export const APP_NAME = '轻账';
export const APP_DESCRIPTION = '简洁、私密的个人收支与票据管理工具。';
export const INITIAL_AUTH = { salt: 'sMD7dJYC1pmNInhYiEm7Qg==', hash: 'ZD5Y90ErHGPTxAAUTSCIJj1xoMxCK1D4PpqyABaGBn0=', iterations: 310_000 };
export const PAYMENT_METHODS = ['微信', '支付宝', '银行卡', '信用卡', '现金', '其他'] as const;
export const MAX_ATTACHMENTS = 10;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'], 'image/gif': ['gif'], 'image/heic': ['heic'], 'image/heif': ['heif'],
  'application/pdf': ['pdf'], 'application/msword': ['doc'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-excel': ['xls'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'], 'text/csv': ['csv'], 'text/plain': ['txt'],
};
export const CATEGORY_SEEDS = [
  ['expense-food', 'expense', '餐饮', 'Utensils', '#168477', 10], ['expense-transport', 'expense', '交通', 'Car', '#4f7f9b', 20], ['expense-shopping', 'expense', '购物', 'ShoppingBag', '#c18a3e', 30],
  ['expense-home', 'expense', '居住', 'House', '#8a7563', 40], ['expense-fun', 'expense', '娱乐', 'Gamepad2', '#8066a8', 50], ['expense-health', 'expense', '医疗', 'HeartPulse', '#b15f67', 60],
  ['expense-study', 'expense', '教育', 'GraduationCap', '#4b77a8', 70], ['expense-gift', 'expense', '人情', 'Gift', '#a5677a', 80], ['expense-other', 'expense', '其他', 'MoreHorizontal', '#77837e', 90],
  ['income-salary', 'income', '工资', 'BriefcaseBusiness', '#168477', 10], ['income-bonus', 'income', '奖金', 'BadgeDollarSign', '#4f8b67', 20], ['income-side', 'income', '兼职', 'WalletCards', '#4b77a8', 30],
  ['income-invest', 'income', '理财', 'TrendingUp', '#c18a3e', 40], ['income-refund', 'income', '退款', 'RotateCcw', '#8066a8', 50], ['income-other', 'income', '其他', 'MoreHorizontal', '#77837e', 60],
] as const;
