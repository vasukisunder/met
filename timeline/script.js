// Ensure back link is clickable
document.addEventListener('DOMContentLoaded', function() {
    const backLink = document.querySelector('.back-link');
    if (backLink) {
        backLink.addEventListener('click', function(e) {
            // Allow default behavior (navigation)
            console.log('Back link clicked');
            // Explicitly navigate if needed
            // window.location.href = this.getAttribute('href');
        });
    }
});

// Met Museum API endpoints
const MET_API_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';

// Set up the SVG to fill the entire visualization container
const width = document.getElementById('visualization').clientWidth;
const height = window.innerHeight - 150; // Account for header and legend

const svg = d3.select('#visualization')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('pointer-events', 'auto'); // Ensure SVG elements respond to pointer events properly

// Create a group for the visualization
const mainGroup = svg.append('g');

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
    "#c49c94", "#f7b6d2", "#c7c7c7", "#dbdb8d", "#9edae5",
    "#393b79", "#637939", "#8c6d31", "#843c39", "#7b4173",
    "#5254a3", "#8ca252", "#bd9e39", "#ad494a", "#a55194",
    "#6b6ecf", "#b5cf6b", "#e6ab02", "#a6761d", "#e7969c",
    "#7570b3", "#66a61e", "#e6ab02", "#a6761d", "#666666"
];

// Generate a more diverse color palette for cultures
function generateColorPalette(count) {
    // If we have more cultures than predefined colors, we'll need to generate additional colors
    if (count <= DISTINCT_COLORS.length) {
        // Return a subset of the predefined colors
        return DISTINCT_COLORS.slice(0, count);
    } else {
        // Use all predefined colors
        const colors = [...DISTINCT_COLORS];
        
        // Generate additional colors using HSL with maximized distance
        const additionalCount = count - DISTINCT_COLORS.length;
        const hueStep = 360 / additionalCount;
        
        for (let i = 0; i < additionalCount; i++) {
            const hue = i * hueStep;
            // Use different saturation/lightness combinations to maximize distinction
            const saturation = 70 + (i % 3) * 10; // 70%, 80%, 90%
            const lightness = 45 + (i % 5) * 5;   // 45%, 50%, 55%, 60%, 65%
            colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
        }
        
        return colors;
    }
}

// Create a custom color scale that doesn't reuse colors
const colorScale = (function() {
    const cultureMap = new Map();
    let allColors = [];
    
    return function(culture) {
        if (!cultureMap.has(culture)) {
            // Generate new colors when needed
            const existingCount = cultureMap.size;
            if (existingCount >= allColors.length) {
                // Generate a new batch of colors if needed
                allColors = generateColorPalette(existingCount + 10); // Generate 10 extra colors at a time
            }
            cultureMap.set(culture, allColors[existingCount]);
        }
        return cultureMap.get(culture);
    };
})();

// Initialize variables
let artworks = [];
let currentTimeRange = [null, null];

// Make the visualization responsive
window.addEventListener('resize', () => {
    // Debounce the resize event to avoid excessive updates
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(() => {
        updateSvgDimensions();
        updateVisualization();
    }, 250); // Wait 250ms after resize ends before updating
});

function updateSvgDimensions() {
    const newWidth = document.getElementById('visualization').clientWidth;
    const newHeight = window.innerHeight - 150; // Account for header and legend
    
    svg.attr('width', newWidth)
       .attr('height', newHeight);
}

// Load The Cloisters collection on page load
document.addEventListener('DOMContentLoaded', () => {
    fetchCloistersCollection();
});

