import { loadState } from './storage.js';
const theme = loadState().theme;
if (theme !== 'system') document.documentElement.dataset.theme = theme;
