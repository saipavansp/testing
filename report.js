// Global chart instances
let charts = {
    emotionPie: null,
    emotionTimeline: null,
    communicationRadar: null,
    professionalScores: null,
    wpmChart: null,
    confidenceTimeline: null
};

// Chart colors
const CHART_COLORS = {
    primary: '#4361ee',
    secondary: '#3f37c9',
    success: '#4caf50',
    warning: '#ff9800',
    danger: '#f44336',
    info: '#2196f3',
    gray: '#6c757d'
};

// Initialize report with data
function initializeReport(data) {
    // Set basic information
    document.getElementById('report-date').textContent = new Date().toLocaleString();
    
    // Update all sections
    updateSummaryMetrics(data.summary);
    createAllCharts(data);
    updateDetailedAnalysis(data);
    updateRecommendations(data);
    
    // Save data for download
    window.reportData = data;
}

// Add this at the beginning of report.js
document.addEventListener('DOMContentLoaded', () => {
    // Try to get report data from localStorage
    const reportData = localStorage.getItem('reportData');
    
    if (reportData) {
        try {
            const data = JSON.parse(reportData);
            initializeReport(data);
            // Clear localStorage after loading
            localStorage.removeItem('reportData');
        } catch (error) {
            console.error('Error loading report data:', error);
            showErrorMessage();
        }
    } else if (!window.location.search.includes('test=true')) {
        showErrorMessage();
    }
});

function showErrorMessage() {
    Swal.fire({
        title: 'No Report Data',
        text: 'No assessment data found. Please complete an assessment first.',
        icon: 'error'
    }).then(() => {
        window.location.href = '/index.html';
    });
}

// Create all charts
function createAllCharts(data) {
    // Destroy existing charts
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });

    // Create new charts
    charts.emotionPie = createEmotionPieChart(data.emotionAnalysis);
    charts.emotionTimeline = createEmotionTimeline(data.emotionAnalysis);
    charts.communicationRadar = createCommunicationRadar(data.professionalAnalysis);
    charts.professionalScores = createProfessionalScores(data.professionalAnalysis);
    charts.wpmChart = createWPMChart(data.speechAnalysis);
    charts.confidenceTimeline = createConfidenceTimeline(data.confidenceAnalysis);
}

// Create emotion pie chart
function createEmotionPieChart(emotionData) {
    const ctx = document.getElementById('emotion-pie').getContext('2d');
    
    return new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(emotionData),
            datasets: [{
                data: Object.values(emotionData),
                backgroundColor: Object.values(CHART_COLORS),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                title: {
                    display: true,
                    text: 'Emotional Expression Distribution',
                    font: { size: 16 }
                }
            },
            cutout: '60%'
        }
    });
}

// Create emotion timeline
function createEmotionTimeline(emotionData) {
    const ctx = document.getElementById('emotion-timeline').getContext('2d');
    const timePoints = generateTimePoints(120); // 2 minutes in seconds
    
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: timePoints,
            datasets: [{
                label: 'Emotional Engagement',
                data: emotionData.timeline || [],
                borderColor: CHART_COLORS.primary,
                tension: 0.4,
                fill: true,
                backgroundColor: hexToRGBA(CHART_COLORS.primary, 0.1)
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 10,
                    title: {
                        display: true,
                        text: 'Engagement Level'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Time (seconds)'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Emotional Engagement Over Time'
                }
            }
        }
    });
}

// Create communication radar chart
function createCommunicationRadar(professionalData) {
    const ctx = document.getElementById('communication-radar').getContext('2d');
    
    return new Chart(ctx, {
        type: 'radar',
        data: {
            labels: [
                'Clarity',
                'Organization',
                'Confidence',
                'Engagement',
                'Professionalism',
                'Delivery'
            ],
            datasets: [{
                label: 'Your Score',
                data: [
                    professionalData.clarityScore,
                    professionalData.organizationScore,
                    professionalData.confidenceScore,
                    professionalData.engagementScore,
                    professionalData.professionalismScore,
                    professionalData.deliveryScore
                ],
                borderColor: CHART_COLORS.primary,
                backgroundColor: hexToRGBA(CHART_COLORS.primary, 0.2),
                pointBackgroundColor: CHART_COLORS.primary,
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: CHART_COLORS.primary
            }]
        },
        options: {
            responsive: true,
            scales: {
                r: {
                    min: 0,
                    max: 10,
                    beginAtZero: true,
                    ticks: {
                        stepSize: 2
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Communication Skills Analysis'
                }
            }
        }
    });
}

// Create WPM chart
function createWPMChart(speechData) {
    const ctx = document.getElementById('wpm-chart').getContext('2d');
    const segments = speechData.wpmSegments || [];
    
    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: segments.map((_, index) => `Segment ${index + 1}`),
            datasets: [{
                label: 'Words per Minute',
                data: segments,
                backgroundColor: CHART_COLORS.info,
                borderColor: CHART_COLORS.info,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'WPM'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Speaking Rate Analysis'
                }
            }
        }
    });
}