async function fetchCloistersCollection() {
    try {
        // Show loading state with a subtle indicator
        document.getElementById('visualization').style.opacity = 0.7;
        
        // The Cloisters department ID is 7
        const deptId = 7;
        
        // First get all object IDs for The Cloisters
        const response = await fetch(`${MET_API_BASE}/search?departmentId=${deptId}&hasImages=true&q=*`);
        const data = await response.json();
        
        if (!data.objectIDs || data.objectIDs.length === 0) {
            console.error('No objects found for The Cloisters');
            return;
        }
        
        // Get a random sample of 500 object IDs
        const sampleSize = 500;
        const randomSample = getRandomSample(data.objectIDs, sampleSize);
        
        // Use a simple loading indicator in the visualization area
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'simple-loading';
        loadingIndicator.innerHTML = 'Loading artworks...';
        document.getElementById('visualization').appendChild(loadingIndicator);
        
        // Fetch details for each artwork with optimized batching
        // Process in larger batches to speed up loading
        const batchSize = 50;
        let allArtworks = [];
        
        for (let i = 0; i < randomSample.length; i += batchSize) {
            const batch = randomSample.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(async id => {
                    try {
                        const objResponse = await fetch(`${MET_API_BASE}/objects/${id}`);
                        return objResponse.json();
                    } catch (error) {
                        console.error(`Error fetching object ${id}:`, error);
                        return null;
                    }
                })
            );
            
            allArtworks = allArtworks.concat(batchResults.filter(item => item !== null));
            
            // If we have enough artworks to show something meaningful, update the visualization
            if (allArtworks.length >= 100 && i + batchSize < randomSample.length) {
                // Process what we have so far
                processArtworks(allArtworks);
                // Update opacity to show we're making progress
                document.getElementById('visualization').style.opacity = 0.8 + (0.2 * (i / randomSample.length));
            }
        }
        
        // Remove loading indicator
        if (loadingIndicator && loadingIndicator.parentNode) {
            loadingIndicator.parentNode.removeChild(loadingIndicator);
        }
        
        // Process all artworks
        processArtworks(allArtworks);
        
        // Restore opacity
        document.getElementById('visualization').style.opacity = 1;
    } catch (error) {
        console.error('Error fetching artworks:', error);
        // Ensure visualization is visible even if there's an error
        document.getElementById('visualization').style.opacity = 1;
    }
}

// Helper function to process artworks data
function processArtworks(artworksData) {
    // Filter out artworks without dates and sort by date
    artworks = artworksData
        .filter(artwork => artwork.objectDate && !isNaN(extractYear(artwork.objectDate)))
        .sort((a, b) => extractYear(a.objectDate) - extractYear(b.objectDate));
    
    // Update time range
    currentTimeRange = [
        d3.min(artworks, d => extractYear(d.objectDate)),
        d3.max(artworks, d => extractYear(d.objectDate))
    ];
    
    // Update the visualization
    updateVisualization();
}

// Helper function to get a random sample of items from an array
function getRandomSample(array, size) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, size);
}

function extractYear(dateString) {
    // Extract the first number from the date string
    const match = dateString.match(/\d+/);
    return match ? parseInt(match[0]) : NaN;
}

function createGridLayout(artworks) {
    // Get current viewport dimensions
    const viewportWidth = svg.attr('width');
    const viewportHeight = svg.attr('height');
    
    // Calculate grid dimensions to fill the screen
    // Determine how many items we want per row based on screen size
    const targetItemsPerRow = Math.ceil(Math.sqrt(artworks.length * viewportWidth / viewportHeight));
    
    // Calculate item size to fill the screen
    const padding = 2; // Small padding between items
    const itemWidth = (viewportWidth / targetItemsPerRow) - padding;
    const itemHeight = itemWidth; // Keep them square
    
    // Calculate how many rows we'll need
    const rowCount = Math.ceil(artworks.length / targetItemsPerRow);
    
    // If we have fewer rows than would fill the height, increase item size
    const availableHeight = viewportHeight;
    const neededHeight = rowCount * (itemHeight + padding);
    
    let finalItemWidth = itemWidth;
    let finalItemHeight = itemHeight;
    
    if (neededHeight < availableHeight) {
        // Scale up to fill more of the height
        const scaleFactor = Math.min(availableHeight / neededHeight, 1.5); // Limit scaling to 1.5x
        finalItemWidth = itemWidth * scaleFactor;
        finalItemHeight = itemHeight * scaleFactor;
    }
    
    // Recalculate items per row with the new size
    const finalItemsPerRow = Math.floor(viewportWidth / (finalItemWidth + padding));
    
    return {
        layout: artworks.map((artwork, i) => {
            const row = Math.floor(i / finalItemsPerRow);
            const col = i % finalItemsPerRow;
            
            return {
                x: col * (finalItemWidth + padding),
                y: row * (finalItemHeight + padding),
                width: finalItemWidth,
                height: finalItemHeight
            };
        }),
        itemsPerRow: finalItemsPerRow,
        itemSize: finalItemWidth,
        visibleCount: artworks.length,
        totalCount: artworks.length
    };
}

