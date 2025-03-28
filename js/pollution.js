import { getLocation } from './location.js';

// Function to get current air quality data for a specific location
export async function getMarkerAQIData(latitude, longitude) {
  try {
    // Use our server endpoint instead of calling OpenMeteo API directly
    const url = `/api/air-quality?latitude=${latitude}&longitude=${longitude}`;
    
    console.log(`Requesting air quality data for: ${latitude}, ${longitude}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Received air quality data:', data);

    // Process the API response
    // Handle the current data structure from OpenMeteo
    if (!data.current) {
      throw new Error('No current data available in the response');
    }
    
    const currentTime = new Date(data.current.time);
    const pm10Value = data.current.pm10;
    const pm25Value = data.current.pm2_5;
    
    // Return formatted data
    return {
      current: {
        time: currentTime,
        pm10: pm10Value,
        pm25: pm25Value
      },
      hourly: data.hourly ? {
        time: data.hourly.time.map(t => new Date(t)),
        pm10: data.hourly.pm10,
        pm25: data.hourly.pm2_5
      } : null,
      metadata: {
        timezone: data.timezone,
        timezoneAbbreviation: data.timezone_abbreviation,
        latitude,
        longitude,
        utcOffsetSeconds: data.utc_offset_seconds
      }
    };
  } catch (error) {
    console.error('Error fetching air quality data:', error);
    throw error;
  }
}

// Function to create HTML display for AQI data
export function createAQIDisplayHTML(aqiData) {
  if (!aqiData || !aqiData.current) {
    return '<div class="aqi-error"><h4>No Air Quality Data Available</h4><p>Could not retrieve air quality information for this location.</p></div>';
  }

  // Format date and time
  const timestamp = aqiData.current.time;
  const formattedTime = timestamp.toLocaleString();

  // PM2.5 level categorization
  let pm25Quality = "Unknown";
  let pm25Class = "unknown";
  const pm25Value = aqiData.current.pm25;

  if (pm25Value !== null && pm25Value !== undefined) {
    if (pm25Value <= 12) {
      pm25Quality = "Good";
      pm25Class = "good";
    } else if (pm25Value <= 35.4) {
      pm25Quality = "Moderate";
      pm25Class = "moderate";
    } else if (pm25Value <= 55.4) {
      pm25Quality = "Unhealthy for Sensitive Groups";
      pm25Class = "unhealthy-sensitive";
    } else if (pm25Value <= 150.4) {
      pm25Quality = "Unhealthy";
      pm25Class = "unhealthy";
    }
    else if (pm25Value <= 250.4) {
      pm25Quality = "Very Unhealthy";
      pm25Class = "very-unhealthy";
    } else {
      pm25Quality = "Hazardous";
      pm25Class = "hazardous";
    }
  }

  // PM10 level categorization
  let pm10Quality = "Unknown";
  let pm10Class = "unknown";
  const pm10Value = aqiData.current.pm10;

  if (pm10Value !== null && pm10Value !== undefined) {
    if (pm10Value <= 54) {
      pm10Quality = "Good";
      pm10Class = "good";
    } else if (pm10Value <= 154) {
      pm10Quality = "Moderate";
      pm10Class = "moderate";
    } else if (pm10Value <= 254) {
      pm10Quality = "Unhealthy for Sensitive Groups";
      pm10Class = "poor";
    } else if (pm10Value <= 354) {
      pm10Quality = "Unhealthy";
      pm10Class = "unhealthy";
    } else if (pm10Value <= 424) {
      pm10Quality = "Very Unhealthy";
      pm10Class = "very-unhealthy";
    }
    else {
      pm10Quality = "Hazardous";
      pm10Class = "hazardous";
    }
  }

  // Generate HTML
  return `
    <div class="aqi-container">
      <h4>Air Quality Information</h4>
      
      <div class="aqi-location-info">
        <p><strong>Location:</strong> ${aqiData.metadata.latitude.toFixed(4)}, ${aqiData.metadata.longitude.toFixed(4)}</p>
        <p><strong>Timezone:</strong> ${aqiData.metadata.timezone || 'Local time'}</p>
      </div>
      
      <h5>Current Conditions</h5>
      
      <div class="particulates-grid">
        <div class="particulate-card ${pm25Class}">
          <div class="particulate-title">PM2.5</div>
          <div class="particulate-value">${pm25Value !== null && pm25Value !== undefined ? pm25Value.toFixed(1) : 'N/A'}</div>
          <div class="particulate-unit">μg/m³</div>
          <div class="particulate-quality ${pm25Class}">${pm25Quality}</div>
          <div class="particulate-desc">Fine particulate matter less than 2.5 micrometers in diameter</div>
        </div>
        
        <div class="particulate-card ${pm10Class}">
          <div class="particulate-title">PM10</div>
          <div class="particulate-value">${pm10Value !== null && pm10Value !== undefined ? pm10Value.toFixed(1) : 'N/A'}</div>
          <div class="particulate-unit">μg/m³</div>
          <div class="particulate-quality ${pm10Class}">${pm10Quality}</div>
          <div class="particulate-desc">Particulate matter less than 10 micrometers in diameter</div>
        </div>
      </div>
      
      <div class="aqi-updated">
        Last updated: ${formattedTime}
      </div>
    </div>
  `;
}
