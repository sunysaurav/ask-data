"use strict";

const CHART_COLORS = [
    "#3b82f6", "#ef4444", "#10b981", "#f59e0b",
    "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
    "#14b8a6", "#6366f1", "#84cc16", "#e11d48"
];

interface ChartDataset {
    label?: string;
    data: number[];
    color?: string;
}

interface ChartSpec {
    type: "bar" | "line" | "pie" | "doughnut" | "area" | "horizontalBar";
    title?: string;
    labels: string[];
    datasets: ChartDataset[];
}

function esc(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtVal(val: number): string {
    const abs = Math.abs(val);
    if (abs >= 1_000_000_000) return (val / 1_000_000_000).toFixed(1) + "B";
    if (abs >= 1_000_000) return (val / 1_000_000).toFixed(1) + "M";
    if (abs >= 1_000) return (val / 1_000).toFixed(1) + "K";
    if (Number.isInteger(val)) return val.toString();
    return val.toFixed(1);
}

function getColor(ds: ChartDataset, idx: number): string {
    return ds.color || CHART_COLORS[idx % CHART_COLORS.length];
}

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ─── Bar Chart ──────────────────────────────────────────────────────────────

function renderBarChart(spec: ChartSpec): string {
    const W = 420, H = 280;
    const PAD = { top: spec.title ? 36 : 16, right: 20, bottom: 48, left: 52 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top - PAD.bottom;

    const allVals = spec.datasets.flatMap(d => d.data);
    const maxVal = Math.max(...allVals, 1) * 1.12;
    const numBars = spec.labels.length;
    const numSets = spec.datasets.length;
    const groupW = cW / numBars;
    const barW = Math.min((groupW * 0.72) / numSets, 48);
    const groupPad = (groupW - barW * numSets) / 2;

    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="ad-chart">`;

    if (spec.title) {
        svg += `<text x="${W / 2}" y="20" text-anchor="middle" font-size="13" font-weight="600" fill="var(--ad-chart-text,currentColor)">${esc(spec.title)}</text>`;
    }

    // Y gridlines
    const gridN = 5;
    for (let i = 0; i <= gridN; i++) {
        const y = PAD.top + (cH / gridN) * i;
        const v = maxVal * (1 - i / gridN);
        svg += `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="var(--ad-chart-grid,#e2e8f0)" stroke-width="0.7"/>`;
        svg += `<text x="${PAD.left - 8}" y="${y + 3.5}" text-anchor="end" font-size="9.5" fill="var(--ad-chart-label,#64748b)">${fmtVal(v)}</text>`;
    }

    // Bars
    for (let s = 0; s < numSets; s++) {
        const ds = spec.datasets[s];
        const color = getColor(ds, s);
        for (let i = 0; i < numBars; i++) {
            const v = ds.data[i] || 0;
            const bH = (v / maxVal) * cH;
            const x = PAD.left + groupPad + i * groupW + s * barW;
            const y = PAD.top + cH - bH;
            svg += `<rect x="${x}" y="${y}" width="${barW}" height="${bH}" fill="${color}" rx="3" opacity="0.88">`;
            svg += `<title>${esc(spec.labels[i])}: ${v.toLocaleString()}</title></rect>`;
            if (bH > 16) {
                svg += `<text x="${x + barW / 2}" y="${y + 13}" text-anchor="middle" font-size="8.5" font-weight="600" fill="#fff">${fmtVal(v)}</text>`;
            }
        }
    }

    // X labels
    for (let i = 0; i < numBars; i++) {
        const x = PAD.left + i * groupW + groupW / 2;
        const label = spec.labels[i].length > 10 ? spec.labels[i].slice(0, 9) + "..." : spec.labels[i];
        svg += `<text x="${x}" y="${PAD.top + cH + 16}" text-anchor="middle" font-size="9.5" fill="var(--ad-chart-label,#64748b)">${esc(label)}</text>`;
    }

    // Legend
    if (numSets > 1) {
        svg += renderLegend(spec.datasets, W, H - 6);
    }

    svg += `</svg>`;
    return svg;
}

// ─── Horizontal Bar Chart ───────────────────────────────────────────────────

function renderHorizontalBarChart(spec: ChartSpec): string {
    const numBars = spec.labels.length;
    const barH = 26;
    const gap = 8;
    const W = 420;
    const PAD = { top: spec.title ? 36 : 12, right: 20, bottom: 12, left: 90 };
    const H = PAD.top + numBars * (barH + gap) + PAD.bottom + (spec.datasets.length > 1 ? 24 : 0);
    const cW = W - PAD.left - PAD.right;

    const allVals = spec.datasets.flatMap(d => d.data);
    const maxVal = Math.max(...allVals, 1) * 1.12;

    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="ad-chart">`;

    if (spec.title) {
        svg += `<text x="${W / 2}" y="20" text-anchor="middle" font-size="13" font-weight="600" fill="var(--ad-chart-text,currentColor)">${esc(spec.title)}</text>`;
    }

    for (let i = 0; i < numBars; i++) {
        const y = PAD.top + i * (barH + gap);
        const label = spec.labels[i].length > 12 ? spec.labels[i].slice(0, 11) + "..." : spec.labels[i];
        svg += `<text x="${PAD.left - 6}" y="${y + barH / 2 + 4}" text-anchor="end" font-size="10" fill="var(--ad-chart-label,#64748b)">${esc(label)}</text>`;

        for (let s = 0; s < spec.datasets.length; s++) {
            const ds = spec.datasets[s];
            const v = ds.data[i] || 0;
            const bW = (v / maxVal) * cW;
            const color = getColor(ds, s);
            svg += `<rect x="${PAD.left}" y="${y}" width="${bW}" height="${barH}" fill="${color}" rx="3" opacity="0.88">`;
            svg += `<title>${esc(spec.labels[i])}: ${v.toLocaleString()}</title></rect>`;
            svg += `<text x="${PAD.left + bW + 6}" y="${y + barH / 2 + 4}" font-size="9.5" font-weight="500" fill="var(--ad-chart-label,#64748b)">${fmtVal(v)}</text>`;
        }
    }

    if (spec.datasets.length > 1) {
        svg += renderLegend(spec.datasets, W, H - 6);
    }

    svg += `</svg>`;
    return svg;
}

// ─── Line / Area Chart ──────────────────────────────────────────────────────

function renderLineChart(spec: ChartSpec): string {
    const W = 420, H = 280;
    const PAD = { top: spec.title ? 36 : 16, right: 20, bottom: 48, left: 52 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top - PAD.bottom;
    const isArea = spec.type === "area";

    const allVals = spec.datasets.flatMap(d => d.data);
    const maxVal = Math.max(...allVals, 1) * 1.12;
    const minVal = Math.min(0, ...allVals);
    const range = maxVal - minVal;
    const numPts = spec.labels.length;

    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="ad-chart">`;

    if (spec.title) {
        svg += `<text x="${W / 2}" y="20" text-anchor="middle" font-size="13" font-weight="600" fill="var(--ad-chart-text,currentColor)">${esc(spec.title)}</text>`;
    }

    // Grid
    const gridN = 5;
    for (let i = 0; i <= gridN; i++) {
        const y = PAD.top + (cH / gridN) * i;
        const v = maxVal - (range * i / gridN);
        svg += `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="var(--ad-chart-grid,#e2e8f0)" stroke-width="0.7"/>`;
        svg += `<text x="${PAD.left - 8}" y="${y + 3.5}" text-anchor="end" font-size="9.5" fill="var(--ad-chart-label,#64748b)">${fmtVal(v)}</text>`;
    }

    // Lines
    for (let s = 0; s < spec.datasets.length; s++) {
        const ds = spec.datasets[s];
        const color = getColor(ds, s);
        const points: { x: number; y: number }[] = [];

        for (let i = 0; i < numPts; i++) {
            const v = ds.data[i] || 0;
            const x = PAD.left + (i / Math.max(numPts - 1, 1)) * cW;
            const y = PAD.top + cH - ((v - minVal) / range) * cH;
            points.push({ x, y });
        }

        const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

        if (isArea) {
            const areaD = pathD + ` L ${points[points.length - 1].x.toFixed(1)} ${PAD.top + cH} L ${points[0].x.toFixed(1)} ${PAD.top + cH} Z`;
            svg += `<path d="${areaD}" fill="${color}" opacity="0.12"/>`;
        }

        svg += `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;

        for (const p of points) {
            svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${color}" stroke="var(--ad-chart-bg,#fff)" stroke-width="2"/>`;
        }
    }

    // X labels
    for (let i = 0; i < numPts; i++) {
        const x = PAD.left + (i / Math.max(numPts - 1, 1)) * cW;
        const label = spec.labels[i].length > 10 ? spec.labels[i].slice(0, 9) + "..." : spec.labels[i];
        svg += `<text x="${x}" y="${PAD.top + cH + 16}" text-anchor="middle" font-size="9.5" fill="var(--ad-chart-label,#64748b)">${esc(label)}</text>`;
    }

    if (spec.datasets.length > 1) {
        svg += renderLegend(spec.datasets, W, H - 6);
    }

    svg += `</svg>`;
    return svg;
}

// ─── Pie / Doughnut Chart ───────────────────────────────────────────────────

function renderPieChart(spec: ChartSpec): string {
    const W = 420, H = 300;
    const cx = W / 2, cy = (spec.title ? 160 : 140);
    const R = 95;
    const innerR = spec.type === "doughnut" ? R * 0.55 : 0;
    const data = spec.datasets[0]?.data || [];
    const total = data.reduce((a, b) => a + b, 0) || 1;

    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="ad-chart">`;

    if (spec.title) {
        svg += `<text x="${W / 2}" y="22" text-anchor="middle" font-size="13" font-weight="600" fill="var(--ad-chart-text,currentColor)">${esc(spec.title)}</text>`;
    }

    let startAngle = 0;
    for (let i = 0; i < data.length; i++) {
        const slice = (data[i] / total) * 360;
        if (slice < 0.5) { startAngle += slice; continue; }
        const endAngle = startAngle + slice;
        const color = CHART_COLORS[i % CHART_COLORS.length];

        const s1 = polarToXY(cx, cy, R, startAngle);
        const e1 = polarToXY(cx, cy, R, endAngle);
        const largeArc = slice > 180 ? 1 : 0;

        let d: string;
        if (innerR > 0) {
            const s2 = polarToXY(cx, cy, innerR, startAngle);
            const e2 = polarToXY(cx, cy, innerR, endAngle);
            d = `M ${s1.x} ${s1.y} A ${R} ${R} 0 ${largeArc} 1 ${e1.x} ${e1.y} L ${e2.x} ${e2.y} A ${innerR} ${innerR} 0 ${largeArc} 0 ${s2.x} ${s2.y} Z`;
        } else {
            d = `M ${cx} ${cy} L ${s1.x} ${s1.y} A ${R} ${R} 0 ${largeArc} 1 ${e1.x} ${e1.y} Z`;
        }

        svg += `<path d="${d}" fill="${color}" opacity="0.88" stroke="var(--ad-chart-bg,#fff)" stroke-width="2">`;
        svg += `<title>${esc(spec.labels[i] || "")}: ${data[i].toLocaleString()} (${((data[i] / total) * 100).toFixed(1)}%)</title></path>`;

        // Percentage label on larger slices
        if (slice > 20) {
            const mid = startAngle + slice / 2;
            const labelR = innerR > 0 ? (R + innerR) / 2 : R * 0.6;
            const lp = polarToXY(cx, cy, labelR, mid);
            svg += `<text x="${lp.x}" y="${lp.y + 4}" text-anchor="middle" font-size="10" font-weight="600" fill="#fff">${((data[i] / total) * 100).toFixed(0)}%</text>`;
        }

        startAngle = endAngle;
    }

    // Legend below pie
    const legendStartY = cy + R + 20;
    const cols = Math.min(data.length, 3);
    const colW = W / cols;
    for (let i = 0; i < data.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * colW + 24;
        const y = legendStartY + row * 18;
        const color = CHART_COLORS[i % CHART_COLORS.length];
        const label = spec.labels[i] || `Item ${i + 1}`;
        svg += `<rect x="${x}" y="${y - 8}" width="10" height="10" fill="${color}" rx="2"/>`;
        svg += `<text x="${x + 14}" y="${y}" font-size="9.5" fill="var(--ad-chart-label,#64748b)">${esc(label.length > 16 ? label.slice(0, 15) + "..." : label)}</text>`;
    }

    svg += `</svg>`;
    return svg;
}

// ─── Shared legend ──────────────────────────────────────────────────────────

function renderLegend(datasets: ChartDataset[], width: number, y: number): string {
    let svg = "";
    let x = 24;
    for (let s = 0; s < datasets.length; s++) {
        const color = getColor(datasets[s], s);
        const label = datasets[s].label || `Series ${s + 1}`;
        svg += `<rect x="${x}" y="${y - 8}" width="10" height="10" fill="${color}" rx="2"/>`;
        svg += `<text x="${x + 14}" y="${y}" font-size="9.5" fill="var(--ad-chart-label,#64748b)">${esc(label)}</text>`;
        x += 14 + label.length * 5.8 + 20;
        if (x > width - 40) { x = 24; y += 18; }
    }
    return svg;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function tryRenderChart(jsonStr: string): string | null {
    try {
        const spec: ChartSpec = JSON.parse(jsonStr);
        if (!spec.type || !spec.labels || !spec.datasets) return null;

        switch (spec.type) {
            case "bar": return renderBarChart(spec);
            case "horizontalBar": return renderHorizontalBarChart(spec);
            case "line":
            case "area": return renderLineChart(spec);
            case "pie":
            case "doughnut": return renderPieChart(spec);
            default: return null;
        }
    } catch {
        return null;
    }
}
