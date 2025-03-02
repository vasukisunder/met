// Met Museum API endpoints
import fs from 'fs';
import https from 'https';

const MET_API_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';

// Initialize variables
let artworksByCountry = {};
let processedCount = 0;
let totalToProcess = 0;

// Departments to process
const departments = [
    { id: 3, name: 'American Decorative Arts' },
    { id: 4, name: 'Ancient Near Eastern Art' },
    { id: 5, name: 'Arms and Armor' },
    { id: 6, name: 'Asian Art' },
    { id: 10, name: 'Egyptian Art' },
    { id: 11, name: 'European Paintings' },
    { id: 12, name: 'European Sculpture and Decorative Arts' },
    { id: 13, name: 'Greek and Roman Art' },
    { id: 14, name: 'Islamic Art' }
];

// Main function to process all departments
async function processAllDepartments() {
    console.log('Starting data processing...');
    
    for (const dept of departments) {
        console.log(`Processing department: ${dept.name}`);
        await processDepartment(dept);
    }
    
    // Save the final results
    saveResults();
    console.log('Data processing complete!');
}

// Process a single department
async function processDepartment(dept) {
    try {
        // Fetch artworks for this department
        const objectIDs = await fetchObjectIDs(dept.id);
        
        if (!objectIDs || objectIDs.length === 0) {
            console.log(`No objects found for ${dept.name}`);
            return;
        }
        
        console.log(`Found ${objectIDs.length} objects for ${dept.name}`);
        
        // Take a larger sample for better representation
        const sampleSize = Math.min(500, objectIDs.length);
        const randomSample = getRandomSample(objectIDs, sampleSize);
        
        totalToProcess += randomSample.length;
        console.log(`Processing ${randomSample.length} sample objects...`);
        
        // Process in batches to avoid overwhelming the API
        const batchSize = 20;
        for (let i = 0; i < randomSample.length; i += batchSize) {
            const batch = randomSample.slice(i, i + batchSize);
            await Promise.all(batch.map(id => processArtwork(id, dept.name)));
            console.log(`Processed ${Math.min(i + batchSize, randomSample.length)} of ${randomSample.length} for ${dept.name}`);
        }
    } catch (error) {
        console.error(`Error processing department ${dept.name}:`, error);
    }
}

// Fetch object IDs for a department
function fetchObjectIDs(departmentId) {
    return new Promise((resolve, reject) => {
        const url = `${MET_API_BASE}/search?departmentId=${departmentId}&hasImages=true&q=*`;
        
        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    resolve(parsedData.objectIDs || []);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

// Process a single artwork
function processArtwork(id, department) {
    return new Promise((resolve, reject) => {
        const url = `${MET_API_BASE}/objects/${id}`;
        
        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const artwork = JSON.parse(data);
                    
                    // Extract country information
                    let country = extractCountry(artwork);
                    
                    if (country) {
                        // Initialize country entry if it doesn't exist
                        if (!artworksByCountry[country]) {
                            artworksByCountry[country] = {
                                count: 0,
                                departments: {},
                                timePeriods: {
                                    ancient: 0,
                                    medieval: 0,
                                    renaissance: 0,
                                    modern: 0
                                },
                                // Store a small sample of artwork IDs for reference
                                sampleArtworkIds: []
                            };
                        }
                        
                        // Increment country count
                        artworksByCountry[country].count++;
                        
                        // Increment department count
                        if (!artworksByCountry[country].departments[department]) {
                            artworksByCountry[country].departments[department] = 0;
                        }
                        artworksByCountry[country].departments[department]++;
                        
                        // Determine time period
                        const year = extractYear(artwork.objectDate);
                        let timePeriod = 'unknown';
                        
                        if (year !== null) {
                            if (year < 500) timePeriod = 'ancient';
                            else if (year < 1400) timePeriod = 'medieval';
                            else if (year < 1600) timePeriod = 'renaissance';
                            else timePeriod = 'modern';
                            
                            // Increment time period count
                            if (artworksByCountry[country].timePeriods[timePeriod] !== undefined) {
                                artworksByCountry[country].timePeriods[timePeriod]++;
                            }
                        }
                        
                        // Store a sample of artwork IDs (up to 10 per country)
                        if (artworksByCountry[country].sampleArtworkIds.length < 10) {
                            artworksByCountry[country].sampleArtworkIds.push({
                                id: artwork.objectID,
                                title: artwork.title,
                                date: artwork.objectDate,
                                image: artwork.primaryImageSmall,
                                department: department,
                                timePeriod: timePeriod
                            });
                        }
                    }
                    
                    processedCount++;
                    if (processedCount % 100 === 0) {
                        console.log(`Processed ${processedCount} of ${totalToProcess} total artworks`);
                    }
                    
                    resolve();
                } catch (e) {
                    console.error(`Error processing artwork ${id}:`, e);
                    resolve(); // Resolve anyway to continue processing
                }
            });
        }).on('error', (err) => {
            console.error(`Error fetching artwork ${id}:`, err);
            resolve(); // Resolve anyway to continue processing
        });
    });
}

