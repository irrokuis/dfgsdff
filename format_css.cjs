const fs = require('fs');

const cssContent = `:root {
  --color-primary: #171717;
  --color-on-primary: #FFFFFF;
  --color-secondary: #404040;
  --color-accent: #A16207;
  --color-background: #F4F5F7;
  --color-foreground: #111827;
  --color-muted: #E5E7EB;
  --color-border: #D1D5DB;
  --color-destructive: #B91C1C;
  --color-ring: #171717;

  --color-text-body: #374151;
  --color-text-muted: #6B7280;
  --color-sidebar-bg: #111827;
  --color-sidebar-border: #1F2937;
  --color-sidebar-text: #E5E7EB;
  --color-sidebar-muted: #9CA3AF;
  --color-sidebar-input: #1F2937;

  /* Sharper, enterprise-style corners */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 6px;
  --radius-xl: 8px;

  font-family: 'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, sans-serif;
  color: var(--color-text-body);
  background: var(--color-background);
  font-synthesis: none;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
}

button, input, select {
  font: inherit;
}

h1, h2, h3, h4, strong {
  color: var(--color-foreground);
}

.mono {
  font-family: 'IBM Plex Mono', monospace;
}

/* App Layout */
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 320px 1fr;
}

/* Sidebar */
.sidebar {
  background: var(--color-sidebar-bg);
  color: var(--color-sidebar-text);
  padding: 32px 24px;
  border-right: 1px solid var(--color-sidebar-border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 32px;
  border-bottom: 1px solid var(--color-sidebar-border);
}

.brand-icon {
  display: grid;
  place-items: center;
  height: 40px;
  width: 40px;
  background: #1F2937;
  border: 1px solid #374151;
  border-radius: var(--radius-sm);
  color: #F9FAFB;
}

.brand p, .eyebrow {
  margin: 0;
  color: #9CA3AF;
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.brand h2 {
  margin: 4px 0 0;
  font-size: 1.1rem;
  color: #FFFFFF;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.sidebar-content {
  padding-top: 32px;
}

.sidebar h3 {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 24px;
  color: #D1D5DB;
  font-weight: 600;
}

/* Forms */
.field {
  display: grid;
  gap: 6px;
  margin: 0 0 20px;
}

.field span {
  font-size: 0.75rem;
  color: var(--color-sidebar-text);
  font-weight: 500;
}

.field input, .field select {
  width: 100%;
  border: 1px solid var(--color-sidebar-border);
  background: var(--color-sidebar-input);
  color: white;
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  outline: none;
  transition: all 0.1s ease;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.85rem;
}

.field input:focus, .field select:focus {
  border-color: #6B7280;
  box-shadow: 0 0 0 1px #6B7280;
}

.sidebar-note {
  margin: 8px 0 24px;
  color: var(--color-sidebar-muted);
  font-size: 0.75rem;
  line-height: 1.5;
  border-left: 2px solid var(--color-sidebar-border);
  padding-left: 12px;
}

/* Buttons */
.primary-button {
  width: 100%;
  margin-top: 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 12px 12px;
  color: var(--color-on-primary);
  background: var(--color-primary);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.sidebar .primary-button {
  background: #FFFFFF;
  color: #111827;
}

.sidebar .primary-button:hover {
  background: #E5E7EB;
}

.primary-button:hover {
  background: var(--color-secondary);
}

.primary-button:active {
  transform: translateY(1px);
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
  transform: none;
}

/* Workspace & Layout */
.workspace {
  padding: clamp(32px, 5vw, 64px);
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
}

.workspace header h1 {
  margin: 8px 0 12px;
  font-size: clamp(1.75rem, 3vw, 2.25rem);
  letter-spacing: -0.03em;
  font-weight: 600;
}

.subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 1rem;
  line-height: 1.5;
}

/* Map Section */
.map-section {
  margin-top: 48px;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-end;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 16px;
}

.section-heading h2, .panel h2 {
  margin: 0 0 4px;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-foreground);
}

.section-heading p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

/* Coordinate Card */
.coordinate-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: #FFFFFF;
}

.coordinate-card span {
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.65rem;
  font-weight: 600;
}

.coordinate-card strong {
  color: var(--color-foreground);
  font-size: 0.85rem;
  font-family: 'IBM Plex Mono', monospace;
}

/* Map */
.map {
  height: min(60vh, 600px);
  min-height: 450px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  z-index: 1;
}

.target-marker {
  background: var(--color-foreground);
  border: 2px solid #FFFFFF;
  border-radius: 50%;
  color: #FFFFFF;
  display: grid;
  place-items: center;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  font-size: 18px;
}

.map-note {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Alerts */
.alert {
  margin: 24px 0;
  padding: 12px 16px;
  border: 1px solid #FCD34D;
  background: #FFFBEB;
  border-radius: var(--radius-sm);
  color: #92400E;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 12px;
}

.alert.error {
  border-color: #FCA5A5;
  background: #FEF2F2;
  color: #991B1B;
}

/* Result Page */
.result-page {
  width: min(1200px, calc(100% - 48px));
  margin: 0 auto;
  padding: 48px 0 80px;
}

.result-header {
  display: flex;
  gap: 32px;
  align-items: flex-start;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--color-border);
}

.result-header h1 {
  margin: 8px 0 4px;
  font-size: 2rem;
  letter-spacing: -0.02em;
  font-weight: 600;
}

.back-button {
  border: 1px solid var(--color-border);
  background: #FFFFFF;
  color: var(--color-foreground);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-weight: 500;
  font-size: 0.85rem;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.back-button:hover {
  background: var(--color-muted);
}

/* Bento Grid System */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 20px;
  margin-top: 24px;
}

.panel {
  background: #FFFFFF;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 24px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

/* Rating Panel */
.rating-panel {
  grid-column: span 12;
  display: flex;
  flex-direction: column;
  padding: 24px 32px;
  border-top: 4px solid var(--rating-color, var(--color-primary));
}

.rating-panel p {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.rating-panel h2 {
  color: var(--rating-color, var(--color-foreground));
  margin: 8px 0 8px;
  font-size: 1.75rem;
  font-weight: 600;
}

.rating-panel span {
  color: var(--color-text-body);
  font-size: 0.95rem;
}

/* Metrics row */
.metrics {
  grid-column: span 12;
  display: grid;
  grid-template-columns: 2fr repeat(3, 1fr);
  gap: 20px;
}

.metric {
  background: #FFFFFF;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 20px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.metric p {
  margin: 0 0 12px;
  color: var(--color-text-muted);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric strong {
  display: block;
  font-size: 1.4rem;
  letter-spacing: -0.01em;
  font-family: 'IBM Plex Mono', monospace;
  margin-top: auto;
}

.metric.revenue {
  background: #FAFAFA;
  border: 1px solid #E5E7EB;
}

.metric.revenue strong {
  color: var(--color-foreground);
  font-size: 1.75rem;
}

.metric span {
  display: block;
  margin-top: 8px;
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

/* Dashboard Bottom Grid */
.dashboard-grid {
  grid-column: span 12;
  display: grid;
  grid-template-columns: 7fr 5fr;
  gap: 20px;
}

.dashboard-grid .panel {
  display: flex;
  flex-direction: column;
}

.dashboard-grid .map {
  height: 480px;
  min-height: 0;
  border-radius: var(--radius-sm);
  margin-top: 16px;
  box-shadow: none;
  border: 1px solid var(--color-border);
}

.chart-panel {
  display: flex;
  flex-direction: column;
}

.chart-panel h2 {
  margin-bottom: 24px;
}

.chart-panel > div {
  flex: 1;
  min-height: 320px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.75rem;
}

.empty {
  color: var(--color-text-muted);
  margin: auto;
  text-align: center;
  font-size: 0.85rem;
}

/* Projections and Details */
.bottom-panels {
  grid-column: span 12;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.projection-panel > p {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  margin: 0 0 24px;
}

.projection-panel .recharts-wrapper {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.75rem;
}

.details-table {
  margin-top: 20px;
  border-top: 1px solid var(--color-border);
}

.details-table > div {
  display: flex;
  justify-content: space-between;
  padding: 12px 8px;
  border-bottom: 1px solid var(--color-muted);
  font-size: 0.9rem;
}

.details-table span {
  color: var(--color-text-muted);
}

.details-table strong {
  color: var(--color-foreground);
  font-family: 'IBM Plex Mono', monospace;
}

.disclaimer {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  margin: 24px 0 0;
  padding: 12px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 8px;
}

.text-muted {
  color: var(--color-text-muted);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.animate-spin {
  animation: spin 1s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* Responsive */
@media (max-width: 1024px) {
  .app-shell {
    grid-template-columns: 280px 1fr;
  }
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .app-shell {
    grid-template-columns: 1fr;
  }
  .sidebar {
    padding: 24px;
    border-right: none;
    border-bottom: 1px solid var(--color-sidebar-border);
  }
  .sidebar-content {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0 20px;
  }
  .sidebar-content h3 {
    grid-column: 1 / -1;
  }
  .primary-button {
    align-self: end;
    margin-bottom: 20px;
  }
  .metrics {
    grid-template-columns: repeat(2, 1fr);
  }
  .metric.revenue {
    grid-column: 1 / -1;
  }
  .bottom-panels {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .workspace {
    padding: 24px 16px;
  }
  .sidebar-content {
    display: block;
  }
  .map {
    min-height: 400px;
  }
  .section-heading, .result-header {
    display: block;
  }
  .coordinate-card {
    margin-top: 16px;
    width: 100%;
    justify-content: space-between;
  }
  .result-page {
    width: 100%;
    padding: 24px 16px;
  }
  .back-button {
    margin-bottom: 24px;
  }
  .metrics {
    grid-template-columns: 1fr;
  }
  .metric.revenue {
    grid-column: auto;
  }
  .bento-grid {
    gap: 16px;
  }
  .dashboard-grid, .bottom-panels {
    gap: 16px;
  }
  .panel {
    padding: 20px;
  }
}
`;
fs.writeFileSync('src/styles.css', cssContent);
