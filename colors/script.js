// Met Museum API endpoints
const MET_API_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';

// Set up the SVG
const width = document.getElementById('visualization').clientWidth;
const height = document.getElementById('visualization').clientHeight || 800;

const svg = d3.select('#visualization')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

// Create a group for the visualization
const vizGroup = svg.append('g')
    .attr('transform', `translate(${width/2}, ${height/2})`);

// Create tooltip
const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);

// Initialize variables
let artworks = [];
let simulation;
let colorThief = new ColorThief();
let dominantColors = {};
let colorFilters = new Set();

// Define painting topics with more general search terms
const paintingTopics = [
    { 
        id: 'landscape', 
        name: 'Landscapes', 
        query: 'landscape', 
        departments: [] // Search all departments
    },
    { 
        id: 'portrait', 
        name: 'Portraits', 
        query: 'portrait', 
        departments: []
    },
    { 
        id: 'still-life', 
        name: 'Still Life', 
        query: 'still life', 
        departments: []
    },
    { 
        id: 'religious', 
        name: 'Religious', 
        query: 'religious', 
        departments: []
    },
    { 
        id: 'mythology', 
        name: 'Mythology', 
        query: 'myth', 
        departments: []
    },
    { 
        id: 'abstract', 
        name: 'Abstract', 
        query: 'abstract', 
        departments: []
    },
    { 
        id: 'figure', 
        name: 'Figures', 
        query: 'figure', 
        departments: []
    },
    { 
        id: 'nature', 
        name: 'Nature', 
        query: 'nature', 
        departments: []
    },
    { 
        id: 'flowers', 
        name: 'Flowers', 
        query: 'flower', 
        departments: []
    },
    { 
        id: 'water', 
        name: 'Water Scenes', 
        query: 'water', 
        departments: []
    },
    { 
        id: 'color', 
        name: 'Colorful', 
        query: 'color', 
        departments: []
    },
    { 
        id: 'blue', 
        name: 'Blue Tones', 
        query: 'blue', 
        departments: []
    }
];

// Initialize the page
function initialize() {
    // Populate topic select
    const select = document.getElementById('departmentSelect');
    select.innerHTML = '<option value="">Select a Topic</option>' +
        paintingTopics.map(topic => 
            `<option value="${topic.id}">${topic.name}</option>`
        ).join('');
    
    // Add event listener
    select.addEventListener('change', handleTopicChange);
    
    // Update the label for the dropdown
    const label = document.querySelector('label[for="departmentSelect"]');
    if (label) {
        label.textContent = 'Select a Topic:';
    }
}