// Extract country information from artwork data
function extractCountry(artwork) {
    // Try different fields that might contain country information
    const possibleFields = [
        artwork.culture,
        artwork.country,
        artwork.artistNationality,
        artwork.geographyType
    ];
    
    // Common country names and their standardized forms
    const countryMappings = {
        'american': 'United States',
        'united states': 'United States',
        'usa': 'United States',
        'u.s.a.': 'United States',
        'british': 'United Kingdom',
        'england': 'United Kingdom',
        'scotland': 'United Kingdom',
        'wales': 'United Kingdom',
        'uk': 'United Kingdom',
        'french': 'France',
        'german': 'Germany',
        'italian': 'Italy',
        'spanish': 'Spain',
        'dutch': 'Netherlands',
        'the netherlands': 'Netherlands',
        'holland': 'Netherlands',
        'japanese': 'Japan',
        'chinese': 'China',
        'greek': 'Greece',
        'roman': 'Italy',
        'egyptian': 'Egypt',
        'russian': 'Russia',
        'indian': 'India',
        'persian': 'Iran',
        'iran': 'Iran',
        'turkish': 'Turkey',
        'mexican': 'Mexico',
        'canadian': 'Canada',
        'australian': 'Australia',
        'korean': 'South Korea',
        'south korean': 'South Korea',
        'swiss': 'Switzerland',
        'swedish': 'Sweden',
        'norwegian': 'Norway',
        'danish': 'Denmark',
        'finnish': 'Finland',
        'belgian': 'Belgium',
        'austrian': 'Austria',
        'portuguese': 'Portugal',
        'irish': 'Ireland',
        'scottish': 'United Kingdom',
        'welsh': 'United Kingdom',
        'english': 'United Kingdom'
    };
    
    // Check each field for country information
    for (const field of possibleFields) {
        if (field) {
            const lowerField = field.toLowerCase();
            
            // Check if the field directly matches a country name
            for (const [key, value] of Object.entries(countryMappings)) {
                if (lowerField.includes(key)) {
                    return value;
                }
            }
        }
    }
    
    return null;
}

// Extract year from date string
function extractYear(dateString) {
    if (!dateString) return null;
    
    // Extract the first number from the date string
    const match = dateString.match(/\d+/);
    return match ? parseInt(match[0]) : null;
}

// Helper function to get a random sample of items from an array
function getRandomSample(array, size) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, size);
}

// Save the results to a JSON file
function saveResults() {
    // Add metadata
    const result = {
        metadata: {
            totalCountries: Object.keys(artworksByCountry).length,
            totalArtworks: Object.values(artworksByCountry).reduce((sum, country) => sum + country.count, 0),
            departments: departments.map(d => d.name),
            generatedAt: new Date().toISOString()
        },
        countries: artworksByCountry
    };
    
    // Write to file
    fs.writeFileSync('data.json', JSON.stringify(result, null, 2));
    console.log(`Results saved to data.json with data for ${Object.keys(artworksByCountry).length} countries`);
}

// Start processing
processAllDepartments(); 