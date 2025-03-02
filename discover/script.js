// Constants
const MET_API_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';

// DOM Elements
let searchInput;
let searchButton;
let loadingIndicator;
let artworkContainer;
let noResultsContainer;
let artworkImage;
let artworkTitle;
let artworkArtist;
let artworkDate;
let artworkMedium;
let artworkDepartment;
let artworkLink;
let newSearchButton;
let tryAgainButton;

// Initialize the page
function initialize() {
    // Initialize DOM elements after the document is loaded
    searchInput = document.getElementById('searchInput');
    searchButton = document.getElementById('searchButton');
    loadingIndicator = document.getElementById('loading');
    artworkContainer = document.getElementById('artwork-container');
    noResultsContainer = document.getElementById('no-results');
    artworkImage = document.getElementById('artwork-image');
    artworkTitle = document.getElementById('artwork-title');
    artworkArtist = document.getElementById('artwork-artist');
    artworkDate = document.getElementById('artwork-date');
    artworkMedium = document.getElementById('artwork-medium');
    artworkDepartment = document.getElementById('artwork-department');
    artworkLink = document.getElementById('artwork-link');
    newSearchButton = document.getElementById('newSearchButton');
    tryAgainButton = document.getElementById('tryAgainButton');
    
    // Add event listeners
    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    newSearchButton.addEventListener('click', resetSearch);
    tryAgainButton.addEventListener('click', resetSearch);
    
    // Hide loading indicator initially
    loadingIndicator.classList.add('hidden');
    
    console.log('Art Discovery page initialized');
}

// Handle search
async function handleSearch() {
    const searchTerm = searchInput.value.trim();
    if (!searchTerm) {
        alert('Please enter a search term');
        return;
    }
    
    console.log('Searching for:', searchTerm);
    
    // Show loading indicator
    showLoading(true);
    artworkContainer.classList.add('hidden');
    noResultsContainer.classList.add('hidden');
    
    try {
        // First try with exact search term
        let objectIDs = await searchCollection(searchTerm);
        
        // If no results, try with more relaxed parameters
        if (!objectIDs || objectIDs.length === 0) {
            console.log('No exact matches, trying with broader search...');
            
            // Try searching with individual words if the search term has multiple words
            const words = searchTerm.split(' ').filter(word => word.length > 2);
            if (words.length > 1) {
                for (const word of words) {
                    const results = await searchCollection(word);
                    if (results && results.length > 0) {
                        console.log(`Found results for individual word: ${word}`);
                        objectIDs = results;
                        break;
                    }
                }
            }
        }
        
        // If still no results, show no results message
        if (!objectIDs || objectIDs.length === 0) {
            console.log('No results found after multiple attempts');
            showNoResults();
            return;
        }
        
        console.log(`Found ${objectIDs.length} artworks for search: ${searchTerm}`);
        
        // Get a random artwork from the results
        const randomId = objectIDs[Math.floor(Math.random() * objectIDs.length)];
        
        // Show the artwork
        await showArtwork(randomId);
        
    } catch (error) {
        console.error('Error fetching artworks:', error);
        showLoading(false);
        alert(`Error loading artworks: ${error.message}. Please try again.`);
    }
}

// Search the collection with given parameters
async function searchCollection(term) {
    // Search for artworks matching the term
    const searchParams = new URLSearchParams({
        hasImages: true,
        q: term
    });
    
    try {
        const response = await fetch(`${MET_API_BASE}/search?${searchParams.toString()}`);
        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        return data.objectIDs || [];
    } catch (error) {
        console.error('Error in searchCollection:', error);
        return [];
    }
}

// Show a specific artwork by ID
async function showArtwork(artworkId) {
    try {
        // Fetch details for the artwork
        const objResponse = await fetch(`${MET_API_BASE}/objects/${artworkId}`);
        if (!objResponse.ok) {
            throw new Error(`API responded with status: ${objResponse.status}`);
        }
        
        const artwork = await objResponse.json();
        
        if (!artwork || !artwork.primaryImage) {
            console.log('Artwork has no image, trying another one');
            
            // Try to get another artwork from the same search
            const searchTerm = searchInput.value.trim();
            const objectIDs = await searchCollection(searchTerm);
            
            if (objectIDs && objectIDs.length > 0) {
                // Filter out the current artwork ID
                const filteredIDs = objectIDs.filter(id => id !== artworkId);
                if (filteredIDs.length > 0) {
                    const newRandomId = filteredIDs[Math.floor(Math.random() * filteredIDs.length)];
                    return showArtwork(newRandomId);
                }
            }
            
            showNoResults();
            return;
        }
        
        console.log('Displaying artwork:', artwork.title);
        
        // Display the artwork
        displayArtwork(artwork);
        
    } catch (error) {
        console.error('Error fetching artwork details:', error);
        showLoading(false);
        throw error;
    }
}

// Display artwork
function displayArtwork(artwork) {
    // Set artwork details
    artworkImage.crossOrigin = "Anonymous";
    artworkImage.src = artwork.primaryImage;
    artworkTitle.textContent = artwork.title;
    artworkArtist.textContent = artwork.artistDisplayName || 'Unknown Artist';
    artworkDate.textContent = artwork.objectDate || 'Date unknown';
    artworkMedium.textContent = artwork.medium || 'Medium unknown';
    artworkDepartment.textContent = artwork.department || '';
    
    // Set link to Met Museum page
    if (artwork.objectURL) {
        artworkLink.href = artwork.objectURL;
        artworkLink.classList.remove('hidden');
    } else {
        artworkLink.classList.add('hidden');
    }
    
    // Create a fallback timeout in case the image load event doesn't fire
    const loadTimeout = setTimeout(() => {
        console.log('Image load timeout triggered');
        artworkContainer.classList.remove('hidden');
        showLoading(false);
    }, 5000); // 5 second timeout
    
    // When image loads
    artworkImage.onload = function() {
        clearTimeout(loadTimeout); // Clear the fallback timeout
        console.log('Image loaded successfully');
        
        // Show artwork container
        artworkContainer.classList.remove('hidden');
        showLoading(false);
    };
    
    // Handle image loading error
    artworkImage.onerror = function() {
        clearTimeout(loadTimeout); // Clear the fallback timeout
        console.error('Error loading image');
        
        // Try to use small image if primary image fails
        if (artwork.primaryImageSmall) {
            artworkImage.src = artwork.primaryImageSmall;
        } else {
            // Show artwork info without image
            artworkContainer.classList.remove('hidden');
            showLoading(false);
        }
    };
}

// Reset search
function resetSearch() {
    searchInput.value = '';
    artworkContainer.classList.add('hidden');
    noResultsContainer.classList.add('hidden');
}

// Show no results message
function showNoResults() {
    noResultsContainer.classList.remove('hidden');
    artworkContainer.classList.add('hidden');
    showLoading(false);
}

// Show/hide loading indicator
function showLoading(show) {
    if (show) {
        loadingIndicator.classList.remove('hidden');
    } else {
        loadingIndicator.classList.add('hidden');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded');
    initialize();
}); 