// Met Museum API endpoints
const MET_API_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';

// Set up the SVG
const width = document.getElementById('visualization').clientWidth;
const height = 800;
const centerX = width / 2;
const centerY = height / 2;

const svg = d3.select('#visualization')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

// Create a group for the spiral
const spiralGroup = svg.append('g')
    .attr('transform', `translate(${centerX}, ${centerY})`);

// Create tooltip
const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);

// Color scale for different cultures/regions
const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

// Initialize variables
let artworks = [];
let departments = [];

// Fetch departments first
async function fetchDepartments() {
    try {
        const response = await fetch(`${MET_API_BASE}/departments`);
        const data = await response.json();
        departments = data.departments;
        
        // Populate department select
        const select = document.getElementById('departmentSelect');
        select.innerHTML = '<option value="">Select a Department</option>' +
            departments.map(dept => 
                `<option value="${dept.departmentId}">${dept.displayName}</option>`
            ).join('');
        
        // Add event listener
        select.addEventListener('change', handleDepartmentChange);
    } catch (error) {
        console.error('Error fetching departments:', error);
    }
}

async function handleDepartmentChange(event) {
    const deptId = event.target.value;
    if (!deptId) return;
    
    try {
        // First get object IDs for the department
        const response = await fetch(`${MET_API_BASE}/search?departmentId=${deptId}&hasImages=true&q=*`);
        const data = await response.json();
        
        // Get a random sample of 50 objects
        const sampleSize = 50;
        const randomIds = d3.shuffle(data.objectIDs).slice(0, sampleSize);
        
        // Fetch details for each artwork
        artworks = await Promise.all(
            randomIds.map(async id => {
                const objResponse = await fetch(`${MET_API_BASE}/objects/${id}`);
                return objResponse.json();
            })
        );
        
        // Filter out artworks without dates and sort by date
        artworks = artworks
            .filter(artwork => artwork.objectDate && !isNaN(extractYear(artwork.objectDate)))
            .sort((a, b) => extractYear(a.objectDate) - extractYear(b.objectDate));
        
        updateVisualization();
    } catch (error) {
        console.error('Error fetching artworks:', error);
    }
}

function extractYear(dateString) {
    // Extract the first number from the date string
    const match = dateString.match(/\d+/);
    return match ? parseInt(match[0]) : NaN;
}

function createSpiral(dataPoints) {
    const spiral = [];
    const numCoils = 3;
    const coilSpacing = 60;
    
    dataPoints.forEach((_, i) => {
        const angle = (i / (dataPoints.length - 1)) * (numCoils * 2 * Math.PI);
        const radius = (angle / (2 * Math.PI)) * coilSpacing;
        spiral.push({
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius
        });
    });
    
    return spiral;
}

function updateVisualization() {
    // Clear existing elements
    spiralGroup.selectAll('*').remove();
    
    // Create spiral layout
    const spiralPoints = createSpiral(artworks);
    
    // Create artwork elements
    const artworkGroups = spiralGroup.selectAll('.artwork')
        .data(artworks)
        .join('g')
        .attr('class', 'artwork')
        .attr('transform', (d, i) => `translate(${spiralPoints[i].x}, ${spiralPoints[i].y})`);
    
    // Add artwork images
    artworkGroups.append('image')
        .attr('xlink:href', d => d.primaryImageSmall)
        .attr('width', 40)
        .attr('height', 40)
        .attr('x', -20)
        .attr('y', -20)
        .attr('clip-path', 'circle(20px)')
        .style('cursor', 'pointer')
        .on('mouseover', showTooltip)
        .on('mouseout', hideTooltip)
        .on('click', showArtworkDetail);
    
    // Add circular frame
    artworkGroups.append('circle')
        .attr('r', 20)
        .attr('fill', 'none')
        .attr('stroke', d => colorScale(d.culture || 'Unknown'))
        .attr('stroke-width', 2);
    
    // Update legend
    updateLegend();
}

function showTooltip(event, d) {
    tooltip.transition()
        .duration(200)
        .style('opacity', .9);
    
    tooltip.html(`
        <strong>${d.title}</strong><br/>
        ${d.objectDate}<br/>
        ${d.culture || 'Culture unknown'}
    `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');
}

function hideTooltip() {
    tooltip.transition()
        .duration(500)
        .style('opacity', 0);
}

function showArtworkDetail(event, d) {
    const detailDiv = document.getElementById('artwork-detail');
    const detailInfo = detailDiv.querySelector('.detail-info');
    
    detailInfo.innerHTML = `
        <div>
            <img src="${d.primaryImage}" alt="${d.title}">
        </div>
        <div class="artwork-metadata">
            <h2>${d.title}</h2>
            <p><strong>Date:</strong> ${d.objectDate}</p>
            <p><strong>Artist:</strong> ${d.artistDisplayName || 'Unknown'}</p>
            <p><strong>Culture:</strong> ${d.culture || 'Unknown'}</p>
            <p><strong>Medium:</strong> ${d.medium}</p>
            <p><strong>Dimensions:</strong> ${d.dimensions}</p>
            <p><strong>Credit:</strong> ${d.creditLine}</p>
            ${d.objectURL ? `<p><a href="${d.objectURL}" target="_blank">View on Met Museum website</a></p>` : ''}
        </div>
    `;
    
    detailDiv.style.display = 'block';
}

function updateLegend() {
    const cultures = [...new Set(artworks.map(d => d.culture || 'Unknown'))];
    
    const legend = d3.select('.legend')
        .selectAll('.legend-item')
        .data(cultures)
        .join('div')
        .attr('class', 'legend-item');
    
    legend.html(culture => `
        <div class="legend-color" style="background-color: ${colorScale(culture)}"></div>
        <div>${culture}</div>
    `);
}

// Close detail view when clicking close button
document.querySelector('.close-button').addEventListener('click', () => {
    document.getElementById('artwork-detail').style.display = 'none';
});

// Initialize the visualization
fetchDepartments(); 