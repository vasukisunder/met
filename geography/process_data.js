// Simple script to run the data processor
import { exec } from 'child_process';

console.log('Starting the Met Museum data processor...');
console.log('This will fetch and process data from the Met Museum API.');
console.log('The process may take several minutes to complete.');
console.log('-----------------------------------------------------');

// Run the data processor
exec('node data_processor.js', { cwd: process.cwd() }, (error, stdout, stderr) => {
    if (error) {
        console.error(`Error: ${error.message}`);
        return;
    }
    
    if (stderr) {
        console.error(`stderr: ${stderr}`);
    }
    
    console.log(stdout);
    console.log('-----------------------------------------------------');
    console.log('Data processing complete!');
    console.log('You can now open the visualization in your browser.');
}); 