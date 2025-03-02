// Met Museum API endpoints
const MET_API_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';

// Set up the SVG
const width = document.getElementById('visualization').clientWidth;
const height = window.innerHeight - 200; // Account for header and controls

const svg = d3.select('#visualization')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

// Create a group for the map
const mapGroup = svg.append('g');

// Create a group for the bubbles
const bubblesGroup = svg.append('g');

// Create tooltip
const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);

// Predefined distinct color palette
const DISTINCT_COLORS = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", 
    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
    "#aec7e8", "#ffbb78", "#98df8a", "#ff9896", "#c5b0d5",
    "#c49c94", "#f7b6d2", "#c7c7c7", "#dbdb8d", "#9edae5"
];

// Color scale for different departments
const colorScale = d3.scaleOrdinal(DISTINCT_COLORS);

// Initialize variables
let worldData;
let artworksByCountry = {};
let currentTimePeriod = 'all';
let metadata = {};

// Load the world map data and initialize the visualization
document.addEventListener('DOMContentLoaded', () => {
    // Show loading indicator
    showLoading('Loading map data...');
    
    // Load world map data and pre-calculated artwork data
    Promise.all([
        d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'),
        d3.json('data.json')
    ])
    .then(([world, artData]) => {
        worldData = world;
        artworksByCountry = artData.countries;
        metadata = artData.metadata;
        
        hideLoading();
        drawMap();
        setupEventListeners();
    })
    .catch(error => {
        console.error('Error loading data:', error);
        hideLoading();
        showError('Failed to load data. Please try refreshing the page.');
    });
});

// Function to show loading indicator
function showLoading(message) {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'simple-loading';
    loadingIndicator.innerHTML = message || 'Loading...';
    document.getElementById('visualization').appendChild(loadingIndicator);
}

// Function to hide loading indicator
function hideLoading() {
    const loadingIndicator = document.querySelector('.simple-loading');
    if (loadingIndicator && loadingIndicator.parentNode) {
        loadingIndicator.parentNode.removeChild(loadingIndicator);
    }
}

// Function to show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = message;
    document.getElementById('visualization').appendChild(errorDiv);
}

// Draw the world map
function drawMap() {
    // Clear previous elements
    mapGroup.selectAll('*').remove();
    bubblesGroup.selectAll('*').remove();
    
    // Create a projection
    const projection = d3.geoNaturalEarth1()
        .fitSize([width, height], topojson.feature(worldData, worldData.objects.countries));
    
    // Create a path generator
    const path = d3.geoPath()
        .projection(projection);
    
    // Draw the countries
    mapGroup.selectAll('path')
        .data(topojson.feature(worldData, worldData.objects.countries).features)
        .enter()
        .append('path')
        .attr('d', path)
        .attr('class', 'country')
        .attr('fill', '#e0e0e0')
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.5);
    
    // Add bubbles for countries with artworks
    addCountryBubbles(projection);
    
    // Add legend
    addLegend();
}

