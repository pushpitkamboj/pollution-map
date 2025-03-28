const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Enable CORS
app.use(cors());

// Parse JSON body with increased limit for map exports
app.use(bodyParser.json({ limit: '50mb' }));

// Disable caching
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Serve static files from the project directory
app.use(express.static(path.join(__dirname)));

// Serve the 'js' directory explicitly
app.use('/js', express.static(path.join(__dirname, 'js')));

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
  console.log('Created data directory');
}

// Bookmarks file path
const bookmarksPath = path.join(dataDir, 'bookmarks.json');

// Helper functions for bookmark file operations
const bookmarkFileOps = {
  // Read all bookmarks from file
  read: () => {
    try {
      if (fs.existsSync(bookmarksPath)) {
        const data = fs.readFileSync(bookmarksPath, 'utf8');
        return JSON.parse(data || '[]');
      }
      return [];
    } catch (error) {
      console.error('Error reading bookmarks file:', error);
      return [];
    }
  },
  
  // Write bookmarks to file
  write: (bookmarks) => {
    try {
      fs.writeFileSync(bookmarksPath, JSON.stringify(bookmarks, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('Error writing bookmarks file:', error);
      return false;
    }
  },
  
  // Calculate distance between two coordinates (Haversine formula)
  calculateDistance: (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon1 - lon2);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; // Distance in km
    return d;
  }
};

// Convert degrees to radians
function deg2rad(deg) {
  return deg * (Math.PI/180);
}

// Bookmark API endpoints
// Get all bookmarks
app.get('/api/bookmarks', (req, res) => {
  try {
    const bookmarks = bookmarkFileOps.read();
    res.json(bookmarks);
  } catch (error) {
    console.error('Error getting bookmarks:', error);
    res.status(500).json({ error: 'Failed to get bookmarks' });
  }
});

// Add a new bookmark
app.post('/api/bookmarks', (req, res) => {
  try {
    const newBookmark = req.body;
    const bookmarks = bookmarkFileOps.read();
    
    // Add the bookmark
    bookmarks.push(newBookmark);
    
    // Save to file
    if (bookmarkFileOps.write(bookmarks)) {
      res.status(201).json(newBookmark);
    } else {
      res.status(500).json({ error: 'Failed to save bookmark' });
    }
  } catch (error) {
    console.error('Error adding bookmark:', error);
    res.status(500).json({ error: 'Failed to add bookmark' });
  }
});

// Update a bookmark
app.put('/api/bookmarks/:id', (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    const bookmarks = bookmarkFileOps.read();
    
    // Find and update the bookmark
    const index = bookmarks.findIndex(b => b.id === id);
    if (index !== -1) {
      bookmarks[index] = updates;
      
      // Save to file
      if (bookmarkFileOps.write(bookmarks)) {
        res.json(updates);
      } else {
        res.status(500).json({ error: 'Failed to update bookmark' });
      }
    } else {
      res.status(404).json({ error: 'Bookmark not found' });
    }
  } catch (error) {
    console.error('Error updating bookmark:', error);
    res.status(500).json({ error: 'Failed to update bookmark' });
  }
});

// Delete a bookmark
app.delete('/api/bookmarks/:id', (req, res) => {
  try {
    const id = req.params.id;
    const bookmarks = bookmarkFileOps.read();
    
    // Filter out the bookmark to be deleted
    const filteredBookmarks = bookmarks.filter(b => b.id !== id);
    
    if (filteredBookmarks.length < bookmarks.length) {
      // Save to file
      if (bookmarkFileOps.write(filteredBookmarks)) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Failed to delete bookmark' });
      }
    } else {
      res.status(404).json({ error: 'Bookmark not found' });
    }
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    res.status(500).json({ error: 'Failed to delete bookmark' });
  }
});

