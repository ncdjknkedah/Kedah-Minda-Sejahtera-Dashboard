const STIGMA_INTERPRETATION = [
    { min: 1.00, max: 1.75, label: 'Sangat Rendah', class: 'status-excellent', desc: 'Masyarakat mempunyai tahap penerimaan yang sangat tinggi dan inklusif.' },
    { min: 1.76, max: 2.50, label: 'Rendah/Sederhana', class: 'status-good', desc: 'Masyarakat mempunyai kesedaran asas namun masih terdapat keraguan sosial yang kecil.' },
    { min: 2.51, max: 3.25, label: 'Tinggi', class: 'status-warning', desc: 'Stigma adalah ketara. Wujud keperluan mendesak untuk kempen kesedaran dan pendidikan.' },
    { min: 3.26, max: 4.00, label: 'Sangat Tinggi', class: 'status-critical', desc: 'Tahap diskriminasi dan stereotaip yang ekstrem.' }
];

function calculateStigmaScores(row) {
    const q = [];
    for (let i = 1; i <= 9; i++) {
        q[i] = parseFloat(row[`q${i}`]) || 0;
    }

    const affective = (q[1] + q[9]) / 2;
    const cognitive = (q[5] + q[6] + q[8]) / 3;
    const behavioral = (q[2] + q[3] + q[4] + q[7]) / 4;
    const overall = q.slice(1).reduce((a, b) => a + b, 0) / 9;

    return { affective, cognitive, behavioral, overall };
}

function getStigmaInterpretation(score) {
    return STIGMA_INTERPRETATION.find(item => score >= item.min && score <= item.max) || STIGMA_INTERPRETATION[0];
}

function formatNumber(num, decimals = 0) {
    return new Intl.NumberFormat('ms-MY', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
}

function getStatusColor(value, target) {
    const ratio = value / target;
    if (ratio >= 1) return '#2ecc71';
    if (ratio >= 0.7) return '#f39c12';
    return '#e74c3c';
}
