# Met Museum Geographic Visualization

This visualization displays the geographic distribution of artworks from the Metropolitan Museum of Art collection.

## How It Works

Instead of making API calls directly from the browser (which would be slow and inefficient), this visualization uses pre-calculated data:

1. A Node.js script (`data_processor.js`) fetches data from the Met Museum API and processes it
2. The processed data is saved to a JSON file (`data.json`)
3. The visualization loads this pre-calculated data, making it much faster and more responsive

## Running the Data Processor

To generate or update the data:

1. Make sure you have Node.js installed
2. Navigate to the `geography` directory
3. Run the processor script:

```bash
node process_data.js
```

This will:
- Fetch data from the Met Museum API for multiple departments
- Process the data to extract country information
- Group artworks by country and calculate statistics
- Save the results to `data.json`

**Note:** The data processing can take several minutes to complete as it needs to make many API requests.

## Viewing the Visualization

Once the data is processed, you can view the visualization by:

1. Opening the `index.html` file in a web browser
2. Or accessing it through your local web server at `/geography/index.html`

## Features

- Interactive world map showing the distribution of Met Museum artworks by country
- Bubble size represents the number of artworks from each country
- Color represents the predominant department for each country
- Filter by time period (Ancient, Medieval, Renaissance, Modern)
- Click on a country to see detailed information:
  - Department distribution (pie chart)
  - Time period distribution (bar chart)
  - Sample artworks from that country

## Technical Details

- Uses D3.js for data visualization
- TopoJSON for the world map
- Pre-calculated data to improve performance
- Responsive design that works on different screen sizes

## Data Processing Logic

The data processor:

1. Fetches object IDs for selected departments
2. Takes a random sample of artworks from each department
3. Extracts country information from various fields (culture, country, artistNationality)
4. Standardizes country names for consistent mapping
5. Groups artworks by country and calculates statistics
6. Saves a small sample of artworks for each country for display purposes 