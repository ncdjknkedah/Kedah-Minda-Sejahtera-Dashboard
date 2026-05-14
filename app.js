const SHEET_RESPONSES_URL = 'https://docs.google.com/spreadsheets/d/1xQdgrVAVwxGbqJEe3alTPEwkIITasTTwNCLKVK6Juvg/gviz/tq?tqx=out:csv&gid=0';
const SHEET_TARGETS_URL = 'https://docs.google.com/spreadsheets/d/1xQdgrVAVwxGbqJEe3alTPEwkIITasTTwNCLKVK6Juvg/gviz/tq?tqx=out:csv&gid=435147458';

let rawResponses = [];
let targetData = [];
let charts = {};

// Register ChartDataLabels plugin
Chart.register(ChartDataLabels);

document.addEventListener('DOMContentLoaded', async () => {
    showLoading();
    await loadData();
    initFilters();
    updateDashboard('all');
    
    document.getElementById('districtFilter').addEventListener('change', (e) => {
        updateDashboard(e.target.value);
    });

    document.getElementById('refreshBtn').addEventListener('click', async () => {
        showLoading();
        await loadData();
        updateDashboard(document.getElementById('districtFilter').value);
    });
});

async function loadData() {
    try {
        const [responsesRes, targetsRes] = await Promise.all([
            fetch(SHEET_RESPONSES_URL).then(res => res.text()),
            fetch(SHEET_TARGETS_URL).then(res => res.text())
        ]);

        rawResponses = Papa.parse(responsesRes, { header: true, skipEmptyLines: true }).data;
        targetData = Papa.parse(targetsRes, { header: true, skipEmptyLines: true }).data;
        
        console.log('Data loaded:', { responses: rawResponses.length, targets: targetData.length });
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Gagal memuatkan data. Sila pastikan sambungan internet anda stabil.');
    }
}

function initFilters() {
    const districtSelect = document.getElementById('districtFilter');
    const districts = [...new Set(targetData.map(d => d['Daerah']))].sort();
    
    // Clear existing options except "All"
    districtSelect.innerHTML = '<option value="all">Semua Daerah</option>';
    
    districts.forEach(d => {
        const option = document.createElement('option');
        option.value = d;
        option.textContent = d;
        districtSelect.appendChild(option);
    });
}

function updateDashboard(selectedDistrict) {
    const filteredResponses = selectedDistrict === 'all' 
        ? rawResponses 
        : rawResponses.filter(r => r['daerah_program'] === selectedDistrict);

    const filteredTargets = selectedDistrict === 'all'
        ? targetData
        : targetData.filter(d => d['Daerah'] === selectedDistrict);

    // Calculate Metrics
    const totalResponses = filteredResponses.length;
    
    const stigmaData = filteredResponses.map(r => calculateStigmaScores(r));
    const avgOverall = stigmaData.length > 0 
        ? stigmaData.reduce((acc, curr) => acc + curr.overall, 0) / stigmaData.length 
        : 0;
    
    const avgAffective = stigmaData.length > 0 
        ? stigmaData.reduce((acc, curr) => acc + curr.affective, 0) / stigmaData.length 
        : 0;
        
    const avgCognitive = stigmaData.length > 0 
        ? stigmaData.reduce((acc, curr) => acc + curr.cognitive, 0) / stigmaData.length 
        : 0;
        
    const avgBehavioral = stigmaData.length > 0 
        ? stigmaData.reduce((acc, curr) => acc + curr.behavioral, 0) / stigmaData.length 
        : 0;

    const totalVisitors = filteredTargets.reduce((acc, curr) => acc + (parseInt(curr['Bilangan Pengunjung Sebenar']) || 0), 0);
    const targetVisitors = filteredTargets.reduce((acc, curr) => acc + (parseInt(curr['Sasaran Pengunjung']) || 300), 0);
    
    const responseRate = totalVisitors > 0 ? (totalResponses / totalVisitors) * 100 : 0;
    const visitorAchievement = targetVisitors > 0 ? (totalVisitors / targetVisitors) * 100 : 0;

    // Update KPI Cards
    animateValue('totalResponses', totalResponses);
    animateValue('avgStigma', avgOverall, 2);
    animateValue('totalVisitors', totalVisitors);
    document.getElementById('responseRate').textContent = `${formatNumber(responseRate, 1)}%`;

    // Update Stigma Status
    const interpretation = getStigmaInterpretation(avgOverall);
    const statusEl = document.getElementById('stigmaStatus');
    statusEl.textContent = interpretation.label;
    statusEl.className = `status-badge ${interpretation.class}`;
    document.getElementById('stigmaDesc').textContent = interpretation.desc;

    // Update Progress Bars
    updateProgressBar('visitorProgress', visitorAchievement);
    document.getElementById('visitorTargetText').textContent = `${formatNumber(visitorAchievement, 1)}% dari sasaran (${targetVisitors})`;
    
    updateProgressBar('rateProgress', (responseRate / 30) * 100); // 30% is the target
    document.getElementById('rateTargetText').textContent = `Sasaran: 30% (Semasa: ${formatNumber(responseRate, 1)}%)`;

    // Update Charts
    renderStigmaDimensionsChart(avgAffective, avgCognitive, avgBehavioral);
    renderDistrictComparisonChart(selectedDistrict);
    renderDemographicsChart(filteredResponses);
    renderEvaluationChart(filteredResponses);
}

