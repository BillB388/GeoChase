/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Composables
import { createApp } from 'vue';
// Plugins
import { registerPlugins } from '@/plugins';

// Components
import App from './App.vue';
// Styles
import 'unfonts.css';
import 'ol/ol.css';
import './styles/workspace.css';

// Global layout styles for OpenLayers container and dark theme
const style = document.createElement('style');
style.textContent = `
  /* Note tooltips on map */
  .note-tooltip {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
  }

  .note-tooltip::before {
    display: none !important;
  }

  .note-tooltip-card {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    max-width: 400px;
    min-width: 200px;
    padding: 12px;
    background: var(--bg);
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    box-shadow: var(--shadow);
    cursor: pointer;
    transition: transform 0.2s ease;
  }

  .note-tooltip-card:hover {
    transform: scale(1.02);
  }

  .note-tooltip-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .note-tooltip-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .note-tooltip-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--accent);
    word-break: break-word;
    overflow-wrap: break-word;
    line-height: 1.4;
  }

  .note-tooltip-text {
    font-size: 12px;
    color: var(--text);
    word-break: break-word;
    overflow-wrap: break-word;
    line-height: 1.5;
    white-space: pre-wrap;
  }

  /* Point labels - initially hidden, shown at zoom level 10+ */
  .point-label {
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  /* SVG non-scaling stroke for crisp lines at all zoom levels */
  path.line-layer,
  path.circle-layer,
  path.polygon-layer {
    vector-effect: non-scaling-stroke;
    stroke-width: 3px;
  }
`;
document.head.append(style);

const app = createApp(App);

registerPlugins(app);

app.mount('#app');
