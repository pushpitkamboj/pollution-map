// Distance finder module for calculating distance between two locations on the map

const distanceFinder = {
    map: null,
    markers: [],
    polyline: null,
    isActive: false,
    distanceControl: null,
    resultPopup: null,
    
    // Initialize the distance finder
    init(map) {
        this.map = map;
        this.addDistanceControl();
        this.addStyles();
    },
    
    // Add necessary CSS styles dynamically
    addStyles() {
        if (!document.getElementById('distance-finder-styles')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'distance-finder-styles';
            styleEl.textContent = `
                .distance-control {
                    background: white;
                    padding: 5px;
                    border-radius: 4px;
                    box-shadow: 0 1px 5px rgba(0,0,0,0.4);
                }
                
                .distance-btn {
                    background: white;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    padding: 6px 10px;
                    cursor: pointer;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                }
                
                .distance-btn.active {
                    background-color: #f4f4f4;
                    border-color: #4285F4;
                    color: #4285F4;
                }
                
                .measuring-cursor {
                    cursor: crosshair !important;
                }
                
                .distance-marker {
                    background-color: #4285F4;
                    border: 2px solid white;
                    border-radius: 50%;
                    text-align: center;
                    color: white;
                    font-weight: bold;
                }
                
                .distance-info {
                    background: white;
                    padding: 10px;
                    border-radius: 4px;
                    box-shadow: 0 1px 5px rgba(0,0,0,0.4);
                    text-align: center;
                    min-width: 150px;
                }
                
                .distance-value {
                    font-size: 16px;
                    font-weight: bold;
                    margin: 5px 0;
                }
                
                .distance-clear-btn {
                    background: #f44336;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 5px 8px;
                    cursor: pointer;
                    font-size: 12px;
                    margin-top: 5px;
                }
                
                .distance-instructions {
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0,0,0,0.7);
                    color: white;
                    padding: 8px 12px;
                    border-radius: 4px;
                    font-size: 14px;
                    z-index: 1000;
                }
            `;
            document.head.appendChild(styleEl);
        }
    },
    
    // Add distance measurement control to the map
    addDistanceControl() {
        const DistanceControl = L.Control.extend({
            options: {
                position: 'topleft'
            },
            
            onAdd: (map) => {
                const container = L.DomUtil.create('div', 'distance-control');
                const button = L.DomUtil.create('button', 'distance-btn', container);
                button.innerHTML = '📏 Measure Distance';
                button.title = 'Measure distance between two points';
                
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.on(button, 'click', (e) => {
                    this.toggleMeasurement(button);
                });
                
                this.distanceControl = container;
                return container;
            }
        });
        
        this.map.addControl(new DistanceControl());
    },
    
    // Toggle distance measurement mode
    toggleMeasurement(button) {
        this.isActive = !this.isActive;
        
        if (this.isActive) {
            // Activate measurement mode
            button.innerHTML = '✖ Cancel Measurement';
            button.classList.add('active');
            this.showInstructions('Click on the map to set the start point');
            this.map.on('click', this.handleMapClick, this);
            L.DomUtil.addClass(this.map.getContainer(), 'measuring-cursor');
        } else {
            // Deactivate measurement mode
            button.innerHTML = '📏 Measure Distance';
            button.classList.remove('active');
            this.hideInstructions();
            this.map.off('click', this.handleMapClick, this);
            L.DomUtil.removeClass(this.map.getContainer(), 'measuring-cursor');
        }
    },
    
    // Handle map clicks for measurement
    handleMapClick(e) {
        const latlng = e.latlng;
        
        if (this.markers.length === 0) {
            // First click - Start point
            this.addMarker(latlng, 'A');
            this.showInstructions('Click on the map to set the end point');
        } else if (this.markers.length === 1) {
            // Second click - End point
            this.addMarker(latlng, 'B');
            this.drawLine();
            this.calculateAndDisplayDistance();
            this.hideInstructions();
            
            // Deactivate measurement mode
            this.isActive = false;
            const button = this.distanceControl.querySelector('.distance-btn');
            button.innerHTML = '📏 Measure Distance';
            button.classList.remove('active');
            this.map.off('click', this.handleMapClick, this);
            L.DomUtil.removeClass(this.map.getContainer(), 'measuring-cursor');
        }
    },
    
    // Add marker at specified location
    addMarker(latlng, label) {
        const icon = L.divIcon({
            className: 'distance-marker',
            html: label,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        
        const marker = L.marker(latlng, {
            icon: icon,
            draggable: true
        }).addTo(this.map);
        
        // Update measurement when marker is dragged
        marker.on('dragend', () => {
            if (this.markers.length === 2) {
                this.drawLine();
                this.calculateAndDisplayDistance();
            }
        });
        
        this.markers.push(marker);
    },
    
    // Draw a line between the two markers
    drawLine() {
        if (this.markers.length !== 2) return;
        
        const latlngs = this.markers.map(marker => marker.getLatLng());
        
        if (this.polyline) {
            this.map.removeLayer(this.polyline);
        }
        
        this.polyline = L.polyline(latlngs, {
            color: '#4285F4',
            weight: 3,
            opacity: 0.7,
            dashArray: '5, 7'
        }).addTo(this.map);
        
        // Fit the map to show both points
        const bounds = L.latLngBounds(latlngs);
        this.map.fitBounds(bounds, {
            padding: [50, 50]
        });
    },
    
    // Calculate and display the distance between the two markers
    calculateAndDisplayDistance() {
        if (this.markers.length !== 2) return;
        
        const start = this.markers[0].getLatLng();
        const end = this.markers[1].getLatLng();
        
        // Calculate distance in meters
        const distanceInMeters = start.distanceTo(end);
        
        // Format distance for display
        let distanceText;
        if (distanceInMeters >= 1000) {
            distanceText = `${(distanceInMeters / 1000).toFixed(2)} km`;
        } else {
            distanceText = `${Math.round(distanceInMeters)} meters`;
        }
        
        // Display distance in a popup
        const midPoint = L.latLng(
            (start.lat + end.lat) / 2,
            (start.lng + end.lng) / 2
        );
        
        if (this.resultPopup) {
            this.map.removeLayer(this.resultPopup);
        }
        
        this.resultPopup = L.popup({
            closeButton: false,
            autoClose: false,
            closeOnClick: false
        })
        .setLatLng(midPoint)
        .setContent(
            `<div class="distance-info">
                <div>Distance:</div>
                <div class="distance-value">${distanceText}</div>
                <div>
                    <small>From: ${start.lat.toFixed(6)}, ${start.lng.toFixed(6)}</small><br>
                    <small>To: ${end.lat.toFixed(6)}, ${end.lng.toFixed(6)}</small>
                </div>
                <button class="distance-clear-btn">Clear</button>
            </div>`
        )
        .openOn(this.map);
        
        // Add event listener to clear button
        setTimeout(() => {
            const clearButton = document.querySelector('.distance-clear-btn');
            if (clearButton) {
                clearButton.addEventListener('click', () => {
                    this.clearMeasurement();
                });
            }
        }, 100);
    },
    
    // Clear all measurement elements
    clearMeasurement() {
        // Remove markers
        this.markers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.markers = [];
        
        // Remove line
        if (this.polyline) {
            this.map.removeLayer(this.polyline);
            this.polyline = null;
        }
        
        // Remove popup
        if (this.resultPopup) {
            this.map.removeLayer(this.resultPopup);
            this.resultPopup = null;
        }
    },
    
    // Show instructions to the user
    showInstructions(text) {
        let instructionDiv = document.getElementById('distance-instructions');
        if (!instructionDiv) {
            instructionDiv = document.createElement('div');
            instructionDiv.id = 'distance-instructions';
            instructionDiv.className = 'distance-instructions';
            document.body.appendChild(instructionDiv);
        }
        instructionDiv.textContent = text;
        instructionDiv.style.display = 'block';
    },
    
    // Hide the instructions
    hideInstructions() {
        const instructionDiv = document.getElementById('distance-instructions');
        if (instructionDiv) {
            instructionDiv.style.display = 'none';
        }
    }
};

export default distanceFinder;