// Add bubbles for countries with artworks
function addCountryBubbles(projection) {
    // Filter countries based on time period
    const filteredData = {};
    
    Object.entries(artworksByCountry).forEach(([country, data]) => {
        if (currentTimePeriod === 'all' || data.timePeriods[currentTimePeriod] > 0) {
            filteredData[country] = data;
        }
    });
    
    // Get country centroids from the map data
    const countryCentroids = {};
    topojson.feature(worldData, worldData.objects.countries).features.forEach(feature => {
        // Try to match country name
        const countryName = feature.properties.name;
        if (countryName) {
            countryCentroids[countryName] = projection(d3.geoCentroid(feature));
        }
    });
    
    // Manual mapping for countries that might not match
    const countryNameMapping = {
        'United States': ['United States of America', 'USA', 'US'],
        'United Kingdom': ['UK', 'Britain', 'Great Britain'],
        'Russia': ['Russian Federation'],
        'South Korea': ['Korea, Republic of', 'Korea'],
        'Iran': ['Iran, Islamic Republic of', 'Persia']
    };
    
    // Add manual centroids for important countries that might be missing
    const manualCentroids = {
        'United States': projection([-95.7129, 37.0902]),
        'United Kingdom': projection([-3.4360, 55.3781]),
        'France': projection([2.2137, 46.2276]),
        'Germany': projection([10.4515, 51.1657]),
        'Italy': projection([12.5674, 41.8719]),
        'Spain': projection([-3.7492, 40.4637]),
        'China': projection([104.1954, 35.8617]),
        'Japan': projection([138.2529, 36.2048]),
        'India': projection([78.9629, 20.5937]),
        'Russia': projection([105.3188, 61.5240]),
        'Egypt': projection([30.8025, 26.8206])
    };
    
    // Combine all centroids
    Object.entries(manualCentroids).forEach(([country, centroid]) => {
        countryCentroids[country] = centroid;
    });
    
    // Try to match countries using the mapping
    Object.entries(countryNameMapping).forEach(([standardName, alternateNames]) => {
        alternateNames.forEach(altName => {
            topojson.feature(worldData, worldData.objects.countries).features.forEach(feature => {
                if (feature.properties.name === altName && !countryCentroids[standardName]) {
                    countryCentroids[standardName] = projection(d3.geoCentroid(feature));
                }
            });
        });
    });
    
    // Calculate the maximum count for scaling
    const maxCount = Math.max(...Object.values(filteredData).map(d => d.count));
    
    // Scale for bubble size
    const radiusScale = d3.scaleSqrt()
        .domain([1, maxCount])
        .range([5, 30]);
    
    // Create bubbles for each country with artwork data
    Object.entries(filteredData).forEach(([country, data]) => {
        const centroid = countryCentroids[country] || manualCentroids[country];
        
        if (centroid) {
            // Create a group for the bubble
            const bubbleGroup = bubblesGroup.append('g')
                .attr('class', 'bubble-group')
                .attr('transform', `translate(${centroid[0]}, ${centroid[1]})`);
            
            // Add the bubble
            bubbleGroup.append('circle')
                .attr('r', radiusScale(data.count))
                .attr('fill', d => {
                    // Find the department with the most artworks
                    const topDepartment = Object.entries(data.departments)
                        .sort((a, b) => b[1] - a[1])[0][0];
                    return colorScale(topDepartment);
                })
                .attr('stroke', '#fff')
                .attr('stroke-width', 1)
                .attr('fill-opacity', 0.7)
                .attr('class', 'country-bubble')
                .on('mouseover', (event) => {
                    showTooltip(event, country, data);
                })
                .on('mouseout', hideTooltip)
                .on('click', (event) => {
                    showCountryDetail(country, data);
                });
            
            // Add country label for larger bubbles
            if (data.count > maxCount / 10) {
                bubbleGroup.append('text')
                    .attr('text-anchor', 'middle')
                    .attr('dy', radiusScale(data.count) + 12)
                    .attr('font-size', '10px')
                    .attr('fill', '#333')
                    .text(country);
            }
        }
    });
}

// Add a legend for departments
function addLegend() {
    // Get unique departments
    const departments = [...new Set(
        Object.values(artworksByCountry)
            .flatMap(data => Object.keys(data.departments))
    )];
    
    // Create legend
    const legend = d3.select('#visualization')
        .append('div')
        .attr('class', 'map-legend');
    
    // Add title
    legend.append('h3')
        .text('Departments');
    
    // Add legend items
    departments.forEach(dept => {
        const item = legend.append('div')
            .attr('class', 'legend-item');
        
        item.append('div')
            .attr('class', 'legend-color')
            .style('background-color', colorScale(dept));
        
        item.append('span')
            .text(dept);
    });
}

// Show tooltip with country information
function showTooltip(event, country, data) {
    // Get the top departments
    const topDepartments = Object.entries(data.departments)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([dept, count]) => `${dept}: ${count}`)
        .join('<br>');
    
    // Create tooltip content
    const content = `
        <strong>${country}</strong><br>
        Total Artworks: ${data.count}<br>
        <br>
        <strong>Top Departments:</strong><br>
        ${topDepartments}
    `;
    
    // Show the tooltip
    tooltip.transition()
        .duration(200)
        .style('opacity', 0.9);
    
    tooltip.html(content)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');
}

// Hide tooltip
function hideTooltip() {
    tooltip.transition()
        .duration(500)
        .style('opacity', 0);
}

