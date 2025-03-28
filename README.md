# Map Project - Interactive Map with Location-based Features

## Overview

This interactive map application provides users with location-based information including air quality data, bookmarking capabilities, and map sharing features. Built with Leaflet.js for mapping functionality and Node.js for the backend server, it allows users to explore locations, check current pollution levels, save favorite places, and export maps.

## Features

- **Interactive Map**: Navigate and explore using Leaflet's intuitive controls
- **Location Detection**: Automatically detects user's location on startup
- **Air Quality Data**: Displays real-time PM2.5 and PM10 levels for any clicked location
- **Bookmarks System**: Save, edit, and manage favorite locations
- **URL Sharing**: Generate shareable links with exact map position and zoom level
- **Map Export**: Export the current view as PNG image or PDF document
- **Responsive Design**: Works on both desktop and mobile devices

## Installation Guide

### Prerequisites

- Node.js (v14 or higher)
- npm (usually comes with Node.js)

### Installation Steps

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd map-project
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the server**

   ```bash
   npm start
   ```

4. **Access the application**
   
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

### Development Mode

To run in development mode with auto-restart on code changes:

```bash
npm run dev
```

## User Guide

### Basic Navigation

- **Pan**: Click and drag to move the map
- **Zoom**: Use the scroll wheel, pinch gesture, or the on-screen zoom controls
- **Get Location Info**: Click anywhere on the map to place a marker and view location details

### Air Quality Panel

The air quality panel appears in the bottom-left corner of the map, showing:

- PM2.5 and PM10 readings for the selected location
- Quality categorization (Good, Moderate, Unhealthy, etc.)
- Last update timestamp

### Bookmarks

Access the bookmarks panel by clicking the 🔖 button in the top-right corner.

- **Add Bookmark**: Click on a location, then open the bookmarks panel and click "Add Current Location"
- **View Bookmarks**: All saved locations appear in the bookmarks panel
- **Go To Bookmark**: Click the 🔍 button on any bookmark to navigate to that location
- **Edit Bookmark**: Click the ✏️ button to modify a bookmark's name, notes, or location
- **Delete Bookmark**: Click the 🗑️ button to remove a bookmark

### Sharing Maps

1. Navigate to the desired location and zoom level
2. Click the "🔗 Share Map" button in the top-left corner
3. A link to the current map view is copied to your clipboard
4. The link can be shared with others to show the exact same view

### Exporting Maps

Two export options are available from the top-left controls:

- **Export as Image**: Creates a PNG image of the current map view
- **Export as PDF**: Generates a PDF document containing the map

## Data Storage

- Bookmarks are stored on the server in the `data/bookmarks.json` file
- A local storage backup is maintained in the browser

## Technical Details

- **Frontend**: HTML, CSS, JavaScript with ES6 modules
- **Mapping Library**: Leaflet.js
- **Backend**: Node.js with Express
- **External APIs**: 
  - OpenMeteo Air Quality API (for pollution data)
  - IPInfo (for initial location detection)
  - Nominatim (for reverse geocoding)

## Project Structure

- `js`: JavaScript modules for different features
- `data`: Server-side data storage
- `server.js`: Express server implementation
- `index.html`: Main HTML entry point
- `styles.css`: All application styling

## License

MIT License
