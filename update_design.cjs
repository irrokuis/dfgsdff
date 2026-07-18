const fs = require('fs');

// 1. Update index.html fonts
let htmlContent = fs.readFileSync('index.html', 'utf8');
htmlContent = htmlContent.replace(
  /<link href="https:\/\/fonts.googleapis.com\/css2\?family=IBM\+Plex[^"]+" rel="stylesheet">/,
  '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">'
);
fs.writeFileSync('index.html', htmlContent);

// 2. Update styles.css
const cssContent = `:root {
  --color-primary: #000000;
  --color-on-primary: #FFFFFF;
  --color-secondary: #333333;
  --color-accent: #E11D48; /* Red accent */
  --color-background: #FFFFFF;
  --color-foreground: #000000;
  --color-muted: #F5F5F5;
  --color-border: #E5E5E5;
  --color-destructive: #E11D48;
  --color-ring: #000000;

  --color-text-body: #000000;
  --color-text-muted: #666666;
  --color-sidebar-bg: #FAFAFA;
  --color-sidebar-border: #E5E5E5;
  --color-sidebar-text: #000000;
  --color-sidebar-muted: #666666;
  --color-sidebar-input: #FFFFFF;

  /* Zero radius for Swiss Brutalist / Minimalism */
  --radius-sm: 0px;
  --radius-md: 0px;
  --radius-lg: 0px;
  --radius-xl: 0px;

  font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
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
  font-family: 'JetBrains Mono', monospace;
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
  border-bottom: 2px solid var(--color-foreground);
}

.brand-icon {
  display: grid;
  place-items: center;
  height: 32px;
  width: 32px;
  background: #000000;
  color: #FFFFFF;
}

.brand p, .eyebrow {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.brand h2 {
  margin: 4px 0 0;
  font-size: 1.25rem;
  color: #000000;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.sidebar-content {
  padding-top: 32px;
}

.sidebar h3 {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 0 0 24px;
  color: #000000;
  font-weight: 700;
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
  font-weight: 600;
}

.field input, .field select {
  width: 100%;
  border: 1px solid var(--color-sidebar-border);
  background: var(--color-sidebar-input);
  color: var(--color-foreground);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  outline: none;
  transition: all 0.15s ease;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
}

.field input:focus, .field select:focus {
  border-color: #000000;
  box-shadow: inset 0 0 0 1px #000000;
}

.sidebar-note {
  margin: 8px 0 24px;
  color: var(--color-sidebar-muted);
  font-size: 0.75rem;
  line-height: 1.5;
  border-left: 2px solid #000000;
  padding-left: 12px;
}

/* Buttons */
.primary-button {
  width: 100%;
  margin-top: 12px;
  border: 1px solid #000000;
  border-radius: var(--radius-sm);
  padding: 12px 12px;
  color: #FFFFFF;
  background: #000000;
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
  background: #000000;
  color: #FFFFFF;
}

.sidebar .primary-button:hover {
  background: #FFFFFF;
  color: #000000;
}

.primary-button:hover {
  background: #FFFFFF;
  color: #000000;
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
  font-size: clamp(2rem, 4vw, 3rem);
  letter-spacing: -0.04em;
  font-weight: 800;
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
  border-bottom: 2px solid #000000;
  padding-bottom: 16px;
}

.section-heading h2, .panel h2 {
  margin: 0 0 4px;
  font-size: 1.15rem;
  font-weight: 700;
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
  border: 1px solid #000000;
  border-radius: var(--radius-sm);
  background: #FFFFFF;
}

.coordinate-card span {
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.65rem;
  font-weight: 700;
}

.coordinate-card strong {
  color: var(--color-foreground);
  font-size: 0.85rem;
  font-family: 'JetBrains Mono', monospace;
}

/* Map */
.map {
  height: min(60vh, 600px);
  min-height: 450px;
  border: 1px solid #000000;
  border-radius: var(--radius-sm);
  overflow: hidden;
  z-index: 1;
}

.target-marker {
  background: #000000;
  border: 2px solid #FFFFFF;
  border-radius: 0%;
  color: #FFFFFF;
  display: grid;
  place-items: center;
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
  border: 1px solid #000000;
  background: #FAFAFA;
  border-radius: var(--radius-sm);
  color: #000000;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 12px;
}

.alert.error {
  border-color: #000000;
  background: #000000;
  color: #FFFFFF;
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
  border-bottom: 2px solid #000000;
}

.result-header h1 {
  margin: 8px 0 4px;
  font-size: 2.25rem;
  letter-spacing: -0.04em;
  font-weight: 800;
}

.back-button {
  border: 1px solid #000000;
  background: #FFFFFF;
  color: #000000;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.back-button:hover {
  background: #000000;
  color: #FFFFFF;
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
  border: 1px solid #000000;
  border-radius: var(--radius-sm);
  padding: 24px;
}

/* Rating Panel */
.rating-panel {
  grid-column: span 12;
  display: flex;
  flex-direction: column;
  padding: 24px 32px;
  border: 1px solid #000000;
  border-top: 8px solid #000000;
  background: #FAFAFA;
}

.rating-panel p {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.rating-panel h2 {
  color: var(--color-foreground);
  margin: 8px 0 8px;
  font-size: 2rem;
  font-weight: 800;
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
  border: 1px solid #000000;
  border-radius: var(--radius-sm);
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.metric p {
  margin: 0 0 12px;
  color: var(--color-text-muted);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric strong {
  display: block;
  font-size: 1.4rem;
  letter-spacing: -0.01em;
  font-family: 'JetBrains Mono', monospace;
  margin-top: auto;
}

.metric.revenue {
  background: #000000;
  border: 1px solid #000000;
  color: #FFFFFF;
}

.metric.revenue p {
  color: #CCCCCC;
}

.metric.revenue strong {
  color: #FFFFFF;
  font-size: 1.75rem;
}

.metric.revenue span {
  color: #999999;
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
  border: 1px solid #000000;
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
  font-family: 'JetBrains Mono', monospace;
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
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
}

.details-table {
  margin-top: 20px;
  border-top: 1px solid #000000;
}

.details-table > div {
  display: flex;
  justify-content: space-between;
  padding: 12px 8px;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.9rem;
}

.details-table span {
  color: var(--color-text-muted);
}

.details-table strong {
  color: var(--color-foreground);
  font-family: 'JetBrains Mono', monospace;
}

.disclaimer {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  margin: 24px 0 0;
  padding: 12px;
  background: var(--color-background);
  border: 1px solid #000000;
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

// 3. Update main.jsx for map style and chart colors
let jsxContent = fs.readFileSync('src/main.jsx', 'utf8');

// Update chartData colors
jsxContent = jsxContent.replace(
  /const chartData = \[\s*\{\s*name: "Labor", value: analysis\.labor_cost, color: "[^"]+" \},\s*\{\s*name: "Cost of goods",\s*value: analysis\.cost_of_goods_cost,\s*color: "[^"]+",\s*\},\s*\{\s*name: "Rent", value: analysis\.rent_cost, color: "[^"]+" \},\s*\{\s*name: "Extra", value: analysis\.extra_cost, color: "[^"]+" \},\s*\];/m,
  `const chartData = [
    { name: "Labor", value: analysis.labor_cost, color: "#000000" },
    {
      name: "Cost of goods",
      value: analysis.cost_of_goods_cost,
      color: "#666666",
    },
    { name: "Rent", value: analysis.rent_cost, color: "#CCCCCC" },
    { name: "Extra", value: analysis.extra_cost, color: "#E11D48" },
  ];`
);

// Update projectionData colors
jsxContent = jsxContent.replace(
  /fill: item\.profit >= 0 \? "[^"]+" : "[^"]+"/g,
  'fill: item.profit >= 0 ? "#000000" : "#E11D48"'
);

// Update map circle stroke
jsxContent = jsxContent.replace(
  /pathOptions=\{\{ color: "#dc2626", weight: 2, fill: false \}\}/,
  'pathOptions={{ color: "#E11D48", weight: 2, fill: false }}'
);

// Update circle markers for competitors
jsxContent = jsxContent.replace(
  /pathOptions=\{\{\s*color: "#1d4ed8",\s*fillColor: "#3b82f6",\s*fillOpacity: 0.78,\s*\}\}/m,
  `pathOptions={{
            color: "#000000",
            fillColor: "#000000",
            fillOpacity: 0.6,
          }}`
);

// Remove rating-color from style since we aren't using the variable anymore
jsxContent = jsxContent.replace(
  /style=\{\{ "--rating-color": analysis\.rating_color \}\}/g,
  ''
);

fs.writeFileSync('src/main.jsx', jsxContent);
