class EnergyLookupApp {
    constructor() {
        // Get the hostname from the current page URL
        // If accessing via 192.168.0.236:8000, hostname will be 192.168.0.236
        // If accessing via localhost:8000, hostname will be localhost
        // If opened as file://, use localhost as fallback
        let currentHost = window.location.hostname;
        
        // Fallback for file:// protocol
        if (!currentHost || currentHost === '') {
            currentHost = 'localhost';
            console.warn('⚠️ No hostname detected (file:// protocol?). Using localhost.');
            console.warn('💡 For LAN access, serve via: python -m http.server 8000');
        }
        
        // API is always on port 5000
        this.apiUrl = `http://${currentHost}:5000/api`;
        
        console.log('📍 Current location:', window.location.href);
        console.log('🖥️  Hostname:', currentHost);
        console.log('🔗 API URL:', this.apiUrl);
        
        this.initElements();
        this.attachEventListeners();
        this.checkBackendHealth();
    }

    initElements() {
        this.postcodeInput = document.getElementById('postcode');
        this.searchBtn = document.getElementById('searchBtn');
        this.searchLoader = document.getElementById('searchLoader');
        this.addressSection = document.getElementById('addressSection');
        this.addressSelect = document.getElementById('address');
        this.resultsSection = document.getElementById('resultsSection');
        this.errorSection = document.getElementById('errorSection');
        this.errorMessage = document.getElementById('errorMessage');
        this.ratingBadge = document.getElementById('ratingBadge');
        this.ratingText = document.getElementById('ratingText');
        this.potentialRatingBadge = document.getElementById('potentialRatingBadge');
        this.potentialRatingText = document.getElementById('potentialRatingText');
        this.selectedAddress = document.getElementById('selectedAddress');
        this.selectedPostcode = document.getElementById('selectedPostcode');
        this.lodgementDate = document.getElementById('lodgementDate');
        this.recommendationsSection = document.getElementById('recommendationsSection');
        this.recommendationsList = document.getElementById('recommendationsList');
        this.noRecommendations = document.getElementById('noRecommendations');       
    }

