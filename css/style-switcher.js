// Style Switcher Script
document.addEventListener('DOMContentLoaded', function() {
    // Create style switcher container
    const switcher = document.createElement('div');
    switcher.className = 'style-switcher';
    switcher.innerHTML = `
        <div class="style-switcher-toggle">Styles</div>
        <div class="style-options">
            <button data-style="swiss">Swiss Style</button>
            <button data-style="brutalist">Brutalist</button>
            <button data-style="japanese">Japanese Minimalism</button>
            <button data-style="neo-modernist">Neo-Modernist</button>
            <button data-style="main">Original</button>
        </div>
    `;
    document.body.appendChild(switcher);
    
    // Add styles for the switcher
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .style-switcher {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
            font-family: sans-serif;
            font-size: 12px;
        }
        
        .style-switcher-toggle {
            background: #333;
            color: white;
            padding: 8px 12px;
            cursor: pointer;
            border-radius: 4px;
            text-align: center;
        }
        
        .style-options {
            display: none;
            background: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 10px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        .style-options.active {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .style-options button {
            background: #f5f5f5;
            border: 1px solid #ddd;
            padding: 5px 10px;
            cursor: pointer;
            text-align: left;
        }
        
        .style-options button:hover {
            background: #eee;
        }
    `;
    document.head.appendChild(styleElement);
    
    // Toggle style options
    const toggleButton = switcher.querySelector('.style-switcher-toggle');
    const optionsPanel = switcher.querySelector('.style-options');
    
    toggleButton.addEventListener('click', function() {
        optionsPanel.classList.toggle('active');
    });
    
    // Handle style switching
    const styleButtons = switcher.querySelectorAll('.style-options button');
    styleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const styleName = this.getAttribute('data-style');
            const linkElement = document.querySelector('link[rel="stylesheet"]');
            linkElement.href = `css/${styleName}.css`;
            
            // Close the panel after selection
            optionsPanel.classList.remove('active');
        });
    });
}); 