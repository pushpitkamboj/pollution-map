import { getLocation } from './location.js';
import markerManager from './marker.js';
import bookmarksManager from './bookmarks.js';

// Parse URL parameters to get location information
function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check for coordinates or region name
    const lat = urlParams.get('lat');
    const lng = urlParams.get('lng');
    const zoom = urlParams.get('zoom');
    const region = urlParams.get('region');
    
    return {
        hasLocationParams: !!(lat && lng) || !!region,
        coordinates: lat && lng ? [parseFloat(lat), parseFloat(lng)] : null,
        zoom: zoom ? parseInt(zoom) : null,
        region: region || null
    };
}

// Update URL with current map position
function updateUrlWithLocation(map, locationName = null) {
    if (!map) return;
    
    const center = map.getCenter();
    const zoom = map.getZoom();
    const lat = center.lat.toFixed(6);
    const lng = center.lng.toFixed(6);
    
    const url = new URL(window.location);
    url.searchParams.set('lat', lat);
    url.searchParams.set('lng', lng);
    url.searchParams.set('zoom', zoom);
    
    if (locationName) {
        url.searchParams.set('region', encodeURIComponent(locationName));
    } else {
        url.searchParams.delete('region');
    }
    
    // Update URL without reloading the page
    window.history.replaceState({}, '', url);
}

// Initialize map with location data
async function initMap() {
    try {
        // Default coordinates in case location fetch fails
        let coordinates = [51.505, -0.09];
        let cityName = "Default Location";
        let zoom = 7;
        
        // Parse URL parameters first
        const urlParams = parseUrlParams();
        
        // If URL has location params, prioritize those
        if (urlParams.hasLocationParams) {
            if (urlParams.coordinates) {
                coordinates = urlParams.coordinates;
                cityName = "Shared Location";
            }
            
            if (urlParams.zoom) {
                zoom = urlParams.zoom;
            }
        } else {
            // No URL params, try to get user's location
            try {
                const locationData = await getLocation();
                if (locationData && locationData.length >= 2) {
                    coordinates = [locationData[0], locationData[1]];
                    cityName = locationData[2] || "Your Location";
                }
            } catch (error) {
                console.error('Error getting location, using default:', error);
            }
        }
        
        // Create map centered at determined location
        const map = L.map('map').setView(coordinates, zoom);
        
        // Add tile layer
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);
        
        // Initialize marker manager with the map and initial position
        markerManager.init(map, coordinates, cityName);
        
        // Initialize bookmarks manager
        bookmarksManager.init();
        
        // Check if we need to search for a region by name
        if (urlParams.region && !urlParams.coordinates) {
            await searchRegionByName(map, urlParams.region);
        }
        
        // Update URL when map is moved
        map.on('moveend', () => {
            // Get the marker's location name if available
            const locationName = markerManager.getLocationName();
            updateUrlWithLocation(map, locationName);
        });
        
        // Add export control
        addExportControl(map);
        
        // Add share control
        addShareControl(map);
        
        // Add bookmarks control
        addBookmarksControl(map);
        
        // Add a message to instruct users
        const instructionDiv = document.createElement('div');
        instructionDiv.className = 'map-instructions';
        instructionDiv.innerHTML = 'Click anywhere on the map to move the marker. Select a layer to view region data.';
        document.body.appendChild(instructionDiv);
        
        setTimeout(() => {
            instructionDiv.style.opacity = '0';
            setTimeout(() => instructionDiv.remove(), 1000);
        }, 5000);
    } catch (error) {
        console.error('Failed to initialize map:', error);
    }
}