// Show detailed information for a country
function showCountryDetail(country, data) {
    // Get the detail view element
    const detailView = document.getElementById('artwork-detail');
    const detailInfo = detailView.querySelector('.detail-info');
    
    // Create a pie chart of departments
    const departmentsData = Object.entries(data.departments)
        .map(([name, value]) => ({ name, value }));
    
    // Get sample artworks if available - limit to 3 maximum for better fit
    let artworkSample = data.sampleArtworkIds || [];
    if (artworkSample.length > 3) {
        artworkSample = artworkSample.slice(0, 3);
    }
    
    // Create the HTML content with simple row layout
    detailInfo.innerHTML = `
        <!-- Row 1: Country title and artwork count -->
        <div class="detail-row">
            <h2>${country}</h2>
            <p>Total Artworks: ${data.count}</p>
        </div>
        <div class="geo-modal"> 
           
        <div class="detail-row charts-row">
            <div class="chart-container">
                <h3>Department Distribution</h3>
                <div id="department-pie-chart"></div>
            </div>
            <div class="chart-container">
                <h3>Time Period Distribution</h3>
                <div id="time-period-chart"></div>
            </div>
 </div>
            <div class="geo-right">
 <!-- Row 3: Sample artworks -->
        ${artworkSample.length > 0 ? `
        <div class="detail-row">
            <h3>Sample Artworks (${artworkSample.length} of ${data.count})</h3>
            <div class="artwork-grid">
                ${artworkSample.map(artwork => `
                    <div class="artwork-thumbnail">
                        <img src="${artwork.image || 'https://via.placeholder.com/150?text=No+Image'}" 
                             alt="${artwork.title || 'Artwork'}" 
                             title="${artwork.title || 'Untitled'}"
                             style="height: 80px; width: 100%; object-fit: cover;">
                        <div class="artwork-info" style="padding: 4px;">
                            <p class="artwork-title" style="font-size: 0.65em;">${artwork.title || 'Untitled'}</p>
                            <p class="artwork-date" style="font-size: 0.6em;">${artwork.date || 'Unknown date'}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
        
        <!-- Row 4: View more link -->
        <div class="detail-row">
            <a href="https://www.metmuseum.org/search-results?q=${country}" target="_blank">
                View more artworks from ${country} on the Met Museum website
            </a>
        </div>

       


        </div>
        
        </div>
     
        
       
    `;
    
    // Show the detail view with inline style to ensure scrolling
    detailView.style.display = 'block';
    detailView.style.overflowY = 'auto';
    
    // Prevent background scrolling
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    
    // Reset scroll position
    detailView.scrollTop = 0;
    
    // Create the department pie chart
    createPieChart(departmentsData, '#department-pie-chart', colorScale);
    
    // Create the time period chart
    createTimeChart(data.timePeriods, '#time-period-chart');
    
    // Add event listener to close button
    const closeButton = detailView.querySelector('.close-button');
    closeButton.onclick = function() {
        detailView.style.display = 'none';
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
    };
}

// Create a pie chart
function createPieChart(data, selector, colorFn) {
    // Set up dimensions
    const width = 200;
    const height = 200;
    const radius = Math.min(width, height) / 2;
    
    // Create SVG
    const svg = d3.select(selector)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);
    
    // Create pie layout
    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);
    
    // Create arc generator
    const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(radius - 10);
    
    // Create arcs
    const arcs = svg.selectAll('.arc')
        .data(pie(data))
        .enter()
        .append('g')
        .attr('class', 'arc');
    
    // Add paths
    arcs.append('path')
        .attr('d', arc)
        .attr('fill', d => colorFn(d.data.name))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1);
    
    // Add labels for larger segments
    arcs.filter(d => d.endAngle - d.startAngle > 0.25)
        .append('text')
        .attr('transform', d => `translate(${arc.centroid(d)})`)
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .attr('font-size', '10px')
        .attr('fill', '#fff')
        .text(d => d.data.name.split(' ')[0]);
}

// Create a time period chart
function createTimeChart(timePeriods, selector) {
    // Set up dimensions
    const width = 200;
    const height = 150;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Prepare data
    const data = Object.entries(timePeriods)
        .map(([name, value]) => ({ name, value }));
    
    // Create scales
    const xScale = d3.scaleBand()
        .domain(data.map(d => d.name))
        .range([0, innerWidth])
        .padding(0.1);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value)])
        .nice()
        .range([innerHeight, 0]);
    
    // Create SVG
    const svg = d3.select(selector)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    // Add bars
    svg.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.name))
        .attr('y', d => yScale(d.value))
        .attr('width', xScale.bandwidth())
        .attr('height', d => innerHeight - yScale(d.value))
        .attr('fill', (d, i) => d3.schemeCategory10[i % 10]);
    
    // Add x-axis
    svg.append('g')
        .attr('transform', `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .attr('font-size', '8px')
        .attr('transform', 'rotate(-45)')
        .attr('text-anchor', 'end');
    
    // Add y-axis
    svg.append('g')
        .call(d3.axisLeft(yScale).ticks(5))
        .selectAll('text')
        .attr('font-size', '8px');
}

// Set up event listeners
function setupEventListeners() {
    // Time period select
    document.getElementById('timeperiodSelect').addEventListener('change', function() {
        currentTimePeriod = this.value;
        drawMap();
    });
    
    // Close detail view
    document.querySelector('.close-button').addEventListener('click', function() {
        document.getElementById('artwork-detail').style.display = 'none';
    });
    
    // Make the visualization responsive
    window.addEventListener('resize', () => {
        // Debounce the resize event
        clearTimeout(window.resizeTimer);
        window.resizeTimer = setTimeout(() => {
            // Update SVG dimensions
            const newWidth = document.getElementById('visualization').clientWidth;
            const newHeight = window.innerHeight - 200;
            
            svg.attr('width', newWidth)
               .attr('height', newHeight);
            
            // Redraw the map
            drawMap();
        }, 250);
    });
} 