// Chart Renderers
function renderStigmaDimensionsChart(a, c, b) {
    const ctx = document.getElementById('stigmaDimensionsChart').getContext('2d');
    if (charts.dimensions) charts.dimensions.destroy();

    charts.dimensions = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Afektif (Prasangka)', 'Kognitif (Stereotaip)', 'Tingkah Laku (Diskriminasi)'],
            datasets: [{
                label: 'Skor Purata',
                data: [a, c, b],
                backgroundColor: 'rgba(46, 204, 113, 0.2)',
                borderColor: '#2ecc71',
                pointBackgroundColor: '#2ecc71',
                borderWidth: 2
            }]
        },
        options: {
            scales: {
                r: {
                    min: 1,
                    max: 4,
                    ticks: { stepSize: 1 }
                }
            },
            maintainAspectRatio: false,
            plugins: {
                datalabels: {
                    color: '#2c3e50',
                    font: { weight: 'bold' },
                    formatter: (value) => value.toFixed(2)
                }
            }
        }
    });
}

function renderDistrictComparisonChart(selectedDistrict) {
    const ctx = document.getElementById('districtComparisonChart').getContext('2d');
    if (charts.district) charts.district.destroy();

    const filteredTargets = selectedDistrict === 'all'
        ? targetData
        : targetData.filter(d => d['Daerah'] === selectedDistrict);

    const districts = filteredTargets.map(d => d['Daerah']);
    const actual = filteredTargets.map(d => parseInt(d['Bilangan Pengunjung Sebenar']) || 0);
    const targets = filteredTargets.map(d => parseInt(d['Sasaran Pengunjung']) || 300);

    charts.district = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: districts,
            datasets: [
                {
                    label: 'Kehadiran Sebenar',
                    data: actual,
                    backgroundColor: '#2ecc71',
                    borderRadius: 5
                },
                {
                    label: 'Sasaran (300)',
                    data: targets,
                    backgroundColor: '#e0e0e0',
                    borderRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { 
                    position: 'bottom',
                    labels: { padding: 20 }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    offset: -5,
                    color: '#7f8c8d',
                    font: { size: 10, weight: '600' },
                    formatter: (value) => value > 0 ? value : ''
                }
            },
            layout: {
                padding: {
                    top: 20
                }
            }
        }
    });
}