    attachEventListeners() {
        this.searchBtn.addEventListener('click', () => this.handleSearch());
        this.postcodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });
        this.addressSelect.addEventListener('change', () => this.handleAddressSelect());
    }

    async checkBackendHealth() {
        try {
            console.log('🔍 Checking backend health at:', `${this.apiUrl}/health`);
            const response = await fetch(`${this.apiUrl}/health`);
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Backend connected:', data);
            } else {
                console.error('❌ Backend returned error:', response.status);
                this.showError(`Backend server error (HTTP ${response.status}). Please check backend.py is running.`);
            }
        } catch (error) {
            console.error('❌ Backend health check failed:', error);
            console.error('Expected API at:', this.apiUrl);
            this.showError(`Cannot connect to backend at ${this.apiUrl}. Please ensure:\n1. backend.py is running\n2. It's accessible at port 5000\n3. No firewall blocking the connection`);
        }
    }

    async handleSearch() {
        const postcode = this.postcodeInput.value.trim().toUpperCase();
        
        if (!postcode) {
            this.showError('Please enter a postcode');
            return;
        }

        this.hideError();
        this.hideResults();
        this.showLoading(true);

        try {
            const response = await fetch(`${this.apiUrl}/search?postcode=${encodeURIComponent(postcode)}`);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Search failed');
            }

            const data = await response.json();
            
            if (data.addresses.length === 0) {
                this.showError(`No properties found for postcode: ${postcode}`);
                this.hideAddressSection();
            } else {
                this.populateAddressDropdown(data.addresses, postcode);
                this.showAddressSection();
            }
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Search failed: ' + error.message);
            this.hideAddressSection();
        } finally {
            this.showLoading(false);
        }
    }

    async handleAddressSelect() {
        const address = this.addressSelect.value;
        const postcode = this.postcodeInput.value.trim().toUpperCase();

        if (!address) {
            this.hideResults();
            return;
        }

        this.hideError();

        try {
            const response = await fetch(
                `${this.apiUrl}/rating?postcode=${encodeURIComponent(postcode)}&address=${encodeURIComponent(address)}`
            );
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to get rating');
            }

            const data = await response.json();
            this.displayResults(data, address, postcode);
        } catch (error) {
            console.error('Rating lookup error:', error);
            this.showError('Failed to retrieve energy rating: ' + error.message);
        }
    }

    populateAddressDropdown(addresses, postcode) {
        this.addressSelect.innerHTML = '<option value="">Select an address...</option>';
        addresses.forEach(address => {
            const option = document.createElement('option');
            option.value = address;
            option.textContent = address;
            this.addressSelect.appendChild(option);
        });
        this.addressSelect.dataset.postcode = postcode;
        this.addressSelect.disabled = false;
    }

    displayResults(data, address, postcode) {
        console.log('📊 Received data from backend:', data);
        const colors = {
            'A': { bg: 'bg-green-600', text: 'Very Good' },
            'B': { bg: 'bg-green-500', text: 'Good' },
            'C': { bg: 'bg-lime-500', text: 'Fairly Good' },
            'D': { bg: 'bg-yellow-500', text: 'Average' },
            'E': { bg: 'bg-orange-500', text: 'Below Average' },
            'F': { bg: 'bg-red-500', text: 'Poor' },
            'G': { bg: 'bg-red-700', text: 'Very Poor' }
        };

        // Current Rating
        const currentRatingInfo = colors[data.rating] || { bg: 'bg-gray-500', text: 'Unknown' };
        this.ratingBadge.className = `w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-lg ${currentRatingInfo.bg}`;
        this.ratingBadge.textContent = data.rating || '?';
        this.ratingText.textContent = currentRatingInfo.text;

        // Potential Rating
        const potentialRatingInfo = colors[data.potential_rating] || { bg: 'bg-gray-500', text: 'Unknown' };
        this.potentialRatingBadge.className = `w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-lg ${potentialRatingInfo.bg}`;
        this.potentialRatingBadge.textContent = data.potential_rating || '?';
        this.potentialRatingText.textContent = potentialRatingInfo.text;

        // Address and Date
        this.selectedAddress.textContent = address;
        this.selectedPostcode.textContent = postcode;
        
        // Format date (assuming YYYY-MM-DD format from database)
        const date = new Date(data.lodgement_date);
        this.lodgementDate.textContent = date.toLocaleDateString('en-GB', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
        
        // Display recommendations
        this.displayRecommendations(data.recommendations);
        
        this.showResults();
    }

    displayRecommendations(recommendations) {
            if (!recommendations || recommendations.length === 0) {
                this.recommendationsList.innerHTML = '';
                this.noRecommendations.classList.remove('hidden');
                this.recommendationsSection.classList.remove('hidden');
                return;
            }

            this.noRecommendations.classList.add('hidden');
            
            this.recommendationsList.innerHTML = recommendations.map((rec, index) => `
                <div class="flex items-start gap-4 py-4 border-b border-green-100 last:border-0">
                    <div class="flex-shrink-0 w-8 text-gray-500 font-semibold text-base">
                        ${index + 1}.
                    </div>
                    <div class="flex-1">
                        <p class="text-gray-800 font-medium text-base mb-1.5">${rec.description}</p>
                        <p class="text-gray-600 text-sm">${rec.cost}</p>
                    </div>
                </div>
            `).join('');
            
            this.recommendationsSection.classList.remove('hidden');
        }

    showLoading(show) {
        if (show) {
            this.searchLoader.classList.remove('hidden');
            this.searchBtn.disabled = true;
        } else {
            this.searchLoader.classList.add('hidden');
            this.searchBtn.disabled = false;
        }
    }

    showAddressSection() {
        this.addressSection.classList.remove('hidden');
    }

    hideAddressSection() {
        this.addressSection.classList.add('hidden');
        this.addressSelect.innerHTML = '<option value="">Select an address...</option>';
        this.addressSelect.disabled = true;
    }

    showResults() {
        this.resultsSection.classList.remove('hidden');
    }

    hideResults() {
        this.resultsSection.classList.add('hidden');
        this.recommendationsSection.classList.add('hidden');
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorSection.classList.remove('hidden');
    }

    hideError() {
        this.errorSection.classList.add('hidden');
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new EnergyLookupApp();
});