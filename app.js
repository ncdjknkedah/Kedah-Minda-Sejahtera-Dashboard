const SHEET_RESPONSES_URL = 'https://docs.google.com/spreadsheets/d/1xQdgrVAVwxGbqJEe3alTPEwkIITasTTwNCLKVK6Juvg/gviz/tq?tqx=out:csv&gid=0';
const SHEET_TARGETS_URL = 'https://docs.google.com/spreadsheets/d/1xQdgrVAVwxGbqJEe3alTPEwkIITasTTwNCLKVK6Juvg/gviz/tq?tqx=out:csv&gid=435147458';

let rawResponses = [];
let targetData = [];
let charts = {};

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
            maintainAspectRatio: false
        }
    });
}

function renderDistrictComparisonChart(selectedDistrict) {
    const ctx = document.getElementById('districtComparisonChart').getContext('2d');
    if (charts.district) charts.district.destroy();

    const districts = targetData.map(d => d['Daerah']);
    const actual = targetData.map(d => parseInt(d['Bilangan Pengunjung Sebenar']) || 0);
    const targets = targetData.map(d => parseInt(d['Sasaran Pengunjung']) || 300);

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
                legend: { position: 'top' }
            }
        }
    });
}

function renderDemographicsChart(responses) {
    // Age Group
    const ageCtx = document.getElementById('ageGroupChart').getContext('2d');
    if (charts.age) charts.age.destroy();

    const ageCounts = responses.reduce((acc, curr) => {
        const age = curr['kumpulan_umur'] || 'Tiada Data';
        acc[age] = (acc[age] || 0) + 1;
        return acc;
    }, {});

    charts.age = new Chart(ageCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(ageCounts),
            datasets: [{
                data: Object.values(ageCounts),
                backgroundColor: ['#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e67e22', '#e74c3c']
            }]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    // Gender
    const genderCtx = document.getElementById('genderChart').getContext('2d');
    if (charts.gender) charts.gender.destroy();

    const genderCounts = responses.reduce((acc, curr) => {
        const gender = curr['jantina'] || 'Tiada Data';
        acc[gender] = (acc[gender] || 0) + 1;
        return acc;
    }, {});

    charts.gender = new Chart(genderCtx, {
        type: 'pie',
        data: {
            labels: Object.keys(genderCounts),
            datasets: [{
                data: Object.values(genderCounts),
                backgroundColor: ['#3498db', '#e84393']
            }]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

function renderEvaluationChart(responses) {
    const ctx = document.getElementById('evaluationChart').getContext('2d');
    if (charts.eval) charts.eval.destroy();

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
                backgroundColor: 'rgba(52, 152, 219, 0.7)',
                borderColor: '#3498db',
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: {
            indexAxis: 'y',
            scales: { x: { min: 0, max: 5 } },
            maintainAspectRatio: false
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
