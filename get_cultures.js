// Script to fetch the number of cultures in each department of the Met Museum
import fetch from 'node-fetch';

const MET_API_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';

// List of departments to check
const departments = [
  { id: 1, name: "American Decorative Arts" },
  { id: 3, name: "Ancient Near Eastern Art" },
  { id: 4, name: "Arms and Armor" },
  { id: 5, name: "Arts of Africa, Oceania, and the Americas" },
  { id: 6, name: "Asian Art" },
  { id: 7, name: "The Cloisters" },
  { id: 8, name: "The Costume Institute" },
  { id: 9, name: "Drawings and Prints" },
  { id: 10, name: "Egyptian Art" },
  { id: 11, name: "European Paintings" },
  { id: 12, name: "European Sculpture and Decorative Arts" },
  { id: 13, name: "Greek and Roman Art" },
  { id: 14, name: "Islamic Art" },
  { id: 15, name: "The Robert Lehman Collection" },
  { id: 16, name: "The Libraries" },
  { id: 17, name: "Medieval Art" },
  { id: 18, name: "Musical Instruments" },
  { id: 19, name: "Photographs" },
  { id: 21, name: "Modern Art" }
];

// Function to get a sample of objects from a department
async function getSampleObjects(departmentId, sampleSize = 100) {
  try {
    // Get all object IDs for the department
    const response = await fetch(`${MET_API_BASE}/search?departmentId=${departmentId}&hasImages=true&q=*`);
    const data = await response.json();
    
    if (!data.objectIDs || data.objectIDs.length === 0) {
      return [];
    }
    
    // Take a random sample
    const randomIds = data.objectIDs.sort(() => 0.5 - Math.random()).slice(0, sampleSize);
    
    // Fetch details for each object
    const objectDetails = await Promise.all(
      randomIds.map(async id => {
        try {
          const objResponse = await fetch(`${MET_API_BASE}/objects/${id}`);
          return await objResponse.json();
        } catch (error) {
          console.error(`Error fetching object ${id}:`, error);
          return null;
        }
      })
    );
    
    return objectDetails.filter(item => item !== null);
  } catch (error) {
    console.error(`Error fetching objects for department ${departmentId}:`, error);
    return [];
  }
}

// Function to count unique cultures in a department
async function countCultures(departmentId, departmentName) {
  const objects = await getSampleObjects(departmentId);
  const cultures = new Set(objects.map(obj => obj.culture || 'Unknown').filter(culture => culture !== ''));
  
  console.log(`Department: ${departmentName} (ID: ${departmentId})`);
  console.log(`Total objects sampled: ${objects.length}`);
  console.log(`Number of unique cultures: ${cultures.size}`);
  console.log(`Cultures: ${Array.from(cultures).join(', ')}`);
  console.log('-----------------------------------');
  
  return {
    departmentId,
    departmentName,
    objectCount: objects.length,
    cultureCount: cultures.size,
    cultures: Array.from(cultures)
  };
}

// Main function to process all departments
async function processDepartments() {
  console.log('Analyzing cultures in Met Museum departments...\n');
  
  const results = [];
  for (const dept of departments) {
    const result = await countCultures(dept.id, dept.name);
    results.push(result);
  }
  
  // Sort by number of cultures (descending)
  results.sort((a, b) => b.cultureCount - a.cultureCount);
  
  console.log('\nSUMMARY (sorted by number of cultures):');
  console.log('-----------------------------------');
  results.forEach(dept => {
    console.log(`${dept.departmentName}: ${dept.cultureCount} cultures (from ${dept.objectCount} sampled objects)`);
  });
}

processDepartments().catch(error => console.error('Error:', error)); 