// Update detailed analysis
function updateDetailedAnalysis(data) {
    // Grammar Analysis
    const grammarSection = document.getElementById('grammar-analysis');
    grammarSection.innerHTML = `
        <h4>Grammar Assessment</h4>
        <div class="score-card">
            <div class="score-circle ${getScoreClass(data.grammarAnalysis.score)}">
                ${data.grammarAnalysis.score}/10
            </div>
            <p class="mt-3">${data.grammarAnalysis.feedback}</p>
            ${createImprovementsList(data.grammarAnalysis.improvement_suggestions)}
        </div>
    `;

    // Professional Analysis
    updateProfessionalAnalysis(data.professionalAnalysis);
    
    // Speech Analysis
    updateSpeechAnalysis(data.speechAnalysis);
}

// Update recommendations
function updateRecommendations(data) {
    const container = document.getElementById('recommendations');
    const recommendations = data.recommendations || [];
    
    container.innerHTML = recommendations.map(rec => `
        <div class="recommendation-item">
            <i class="fas fa-lightbulb text-warning"></i>
            <div class="recommendation-content">
                <h5>${rec.title}</h5>
                <p>${rec.description}</p>
            </div>
        </div>
    `).join('');
}

// Helper Functions
function hexToRGBA(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function generateTimePoints(duration) {
    return Array.from({length: duration}, (_, i) => i);
}

function getScoreClass(score) {
    if (score >= 8) return 'excellent';
    if (score >= 6) return 'good';
    if (score >= 4) return 'fair';
    return 'needs-improvement';
}

function createImprovementsList(suggestions) {
    if (!suggestions || !suggestions.length) return '';
    
    return `
        <div class="improvements-list">
            <h5>Improvement Areas:</h5>
            <ul>
                ${suggestions.map(suggestion => `
                    <li><i class="fas fa-arrow-right"></i> ${suggestion}</li>
                `).join('')}
            </ul>
        </div>
    `;
}

// Export Functions
function downloadPDF() {
    const element = document.querySelector('.report-container');
    
    html2canvas(element).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const ratio = canvas.width / canvas.height;
        const imgWidth = pageWidth;
        const imgHeight = pageWidth / ratio;
        
        let heightLeft = imgHeight;
        let position = 0;
        
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        
        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }
        
        pdf.save(`assessment-report-${new Date().toISOString()}.pdf`);
    });
}

function downloadJSON() {
    if (!window.reportData) return;
    
    const dataStr = JSON.stringify(window.reportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assessment-data-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
    // Add event listeners for download buttons
    document.getElementById('download-pdf').addEventListener('click', downloadPDF);
    document.getElementById('download-json').addEventListener('click', downloadJSON);
    
    // Check for test mode
    if (window.location.search.includes('test=true')) {
        const testData = generateTestData();
        initializeReport(testData);
    }
});

// Generate test data for preview
function generateTestData() {
    return {
        summary: {
            totalDuration: 120,
            wordsPerMinute: 150,
            totalWords: 300,
            confidenceScore: 8.5
        },
        emotionAnalysis: {
            "Neutral": 40,
            "Engaged": 30,
            "Confident": 20,
            "Enthusiastic": 10
        },
        grammarAnalysis: {
            score: 8.5,
            feedback: "Excellent grammar usage with clear articulation.",
            improvement_suggestions: [
                "Consider using more varied transitional phrases",
                "Include more industry-specific terminology"
            ]
        },
        professionalAnalysis: {
            clarityScore: 8.5,
            organizationScore: 8.0,
            confidenceScore: 8.5,
            engagementScore: 7.5,
            professionalismScore: 8.0,
            deliveryScore: 7.5
        },
        recommendations: [
            {
                title: "Pace Management",
                description: "Maintain consistent speaking pace throughout the presentation"
            },
            {
                title: "Engagement Enhancement",
                description: "Incorporate more dynamic vocal variations to maintain audience interest"
            }
        ]
    };
}