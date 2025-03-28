class LocationService {
    static async getCurrentLocation() {
        try {
            const response = await fetch('https://ipinfo.io/json');
            if (!response.ok) {
                throw new Error('Failed to fetch location data');
            }
            const data = await response.json();
            const [latitude, longitude] = data.loc.split(',');
            return {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                city: data.city
            };
        } catch (error) {
            console.error('Error fetching location:', error);
            throw error;
        }
    }
}

// This function will be used by map.js
export async function getLocation() {
    try {
        const locationData = await LocationService.getCurrentLocation();
        return [locationData.latitude, locationData.longitude, locationData.city];
    } catch (error) {
        console.error('Error in getLocation:', error);
        throw error;
    }
}

export default LocationService;