// Delete all bookmarks
app.delete('/api/bookmarks', (req, res) => {
  try {
    // Write an empty array to file
    if (bookmarkFileOps.write([])) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to clear bookmarks' });
    }
  } catch (error) {
    console.error('Error clearing bookmarks:', error);
    res.status(500).json({ error: 'Failed to clear bookmarks' });
  }
});

// Sync bookmarks (replace all)
app.post('/api/bookmarks/sync', (req, res) => {
  try {
    const bookmarks = req.body;
    
    // Save to file
    if (bookmarkFileOps.write(bookmarks)) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to sync bookmarks' });
    }
  } catch (error) {
    console.error('Error syncing bookmarks:', error);
    res.status(500).json({ error: 'Failed to sync bookmarks' });
  }
});

// Search bookmarks by coordinates
app.get('/api/bookmarks/search', (req, res) => {
  try {
    const { lat, lng, radius = 0.5 } = req.query;
    
    // Validate parameters
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusKm = parseFloat(radius);
    
    if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusKm)) {
      return res.status(400).json({ error: 'Invalid coordinates or radius' });
    }
    
    // Get all bookmarks and filter by distance
    const bookmarks = bookmarkFileOps.read();
    const results = bookmarks.filter(bookmark => {
      if (!bookmark.position || !bookmark.position.lat || !bookmark.position.lng) {
        return false;
      }
      
      // Calculate distance between points
      const distance = bookmarkFileOps.calculateDistance(
        latitude, longitude, 
        bookmark.position.lat, bookmark.position.lng
      );
      
      return distance <= radiusKm;
    });
    
    res.json(results);
  } catch (error) {
    console.error('Error searching bookmarks:', error);
    res.status(500).json({ error: 'Failed to search bookmarks' });
  }
});

// Air quality API endpoint
app.get('/api/air-quality', async (req, res) => {
  try {
    // Get query parameters from request
    const { latitude, longitude } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    // Construct URL with properly formatted parameters
    const url = 'https://air-quality-api.open-meteo.com/v1/air-quality';
    
    // Important: Convert hourly/current arrays to comma-separated strings as expected by the API
    const requestParams = {
      latitude,
      longitude,
      hourly: 'pm10,pm2_5',  // String format required by OpenMeteo REST API
      current: 'pm10,pm2_5',  // String format required by OpenMeteo REST API
      timezone: 'auto',
      timeformat: 'iso8601'
    };
    
    console.log('Requesting air quality data with params:', requestParams);
    
    // Make request to OpenMeteo API
    const response = await axios.get(url, { params: requestParams });
    
    console.log('Received air quality response status:', response.status);
    
    // Return data to client
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching air quality data:', error.message);
    if (error.response) {
      console.error('API response error data:', error.response.data);
    }
    res.status(500).json({ 
      error: 'Failed to fetch air quality data', 
      details: error.message 
    });
  }
});

// New endpoint for PDF export
app.post('/export-pdf', async (req, res) => {
  try {
    const { imageData, width, height } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ error: 'Image data is required' });
    }
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    
    // Generate unique filename
    const filename = `map_export_${Date.now()}.pdf`;
    const pdfPath = path.join(tempDir, filename);
    
    // Launch puppeteer to create PDF
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Set viewport to match the map size
    await page.setViewport({
      width: width || 1200,
      height: height || 800,
    });
    
    // Create HTML with the image
    await page.setContent(`
      <html>
        <body style="margin: 0; padding: 0;">
          <img src="${imageData}" style="width: 100%; height: auto;" />
        </body>
      </html>
    `);
    
    // Generate PDF
    await page.pdf({
      path: pdfPath,
      printBackground: true,
      format: 'A4',
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      }
    });
    
    await browser.close();
    
    // Send PDF file
    res.download(pdfPath, filename, (err) => {
      if (err) {
        console.error('Error sending PDF:', err);
        // Clean up file if error occurs
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
        }
      } else {
        // Clean up file after sending
        setTimeout(() => {
          if (fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath);
          }
        }, 5000);
      }
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
  }
});

// Default route to serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});