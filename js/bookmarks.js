// Bookmarks manager for map locations
const bookmarksManager = {
    bookmarks: [],
    storageKey: 'map_bookmarks',
    
    // Initialize bookmarks from server
    async init() {
        try {
            // Fetch bookmarks from server-side storage
            const response = await fetch('/api/bookmarks');
            
            if (response.ok) {
                this.bookmarks = await response.json();
                console.log('Loaded bookmarks from server:', this.bookmarks.length);
            } else {
                console.error('Error loading bookmarks from server:', response.statusText);
                this.bookmarks = [];
                
                // Try to load from localStorage as fallback
                const storedBookmarks = localStorage.getItem(this.storageKey);
                if (storedBookmarks) {
                    this.bookmarks = JSON.parse(storedBookmarks);
                    console.log('Loaded bookmarks from localStorage fallback:', this.bookmarks.length);
                    
                    // Migrate bookmarks from localStorage to server storage
                    this.saveToStorage();
                }
            }
        } catch (error) {
            console.error('Error initializing bookmarks:', error);
            this.bookmarks = [];
        }
        return this.bookmarks;
    },
    
    // Get all bookmarks
    getAll() {
        return this.bookmarks;
    },
    
    // Add a new bookmark
    async add(bookmark) {
        // Generate a unique ID if not provided
        if (!bookmark.id) {
            bookmark.id = 'bm_' + Date.now();
        }
        
        // Add created date
        bookmark.createdAt = new Date().toISOString();
        
        try {
            // Save to server first
            const response = await fetch('/api/bookmarks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bookmark)
            });
            
            if (response.ok) {
                // Update local cache only after successful server save
                const savedBookmark = await response.json();
                this.bookmarks.push(savedBookmark);
                
                // Also update localStorage as backup
                this.saveToLocalStorage();
                
                return savedBookmark;
            } else {
                console.error('Error saving bookmark to server:', response.statusText);
                throw new Error('Failed to save bookmark');
            }
        } catch (error) {
            console.error('Error adding bookmark:', error);
            
            // Fallback to local storage only
            this.bookmarks.push(bookmark);
            this.saveToLocalStorage();
            
            return bookmark;
        }
    },
    
    // Remove a bookmark by ID
    async remove(id) {
        const initialLength = this.bookmarks.length;
        this.bookmarks = this.bookmarks.filter(b => b.id !== id);
        
        // If bookmark was found and removed, save the changes
        if (initialLength > this.bookmarks.length) {
            try {
                // Delete from server
                const response = await fetch(`/api/bookmarks/${id}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) {
                    console.error('Error deleting bookmark from server:', response.statusText);
                }
            } catch (error) {
                console.error('Error removing bookmark:', error);
            }
            
            // Update localStorage regardless of server response
            this.saveToLocalStorage();
            return true;
        }
        return false;
    },
    
    // Update an existing bookmark
    async update(id, updates) {
        const index = this.bookmarks.findIndex(b => b.id === id);
        if (index !== -1) {
            // Update fields but preserve ID and creation date
            const updatedBookmark = {
                ...this.bookmarks[index],
                ...updates,
                id: this.bookmarks[index].id,
                createdAt: this.bookmarks[index].createdAt,
                updatedAt: new Date().toISOString()
            };
            
            try {
                // Update on server
                const response = await fetch(`/api/bookmarks/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updatedBookmark)
                });
                
                if (!response.ok) {
                    console.error('Error updating bookmark on server:', response.statusText);
                }
            } catch (error) {
                console.error('Error updating bookmark:', error);
            }
            
            // Update local cache regardless of server response
            this.bookmarks[index] = updatedBookmark;
            this.saveToLocalStorage();
            return updatedBookmark;
        }
        return null;
    },
    
    // Find bookmark by ID
    findById(id) {
        return this.bookmarks.find(b => b.id === id);
    },
    
    // Search for bookmarks by location coordinates
    async searchByCoordinates(lat, lng, radiusInKm = 0.5) {
        try {
            const response = await fetch(`/api/bookmarks/search?lat=${lat}&lng=${lng}&radius=${radiusInKm}`);
            
            if (response.ok) {
                const results = await response.json();
                return results;
            } else {
                console.error('Error searching bookmarks by coordinates:', response.statusText);
                return [];
            }
        } catch (error) {
            console.error('Error searching bookmarks by coordinates:', error);
            
            // Fallback to local search
            return this.bookmarks.filter(bookmark => {
                if (!bookmark.position || !bookmark.position.lat || !bookmark.position.lng) {
                    return false;
                }
                
                // Calculate distance between points
                const distance = this.calculateDistance(
                    lat, lng, 
                    bookmark.position.lat, bookmark.position.lng
                );
                
                return distance <= radiusInKm;
            });
        }
    },
    
    // Calculate distance between two coordinates in kilometers (using Haversine formula)
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of the earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1); 
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        const d = R * c; // Distance in km
        return d;
    },
    
    deg2rad(deg) {
        return deg * (Math.PI/180);
    },
    
    // Save bookmarks to server storage
    async saveToStorage() {
        try {
            const response = await fetch('/api/bookmarks/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.bookmarks)
            });
            
            if (!response.ok) {
                console.error('Error saving bookmarks to server:', response.statusText);
            }
            
            // Always update localStorage as backup
            this.saveToLocalStorage();
        } catch (error) {
            console.error('Error saving bookmarks to server:', error);
            // Fallback to localStorage
            this.saveToLocalStorage();
        }
    },
    
    // Save bookmarks to localStorage as backup
    saveToLocalStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.bookmarks));
        } catch (error) {
            console.error('Error saving bookmarks to localStorage:', error);
        }
    },
    
    // Clear all bookmarks
    async clear() {
        try {
            const response = await fetch('/api/bookmarks', {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                console.error('Error clearing bookmarks from server:', response.statusText);
            }
        } catch (error) {
            console.error('Error clearing bookmarks:', error);
        }
        
        this.bookmarks = [];
        this.saveToLocalStorage();
    },
    
    // Create a bookmark entry from map state
    createFromMap(map, name, notes = '') {
        const center = map.getCenter();
        const zoom = map.getZoom();
        
        return {
            name: name || 'Unnamed Location',
            notes: notes,
            position: {
                lat: center.lat,
                lng: center.lng,
                zoom: zoom
            }
        };
    }
};

export default bookmarksManager;