---
title: Pollution Map
---
#Live link
http://13.60.27.96
you can access the map from it

# Pollution Map

An interactive web application that provides real-time air pollution data across different geographical locations. The project uses modern web technologies to deliver an intuitive, feature-rich map experience that allows users to monitor air quality metrics, bookmark locations of interest, and share or export map data.

## Key Features

### Interactive Map Interface
- Built on the Leaflet.js mapping library for a responsive, interactive experience
- Supports panning, zooming, and custom marker placement
- Clean, user-friendly interface with intuitive controls

### Air Quality Monitoring
- Real-time air pollution data visualization using the OpenMeteo API
- Displays PM2.5 and PM10 pollution metrics, critical indicators for air quality assessment
- Color-coded indicators to easily interpret pollution levels

### Location Management
- Precise geolocation services to detect user's current location
- Address lookup and geocoding for searching specific locations
- URL parameter support for sharing specific map views and locations

### Bookmarking System
- Save favorite or frequently accessed locations with custom names and notes
- Manage a personalized collection of locations for quick access
- Full CRUD operations (Create, Read, Update, Delete) for bookmark management
- Server-side storage of bookmarks in JSON format

### Export Functionality
- Export map views as high-quality PNG images
- Generate PDF reports of map data for documentation or sharing
- Server-side PDF generation using Puppeteer

### Distance Measurement
- Calculate distances between points on the map
- Useful for understanding the spatial relationship between different locations

### Sharing Capabilities
- Generate shareable links that preserve the exact map view, position, and zoom level
- Share maps with specific bookmarked locations via URL parameters

## Technical Architecture

### Front-End
- **HTML/CSS/JavaScript**: Core web technologies for the user interface
- **Leaflet.js**: Open-source JavaScript library for interactive maps
- **html2canvas/leaflet-image**: Libraries for capturing and exporting map views

### Back-End
- **Node.js**: JavaScript runtime environment
- **Express**: Web application framework for handling HTTP requests
- **Puppeteer**: Headless browser for server-side PDF generation
- **Axios**: HTTP client for API requests to the OpenMeteo service

### Data Storage
- **JSON Files**: Server-side storage for user bookmarks
- **URL Parameters**: State management through URL for sharing map positions

### External Services
- **OpenStreetMap**: Base map tiles and geographical data
- **OpenMeteo Air Quality API**: Real-time pollution data
- **Nominatim**: Geocoding service for location search by name

## File Structure

```
map-project/
├── data/                # Data storage directory
│   └── bookmarks.json   # JSON file storing user bookmarks
├── js/                  # JavaScript modules
│   ├── bookmarks.js     # Bookmark management functionality
│   ├── cursor.js        # Custom cursor handling
│   ├── custom-marker.js # Custom map marker implementation
│   ├── distance-find.js # Distance calculation between points
│   ├── location.js      # Geolocation services
│   ├── main.js          # Main application entry point
│   ├── map.js           # Core map functionality and initialization
│   ├── marker.js        # Marker management
│   └── pollution.js     # Pollution data fetching and visualization
├── temp/                # Temporary storage for PDF exports
├── Dockerfile           # Container definition for deployment
├── index.html           # Main HTML entry point
├── package.json         # Node.js dependencies and scripts
├── README.md            # Project documentation
├── server.js            # Express server implementation
└── styles.css           # CSS styling for the application
```

## URL Parameter Handling
The application uses URL parameters to maintain state and enable sharing:
- `lat` and `lng`: Coordinates for map center (with 6 decimal places precision)
- `zoom`: Zoom level for the map view
- `region`: Name of a location or bookmark

Example URL: `https://huggingface.co/spaces/pushpit7/pollution-map?lat=51.505000&lng=-0.090000&zoom=12&region=London`

## Deployment

This application is deployed as a Hugging Face Space. You can access it at [https://pollutionmap.in

## Running Locally

```bash
# Install dependencies
npm install

# Start the server
npm start

# For development with auto-restart
npm run dev
```

## Browser Compatibility

The application is compatible with all modern browsers including:
- Chrome (v90+)
- Firefox (v90+)
- Safari (v14+)
- Edge (v90+)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
