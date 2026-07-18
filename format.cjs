const fs = require('fs');
let content = fs.readFileSync('src/main.jsx', 'utf8');
content = content.replace(/return <main className="result-page">.*<\/main>;/, `
  return (
    <main className="result-page">
      <header className="result-header">
        <button className="back-button" onClick={onRestart}>
          <ChevronLeft size={18} /> New scenario
        </button>
        <div>
          <p className="eyebrow">FEASIBILITY RESULT</p>
          <h1>{analysis.store_type} site assessment</h1>
          <p className="subtitle">Auckland, New Zealand</p>
        </div>
      </header>
      <section className="bento-grid">
        <div className="rating-panel panel" style={{ '--rating-color': analysis.rating_color }}>
          <p>FEASIBILITY RATING</p>
          <h2>{analysis.rating}</h2>
          <span>{analysis.rating_detail}</span>
        </div>
        <div className="metrics">
          <div className="metric revenue">
            <p>Projected monthly revenue</p>
            <strong>{nzd(analysis.revenue_min)} – {nzd(analysis.revenue_max)}</strong>
            <span>Screening range based on live location signals</span>
          </div>
          <div className="metric">
            <p>Central estimate</p>
            <strong>{nzd(analysis.central_estimate)}</strong>
          </div>
          <div className="metric">
            <p>Break-even point</p>
            <strong>{nzd(analysis.total_cost)}</strong>
          </div>
          <div className="metric">
            <p>Live competitors found</p>
            <strong>{analysis.competitor_count}</strong>
          </div>
        </div>
        {analysis.api_error && (
          <p className="alert" style={{ gridColumn: 'span 12' }}>
            <AlertCircle size={20} /> {analysis.api_error}
          </p>
        )}
        <div className="dashboard-grid">
          <div className="panel">
            <div className="section-heading">
              <div>
                <h2>Real competitor map</h2>
                <p>Blue markers are same-type businesses from OpenStreetMap.</p>
              </div>
            </div>
            <SiteMap location={[analysis.latitude, analysis.longitude]} competitors={analysis.competitors} />
          </div>
          <div className="panel chart-panel">
            <h2>Monthly cost allocation</h2>
            {analysis.total_cost > 0 ? (
              <ResponsiveContainer width="100%" height={310}>
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={76} outerRadius={112} paddingAngle={3}>
                    {chartData.map((item) => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                  <ChartTooltip formatter={(value) => nzd(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="empty">No monthly costs were entered, so there is no cost allocation chart.</p>
            )}
          </div>
        </div>
        <div className="bottom-panels">
          <div className="panel projection-panel">
            <h2>12-month profit projection</h2>
            <p>Revenue ramps up over the first four months, then follows the model's seasonal assumptions.</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={projectionData} margin={{ top: 15, right: 8, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(value) => \`$\${Math.round(value / 1000)}k\`} width={48} />
                <ChartTooltip formatter={(value) => nzd(value)} />
                <Bar dataKey="profit" name="Monthly profit">
                  {projectionData.map((item) => <Cell key={item.month} fill={item.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="panel details-panel">
            <h2>Financial summary</h2>
            <div className="details-table">
              {details.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <p className="disclaimer">
              <Info size={16} /> Live business data comes from OpenStreetMap via the Overpass API. Results are screening estimates, not financial advice.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
`);
fs.writeFileSync('src/main.jsx', content);
