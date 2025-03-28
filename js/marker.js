// Marker Manager Module
import { getMarkerAQIData, createAQIDisplayHTML } from './pollution.js';

const markerManager = {
    map: null,
    marker: null,
    currentLocationName: "Selected Location",
    
    // Initialize the marker manager
    init(map, initialCoords, initialName) {
        this.map = map;
        this.currentLocationName = initialName || "Selected Location";
        
        // Create marker at initial position
        this.marker = L.marker(initialCoords).addTo(map);
        this.marker.bindPopup(this.currentLocationName).openPopup();
        
        // Add click event to map to update marker position
        map.on('click', async (e) => {
            const newCoords = [e.latlng.lat, e.latlng.lng];
            await this.updateMarkerPosition(newCoords);
        });
        
        // Initialize air quality panel
        this.initAQIPanel();
        
        // Get initial air quality data
        this.fetchAirQualityData(initialCoords);
    },
    
    // Initialize air quality panel
    initAQIPanel() {
        // Create air quality info panel
        const aqiPanel = L.control({ position: 'bottomleft' });
        
        aqiPanel.onAdd = function(map) {
            const div = L.DomUtil.create('div', 'aqi-info-panel');
            div.innerHTML = '<div class="aqi-loading">Loading air quality data...</div>';
            return div;
        };
        
        aqiPanel.addTo(this.map);
        this.aqiPanel = aqiPanel;
    },
    
    // Get the current location name (for URL sharing)
    getLocationName() {
        return this.currentLocationName;
    },
    
    // Update marker position and fetch location name
    async updateMarkerPosition(coords) {
        if (!this.marker || !this.map) return;
        
        // Update marker position
        this.marker.setLatLng(coords);
        
        // Show loading state
        this.marker.bindPopup("Fetching location...").openPopup();
        
        try {
            // Fetch city name using reverse geocoding
            const cityName = await this.getLocationNameFromCoords(coords);
            this.currentLocationName = cityName; // Store the location name
            this.marker.bindPopup(cityName).openPopup();
            
            // Fetch air quality data for the new location
            this.fetchAirQualityData(coords);
            
            // Return the city name for potential use by other components
            return cityName;
        } catch (error) {
            console.error('Error fetching location name:', error);
            this.currentLocationName = "Selected Location";
            this.marker.bindPopup("Selected Location").openPopup();
            return "Selected Location";
        }
    },
    
    // Get location name from coordinates using reverse geocoding
    async getLocationNameFromCoords(coords) {
        try {
            // Using Nominatim for reverse geocoding with more specific parameters
            // Adding zoom=18 for more detailed results and addressdetails=1 for structured address data
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords[0]}&lon=${coords[1]}&zoom=18&addressdetails=1`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch location data');
            }
            
            const data = await response.json();
            console.log('Reverse geocoding response:', data);
            
            // Extract meaningful location name using structured address data
            if (data && data.address) {
                // More detailed location hierarchy with fallbacks
                const locationParts = [];
                
                // Try to get the most specific location name first (building, amenity, etc.)
                if (data.address.building || data.address.amenity || data.address.leisure) {
                    locationParts.push(data.address.building || data.address.amenity || data.address.leisure);
                }
                
                // Add road/street name if available
                if (data.address.road || data.address.street) {
                    locationParts.push(data.address.road || data.address.street);
                }
                
                // Add neighborhood/suburb if available
                if (data.address.suburb || data.address.neighbourhood) {
                    locationParts.push(data.address.suburb || data.address.neighbourhood);
                }
                
                // Add city, town, or village
                if (data.address.city || data.address.town || data.address.village) {
                    locationParts.push(data.address.city || data.address.town || data.address.village);
                }
                
                // If we have meaningful parts, construct a name
                if (locationParts.length > 0) {
                    // Limit to 3 parts maximum to avoid overly long names
                    return locationParts.slice(0, 3).join(', ');
                } else {
                    // Fallback to county or state level
                    return data.address.county || 
                           data.address.state || 
                           data.address.country || 
                           data.display_name.split(',')[0] || 
                           "Selected Location";
                }
            }
            
            return data.display_name || "Selected Location";
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            return "Selected Location";
        }
    },
    
    // Fetch air quality data for given coordinates
    async fetchAirQualityData(coords) {
        try {
            // Update panel to show loading state
            const aqiPanelElement = document.querySelector('.aqi-info-panel');
            if (aqiPanelElement) {
                aqiPanelElement.innerHTML = '<div class="aqi-loading">Loading air quality data...</div>';
            }
            
            // Get air quality data
            const aqiData = await getMarkerAQIData(coords[0], coords[1]);
            
            // Generate HTML for display
            const aqiHTML = createAQIDisplayHTML(aqiData);
            
            // Update the panel with the data
            if (aqiPanelElement) {
                aqiPanelElement.innerHTML = aqiHTML;
            }
            
            // Log coordinates for debug purposes
            console.log(`Updated pollution data for coordinates: ${coords[0]}, ${coords[1]}`);
        } catch (error) {
            console.error('Error fetching air quality data:', error);
            const aqiPanelElement = document.querySelector('.aqi-info-panel');
            if (aqiPanelElement) {
                aqiPanelElement.innerHTML = `
                    <div class="aqi-error">
                        <h4>Error Loading Air Quality Data</h4>
                        <p>${error.message}</p>
                        <p>Coordinates: ${coords[0]}, ${coords[1]}</p>
                    </div>`;
            }
        }
    }
};

export default markerManager;