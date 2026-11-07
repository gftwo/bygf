import { App } from './core.js';

App.State = {
    user: null,
    isAdmin: false,
    isPremium: true,
    transactions: [], recurring: [], customCategories: [], goals: [], budgets: [], paylaters: [], transfers: [], debts: [], quickTemplates: [], trashedTransactions: [],
    budgetAllocation: { total: 1300000, splits: { pokok: 50, kuliah: 20, fleksibel: 30 } },
    categoryBucketMap: { jajan: 'pokok', uang_mingguan: 'fleksibel', shopping: 'fleksibel', gift: 'fleksibel', lainnya: 'fleksibel' },
    settings: { reminderEnabled: false, reminderTime: '20:00', morningEnabled: false, morningTime: '08:00', budgetAlertEnabled: false, theme: 'light', accentHue: 244, themePreset: 'klasik' },
    isLoading: true, charts: {}, searchTimer: null
};