async function handleTopicChange(event) {
    const topicId = event.target.value;
    if (!topicId) return;
    
    // Find the selected topic
    const selectedTopic = paintingTopics.find(topic => topic.id === topicId);
    if (!selectedTopic) return;
    
    // Show loading indicator
    showLoading(true);
    
    try {
        // Create a more general search query
        const searchParams = new URLSearchParams({
            hasImages: true,
            q: selectedTopic.query
        });
        
        // Add department filter if available and not empty
        if (selectedTopic.departments && selectedTopic.departments.length > 0) {
            const deptId = selectedTopic.departments[Math.floor(Math.random() * selectedTopic.departments.length)];
            searchParams.append('departmentId', deptId);
        }
        
        // Fetch artworks matching the topic
        const response = await fetch(`${MET_API_BASE}/search?${searchParams.toString()}`);
        const data = await response.json();
        
        if (!data.objectIDs || data.objectIDs.length < 5) {
            showLoading(false);
            alert(`Not enough artworks found for topic: ${selectedTopic.name}. Please try another topic.`);
            return;
        }
        
        console.log(`Found ${data.objectIDs.length} artworks for topic: ${selectedTopic.name}`);
        
        // Get a larger sample of artworks to ensure we have enough after filtering
        const sampleSize = Math.min(200, data.objectIDs.length);
        const randomIds = d3.shuffle(data.objectIDs).slice(0, sampleSize);
        
        // Fetch details for each artwork in batches to avoid overwhelming the API
        const batchSize = 20;
        let fetchedArtworks = [];
        
        for (let i = 0; i < randomIds.length; i += batchSize) {
            const batchIds = randomIds.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batchIds.map(async id => {
                    try {
                        const objResponse = await fetch(`${MET_API_BASE}/objects/${id}`);
                        return objResponse.json();
                    } catch (e) {
                        console.error(`Error fetching artwork ${id}:`, e);
                        return null;
                    }
                })
            );
            fetchedArtworks = fetchedArtworks.concat(batchResults);
            
            // If we already have enough valid artworks, we can stop fetching
            const validArtworks = fetchedArtworks.filter(artwork => 
                artwork && artwork.primaryImageSmall && isValidArtwork(artwork, selectedTopic)
            );
            if (validArtworks.length >= 20) {
                break;
            }
        }
        
        // Filter to ensure we have 2D artworks with images
        artworks = fetchedArtworks.filter(artwork => 
            artwork && artwork.primaryImageSmall && isValidArtwork(artwork, selectedTopic)
        );
        
        // Limit to a reasonable number for visualization
        if (artworks.length > 40) {
            artworks = artworks.slice(0, 40);
        }
        
        if (artworks.length < 5) {
            // If we still don't have enough, try a more general search
            const generalSearchParams = new URLSearchParams({
                hasImages: true,
                q: "painting " + selectedTopic.query
            });
            
            const generalResponse = await fetch(`${MET_API_BASE}/search?${generalSearchParams.toString()}`);
            const generalData = await generalResponse.json();
            
            if (generalData.objectIDs && generalData.objectIDs.length > 0) {
                const generalSampleSize = Math.min(50, generalData.objectIDs.length);
                const generalRandomIds = d3.shuffle(generalData.objectIDs)
                    .filter(id => !randomIds.includes(id))
                    .slice(0, generalSampleSize);
                
                const generalFetchedArtworks = await Promise.all(
                    generalRandomIds.map(async id => {
                        try {
                            const objResponse = await fetch(`${MET_API_BASE}/objects/${id}`);
                            return objResponse.json();
                        } catch (e) {
                            console.error(`Error fetching artwork ${id}:`, e);
                            return null;
                        }
                    })
                );
                
                const additionalArtworks = generalFetchedArtworks.filter(artwork => 
                    artwork && artwork.primaryImageSmall && isValidArtwork(artwork, selectedTopic, true)
                );
                
                artworks = artworks.concat(additionalArtworks);
                
                // Limit again if we added more
                if (artworks.length > 40) {
                    artworks = artworks.slice(0, 40);
                }
            }
        }
        
        if (artworks.length < 5) {
            showLoading(false);
            alert(`Not enough suitable artworks found for topic: ${selectedTopic.name}. Please try another topic.`);
            return;
        }
        
        console.log(`Displaying ${artworks.length} artworks for topic: ${selectedTopic.name}`);
        
        // Extract color palettes
        await extractColorPalettes();
        
        // Update visualization
        updateVisualization();
        
        // Update color filters
        updateColorFilters();
        
        // Hide loading indicator
        showLoading(false);
        
        // Update the title to reflect the selected topic
        document.querySelector('h1').textContent = `Color Palette Network: ${selectedTopic.name}`;
        
    } catch (error) {
        console.error('Error fetching artworks:', error);
        showLoading(false);
        alert(`Error loading artworks: ${error.message}. Please try again.`);
    }
}

