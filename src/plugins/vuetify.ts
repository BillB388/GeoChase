/**
 * plugins/vuetify.ts
 *
 * Framework documentation: https://vuetifyjs.com`
 */

// Composables
import { createVuetify } from 'vuetify';
import { applyWorkspaceTheme, readTheme, themes } from '@/services/themes';
// Styles
import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';

const initialTheme = readTheme();
applyWorkspaceTheme(initialTheme, false);

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
export default createVuetify({
  defaults: {
    VBtn: { rounded: 'lg', style: 'text-transform: none; letter-spacing: 0; font-weight: 500;' },
    VTextField: { color: 'primary' },
    VSelect: { color: 'primary' },
    VTextarea: { color: 'primary' },
    VTooltip: { openDelay: 350 },
  },
  theme: {
    defaultTheme: initialTheme,
    themes,
  },
});