function renderDemographicsChart(responses) {
    const categories = [
        { id: 'ageChart', key: 'kumpulan_umur', type: 'doughnut' },
        { id: 'raceChart', key: 'bangsa', type: 'pie' },
        { id: 'religionChart', key: 'agama', type: 'doughnut' },
        { id: 'locationChart', key: 'lokasi', type: 'pie' },
        { id: 'educationChart', key: 'pendidikan', type: 'doughnut' },
        { id: 'jobChart', key: 'status_pekerjaan', type: 'pie' }
    ];

    const colors = ['#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e67e22', '#e74c3c', '#1abc9c', '#34495e'];

    categories.forEach(cat => {
        const ctx = document.getElementById(cat.id).getContext('2d');
        if (charts[cat.id]) charts[cat.id].destroy();

        const counts = responses.reduce((acc, curr) => {
            const val = curr[cat.key] || 'Tiada Data';
            acc[val] = (acc[val] || 0) + 1;
            return acc;
        }, {});

        charts[cat.id] = new Chart(ctx, {
            type: cat.type,
            data: {
                labels: Object.keys(counts),
                datasets: [{
                    data: Object.values(counts),
                    backgroundColor: colors
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                    datalabels: {
                        color: '#fff',
                        font: { weight: 'bold', size: 10 },
                        formatter: (value, ctx) => {
                            let sum = 0;
                            let dataArr = ctx.chart.data.datasets[0].data;
                            dataArr.map(data => { sum += data; });
                            let percentage = (value * 100 / sum).toFixed(1) + "%";
                            return value > 0 ? `${value}\n(${percentage})` : '';
                        },
                        textAlign: 'center',
                        display: (ctx) => {
                            const dataset = ctx.chart.data.datasets[0];
                            const value = dataset.data[ctx.dataIndex];
                            const sum = dataset.data.reduce((a, b) => a + b, 0);
                            return (value / sum) > 0.05; // Only show if > 5% to avoid overlap
                        }
                    }
                }
            }
        });
    });
}

function renderEvaluationChart(responses) {
    const ctx = document.getElementById('evaluationChart').getContext('2d');
    if (charts.eval) charts.eval.destroy();

    if (responses.length === 0) return;

    // 1. Update Awareness Bars (Binary)
    const getBinaryPercent = (key) => {
        const yaCount = responses.filter(r => {
            const val = String(r[key] || '').toLowerCase();
            return val === 'ya' || val === 'yes' || val === '1';
        }).length;
        return (yaCount / responses.length) * 100;
    };

    const amalanPct = getBinaryPercent('amalan_kendiri');
    const logoPct = getBinaryPercent('lihat_logo');

    document.getElementById('amalanBar').style.width = amalanPct + '%';
    document.getElementById('amalanPercent').textContent = amalanPct.toFixed(1) + '%';
    document.getElementById('logoBar').style.width = logoPct + '%';
    document.getElementById('logoPercent').textContent = logoPct.toFixed(1) + '%';

    // 2. Ratings Bar Chart (Likert 1-5)
    const metrics = [
        { label: 'Menarik', key: 'rate_menarik' },
        { label: 'Faham', key: 'rate_faham' },
        { label: 'Relevan', key: 'rate_relevan' },
        { label: 'Mendorong', key: 'rate_dorong' }
    ];

    const data = metrics.map(m => {
        const values = responses.map(r => parseFloat(r[m.key])).filter(v => !isNaN(v));
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    });

    charts.eval = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: metrics.map(m => m.label),
            datasets: [{
                label: 'Skor Purata (1-5)',
                data: data,
                backgroundColor: '#3498db',
                borderRadius: 8,
                barThickness: 40
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                x: { min: 0, max: 5 },
                y: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                datalabels: {
                    anchor: 'end',
                    align: 'right',
                    color: '#34495e',
                    font: { weight: 'bold', size: 13 },
                    formatter: (value) => value.toFixed(2)
                }
            }
        }
    });
}

// UI Helpers
function animateValue(id, value, decimals = 0) {
    const obj = document.getElementById(id);
    obj.textContent = formatNumber(value, decimals);
}

function updateProgressBar(id, percentage) {
    const bar = document.getElementById(id);
    const bounded = Math.min(Math.max(percentage, 0), 100);
    bar.style.setProperty('--progress', `${bounded}%`);
    bar.style.width = `${bounded}%`;
}

function showLoading() {
    // Simple overlay or spinner can be added here
    console.log('Loading data...');
}