async function extractColorPalettes() {
    dominantColors = {};
    
    // Create a promise for each artwork to extract its dominant color
    const colorPromises = artworks.map(artwork => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                try {
                    // Create a canvas to analyze the image
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Set canvas dimensions
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    // Draw the image on the canvas
                    ctx.drawImage(img, 0, 0, img.width, img.height);
                    
                    // Skip the outer 15% of the image to avoid frames and backgrounds
                    const margin = 0.15;
                    const x = Math.floor(img.width * margin);
                    const y = Math.floor(img.height * margin);
                    const w = Math.floor(img.width * (1 - 2 * margin));
                    const h = Math.floor(img.height * (1 - 2 * margin));
                    
                    // Only proceed if we have a valid region to analyze
                    if (w > 0 && h > 0) {
                        // Create a new canvas with just the center portion
                        const centerCanvas = document.createElement('canvas');
                        const centerCtx = centerCanvas.getContext('2d');
                        centerCanvas.width = w;
                        centerCanvas.height = h;
                        
                        // Copy the center portion to the new canvas
                        centerCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
                        
                        // Get the image data directly
                        const imageData = centerCtx.getImageData(0, 0, w, h).data;
                        
                        // Collect all non-white, non-black pixels
                        const colors = [];
                        for (let i = 0; i < imageData.length; i += 4) {
                            const r = imageData[i];
                            const g = imageData[i + 1];
                            const b = imageData[i + 2];
                            
                            // Skip very light or very dark colors
                            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                            if (brightness > 30 && brightness < 225) {
                                colors.push([r, g, b]);
                            }
                        }
                        
                        // If we have colors, cluster them to find the palette
                        if (colors.length > 0) {
                            // Simple clustering - take a sample of pixels and find the most common colors
                            const sampleSize = Math.min(colors.length, 1000);
                            const sampledColors = [];
                            for (let i = 0; i < sampleSize; i++) {
                                sampledColors.push(colors[Math.floor(Math.random() * colors.length)]);
                            }
                            
                            // Find 5 dominant colors using a simple clustering approach
                            const palette = findDominantColors(sampledColors, 5);
                            const dominantColor = palette[0]; // Most dominant color
                            
                            // Store the results
                            dominantColors[artwork.objectID] = {
                                dominant: dominantColor,
                                palette: palette
                            };
                        } else {
                            // Fallback to ColorThief if our method didn't find colors
                            try {
                                const dominantColor = colorThief.getColor(img);
                                const palette = colorThief.getPalette(img, 5);
                                
                                dominantColors[artwork.objectID] = {
                                    dominant: dominantColor,
                                    palette: palette
                                };
                            } catch (e) {
                                console.error('ColorThief fallback failed:', e);
                            }
                        }
                        
                        resolve();
                    } else {
                        // Fallback to ColorThief if the image is too small
                        try {
                            const dominantColor = colorThief.getColor(img);
                            const palette = colorThief.getPalette(img, 5);
                            
                            dominantColors[artwork.objectID] = {
                                dominant: dominantColor,
                                palette: palette
                            };
                        } catch (e) {
                            console.error('ColorThief fallback failed:', e);
                        }
                        
                        resolve();
                    }
                } catch (e) {
                    console.error('Error extracting colors:', e);
                    
                    // Fallback to ColorThief
                    try {
                        const dominantColor = colorThief.getColor(img);
                        const palette = colorThief.getPalette(img, 5);
                        
                        dominantColors[artwork.objectID] = {
                            dominant: dominantColor,
                            palette: palette
                        };
                    } catch (fallbackError) {
                        console.error('Fallback color extraction also failed:', fallbackError);
                    }
                    
                    resolve();
                }
            };
            img.onerror = () => {
                console.error('Error loading image for color extraction');
                resolve();
            };
            img.src = artwork.primaryImageSmall;
        });
    });
    
    // Wait for all color extractions to complete
    await Promise.all(colorPromises);
}