// Search for a region by name using Nominatim or bookmarks
async function searchRegionByName(map, regionName) {
    try {
        console.log(`Searching for region: ${regionName}`);
        
        // First check if there's a bookmark with this name
        const bookmarks = bookmarksManager.getAll();
        const matchingBookmark = bookmarks.find(b => 
            b.name.toLowerCase() === regionName.toLowerCase() || 
            (b.notes && b.notes.toLowerCase().includes(regionName.toLowerCase()))
        );
        
        if (matchingBookmark && matchingBookmark.position) {
            console.log(`Found bookmark match: ${matchingBookmark.name}`);
            
            // Navigate to bookmark coordinates
            map.setView(
                [matchingBookmark.position.lat, matchingBookmark.position.lng], 
                matchingBookmark.position.zoom || 12
            );
            
            // Update marker
            await markerManager.updateMarkerPosition([
                matchingBookmark.position.lat, 
                matchingBookmark.position.lng
            ]);
            
            return {
                name: matchingBookmark.name,
                coords: [matchingBookmark.position.lat, matchingBookmark.position.lng]
            };
        }
        
        // If no bookmark match, try Nominatim search
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(regionName)}&limit=1&addressdetails=1`
        );
        
        if (!response.ok) {
            throw new Error('Failed to search for location');
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            const location = data[0];
            const coords = [parseFloat(location.lat), parseFloat(location.lon)];
            
            console.log(`Found location via Nominatim: ${location.display_name} at coordinates ${coords[0]}, ${coords[1]}`);
            
            // Check if any bookmarks are nearby this location
            try {
                const nearbyBookmarks = await bookmarksManager.searchByCoordinates(coords[0], coords[1], 1.0);
                
                if (nearbyBookmarks && nearbyBookmarks.length > 0) {
                    // Use the bookmark's precise coordinates and zoom level
                    const nearestBookmark = nearbyBookmarks[0];
                    console.log(`Found nearby bookmark: ${nearestBookmark.name}`);
                    
                    // Navigate to bookmark coordinates
                    map.setView(
                        [nearestBookmark.position.lat, nearestBookmark.position.lng], 
                        nearestBookmark.position.zoom || 12
                    );
                    
                    // Update marker
                    await markerManager.updateMarkerPosition([
                        nearestBookmark.position.lat, 
                        nearestBookmark.position.lng
                    ]);
                    
                    return {
                        name: nearestBookmark.name,
                        coords: [nearestBookmark.position.lat, nearestBookmark.position.lng]
                    };
                }
            } catch (err) {
                console.log('Error checking nearby bookmarks:', err);
                // Continue with nominatim result if bookmark search fails
            }
            
            // No nearby bookmarks, use Nominatim result
            // Update map view with appropriate zoom level
            let zoomLevel = 10;
            if (location.type === 'city' || location.type === 'administrative') {
                zoomLevel = 12;
            } else if (location.addresstype === 'amenity' || location.addresstype === 'building') {
                zoomLevel = 16;
            }
            
            map.setView(coords, zoomLevel);
            
            // Update marker
            const locationName = await markerManager.updateMarkerPosition(coords);
            return {
                name: locationName || location.display_name.split(',')[0],
                coords: coords
            };
        } else {
            console.log(`No results found for: ${regionName}`);
            return null;
        }
    } catch (error) {
        console.error('Error searching for region:', error);
        return null;
    }
}

// Add share control to the map
function addShareControl(map) {
    const ShareControl = L.Control.extend({
        options: {
            position: 'topleft'
        },
        
        onAdd: function() {
            const container = L.DomUtil.create('div', 'map-export-control map-share-control');
            
            const shareButton = L.DomUtil.create('button', '', container);
            shareButton.innerHTML = '🔗 Share Map';
            shareButton.title = 'Copy shareable link to clipboard';
            
            // Prevent clicks from propagating to the map
            L.DomEvent.disableClickPropagation(container);
            
            // Add event listener
            L.DomEvent.on(shareButton, 'click', function() {
                const url = window.location.href;
                navigator.clipboard.writeText(url)
                    .then(() => {
                        const originalText = shareButton.innerHTML;
                        shareButton.innerHTML = '✅ Copied!';
                        
                        setTimeout(() => {
                            shareButton.innerHTML = originalText;
                        }, 2000);
                    })
                    .catch(err => {
                        console.error('Failed to copy URL:', err);
                        alert('Failed to copy link. Please copy the URL from your browser address bar.');
                    });
            });
            
            return container;
        }
    });
    
    // Add the control to the map
    map.addControl(new ShareControl());
}

// Add export control to the map
function addExportControl(map) {
    // Create a custom control for exporting the map
    const ExportControl = L.Control.extend({
        options: {
            position: 'topleft'
        },
        
        onAdd: function() {
            const container = L.DomUtil.create('div', 'map-export-control');
            
            const imgButton = L.DomUtil.create('button', '', container);
            imgButton.innerHTML = '📷 Export Image';
            imgButton.title = 'Export as PNG image';
            
            const pdfButton = L.DomUtil.create('button', '', container);
            pdfButton.innerHTML = '📄 Export PDF';
            pdfButton.title = 'Export as PDF document';
            
            // Prevent clicks from propagating to the map
            L.DomEvent.disableClickPropagation(container);
            
            // Add event listeners
            L.DomEvent.on(imgButton, 'click', function() {
                exportMapAsImage(map);
            });
            
            L.DomEvent.on(pdfButton, 'click', function() {
                exportMapAsPDF(map);
            });
            
            return container;
        }
    });
    
    // Add the control to the map
    map.addControl(new ExportControl());
}

// Add bookmarks control to the map
function addBookmarksControl(map) {
    const BookmarksControl = L.Control.extend({
        options: {
            position: 'topright'
        },
        
        onAdd: function() {
            const container = L.DomUtil.create('div', 'map-bookmarks-control');
            
            // Create bookmarks button
            const bookmarksButton = L.DomUtil.create('button', 'bookmarks-toggle', container);
            bookmarksButton.innerHTML = '🔖';
            bookmarksButton.title = 'Manage Bookmarks';
            
            // Create bookmarks panel (hidden by default)
            const panel = L.DomUtil.create('div', 'bookmarks-panel', container);
            panel.style.display = 'none';
            
            // Header with title and close button
            const header = L.DomUtil.create('div', 'bookmarks-header', panel);
            
            const title = L.DomUtil.create('h3', '', header);
            title.textContent = 'Bookmarks';
            
            const closeBtn = L.DomUtil.create('button', 'bookmarks-close', header);
            closeBtn.innerHTML = '✕';
            closeBtn.title = 'Close';
            
            // Add bookmarks list container
            const listContainer = L.DomUtil.create('div', 'bookmarks-list', panel);
            
            // Add action buttons container
            const actionsContainer = L.DomUtil.create('div', 'bookmarks-actions', panel);
            
            const addBtn = L.DomUtil.create('button', 'bookmark-add', actionsContainer);
            addBtn.textContent = 'Add Current Location';
            
            // Prevent clicks from propagating to the map
            L.DomEvent.disableClickPropagation(container);
            
            // Toggle panel visibility when button is clicked
            L.DomEvent.on(bookmarksButton, 'click', function() {
                const isVisible = panel.style.display !== 'none';
                panel.style.display = isVisible ? 'none' : 'block';
                
                if (!isVisible) {
                    // Refresh bookmarks list when panel is opened
                    refreshBookmarksList(listContainer, map);
                }
            });
            
            // Close panel when close button is clicked
            L.DomEvent.on(closeBtn, 'click', function() {
                panel.style.display = 'none';
            });
            
            // Add bookmark for current location
            L.DomEvent.on(addBtn, 'click', function() {
                showAddBookmarkForm(map, panel, listContainer);
            });
            
            return container;
        }
    });
    
    // Add the control to the map
    map.addControl(new BookmarksControl());
}

// Refresh the bookmarks list in the panel
function refreshBookmarksList(listContainer, map) {
    // Clear the current list
    listContainer.innerHTML = '';
    
    // Get all bookmarks
    const bookmarks = bookmarksManager.getAll();
    
    if (bookmarks.length === 0) {
        // Show message if no bookmarks
        const noBookmarksMsg = document.createElement('p');
        noBookmarksMsg.className = 'no-bookmarks-msg';
        noBookmarksMsg.textContent = 'No bookmarks yet. Add your first location!';
        listContainer.appendChild(noBookmarksMsg);
        return;
    }
    
    // Create list element
    const list = document.createElement('ul');
    list.className = 'bookmarks-items';
    
    // Add each bookmark to the list
    bookmarks.forEach(bookmark => {
        const item = document.createElement('li');
        item.className = 'bookmark-item';
        
        // Bookmark name/title
        const title = document.createElement('div');
        title.className = 'bookmark-title';
        title.textContent = bookmark.name;
        
        // Action buttons
        const actions = document.createElement('div');
        actions.className = 'bookmark-actions';
        
        const goToBtn = document.createElement('button');
        goToBtn.className = 'bookmark-goto';
        goToBtn.innerHTML = '🔍';
        goToBtn.title = 'Go to this location';
        goToBtn.addEventListener('click', async function() {
            // Show loading state in the button
            const originalHTML = goToBtn.innerHTML;
            goToBtn.innerHTML = '⏳';
            goToBtn.disabled = true;
            
            try {
                // Navigate to the bookmarked location with proper updating of marker and context
                // First set the view to the bookmarked position
                map.setView([bookmark.position.lat, bookmark.position.lng], bookmark.position.zoom);
                
                // Then update the marker position - this will also trigger reverse geocoding
                await markerManager.updateMarkerPosition([bookmark.position.lat, bookmark.position.lng]);
                
                // Update URL with the bookmark name for better sharing experience
                updateUrlWithLocation(map, bookmark.name);
            } catch (error) {
                console.error('Error navigating to bookmark:', error);
            } finally {
                // Restore button state
                goToBtn.innerHTML = originalHTML;
                goToBtn.disabled = false;
            }
        });
        
        const editBtn = document.createElement('button');
        editBtn.className = 'bookmark-edit';
        editBtn.innerHTML = '✏️';
        editBtn.title = 'Edit bookmark';
        editBtn.addEventListener('click', function() {
            showEditBookmarkForm(bookmark, map, listContainer);
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'bookmark-delete';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete bookmark';
        deleteBtn.addEventListener('click', function() {
            if (confirm(`Are you sure you want to delete the bookmark "${bookmark.name}"?`)) {
                bookmarksManager.remove(bookmark.id);
                refreshBookmarksList(listContainer, map);
            }
        });
        
        // Add actions to the item
        actions.appendChild(goToBtn);
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        
        // If bookmark has notes, show them
        if (bookmark.notes) {
            const notes = document.createElement('div');
            notes.className = 'bookmark-notes';
            notes.textContent = bookmark.notes;
            item.appendChild(title);
            item.appendChild(notes);
            item.appendChild(actions);
        } else {
            item.appendChild(title);
            item.appendChild(actions);
        }
        
        list.appendChild(item);
    });
    
    listContainer.appendChild(list);
}

// Show form to add a new bookmark
function showAddBookmarkForm(map, panel, listContainer) {
    // Create form container
    const formContainer = document.createElement('div');
    formContainer.className = 'bookmark-form-container';
    
    // Create form
    const form = document.createElement('form');
    form.className = 'bookmark-form';
    
    // Form title
    const formTitle = document.createElement('h4');
    formTitle.textContent = 'Add New Bookmark';
    
    // Name input
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Name:';
    nameLabel.setAttribute('for', 'bookmark-name');
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'bookmark-name';
    nameInput.name = 'name';
    nameInput.required = true;
    nameInput.placeholder = 'Enter a name for this location';
    nameInput.value = markerManager.getLocationName() || 'My Bookmark';
    
    // Notes textarea
    const notesLabel = document.createElement('label');
    notesLabel.textContent = 'Notes (optional):';
    notesLabel.setAttribute('for', 'bookmark-notes');
    
    const notesInput = document.createElement('textarea');
    notesInput.id = 'bookmark-notes';
    notesInput.name = 'notes';
    notesInput.placeholder = 'Add some notes about this location';
    
    // Buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'form-buttons';
    
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.textContent = 'Save';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function() {
        formContainer.remove();
    });
    
    // Add elements to form
    form.appendChild(formTitle);
    form.appendChild(nameLabel);
    form.appendChild(nameInput);
    form.appendChild(notesLabel);
    form.appendChild(notesInput);
    buttonsContainer.appendChild(cancelBtn);
    buttonsContainer.appendChild(saveBtn);
    form.appendChild(buttonsContainer);
    
    // Add form to container
    formContainer.appendChild(form);
    
    // Handle form submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Create bookmark from form data
        const bookmark = bookmarksManager.createFromMap(map, nameInput.value, notesInput.value);
        
        // Add to bookmarks manager
        bookmarksManager.add(bookmark);
        
        // Close form
        formContainer.remove();
        
        // Refresh bookmarks list
        refreshBookmarksList(listContainer, map);
    });
    
    // Add form to panel
    panel.appendChild(formContainer);
    
    // Focus on the name input
    nameInput.focus();
}

// Show form to edit an existing bookmark
async function showEditBookmarkForm(bookmark, map, listContainer) {
    // Create form container
    const formContainer = document.createElement('div');
    formContainer.className = 'bookmark-form-container';
    
    // Create form
    const form = document.createElement('form');
    form.className = 'bookmark-form';
    
    // Form title
    const formTitle = document.createElement('h4');
    formTitle.textContent = 'Edit Bookmark';
    
    // Name input
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Name:';
    nameLabel.setAttribute('for', 'edit-bookmark-name');
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'edit-bookmark-name';
    nameInput.name = 'name';
    nameInput.required = true;
    nameInput.value = bookmark.name;
    
    // Notes textarea
    const notesLabel = document.createElement('label');
    notesLabel.textContent = 'Notes (optional):';
    notesLabel.setAttribute('for', 'edit-bookmark-notes');
    
    const notesInput = document.createElement('textarea');
    notesInput.id = 'edit-bookmark-notes';
    notesInput.name = 'notes';
    notesInput.value = bookmark.notes || '';
    
    // Location options section
    const locationOptionsContainer = document.createElement('div');
    locationOptionsContainer.className = 'location-options-container';
    
    const locationOptionsTitle = document.createElement('p');
    locationOptionsTitle.className = 'location-options-title';
    locationOptionsTitle.textContent = 'Location Options:';
    locationOptionsContainer.appendChild(locationOptionsTitle);
    
    // Update location checkbox
    const updateLocationContainer = document.createElement('div');
    updateLocationContainer.className = 'checkbox-container';
    
    const updateLocationCheckbox = document.createElement('input');
    updateLocationCheckbox.type = 'checkbox';
    updateLocationCheckbox.id = 'update-location';
    updateLocationCheckbox.name = 'updateLocation';
    
    const updateLocationLabel = document.createElement('label');
    updateLocationLabel.setAttribute('for', 'update-location');
    updateLocationLabel.textContent = 'Update to current map position';
    
    updateLocationContainer.appendChild(updateLocationCheckbox);
    updateLocationContainer.appendChild(updateLocationLabel);
    
    // Go to bookmark location button
    const gotoLocationBtn = document.createElement('button');
    gotoLocationBtn.type = 'button';
    gotoLocationBtn.className = 'goto-bookmark-btn';
    gotoLocationBtn.textContent = 'Go to Bookmark Location';
    gotoLocationBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        
        // Navigate to bookmark coordinates
        map.setView(
            [bookmark.position.lat, bookmark.position.lng], 
            bookmark.position.zoom || 12
        );
        
        // Update marker
        await markerManager.updateMarkerPosition([
            bookmark.position.lat, 
            bookmark.position.lng
        ]);
    });
    
    // Add location options
    locationOptionsContainer.appendChild(updateLocationContainer);
    locationOptionsContainer.appendChild(gotoLocationBtn);
    
    // Location coordinates display
    const coordsContainer = document.createElement('div');
    coordsContainer.className = 'coords-container';
    
    const coordsDisplay = document.createElement('div');
    coordsDisplay.className = 'coords-display';
    coordsDisplay.innerHTML = `
        <strong>Current Coordinates:</strong>
        <span>Lat: ${bookmark.position.lat.toFixed(6)}, Lng: ${bookmark.position.lng.toFixed(6)}, Zoom: ${bookmark.position.zoom}</span>
    `;
    coordsContainer.appendChild(coordsDisplay);
    
    // Buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'form-buttons';
    
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.textContent = 'Save';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function() {
        formContainer.remove();
    });
    
    // Add elements to form
    form.appendChild(formTitle);
    form.appendChild(nameLabel);
    form.appendChild(nameInput);
    form.appendChild(notesLabel);
    form.appendChild(notesInput);
    form.appendChild(locationOptionsContainer);
    form.appendChild(coordsContainer);
    buttonsContainer.appendChild(cancelBtn);
    buttonsContainer.appendChild(saveBtn);
    form.appendChild(buttonsContainer);
    
    // Add form to container
    formContainer.appendChild(form);
    
    // Handle form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Show loading state
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        
        const updates = {
            name: nameInput.value,
            notes: notesInput.value
        };
        
        try {
            // Update position if checkbox is checked
            if (updateLocationCheckbox.checked) {
                const center = map.getCenter();
                const zoom = map.getZoom();
                
                // Update marker to current map position if necessary
                const currentMarkerPos = markerManager.marker.getLatLng();
                
                // If marker isn't at the map center, update it
                if (Math.abs(currentMarkerPos.lat - center.lat) > 0.0001 || 
                    Math.abs(currentMarkerPos.lng - center.lng) > 0.0001) {
                    // Update marker and get location name
                    await markerManager.updateMarkerPosition([center.lat, center.lng]);
                }
                
                // Use current marker name as bookmark name if user didn't change it
                if (nameInput.value === bookmark.name) {
                    // Get current marker name
                    const markerName = markerManager.getLocationName();
                    if (markerName && markerName !== "Selected Location") {
                        nameInput.value = markerName;
                        updates.name = markerName;
                    }
                }
                
                // Set position from map
                updates.position = {
                    lat: center.lat,
                    lng: center.lng,
                    zoom: zoom
                };
            }
            
            // Update the bookmark
            await bookmarksManager.update(bookmark.id, updates);
            
            // Close form
            formContainer.remove();
            
            // Refresh bookmarks list
            refreshBookmarksList(listContainer, map);
        } catch (error) {
            console.error('Error updating bookmark:', error);
            alert('There was a problem updating the bookmark. Please try again.');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
        }
    });
    
    // Add form to the page
    // Find the bookmarks panel and append the form
    const panel = document.querySelector('.bookmarks-panel');
    panel.appendChild(formContainer);
    
    // Focus on the name input
    nameInput.focus();
}

// Export map as image (PNG)
async function exportMapAsImage(map) {
    try {
        showLoading('Generating image...');
        
        // Use Leaflet's built-in method to get visible bounds
        const bounds = map.getBounds();
        
        // This is a workaround for Leaflet's rendering mechanism
        // Wait a moment to ensure all tiles are loaded
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Use leaflet-image (included via CDN) if available,
        // otherwise use html2canvas as fallback
        if (window.leafletImage) {
            window.leafletImage(map, function(err, canvas) {
                if (err) {
                    console.error('Error generating map image:', err);
                    hideLoading();
                    alert('Failed to export image. Please try again.');
                    return;
                }
                
                // Convert canvas to data URL and trigger download
                const imgData = canvas.toDataURL('image/png');
                downloadImage(imgData, 'map-export.png');
                hideLoading();
            });
        } else {
            // Fallback to regular canvas approach
            html2canvas(document.querySelector('#map')).then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                downloadImage(imgData, 'map-export.png');
                hideLoading();
            }).catch(err => {
                console.error('Error generating map image:', err);
                hideLoading();
                alert('Failed to export image. Please try again.');
            });
        }
    } catch (error) {
        console.error('Error exporting map as image:', error);
        hideLoading();
        alert('Failed to export image. Please try again.');
    }
}

// Export map as PDF
async function exportMapAsPDF(map) {
    try {
        showLoading('Generating PDF...');
        
        // Use html2canvas to capture map
        html2canvas(document.querySelector('#map')).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            
            // Get map dimensions
            const width = map.getSize().x;
            const height = map.getSize().y;
            
            // Send to server for PDF generation
            fetch('/export-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    imageData: imgData,
                    width,
                    height
                }),
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Server returned error');
                }
                return response.blob();
            })
            .then(blob => {
                // Create a download link for the PDF
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'map-export.pdf';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
                hideLoading();
            })
            .catch(error => {
                console.error('Error generating PDF:', error);
                hideLoading();
                alert('Failed to export PDF. Please try again.');
            });
        }).catch(err => {
            console.error('Error capturing map for PDF:', err);
            hideLoading();
            alert('Failed to export PDF. Please try again.');
        });
    } catch (error) {
        console.error('Error exporting map as PDF:', error);
        hideLoading();
        alert('Failed to export PDF. Please try again.');
    }
}

// Helper function to download image
function downloadImage(dataUrl, filename) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Show loading indicator
function showLoading(message = 'Exporting map...') {
    const loadingElement = document.getElementById('export-loading');
    const loadingTextElement = document.getElementById('export-loading-text');
    
    if (loadingTextElement) {
        loadingTextElement.textContent = message;
    }
    
    if (loadingElement) {
        loadingElement.style.display = 'flex';
    }
}

// Hide loading indicator
function hideLoading() {
    const loadingElement = document.getElementById('export-loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

// Initialize the map when the page loads
initMap();