function updateVisualization() {
    // Clear existing elements
    mainGroup.selectAll('*').remove();
    
    // Create grid layout
    const gridInfo = createGridLayout(artworks);
    const gridPoints = gridInfo.layout;
    const visibleArtworks = artworks.slice(0, gridInfo.visibleCount);
    
    // Add count information
    d3.select('.artwork-count').remove();
    d3.select('body')
        .append('div')
        .attr('class', 'artwork-count')
        .html(`Showing ${gridInfo.visibleCount} of ${gridInfo.totalCount} artworks`);
    
    // Create artwork elements
    const artworkGroups = mainGroup.selectAll('.artwork')
        .data(visibleArtworks)
        .join('g')
        .attr('class', 'artwork')
        .attr('transform', (d, i) => `translate(${gridPoints[i].x}, ${gridPoints[i].y})`);
    
    // Add colored squares for each artwork
    artworkGroups.append('rect')
        .attr('class', 'artwork-square')
        .attr('width', d => gridPoints[0].width)
        .attr('height', d => gridPoints[0].height)
        .attr('rx', 2) // Rounded corners
        .attr('ry', 2)
        .style('fill', d => colorScale(d.culture || 'Unknown'))
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            // Show tooltip on hover
            showTooltip(event, d);
        })
        .on('mouseout', function(event, d) {
            // Hide tooltip when mouse leaves
            hideTooltip();
        })
        .on('click', function(event, d) {
            // Only show artwork detail on click
            showArtworkDetail(event, d);
        });
    
    // Update legend with cultures
    updateLegend();
}

function updateLegend() {
    // Get unique cultures from all artworks
    const cultures = [...new Set(artworks.map(d => d.culture || 'Unknown'))];
    
    // Create legend
    const legend = d3.select('.legend').empty() ? 
        d3.select('#visualization').append('div').attr('class', 'legend') :
        d3.select('.legend');
    
    legend.selectAll('*').remove();
    
    // Create a container for left-aligned items
    const container = legend.append('div')
        .attr('class', 'legend-container');
    
    cultures.forEach(culture => {
        const item = container.append('div')
            .attr('class', 'legend-item');
        
        item.append('div')
            .attr('class', 'legend-color')
            .style('background-color', colorScale(culture));
        
        item.append('span')
            .text(culture || 'Unknown');
    });
}

function showTooltip(event, d) {
    const year = extractYear(d.objectDate);
    
    tooltip.transition()
        .duration(200)
        .style('opacity', .9);
    
    tooltip.html(`
        <strong>${d.title || 'Untitled'}</strong><br>
        ${d.objectDate || 'Unknown date'}<br>
        ${d.culture || 'Unknown culture'}<br>
        ${d.medium || ''}
    `)
    .style('left', (event.pageX + 10) + 'px')
    .style('top', (event.pageY - 28) + 'px');
}

function hideTooltip() {
    tooltip.transition()
        .duration(500)
        .style('opacity', 0);
}

function showArtworkDetail(event, artwork) {
    // Create or update the detail view
    let detailView = document.querySelector('.artwork-detail');
    
    if (!detailView) {
        detailView = document.createElement('div');
        detailView.className = 'artwork-detail';
        document.body.appendChild(detailView);
    }
    
    // Populate with artwork details
    detailView.innerHTML = `
        <div class="detail-content">
            <span class="close-button">&times;</span>
            <div class="detail-info">
                <img src="${artwork.primaryImage}" alt="${artwork.title || 'Artwork image'}">
                <div class="artwork-metadata">
                    <h2>${artwork.title || 'Untitled'}</h2>
                    <p><strong>Date:</strong> ${artwork.objectDate || 'Unknown'}</p>
                    <p><strong>Culture:</strong> ${artwork.culture || 'Unknown'}</p>
                    <p><strong>Medium:</strong> ${artwork.medium || 'Unknown'}</p>
                    <p><strong>Dimensions:</strong> ${artwork.dimensions || 'Unknown'}</p>
                    <p><strong>Credit Line:</strong> ${artwork.creditLine || ''}</p>
                    <p><a href="${artwork.objectURL}" target="_blank">View on Met Museum Website</a></p>
                </div>
            </div>
        </div>
    `;
    
    // Show the detail view
    detailView.style.display = 'block';
    
    // Add close button functionality
    document.querySelector('.close-button').addEventListener('click', function() {
        detailView.style.display = 'none';
    });
} 