// Function to find dominant colors using a simple clustering approach
function findDominantColors(colors, numColors) {
    if (colors.length <= numColors) return colors;
    
    // Start with random colors as centroids
    let centroids = [];
    for (let i = 0; i < numColors; i++) {
        centroids.push(colors[Math.floor(Math.random() * colors.length)]);
    }
    
    // Assign colors to clusters and update centroids
    for (let iteration = 0; iteration < 10; iteration++) {
        // Assign each color to the nearest centroid
        const clusters = Array(numColors).fill().map(() => []);
        
        for (const color of colors) {
            let minDistance = Infinity;
            let closestCentroid = 0;
            
            for (let i = 0; i < centroids.length; i++) {
                const distance = colorDistance(color, centroids[i]);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestCentroid = i;
                }
            }
            
            clusters[closestCentroid].push(color);
        }
        
        // Update centroids
        let changed = false;
        for (let i = 0; i < numColors; i++) {
            if (clusters[i].length === 0) continue;
            
            const newCentroid = calculateCentroid(clusters[i]);
            if (!arraysEqual(newCentroid, centroids[i])) {
                centroids[i] = newCentroid;
                changed = true;
            }
        }
        
        // If centroids didn't change, we've converged
        if (!changed) break;
    }
    
    return centroids;
}

function calculateCentroid(cluster) {
    const sum = [0, 0, 0];
    for (const color of cluster) {
        sum[0] += color[0];
        sum[1] += color[1];
        sum[2] += color[2];
    }
    return [
        Math.round(sum[0] / cluster.length),
        Math.round(sum[1] / cluster.length),
        Math.round(sum[2] / cluster.length)
    ];
}

function arraysEqual(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function updateVisualization() {
    // Clear existing elements
    vizGroup.selectAll('*').remove();
    
    // Create links between artworks with similar colors
    const links = createColorLinks();
    
    // Create force simulation
    simulation = d3.forceSimulation(artworks)
        .force('link', d3.forceLink(links).id(d => d.objectID).distance(100))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(0, 0))
        .force('collision', d3.forceCollide().radius(30));
    
    // Draw links
    const link = vizGroup.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(links)
        .enter().append('line')
        .attr('stroke', d => `rgba(${d.color.join(',')}, 0.5)`)
        .attr('stroke-width', d => Math.sqrt(d.value) * 1.5);
    
    // Draw nodes (artworks)
    const node = vizGroup.append('g')
        .attr('class', 'nodes')
        .selectAll('.node')
        .data(artworks)
        .enter().append('g')
        .attr('class', 'node')
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    
    // Add artwork images to nodes
    node.append('circle')
        .attr('r', d => getNodeSize(d))
        .attr('fill', d => {
            const color = dominantColors[d.objectID]?.dominant;
            return color ? `rgb(${color[0]}, ${color[1]}, ${color[2]})` : '#ccc';
        })
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5);
    
    node.append('image')
        .attr('xlink:href', d => d.primaryImageSmall)
        .attr('x', d => -getNodeSize(d))
        .attr('y', d => -getNodeSize(d))
        .attr('width', d => getNodeSize(d) * 2)
        .attr('height', d => getNodeSize(d) * 2)
        .attr('clip-path', d => `circle(${getNodeSize(d)}px)`)
        .style('cursor', 'pointer')
        .on('mouseover', showTooltip)
        .on('mouseout', hideTooltip)
        .on('click', showArtworkDetail);
    
    // Update simulation
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        node
            .attr('transform', d => `translate(${d.x}, ${d.y})`);
    });
    
    // Add artwork count
    updateArtworkCount();
    
    // Add link count
    updateLinkCount(links.length);
}

function createColorLinks() {
    const links = [];
    const colorThreshold = 60; // Increased threshold to create more connections
    
    // Compare each pair of artworks
    for (let i = 0; i < artworks.length; i++) {
        const artwork1 = artworks[i];
        const colors1 = dominantColors[artwork1.objectID];
        
        if (!colors1) continue;
        
        for (let j = i + 1; j < artworks.length; j++) {
            const artwork2 = artworks[j];
            const colors2 = dominantColors[artwork2.objectID];
            
            if (!colors2) continue;
            
            // Check if any colors in the palettes are similar
            let similarityScore = 0;
            let closestColorPair = null;
            let minDistance = Infinity;
            
            // Compare each color in palette 1 with each color in palette 2
            for (const color1 of colors1.palette) {
                for (const color2 of colors2.palette) {
                    const distance = colorDistance(color1, color2);
                    
                    if (distance < colorThreshold) {
                        similarityScore++;
                    }
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestColorPair = {
                            color1,
                            color2,
                            distance
                        };
                    }
                }
            }
            
            // If there's at least one similar color, create a link
            if (similarityScore > 0 || minDistance < 100) { // Increased threshold
                // Use the average of the closest color pair for the link color
                const avgColor = [
                    Math.floor((closestColorPair.color1[0] + closestColorPair.color2[0]) / 2),
                    Math.floor((closestColorPair.color1[1] + closestColorPair.color2[1]) / 2),
                    Math.floor((closestColorPair.color1[2] + closestColorPair.color2[2]) / 2)
                ];
                
                links.push({
                    source: artwork1.objectID,
                    target: artwork2.objectID,
                    value: similarityScore || 1,
                    color: avgColor
                });
            }
        }
    }
    
    return links;
}

function colorDistance(color1, color2) {
    // Simple Euclidean distance in RGB space
    return Math.sqrt(
        Math.pow(color1[0] - color2[0], 2) +
        Math.pow(color1[1] - color2[1], 2) +
        Math.pow(color1[2] - color2[2], 2)
    );
}

function getNodeSize(artwork) {
    // Base size on whether it's highlighted and/or has a date
    const baseSize = 20;
    
    // If color filters are active, check if this artwork matches
    if (colorFilters.size > 0) {
        const colors = dominantColors[artwork.objectID];
        if (!colors) return baseSize;
        
        // Check if any of the artwork's colors match the filters
        let matches = false;
        for (const filterColor of colorFilters) {
            const [r, g, b] = filterColor.split(',').map(Number);
            
            // Check against dominant color and palette
            if (colorDistance(colors.dominant, [r, g, b]) < 50) {
                matches = true;
                break;
            }
            
            for (const paletteColor of colors.palette) {
                if (colorDistance(paletteColor, [r, g, b]) < 50) {
                    matches = true;
                    break;
                }
            }
            
            if (matches) break;
        }
        
        return matches ? baseSize * 1.3 : baseSize * 0.7;
    }
    
    return baseSize;
}

function updateColorFilters() {
    // Get all unique colors from the artworks
    const uniqueColors = new Set();
    
    // Group similar colors
    const colorGroups = [];
    const groupThreshold = 30;
    
    Object.values(dominantColors).forEach(colors => {
        if (!colors) return;
        
        const dominant = colors.dominant;
        
        // Check if this color is similar to an existing group
        let foundGroup = false;
        for (const group of colorGroups) {
            if (colorDistance(dominant, group.center) < groupThreshold) {
                // Add to existing group and update center
                group.count++;
                group.sum[0] += dominant[0];
                group.sum[1] += dominant[1];
                group.sum[2] += dominant[2];
                group.center = [
                    Math.round(group.sum[0] / group.count),
                    Math.round(group.sum[1] / group.count),
                    Math.round(group.sum[2] / group.count)
                ];
                foundGroup = true;
                break;
            }
        }
        
        // If no similar group, create a new one
        if (!foundGroup) {
            colorGroups.push({
                center: [...dominant],
                sum: [...dominant],
                count: 1
            });
        }
    });
    
    // Sort groups by count (most common colors first)
    colorGroups.sort((a, b) => b.count - a.count);
    
    // Take top 10 color groups
    const topColors = colorGroups.slice(0, 10).map(group => group.center);
    
    // Create color filter buttons
    const colorFiltersContainer = document.querySelector('.color-filters');
    colorFiltersContainer.innerHTML = '';
    
    topColors.forEach(color => {
        const colorKey = color.join(',');
        const filterBtn = document.createElement('div');
        filterBtn.className = 'color-filter';
        filterBtn.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        filterBtn.dataset.color = colorKey;
        
        // Add active class if this color is in the filters
        if (colorFilters.has(colorKey)) {
            filterBtn.classList.add('active');
        }
        
        // Add click handler
        filterBtn.addEventListener('click', () => {
            if (colorFilters.has(colorKey)) {
                colorFilters.delete(colorKey);
                filterBtn.classList.remove('active');
            } else {
                colorFilters.add(colorKey);
                filterBtn.classList.add('active');
            }
            
            // Update visualization to reflect filters
            updateVisualization();
        });
        
        colorFiltersContainer.appendChild(filterBtn);
    });
}

function showTooltip(event, d) {
    const colors = dominantColors[d.objectID];
    const dominantColor = colors ? `rgb(${colors.dominant.join(',')})` : '#ccc';
    
    // Create color swatches for the palette
    let paletteHTML = '';
    if (colors && colors.palette) {
        paletteHTML = '<div style="margin-top: 5px; display: flex;">';
        colors.palette.forEach(color => {
            paletteHTML += `<div style="background-color: rgb(${color.join(',')}); width: 12px; height: 12px; margin-right: 3px;"></div>`;
        });
        paletteHTML += '</div>';
    }
    
    tooltip.transition()
        .duration(200)
        .style('opacity', .9);
    
    tooltip.html(`
        <strong>${d.title}</strong><br/>
        ${d.objectDate || 'Date unknown'}<br/>
        ${d.artistDisplayName || 'Artist unknown'}<br/>
        ${d.classification || d.objectName || ''}<br/>
        ${paletteHTML}
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
    const detailInfo = detailDiv.querySelector('.color-palette-info');
    
    // Get color palette
    const colors = dominantColors[d.objectID];
    let paletteHTML = '';
    
    if (colors && colors.palette) {
        paletteHTML = '<div class="color-palette-swatches">';
        colors.palette.forEach(color => {
            paletteHTML += `<div class="color-palette-swatch" style="background-color: rgb(${color.join(',')});"></div>`;
        });
        paletteHTML += '</div>';
    }
    
    detailInfo.innerHTML = `
        <img src="${d.primaryImage}" alt="${d.title}">
        <div class="color-palette-metadata">
            <h2>${d.title}</h2>
            <p><strong>Date:</strong> ${d.objectDate || 'Unknown'}</p>
            <p><strong>Artist:</strong> ${d.artistDisplayName || 'Unknown'}</p>
            <p><strong>Culture:</strong> ${d.culture || 'Unknown'}</p>
            <p><strong>Medium:</strong> ${d.medium}</p>
            <p><strong>Dimensions:</strong> ${d.dimensions}</p>
            <p><strong>Credit:</strong> ${d.creditLine}</p>
            ${paletteHTML}
            ${d.objectURL ? `<p><a href="${d.objectURL}" target="_blank">View on Met Museum website</a></p>` : ''}
        </div>
    `;
    
    detailDiv.style.display = 'block';
}

function updateArtworkCount() {
    // Create or update the artwork count element
    let countElement = document.querySelector('.artwork-count');
    
    if (!countElement) {
        countElement = document.createElement('div');
        countElement.className = 'artwork-count';
        countElement.style.position = 'fixed';
        countElement.style.bottom = '80px'; // Position above the link count
        countElement.style.left = '50%';
        countElement.style.transform = 'translateX(-50%)';
        countElement.style.fontSize = '0.8em';
        countElement.style.color = '#333';
        countElement.style.backgroundColor = 'rgba(250, 250, 250, 0.9)';
        countElement.style.padding = '8px 15px';
        countElement.style.border = '1px solid #eee';
        countElement.style.zIndex = '10';
        document.body.appendChild(countElement);
    }
    
    countElement.textContent = `Showing ${artworks.length} paintings`;
}

function updateLinkCount(linkCount) {
    // Create or update the link count element
    let linkCountElement = document.querySelector('.link-count');
    
    if (!linkCountElement) {
        linkCountElement = document.createElement('div');
        linkCountElement.className = 'link-count';
        linkCountElement.style.position = 'fixed';
        linkCountElement.style.bottom = '40px';
        linkCountElement.style.left = '50%';
        linkCountElement.style.transform = 'translateX(-50%)';
        linkCountElement.style.fontSize = '0.8em';
        linkCountElement.style.color = '#333';
        linkCountElement.style.backgroundColor = 'rgba(250, 250, 250, 0.9)';
        linkCountElement.style.padding = '8px 15px';
        linkCountElement.style.border = '1px solid #eee';
        linkCountElement.style.zIndex = '10';
        document.body.appendChild(linkCountElement);
    }
    
    linkCountElement.textContent = `${linkCount} color connections found`;
}

function showLoading(show) {
    let loadingElement = document.querySelector('.simple-loading');
    
    if (!loadingElement && show) {
        loadingElement = document.createElement('div');
        loadingElement.className = 'simple-loading';
        loadingElement.textContent = 'Loading paintings...';
        document.getElementById('visualization').appendChild(loadingElement);
    } else if (loadingElement && !show) {
        loadingElement.remove();
    }
}

// Drag functions for nodes
function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}

// Update event listener for close button
document.querySelector('.color-palette-close').addEventListener('click', () => {
    document.getElementById('artwork-detail').style.display = 'none';
});

// Helper function to determine if an artwork is valid for visualization
function isValidArtwork(artwork, topic, relaxedCriteria = false) {
    if (!artwork || !artwork.primaryImageSmall) return false;
    
    // Check if it's a 2D artwork (painting, drawing, print, etc.)
    const is2DArtwork = 
        // Check classification
        (artwork.classification && (
            artwork.classification.toLowerCase().includes('painting') ||
            artwork.classification.toLowerCase().includes('drawing') ||
            artwork.classification.toLowerCase().includes('print') ||
            artwork.classification.toLowerCase().includes('photograph') ||
            artwork.classification.toLowerCase().includes('poster')
        )) ||
        // Check object name
        (artwork.objectName && (
            artwork.objectName.toLowerCase().includes('painting') ||
            artwork.objectName.toLowerCase().includes('canvas') ||
            artwork.objectName.toLowerCase().includes('drawing') ||
            artwork.objectName.toLowerCase().includes('print') ||
            artwork.objectName.toLowerCase().includes('photograph') ||
            artwork.objectName.toLowerCase().includes('picture')
        )) ||
        // Check medium
        (artwork.medium && (
            artwork.medium.toLowerCase().includes('oil') ||
            artwork.medium.toLowerCase().includes('acrylic') ||
            artwork.medium.toLowerCase().includes('tempera') ||
            artwork.medium.toLowerCase().includes('canvas') ||
            artwork.medium.toLowerCase().includes('watercolor') ||
            artwork.medium.toLowerCase().includes('gouache') ||
            artwork.medium.toLowerCase().includes('paper') ||
            artwork.medium.toLowerCase().includes('ink') ||
            artwork.medium.toLowerCase().includes('color')
        ));
    
    // For relaxed criteria, we'll accept any artwork with an image
    if (relaxedCriteria) {
        return true;
    }
    
    // Check if it matches the topic (only if not using relaxed criteria)
    const matchesTopic = 
        (artwork.title && artwork.title.toLowerCase().includes(topic.query.toLowerCase())) ||
        (artwork.tags && artwork.tags.some(tag => 
            tag.term.toLowerCase().includes(topic.query.toLowerCase())
        )) ||
        (artwork.artistDisplayName && artwork.artistDisplayName.toLowerCase().includes(topic.query.toLowerCase())) ||
        (artwork.culture && artwork.culture.toLowerCase().includes(topic.query.toLowerCase())) ||
        (artwork.period && artwork.period.toLowerCase().includes(topic.query.toLowerCase())) ||
        (artwork.dynasty && artwork.dynasty.toLowerCase().includes(topic.query.toLowerCase())) ||
        (artwork.reign && artwork.reign.toLowerCase().includes(topic.query.toLowerCase())) ||
        (artwork.artistDisplayBio && artwork.artistDisplayBio.toLowerCase().includes(topic.query.toLowerCase()));
    
    // We'll accept 2D artworks that match the topic, or any 2D artwork with 50% probability
    return is2DArtwork && (matchesTopic || Math.random() < 0.5);
}

// Initialize the visualization
initialize(); 