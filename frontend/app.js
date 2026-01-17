// ============================================
// GLOBAL VARIABLES
// ============================================
let currentUser = null;
let currentUserId = null;
let isAdmin = false;

// Sample foods for initial setup
const sampleFoods = [
    {
        name: "Grilled Chicken Sandwich",
        imageUrl: "",
        calories: 350,
        protein: 25,
        carbs: 30,
        fat: 12,
        mealType: "lunch",
        availableDate: "2025-03-15",
        availableTime: "12:30",
        allergyWarnings: ["none"],
        nutrientsImportance: "High protein for muscle repair"
    },
    {
        name: "Greek Yogurt Parfait",
        imageUrl: "",
        calories: 280,
        protein: 15,
        carbs: 45,
        fat: 8,
        mealType: "breakfast",
        availableDate: "2025-03-15",
        availableTime: "08:00",
        allergyWarnings: ["dairy"],
        nutrientsImportance: "Calcium for bone health"
    }
];

// ============================================
// INITIALIZATION - RUNS WHEN PAGE LOADS
// ============================================
document.addEventListener('DOMContentLoaded', function () {
    console.log("DH-Commerce starting...");

    // Check if user is already logged in
    auth.onAuthStateChanged(async function (user) {
        if (user) {
            console.log("User is signed in:", user.email);
            currentUser = user;
            currentUserId = user.uid;

            try {
                // Get user data from Firestore
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    isAdmin = userData.isAdmin || false;

                    // Show/hide admin link
                    const adminLink = document.getElementById('admin-link');
                    if (adminLink) {
                        adminLink.style.display = isAdmin ? 'flex' : 'none';
                    }

                    // Set theme from user preference
                    if (userData.darkMode) {
                        document.documentElement.setAttribute('data-theme', 'dark');
                        const toggle = document.getElementById('dark-mode-toggle');
                        if (toggle) toggle.checked = true;
                    }

                    // Load initial user data
                    await loadUserProfile(user.uid);
                    await loadNotifications(user.uid);
                    await loadWeeklyHighlights();
                }

                // Show main app screen
                document.getElementById('auth-screen').classList.remove('active');
                document.getElementById('app-screen').classList.add('active');

                // Initialize sample foods if admin (first time)
                if (isAdmin) {
                    await initializeSampleFoods();
                }

            } catch (error) {
                console.error("Error loading user data:", error);
                showToast("Error loading your data", "error");
            }

        } else {
            console.log("No user signed in");
            // Show login screen
            document.getElementById('auth-screen').classList.add('active');
            document.getElementById('app-screen').classList.remove('active');
            currentUser = null;
            currentUserId = null;
            isAdmin = false;
        }
    });

    // Set up all event listeners
    initializeEventListeners();
});

// ============================================
// EVENT LISTENERS SETUP
// ============================================
function initializeEventListeners() {
    console.log("Setting up event listeners...");

    // Auth forms
    const signinForm = document.getElementById('signin-form');
    const signupForm = document.getElementById('signup-form');
    const forgotPassword = document.getElementById('forgot-password');

    if (signinForm) signinForm.addEventListener('submit', handleSignIn);
    if (signupForm) signupForm.addEventListener('submit', handleSignUp);
    if (forgotPassword) forgotPassword.addEventListener('click', handleForgotPassword);

    // Navigation
    document.querySelectorAll('.nav-link').forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const page = this.dataset.page;
            switchPage(page);
        });
    });

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) darkModeToggle.addEventListener('change', handleDarkModeToggle);

    // Notifications - Use bell icon in navbar
    const notificationIcon = document.querySelector('.notification-icon');
    if (notificationIcon) notificationIcon.addEventListener('click', toggleNotificationsPanel);

    const clearNotifications = document.getElementById('clear-notifications');
    if (clearNotifications) clearNotifications.addEventListener('click', clearAllNotifications);

    // Transaction tabs
    document.querySelectorAll('.trans-tab').forEach(function (tab) {
        tab.addEventListener('click', function (e) {
            const tabName = this.dataset.tab;
            switchTransactionTab(tabName);
        });
    });

    // Modal close
    const closeModals = document.querySelectorAll('.close-modal');
    closeModals.forEach(modal => {
        modal.addEventListener('click', function () {
            this.closest('.modal').classList.remove('active');
        });
    });

    // Profile edit
    const editProfileBtn = document.getElementById('edit-profile-btn');
    if (editProfileBtn) editProfileBtn.addEventListener('click', enableProfileEdit);

    const saveProfileBtn = document.getElementById('save-profile-btn');
    if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfile);

    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', cancelProfileEdit);

    const profileDescription = document.getElementById('profile-description');
    if (profileDescription) profileDescription.addEventListener('input', updateCharCount);

    const passwordForm = document.getElementById('password-form');
    if (passwordForm) passwordForm.addEventListener('submit', handlePasswordChange);

    // People search
    const peopleSearchBtn = document.getElementById('people-search-btn');
    const peopleSearchInput = document.getElementById('people-search');

    if (peopleSearchBtn) {
        peopleSearchBtn.addEventListener('click', () => {
            const searchTerm = peopleSearchInput.value;
            loadPeople(searchTerm);
        });
    }

    // Food filters
    const foodApplyBtn = document.getElementById('food-apply-btn');
    if (foodApplyBtn) foodApplyBtn.addEventListener('click', applyFoodFilters);

    // Food search
    const foodSearch = document.getElementById('food-search');
    if (foodSearch) foodSearch.addEventListener('input', function (e) {
        handleFoodSearch(e.target.value);
    });

    // Transaction filters
    const applyFilters = document.getElementById('apply-filters');
    const clearFilters = document.getElementById('clear-filters');
    const giveForm = document.getElementById('give-form');

    if (applyFilters) applyFilters.addEventListener('click', applyTransactionFilters);
    if (clearFilters) clearFilters.addEventListener('click', clearTransactionFilters);
    if (giveForm) giveForm.addEventListener('submit', handleGiveOffer);

    // Want type radio buttons
    document.querySelectorAll('input[name="want-type"]').forEach(function (radio) {
        radio.addEventListener('change', handleWantTypeChange);
    });

    // Mobile menu
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', function () {
        document.querySelector('.nav-links').classList.toggle('active');
    });

    // Send request button
    const sendRequestBtn = document.getElementById('send-request-btn');
    if (sendRequestBtn) sendRequestBtn.addEventListener('click', sendTradeRequest);

    // Admin functionality
    const adminMenuBtns = document.querySelectorAll('.admin-menu-btn');
    adminMenuBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const section = this.dataset.section;
            switchAdminSection(section);
        });
    });

    const addFoodBtn = document.getElementById('add-food-btn');
    if (addFoodBtn) addFoodBtn.addEventListener('click', openAddFoodModal);

    const addFoodForm = document.getElementById('add-food-form');
    if (addFoodForm) addFoodForm.addEventListener('submit', handleAddFood);

    // Set up admin food filters (FIXED)
    setupAdminFoodFilters();

    // Cancel buttons
    const cancelBtns = document.querySelectorAll('.cancel-btn');
    cancelBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            this.closest('.modal').classList.remove('active');
        });
    });

    // Close notifications when clicking outside
    window.addEventListener('click', function (e) {
        const panel = document.getElementById('notifications-panel');
        if (panel && panel.classList.contains('active') && !panel.contains(e.target)) {
            panel.classList.remove('active');
        }
    });

    // Auth tabs switching
    document.querySelectorAll('.tab-btn').forEach(function (tab) {
        tab.addEventListener('click', function () {
            const tabName = this.dataset.tab;
            switchAuthTab(tabName);
        });
    });
}

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================
async function handleSignIn(e) {
    e.preventDefault();
    console.log("=== SIGN IN DEBUG ===");

    const username = document.getElementById('signin-username').value;
    const password = document.getElementById('signin-password').value;

    console.log("Username:", username);
    console.log("Password:", password ? "***" : "empty");

    if (!username || !password) {
        console.log("ERROR: Missing fields");
        showToast('Please fill in all fields', 'error');
        return;
    }

    try {
        // Check if it's email format, if not, get email from database
        let email = username;
        if (!username.includes('@')) {
            // Try to find user by username
            const usersSnapshot = await db.collection('users')
                .where('username', '==', username)
                .limit(1)
                .get();

            if (!usersSnapshot.empty) {
                const userData = usersSnapshot.docs[0].data();
                email = userData.email;
            }
        }

        console.log("Attempting sign in with email:", email);

        console.log("Calling auth.signInWithEmailAndPassword...");
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log("SUCCESS! User signed in:", userCredential.user.uid);

        showToast('Signed in successfully!', 'success');

    } catch (error) {
        console.log("SIGN IN ERROR:", error);
        console.log("Error code:", error.code);
        console.log("Error message:", error.message);

        if (error.code === 'auth/user-not-found') {
            showToast('User not found. Please sign up first.', 'error');
        } else if (error.code === 'auth/wrong-password') {
            showToast('Incorrect password.', 'error');
        } else if (error.code === 'auth/invalid-email') {
            showToast('Invalid email format. Please enter your email or username.', 'error');
        } else {
            showToast('Error signing in: ' + error.message, 'error');
        }
    }
}

async function handleSignUp(e) {
    e.preventDefault();

    const fullName = document.getElementById('signup-fullname').value;
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const grade = document.getElementById('signup-grade').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm').value;

    // Validation
    if (password !== confirmPassword) {
        showToast('Passwords do not match!', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    try {
        // Create auth user
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const userId = userCredential.user.uid;

        // Create user document in Firestore
        await db.collection('users').doc(userId).set({
            fullName: fullName,
            username: username,
            email: email,
            grade: 'Grade ' + grade,
            description: 'Hello! I\'m a Grade ' + grade + ' student.',
            darkMode: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            isAdmin: false,
            tradesCompleted: 0,
            totalRating: 0,
            ratingCount: 0,
            averageRating: 0
        });

        // Send welcome email
        try {
            await fetch('https://ict-dh-commerce-project.onrender.com/api/send_welcome_email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    name: fullName,
                    username: username
                })
            });
        } catch (emailError) {
            console.log('Welcome email failed (backend might be offline)');
        }

        showToast('Account created successfully!', 'success');

        // Switch to sign in tab
        switchAuthTab('signin');
        document.getElementById('signin-username').value = email;
        document.getElementById('signup-form').reset();

    } catch (error) {
        console.error('Sign up error:', error);
        showToast('Error creating account: ' + error.message, 'error');
    }
}

function switchAuthTab(tabName) {
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(function (tab) {
        tab.classList.remove('active');
    });
    document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');

    // Show active tab content
    document.querySelectorAll('.tab-content').forEach(function (content) {
        content.classList.remove('active');
    });
    document.getElementById(tabName + '-tab').classList.add('active');
}

async function handleForgotPassword() {
    const username = prompt('Enter your email or username:');
    if (!username) return;

    try {
        let email = username;

        // Check if it's a username
        if (!username.includes('@')) {
            const usersSnapshot = await db.collection('users')
                .where('username', '==', username)
                .limit(1)
                .get();

            if (!usersSnapshot.empty) {
                const userData = usersSnapshot.docs[0].data();
                email = userData.email;
            }
        }

        await auth.sendPasswordResetEmail(email);
        showToast('Password reset email sent! Check your inbox.', 'success');
    } catch (error) {
        showToast('Error: Email/Username not found', 'error');
    }
}

async function handleLogout() {
    try {
        await auth.signOut();
        showToast('Logged out successfully', 'info');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// ============================================
// PAGE NAVIGATION
// ============================================
function switchPage(pageName) {
    console.log("Switching to page:", pageName);

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(function (link) {
        link.classList.remove('active');
    });
    document.querySelector('[data-page="' + pageName + '"]').classList.add('active');

    // Show selected page, hide others
    document.querySelectorAll('.page').forEach(function (page) {
        page.classList.remove('active');
    });

    const targetPage = document.getElementById(pageName + '-page');
    if (targetPage) {
        targetPage.classList.add('active');

        // Load page-specific data
        switch (pageName) {
            case 'home':
                loadWeeklyHighlights();
                break;
            case 'people':
                loadPeople();
                break;
            case 'food':
                loadFoods();
                break;
            case 'transaction':
                loadOffers();
                loadGiveFoods();
                loadUserOffers();
                loadUserTradeRequests();
                break;
            case 'profile':
                loadUserProfile(currentUserId);
                loadTradeHistory();
                break;
            case 'admin':
                if (isAdmin) {
                    loadAdminFoods();
                    loadAdminUsers();
                    loadAdminTrades();
                } else {
                    showToast('Access denied. Admin only.', 'error');
                    switchPage('home');
                }
                break;
        }
    }

    // Close notifications panel
    const notificationsPanel = document.getElementById('notifications-panel');
    if (notificationsPanel) {
        notificationsPanel.classList.remove('active');
    }

    // Close mobile menu if open
    const navLinks = document.querySelector('.nav-links');
    if (navLinks && navLinks.classList.contains('active')) {
        navLinks.classList.remove('active');
    }
}

// ============================================
// HELPER FUNCTIONS (REUSABLE)
// ============================================
function showToast(message, type) {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(function (toast) {
        toast.remove();
    });

    // Create toast
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = `
        <span>${message}</span>
        <button class="toast-close">&times;</button>
    `;

    // Add CSS for toast if not already present
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 600;
                z-index: 10000;
                display: flex;
                justify-content: space-between;
                align-items: center;
                min-width: 300px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                animation: slideIn 0.3s ease;
            }
            .toast-success { background: #28a745; }
            .toast-error { background: #dc3545; }
            .toast-info { background: #17a2b8; }
            .toast-close {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                margin-left: 15px;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(function () {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 5000);

    // Close button
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function () {
            toast.remove();
        });
    }
}

function generateStars(rating) {
    if (!rating || rating === 0) {
        return '<i class="far fa-star"></i><i class="far fa-star"></i><i class="far fa-star"></i><i class="far fa-star"></i><i class="far fa-star"></i>';
    }

    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;

    let stars = '';
    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="fas fa-star"></i>';
    }
    if (halfStar) {
        stars += '<i class="fas fa-star-half-alt"></i>';
    }
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="far fa-star"></i>';
    }

    return stars;
}

function formatDate(date) {
    if (!date) return 'Recently';

    if (date instanceof firebase.firestore.Timestamp) {
        date = date.toDate();
    }

    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return minutes + ' min ago';
    if (hours < 24) return hours + ' hour' + (hours > 1 ? 's' : '') + ' ago';
    if (days < 7) return days + ' day' + (days > 1 ? 's' : '') + ' ago';

    return date.toLocaleDateString();
}

// ============================================
// PEOPLE PAGE FUNCTIONS
// ============================================
async function loadPeople(searchTerm = '') {
    try {
        const snapshot = await db.collection('users').get();
        const peopleGrid = document.getElementById('people-grid');
        peopleGrid.innerHTML = '';

        let hasResults = false;

        snapshot.forEach(doc => {
            const user = doc.data();
            if (doc.id === currentUserId) return;

            // Apply search filter
            if (searchTerm &&
                !user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) &&
                !user.username.toLowerCase().includes(searchTerm.toLowerCase())) {
                return;
            }

            hasResults = true;

            const avgRating = user.ratingCount > 0 ?
                (user.totalRating / user.ratingCount).toFixed(1) : 'No ratings';

            const userCard = `
                <div class="user-card" data-userid="${doc.id}">
                    <div class="user-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <h3>${user.fullName}</h3>
                    <p class="user-grade">${user.grade}</p>
                    <p class="user-description">${user.description || 'No description'}</p>
                    <div class="user-rating">
                        <div class="stars">${generateStars(user.totalRating / user.ratingCount)}</div>
                        <span>${avgRating} (${user.ratingCount || 0} ratings)</span>
                    </div>
                    <div class="user-stats">
                        <span>${user.tradesCompleted || 0} trades</span>
                    </div>
                </div>
            `;

            peopleGrid.innerHTML += userCard;
        });

        if (!hasResults) {
            peopleGrid.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search fa-3x"></i>
                    <h3>No users found</h3>
                    <p>Try a different search term</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading people:', error);
        showToast('Error loading users', 'error');
    }
}

// ============================================
// FOOD PAGE FUNCTIONS
// ============================================
async function loadFoods(filters = {}) {
    try {
        let foodsRef = db.collection('foods');

        // Apply filters
        if (filters.mealType) {
            foodsRef = foodsRef.where('mealType', '==', filters.mealType);
        }

        const snapshot = await foodsRef.get();
        const foodGrid = document.getElementById('food-grid');
        foodGrid.innerHTML = '';

        let foods = [];
        snapshot.forEach(doc => {
            const food = doc.data();
            food.id = doc.id;
            foods.push(food);
        });

        // Apply search filter
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            foods = foods.filter(food =>
                food.name.toLowerCase().includes(searchTerm)
            );
        }

        if (foods.length === 0) {
            foodGrid.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-utensils fa-3x"></i>
                    <h3>No foods found</h3>
                    <p>Try adjusting your filters</p>
                </div>
            `;
            return;
        }

        foods.forEach(food => {
            const allergyTags = food.allergyWarnings && food.allergyWarnings[0] !== 'none' ?
                food.allergyWarnings.map(allergy =>
                    `<span class="allergy-tag">${allergy}</span>`
                ).join('') : '';

            const foodCard = `
                <div class="food-detail-card">
                    <div class="food-header">
                        <h3>${food.name}</h3>
                        <p>${food.mealType} • ${food.availableTime}</p>
                    </div>
                    <div class="nutrient-grid">
                        <div class="nutrient-item">
                            <span>Calories</span>
                            <strong>${food.calories}</strong>
                        </div>
                        <div class="nutrient-item">
                            <span>Protein</span>
                            <strong>${food.protein}g</strong>
                        </div>
                        <div class="nutrient-item">
                            <span>Carbs</span>
                            <strong>${food.carbs}g</strong>
                        </div>
                        <div class="nutrient-item">
                            <span>Fat</span>
                            <strong>${food.fat}g</strong>
                        </div>
                    </div>
                    <div class="food-info">
                        <p><strong>Importance:</strong> ${food.nutrientsImportance}</p>
                        <p><strong>Available:</strong> ${food.availableDate} at ${food.availableTime}</p>
                    </div>
                    ${allergyTags ? `
                    <div class="allergy-warnings">
                        <strong>Allergy Info:</strong>
                        ${allergyTags}
                    </div>
                    ` : ''}
                </div>
            `;

            foodGrid.innerHTML += foodCard;
        });
    } catch (error) {
        console.error('Error loading foods:', error);
        showToast('Error loading foods', 'error');
    }
}

function applyFoodFilters() {
    const mealType = document.getElementById('meal-filter').value;
    const searchTerm = document.getElementById('food-search').value;

    loadFoods({
        mealType: mealType || null,
        search: searchTerm || null
    });
}

function handleFoodSearch(searchTerm) {
    if (!searchTerm.trim()) {
        applyFoodFilters();
        return;
    }

    const mealType = document.getElementById('meal-filter').value;

    loadFoods({
        mealType: mealType || null,
        search: searchTerm
    });
}

// ============================================
// TRANSACTION FUNCTIONS
// ============================================
function switchTransactionTab(tabName) {
    document.querySelectorAll('.trans-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.trans-section').forEach(section => section.classList.remove('active'));

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-section`).classList.add('active');
}

async function loadOffers(filters = {}) {
    try {
        let offersRef = db.collection('transactions')
            .where('status', '==', 'pending');

        // Apply toUserId filter to only show public offers
        offersRef = offersRef.where('toUserId', '==', '');

        const snapshot = await offersRef.get();
        const offersGrid = document.getElementById('offers-grid');
        offersGrid.innerHTML = '';

        let offers = [];
        for (const doc of snapshot.docs) {
            const offer = doc.data();

            // Don't show your own offers
            if (offer.fromUserId === currentUserId) continue;

            // Get food details
            const offeredFoodDoc = await db.collection('foods').doc(offer.offeredFoodId).get();
            if (!offeredFoodDoc.exists) continue;

            const offeredFood = offeredFoodDoc.data();

            // Apply meal filter
            if (filters.meal && offeredFood.mealType !== filters.meal) continue;

            // Apply category filter
            if (filters.category) {
                if (filters.category === 'high-protein' && offeredFood.protein < 20) continue;
                if (filters.category === 'low-calorie' && offeredFood.calories > 300) continue;
                if (filters.category === 'vegetarian' && offeredFood.name.includes('Chicken')) continue;
            }

            offers.push({
                id: doc.id,
                offer: offer,
                food: offeredFood
            });
        }

        if (offers.length === 0) {
            offersGrid.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-exchange-alt fa-3x"></i>
                    <h3>No offers available</h3>
                    <p>Try adjusting filters or check back later</p>
                </div>
            `;
            return;
        }

        // Get user info for all offers
        for (const item of offers) {
            const userDoc = await db.collection('users').doc(item.offer.fromUserId).get();
            const user = userDoc.data();

            let wantedFood = { name: "Anything (Negotiate)" };
            if (item.offer.requestedFoodId !== 'all') {
                const wantedFoodDoc = await db.collection('foods').doc(item.offer.requestedFoodId).get();
                if (wantedFoodDoc.exists) {
                    wantedFood = wantedFoodDoc.data();
                }
            }

            const offerCard = `
                <div class="offer-card" data-offerid="${item.id}">
                    <div class="offer-header">
                        <span class="offerer">From: ${user.fullName} (${user.grade})</span>
                        <span class="status-badge status-available">Available</span>
                    </div>
                    <div class="offer-content">
                        <div class="offer-food">
                            <h4>You Receive:</h4>
                            <p><strong>${item.food.name}</strong></p>
                            <p>${item.food.calories} cal • ${item.food.mealType}</p>
                            <div class="nutrient-badges">
                                <span class="nutrient-badge">${item.food.protein}g protein</span>
                                <span class="nutrient-badge">${item.food.carbs}g carbs</span>
                            </div>
                        </div>
                        <div class="food-arrow">
                            <i class="fas fa-exchange-alt"></i>
                        </div>
                        <div class="receive-food">
                            <h4>They Want:</h4>
                            <p><strong>${wantedFood.name}</strong></p>
                            ${wantedFood.calories ? `<p>${wantedFood.calories} cal</p>` : ''}
                        </div>
                    </div>
                    <div class="offer-details">
                        <p><i class="far fa-clock"></i> ${item.offer.tradeTime} on ${item.offer.tradeDate}</p>
                        <p><i class="fas fa-map-marker-alt"></i> School Cafeteria</p>
                    </div>
                    <div class="offer-actions">
                        <button class="btn-primary request-btn" data-offerid="${item.id}">
                            <i class="fas fa-paper-plane"></i> Send Request
                        </button>
                    </div>
                </div>
            `;

            offersGrid.innerHTML += offerCard;
        }

        // Add event listeners to request buttons
        document.querySelectorAll('.request-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const offerId = e.target.closest('.request-btn').dataset.offerid;
                openRequestModal(offerId);
            });
        });
    } catch (error) {
        console.error('Error loading offers:', error);
        showToast('Error loading offers', 'error');
    }
}

function applyTransactionFilters() {
    const meal = document.getElementById('receive-meal').value;
    const category = document.getElementById('receive-category').value;

    loadOffers({
        meal: meal || null,
        category: category || null
    });
}

async function openRequestModal(offerId) {
    const modal = document.getElementById('request-modal');
    const offerDoc = await db.collection('transactions').doc(offerId).get();

    if (!offerDoc.exists) {
        showToast('Offer no longer available', 'error');
        return;
    }

    const offer = offerDoc.data();
    const offeredFoodDoc = await db.collection('foods').doc(offer.offeredFoodId).get();
    const offeredFood = offeredFoodDoc.data();

    document.getElementById('receive-food-details').innerHTML = `
        <p><strong>${offeredFood.name}</strong></p>
        <p>${offeredFood.calories} calories • ${offeredFood.mealType}</p>
        <p>Protein: ${offeredFood.protein}g • Carbs: ${offeredFood.carbs}g</p>
    `;

    // Load user's available foods
    await loadUserFoodsForOffer();

    modal.dataset.offerId = offerId;
    modal.dataset.sellerId = offer.fromUserId;
    modal.classList.add('active');
}

async function loadUserFoodsForOffer() {
    try {
        const snapshot = await db.collection('foods').get();
        const select = document.getElementById('offer-food-select');
        select.innerHTML = '<option value="">Select your food...</option>';

        snapshot.forEach(doc => {
            const food = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${food.name} (${food.calories} cal) - ${food.mealType}`;
            select.appendChild(option);
        });

        // Add change listener for preview
        select.addEventListener('change', async function () {
            const foodId = this.value;
            if (!foodId) {
                document.getElementById('selected-food-preview').innerHTML = '';
                return;
            }

            const foodDoc = await db.collection('foods').doc(foodId).get();
            if (foodDoc.exists) {
                const food = foodDoc.data();
                document.getElementById('selected-food-preview').innerHTML = `
                    <p><strong>${food.name}</strong></p>
                    <p>${food.calories} cal • ${food.protein}g protein</p>
                `;
            }
        });
    } catch (error) {
        console.error('Error loading foods for offer:', error);
    }
}

async function sendTradeRequest() {
    const modal = document.getElementById('request-modal');
    const offerId = modal.dataset.offerId;
    const sellerId = modal.dataset.sellerId;
    const foodId = document.getElementById('offer-food-select').value;

    if (!foodId) {
        showToast('Please select a food to offer', 'error');
        return;
    }

    try {
        const offerDoc = await db.collection('transactions').doc(offerId).get();
        const originalOffer = offerDoc.data();

        // Get food details
        const offeredFoodDoc = await db.collection('foods').doc(foodId).get();
        const offeredFood = offeredFoodDoc.data();

        const originalFoodDoc = await db.collection('foods').doc(originalOffer.offeredFoodId).get();
        const originalFood = originalFoodDoc.data();

        // Get user info
        const currentUserDoc = await db.collection('users').doc(currentUserId).get();
        const currentUserData = currentUserDoc.data();

        // Get seller info for email
        const sellerDoc = await db.collection('users').doc(sellerId).get();
        const sellerData = sellerDoc.data();

        // Create the trade request
        await db.collection('transactions').add({
            fromUserId: currentUserId,
            toUserId: sellerId,
            offeredFoodId: foodId,
            requestedFoodId: originalOffer.offeredFoodId,
            status: 'pending_request',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            tradeDate: originalOffer.tradeDate,
            tradeTime: originalOffer.tradeTime,
            reminderSent: false,
            ratingSent: false,
            parentOfferId: offerId,
            isRequest: true
        });

        // Create in-app notification
        await db.collection('notifications').add({
            userId: sellerId,
            type: 'trade_request',
            message: `${currentUserData.fullName} wants to trade ${offeredFood.name} for your ${originalFood.name}`,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            transactionId: offerId,
            fromUserId: currentUserId
        });

        // Send email notification
        try {
            await fetch('https://ict-dh-commerce-project.onrender.com/api/send_trade_request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to_email: sellerData.email,
                    from_user: currentUserData.fullName,
                    food_name: originalFood.name,
                    offer_food: offeredFood.name,
                    trade_time: originalOffer.tradeTime,
                    trade_date: originalOffer.tradeDate,
                    app_url: window.location.origin
                })
            });
        } catch (emailError) {
            console.log('Email sending failed (backend might be offline)');
        }

        showToast('Trade request sent! Seller has been notified.', 'success');
        modal.classList.remove('active');
        loadOffers();
        loadNotifications(currentUserId);

    } catch (error) {
        console.error('Error sending request:', error);
        showToast('Error sending request: ' + error.message, 'error');
    }
}

// ============================================
// GIVE SECTION FUNCTIONS
// ============================================
async function loadGiveFoods() {
    try {
        const snapshot = await db.collection('foods').get();
        const giveSelect = document.getElementById('give-food');
        const wantSelect = document.getElementById('want-food');

        giveSelect.innerHTML = '<option value="">Select a food...</option>';
        wantSelect.innerHTML = '<option value="">Select desired food...</option>';

        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'Anything (Negotiate later)';
        wantSelect.appendChild(allOption);

        snapshot.forEach(doc => {
            const food = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${food.name} (${food.calories} cal - ${food.mealType})`;

            giveSelect.appendChild(option.cloneNode(true));

            const wantOption = option.cloneNode(true);
            wantSelect.appendChild(wantOption);
        });

        // Add preview for selected food
        giveSelect.addEventListener('change', async function () {
            const foodId = this.value;
            const preview = document.getElementById('give-food-preview');

            if (!foodId) {
                preview.innerHTML = '';
                return;
            }

            const foodDoc = await db.collection('foods').doc(foodId).get();
            if (foodDoc.exists) {
                const food = foodDoc.data();
                preview.innerHTML = `
                    <div class="food-preview-card">
                        <h4>${food.name}</h4>
                        <p>${food.calories} calories • ${food.mealType}</p>
                        <p>Protein: ${food.protein}g • Carbs: ${food.carbs}g • Fat: ${food.fat}g</p>
                        <p><em>${food.nutrientsImportance}</em></p>
                    </div>
                `;
            }
        });
    } catch (error) {
        console.error('Error loading foods for give section:', error);
    }
}

function handleWantTypeChange(e) {
    const wantSelect = document.getElementById('want-food');
    if (e.target.value === 'specific') {
        wantSelect.disabled = false;
        wantSelect.value = '';
    } else {
        wantSelect.disabled = true;
        wantSelect.value = 'all';
    }
}

async function handleGiveOffer(e) {
    e.preventDefault();

    const giveFoodId = document.getElementById('give-food').value;
    const wantType = document.querySelector('input[name="want-type"]:checked').value;
    const wantFoodId = wantType === 'specific' ? document.getElementById('want-food').value : 'all';

    if (!giveFoodId) {
        showToast('Please select a food to give', 'error');
        return;
    }

    try {
        const foodDoc = await db.collection('foods').doc(giveFoodId).get();
        const food = foodDoc.data();

        // Create public offer
        await db.collection('transactions').add({
            fromUserId: currentUserId,
            toUserId: '',  // Empty for public offers
            offeredFoodId: giveFoodId,
            requestedFoodId: wantFoodId,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            tradeDate: food.availableDate,
            tradeTime: food.availableTime,
            reminderSent: false,
            ratingSent: false,
            isRequest: false
        });

        showToast('Offer posted successfully!', 'success');
        e.target.reset();
        document.getElementById('give-food-preview').innerHTML = '';
        loadUserOffers();
        loadOffers();

    } catch (error) {
        console.error('Error posting offer:', error);
        showToast('Error posting offer: ' + error.message, 'error');
    }
}

async function loadUserOffers() {
    try {
        const snapshot = await db.collection('transactions')
            .where('fromUserId', '==', currentUserId)
            .where('status', '==', 'pending')
            .where('toUserId', '==', '')  // Only public offers
            .get();

        const offersList = document.getElementById('user-offers-list');
        offersList.innerHTML = '';

        if (snapshot.empty) {
            offersList.innerHTML = `
                <div class="no-offers">
                    <p>You haven't posted any offers yet.</p>
                    <p>Use the form to create your first offer!</p>
                </div>
            `;
            return;
        }

        for (const doc of snapshot.docs) {
            const offer = doc.data();
            const foodDoc = await db.collection('foods').doc(offer.offeredFoodId).get();
            const food = foodDoc.data();

            let wantedFood = "Anything";
            if (offer.requestedFoodId !== 'all') {
                const wantedDoc = await db.collection('foods').doc(offer.requestedFoodId).get();
                wantedFood = wantedDoc.data().name;
            }

            const offerItem = `
                <div class="user-offer-item">
                    <div class="offer-info">
                        <p><strong>Giving:</strong> ${food.name} (${food.calories} cal)</p>
                        <p><strong>Want:</strong> ${wantedFood}</p>
                        <p><strong>Time:</strong> ${offer.tradeTime} on ${offer.tradeDate}</p>
                    </div>
                    <div class="offer-actions">
                        <button class="btn-secondary cancel-offer" data-offerid="${doc.id}">
                            Cancel Offer
                        </button>
                    </div>
                </div>
            `;

            offersList.innerHTML += offerItem;
        }

        document.querySelectorAll('.cancel-offer').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const offerId = e.target.dataset.offerid;
                cancelOffer(offerId);
            });
        });
    } catch (error) {
        console.error('Error loading user offers:', error);
    }
}

async function loadUserTradeRequests() {
    try {
        const snapshot = await db.collection('transactions')
            .where('toUserId', '==', currentUserId)
            .where('status', '==', 'pending_request')
            .get();

        const requestsContainer = document.getElementById('user-requests-list');
        if (!requestsContainer) return;

        requestsContainer.innerHTML = '';

        if (snapshot.empty) {
            requestsContainer.innerHTML = `
                <div class="no-requests">
                    <p>No pending trade requests.</p>
                </div>
            `;
            return;
        }

        for (const doc of snapshot.docs) {
            const request = doc.data();
            const buyerDoc = await db.collection('users').doc(request.fromUserId).get();
            const buyerData = buyerDoc.data();

            const offeredFoodDoc = await db.collection('foods').doc(request.offeredFoodId).get();
            const offeredFood = offeredFoodDoc.data();

            const requestedFoodDoc = await db.collection('foods').doc(request.requestedFoodId).get();
            const requestedFood = requestedFoodDoc.data();

            const requestItem = `
                <div class="trade-request-item" data-requestid="${doc.id}">
                    <div class="request-header">
                        <h4>Request from ${buyerData.fullName}</h4>
                        <span class="time">${formatDate(request.createdAt)}</span>
                    </div>
                    <div class="request-content">
                        <div class="trade-details">
                            <div class="trade-side">
                                <p><strong>You Give:</strong></p>
                                <p>${requestedFood.name} (${requestedFood.calories} cal)</p>
                            </div>
                            <div class="trade-arrow">
                                <i class="fas fa-exchange-alt"></i>
                            </div>
                            <div class="trade-side">
                                <p><strong>You Receive:</strong></p>
                                <p>${offeredFood.name} (${offeredFood.calories} cal)</p>
                            </div>
                        </div>
                        <div class="request-actions">
                            <button class="btn-primary accept-request" data-requestid="${doc.id}">
                                Accept
                            </button>
                            <button class="btn-secondary decline-request" data-requestid="${doc.id}">
                                Decline
                            </button>
                        </div>
                    </div>
                </div>
            `;

            requestsContainer.innerHTML += requestItem;
        }

        // Add event listeners
        document.querySelectorAll('.accept-request').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const requestId = e.target.dataset.requestid;
                await acceptTradeRequest(requestId);
            });
        });

        document.querySelectorAll('.decline-request').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const requestId = e.target.dataset.requestid;
                await declineTradeRequest(requestId);
            });
        });

    } catch (error) {
        console.error('Error loading trade requests:', error);
    }
}

async function acceptTradeRequest(requestId) {
    try {
        const requestDoc = await db.collection('transactions').doc(requestId).get();
        const request = requestDoc.data();

        // Update request status
        await db.collection('transactions').doc(requestId).update({
            status: 'accepted'
        });

        // Update original offer status
        if (request.parentOfferId) {
            await db.collection('transactions').doc(request.parentOfferId).update({
                status: 'taken'
            });
        }

        // Create acceptance notification for buyer
        const currentUserDoc = await db.collection('users').doc(currentUserId).get();
        const currentUserData = currentUserDoc.data();

        await db.collection('notifications').add({
            userId: request.fromUserId,
            type: 'trade_accepted',
            message: `${currentUserData.fullName} accepted your trade request`,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Send acceptance email
        try {
            const buyerDoc = await db.collection('users').doc(request.fromUserId).get();
            const buyerData = buyerDoc.data();

            const requestedFoodDoc = await db.collection('foods').doc(request.requestedFoodId).get();
            const requestedFood = requestedFoodDoc.data();

            await fetch('https://ict-dh-commerce-project.onrender.com/api/send_trade_accepted', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to_email: buyerData.email,
                    from_user: currentUserData.fullName,
                    food_name: requestedFood.name,
                    trade_time: request.tradeTime,
                    trade_date: request.tradeDate,
                    app_url: window.location.origin
                })
            });
        } catch (emailError) {
            console.log('Acceptance email failed');
        }

        showToast('Trade accepted! Both parties notified.', 'success');

        // Update UI
        loadUserTradeRequests();
        loadOffers();
        loadUserOffers();
        loadNotifications(currentUserId);

    } catch (error) {
        console.error('Error accepting trade:', error);
        showToast('Error accepting trade', 'error');
    }
}

async function declineTradeRequest(requestId) {
    const reason = prompt('Please provide a reason for declining (optional):');

    try {
        const requestDoc = await db.collection('transactions').doc(requestId).get();
        const request = requestDoc.data();

        // Update request status with reason
        await db.collection('transactions').doc(requestId).update({
            status: 'declined',
            declineReason: reason || 'No reason provided'
        });

        // Create decline notification
        const currentUserDoc = await db.collection('users').doc(currentUserId).get();
        const currentUserData = currentUserDoc.data();

        await db.collection('notifications').add({
            userId: request.fromUserId,
            type: 'trade_declined',
            message: `${currentUserData.fullName} declined your trade request${reason ? ': ' + reason : ''}`,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Send decline email with reason
        try {
            const buyerDoc = await db.collection('users').doc(request.fromUserId).get();
            const buyerData = buyerDoc.data();

            await fetch('https://ict-dh-commerce-project.onrender.com/api/send_trade_declined', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to_email: buyerData.email,
                    from_user: currentUserData.fullName,
                    reason: reason || 'No reason provided',
                    app_url: window.location.origin
                })
            });
        } catch (emailError) {
            console.log('Decline email failed');
        }

        showToast('Trade request declined', 'info');

        // Update UI
        loadUserTradeRequests();
        loadNotifications(currentUserId);

    } catch (error) {
        console.error('Error declining trade:', error);
        showToast('Error declining trade', 'error');
    }
}

async function cancelOffer(offerId) {
    if (confirm('Are you sure you want to cancel this offer?')) {
        try {
            await db.collection('transactions').doc(offerId).update({
                status: 'cancelled'
            });
            showToast('Offer cancelled', 'info');
            loadUserOffers();
            loadOffers();
        } catch (error) {
            showToast('Error cancelling offer', 'error');
        }
    }
}

// ============================================
// NOTIFICATION FUNCTIONS
// ============================================
async function loadNotifications(userId) {
    try {
        const snapshot = await db.collection('notifications')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();

        const notificationsList = document.getElementById('notifications-list');
        const unreadCount = snapshot.docs.filter(doc => !doc.data().read).length;

        // Update notification icon
        const notificationIcon = document.querySelector('.notification-icon');
        if (notificationIcon) {
            const countBadge = notificationIcon.querySelector('.notification-count') ||
                document.createElement('span');
            if (!notificationIcon.querySelector('.notification-count')) {
                countBadge.className = 'notification-count';
                notificationIcon.appendChild(countBadge);
            }

            if (unreadCount > 0) {
                countBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                countBadge.style.display = 'flex';
            } else {
                countBadge.style.display = 'none';
            }
        }

        notificationsList.innerHTML = '';

        if (snapshot.empty) {
            notificationsList.innerHTML = `
                <div class="no-notifications">
                    <i class="fas fa-bell-slash fa-2x"></i>
                    <p>No notifications yet</p>
                </div>
            `;
            return;
        }

        snapshot.forEach(doc => {
            const notif = doc.data();
            const notificationItem = `
                <div class="notification-item ${notif.read ? '' : 'unread'}" 
                     data-notifid="${doc.id}" 
                     data-type="${notif.type || 'info'}">
                    <div class="notification-content">
                        <p class="notification-message">${notif.message}</p>
                        <small class="notification-time">${formatDate(notif.createdAt)}</small>
                    </div>
                    ${!notif.read ? '<span class="unread-dot"></span>' : ''}
                </div>
            `;
            notificationsList.innerHTML += notificationItem;
        });

    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

function toggleNotificationsPanel() {
    const panel = document.getElementById('notifications-panel');
    panel.classList.toggle('active');

    // Mark all as read when opening
    if (panel.classList.contains('active') && currentUserId) {
        markAllNotificationsAsRead();
    }
}

async function markAllNotificationsAsRead() {
    try {
        const snapshot = await db.collection('notifications')
            .where('userId', '==', currentUserId)
            .where('read', '==', false)
            .get();

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });

        await batch.commit();
        loadNotifications(currentUserId);

    } catch (error) {
        console.error('Error marking notifications as read:', error);
    }
}

async function clearAllNotifications() {
    try {
        const snapshot = await db.collection('notifications')
            .where('userId', '==', currentUserId)
            .get();

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        loadNotifications(currentUserId);
        showToast('Notifications cleared', 'info');

    } catch (error) {
        showToast('Error clearing notifications', 'error');
    }
}

// ============================================
// PROFILE FUNCTIONS
// ============================================
async function loadUserProfile(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();

            // Update profile page
            document.getElementById('profile-name').textContent = userData.fullName;
            document.getElementById('profile-fullname').value = userData.fullName;
            document.getElementById('profile-username').value = userData.username;
            document.getElementById('profile-email').value = userData.email;
            document.getElementById('profile-grade-select').value = parseInt(userData.grade.split(' ')[1]);
            document.getElementById('profile-description').value = userData.description || '';
            document.getElementById('profile-grade').textContent = userData.grade;

            // Update stats
            const avgRating = userData.ratingCount > 0 ?
                (userData.totalRating / userData.ratingCount).toFixed(1) : '0.0';

            document.getElementById('trades-count').textContent = userData.tradesCompleted || 0;
            document.getElementById('rating-count').textContent = userData.ratingCount || 0;
            document.getElementById('average-rating').textContent = avgRating;

            // Update stars
            updateStars('.profile-card .stars', avgRating);
            updateCharCount();
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function loadTradeHistory() {
    try {
        const response = await fetch(`https://ict-dh-commerce-project.onrender.com/api/trade-history/${currentUserId}`);
        const data = await response.json();

        const historyList = document.getElementById('trade-history');
        historyList.innerHTML = '';

        if (!data.success || data.count === 0) {
            historyList.innerHTML = `
                <div class="history-item">
                    <p><strong>Your trade history will appear here</strong></p>
                    <p><small>Complete your first trade to see history</small></p>
                </div>
            `;
            return;
        }

        data.history.forEach(trade => {
            const historyItem = `
                <div class="history-item">
                    <div class="trade-header">
                        <strong>${trade.direction === 'sent' ? 'You offered to' : 'You received from'} ${trade.otherUser || 'Unknown'}</strong>
                        <span class="trade-status">${trade.status}</span>
                    </div>
                    <div class="trade-details">
                        <p><strong>Date:</strong> ${trade.tradeDate} at ${trade.tradeTime}</p>
                        ${trade.offeredFood ? `<p><strong>Food:</strong> ${trade.offeredFood.name}</p>` : ''}
                    </div>
                    <div class="trade-time">${formatDate(trade.createdAt)}</div>
                </div>
            `;
            historyList.innerHTML += historyItem;
        });
    } catch (error) {
        console.error('Error loading trade history:', error);
        const historyList = document.getElementById('trade-history');
        historyList.innerHTML = `
            <div class="history-item">
                <p><strong>Error loading trade history</strong></p>
                <p><small>Please try again later</small></p>
            </div>
        `;
    }
}

function enableProfileEdit() {
    const inputs = document.querySelectorAll('#profile-form input, #profile-form select, #profile-form textarea');
    inputs.forEach(input => input.disabled = false);

    document.getElementById('save-profile-btn').style.display = 'block';
    document.getElementById('cancel-edit-btn').style.display = 'block';
    document.getElementById('edit-profile-btn').style.display = 'none';
}

function cancelProfileEdit() {
    const inputs = document.querySelectorAll('#profile-form input, #profile-form select, #profile-form textarea');
    inputs.forEach(input => input.disabled = true);

    document.getElementById('save-profile-btn').style.display = 'none';
    document.getElementById('cancel-edit-btn').style.display = 'none';
    document.getElementById('edit-profile-btn').style.display = 'block';

    loadUserProfile(currentUserId);
}

async function saveProfile() {
    const fullName = document.getElementById('profile-fullname').value;
    const username = document.getElementById('profile-username').value;
    const email = document.getElementById('profile-email').value;
    const grade = `Grade ${document.getElementById('profile-grade-select').value}`;
    const description = document.getElementById('profile-description').value;

    try {
        await db.collection('users').doc(currentUserId).update({
            fullName,
            username,
            email,
            grade,
            description
        });

        showToast('Profile updated!', 'success');
        cancelProfileEdit();
    } catch (error) {
        showToast('Error updating profile', 'error');
    }
}

async function handlePasswordChange(e) {
    e.preventDefault();

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;

    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match!', 'error');
        return;
    }

    try {
        // Reauthenticate
        const credential = firebase.auth.EmailAuthProvider.credential(
            currentUser.email,
            currentPassword
        );
        await currentUser.reauthenticateWithCredential(credential);

        // Update password
        await currentUser.updatePassword(newPassword);

        showToast('Password updated!', 'success');
        e.target.reset();
    } catch (error) {
        showToast('Current password is incorrect', 'error');
    }
}

function updateCharCount() {
    const textarea = document.getElementById('profile-description');
    const count = textarea.value.length;
    document.getElementById('char-count').textContent = count;
}

// ============================================
// ADMIN FUNCTIONS - FIXED
// ============================================
function switchAdminSection(sectionName) {
    document.querySelectorAll('.admin-menu-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(section => section.classList.remove('active'));

    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
    document.getElementById(`admin-${sectionName}`).classList.add('active');
}

async function loadAdminFoods() {
    if (!isAdmin) return;

    try {
        const response = await fetch('https://ict-dh-commerce-project.onrender.com/api/admin/foods', {
            headers: {
                'Authorization': 'admin-secret-key'
            }
        });
        const data = await response.json();

        const foodsList = document.getElementById('admin-foods-list');
        foodsList.innerHTML = '';

        if (!data.success || data.count === 0) {
            foodsList.innerHTML = `
                <tr>
                    <td colspan="8" class="no-data">No foods found</td>
                </tr>
            `;
            return;
        }

        data.foods.forEach(food => {
            const foodRow = `
                <tr>
                    <td>${food.name}</td>
                    <td>${food.calories}</td>
                    <td>${food.protein}g</td>
                    <td>${food.carbs}g</td>
                    <td>${food.fat}g</td>
                    <td><span class="meal-badge ${food.mealType}">${food.mealType}</span></td>
                    <td>${food.availableTime}</td>
                    <td class="action-buttons">
                        <button class="btn-secondary btn-sm edit-food" data-id="${food.id}">Edit</button>
                        <button class="btn-danger btn-sm delete-food" data-id="${food.id}">Delete</button>
                    </td>
                </tr>
            `;
            foodsList.innerHTML += foodRow;
        });

        // Add event listeners for edit/delete buttons
        document.querySelectorAll('.edit-food').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const foodId = e.target.dataset.id;
                editFood(foodId);
            });
        });

        document.querySelectorAll('.delete-food').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const foodId = e.target.dataset.id;
                deleteFood(foodId);
            });
        });

    } catch (error) {
        console.error('Error loading admin foods:', error);
        showToast('Error loading foods', 'error');
    }
}

// FIXED: Admin food search and filter
function setupAdminFoodFilters() {
    const adminFoodSearch = document.getElementById('admin-food-search');
    const adminMealFilter = document.getElementById('admin-meal-filter');
    const adminRefreshFoods = document.getElementById('admin-refresh-foods');

    if (adminFoodSearch) {
        adminFoodSearch.addEventListener('input', debounce((e) => {
            filterAdminFoods(e.target.value, adminMealFilter.value);
        }, 300));
    }

    if (adminMealFilter) {
        adminMealFilter.addEventListener('change', () => {
            filterAdminFoods(adminFoodSearch.value, adminMealFilter.value);
        });
    }

    if (adminRefreshFoods) {
        adminRefreshFoods.addEventListener('click', () => {
            adminFoodSearch.value = '';
            adminMealFilter.value = '';
            loadAdminFoods();
        });
    }
}

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function filterAdminFoods(searchTerm = '', mealType = '') {
    try {
        const response = await fetch('https://ict-dh-commerce-project.onrender.com/api/admin/foods', {
            headers: {
                'Authorization': 'admin-secret-key'
            }
        });
        const data = await response.json();

        if (!data.success) {
            showToast('Error loading foods', 'error');
            return;
        }

        const foodsList = document.getElementById('admin-foods-list');
        foodsList.innerHTML = '';

        let filteredFoods = data.foods || [];

        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredFoods = filteredFoods.filter(food =>
                food.name.toLowerCase().includes(term) ||
                (food.nutrientsImportance && food.nutrientsImportance.toLowerCase().includes(term))
            );
        }

        // Apply meal type filter
        if (mealType) {
            filteredFoods = filteredFoods.filter(food => food.mealType === mealType);
        }

        if (filteredFoods.length === 0) {
            foodsList.innerHTML = `
                <tr>
                    <td colspan="8" class="no-data">No foods found matching your criteria</td>
                </tr>
            `;
            return;
        }

        filteredFoods.forEach(food => {
            const foodRow = `
                <tr>
                    <td>${food.name}</td>
                    <td>${food.calories}</td>
                    <td>${food.protein}g</td>
                    <td>${food.carbs}g</td>
                    <td>${food.fat}g</td>
                    <td><span class="meal-badge ${food.mealType}">${food.mealType}</span></td>
                    <td>${food.availableTime}</td>
                    <td class="action-buttons">
                        <button class="btn-secondary btn-sm edit-food" data-id="${food.id}">Edit</button>
                        <button class="btn-danger btn-sm delete-food" data-id="${food.id}">Delete</button>
                    </td>
                </tr>
            `;
            foodsList.innerHTML += foodRow;
        });

        // Reattach event listeners for edit/delete buttons
        document.querySelectorAll('.edit-food').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const foodId = e.target.dataset.id;
                editFood(foodId);
            });
        });

        document.querySelectorAll('.delete-food').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const foodId = e.target.dataset.id;
                deleteFood(foodId);
            });
        });

    } catch (error) {
        console.error('Error filtering foods:', error);
        showToast('Error filtering foods', 'error');
    }
}

async function editFood(foodId) {
    try {
        // First, get the food data
        const response = await fetch('https://ict-dh-commerce-project.onrender.com/api/admin/foods', {
            headers: {
                'Authorization': 'admin-secret-key'
            }
        });
        const data = await response.json();

        if (!data.success) {
            showToast('Error loading food data', 'error');
            return;
        }

        const food = data.foods.find(f => f.id === foodId);
        if (!food) {
            showToast('Food not found', 'error');
            return;
        }

        // Open edit modal with prefilled data
        openEditFoodModal(food);
    } catch (error) {
        console.error('Error loading food for editing:', error);
        showToast('Error loading food data', 'error');
    }
}

function openEditFoodModal(food) {
    // Create or get edit modal
    let editModal = document.getElementById('edit-food-modal');
    if (!editModal) {
        editModal = document.createElement('div');
        editModal.id = 'edit-food-modal';
        editModal.className = 'modal';
        editModal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <h3>Edit Food</h3>
                <form id="edit-food-form">
                    <input type="hidden" id="edit-food-id" value="${food.id}">
                    <div class="form-group">
                        <label>Food Name</label>
                        <input type="text" id="edit-food-name" value="${food.name}" required>
                    </div>
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Calories</label>
                            <input type="number" id="edit-food-calories" value="${food.calories}" required>
                        </div>
                        <div class="form-group">
                            <label>Protein (g)</label>
                            <input type="number" id="edit-food-protein" value="${food.protein}" required>
                        </div>
                        <div class="form-group">
                            <label>Carbs (g)</label>
                            <input type="number" id="edit-food-carbs" value="${food.carbs}" required>
                        </div>
                        <div class="form-group">
                            <label>Fat (g)</label>
                            <input type="number" id="edit-food-fat" value="${food.fat}" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Meal Type</label>
                        <select id="edit-food-meal-type" required>
                            <option value="breakfast" ${food.mealType === 'breakfast' ? 'selected' : ''}>Breakfast</option>
                            <option value="lunch" ${food.mealType === 'lunch' ? 'selected' : ''}>Lunch</option>
                            <option value="dinner" ${food.mealType === 'dinner' ? 'selected' : ''}>Dinner</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Available Time</label>
                        <input type="time" id="edit-food-available-time" value="${food.availableTime}" required>
                    </div>
                    <div class="form-group">
                        <label>Allergy Warnings (comma separated)</label>
                        <input type="text" id="edit-food-allergies" value="${food.allergyWarnings && food.allergyWarnings[0] !== 'none' ? food.allergyWarnings.join(', ') : ''}" placeholder="dairy, nuts, gluten">
                    </div>
                    <div class="form-group">
                        <label>Nutrient Importance</label>
                        <textarea id="edit-food-importance" rows="3">${food.nutrientsImportance || ''}</textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Update Food</button>
                        <button type="button" class="btn-secondary cancel-edit-btn">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(editModal);

        // Add event listeners for the new modal
        editModal.querySelector('.close-modal').addEventListener('click', () => {
            editModal.classList.remove('active');
        });

        editModal.querySelector('.cancel-edit-btn').addEventListener('click', () => {
            editModal.classList.remove('active');
        });

        editModal.querySelector('#edit-food-form').addEventListener('submit', handleUpdateFood);
    } else {
        // Update modal with new food data
        document.getElementById('edit-food-id').value = food.id;
        document.getElementById('edit-food-name').value = food.name;
        document.getElementById('edit-food-calories').value = food.calories;
        document.getElementById('edit-food-protein').value = food.protein;
        document.getElementById('edit-food-carbs').value = food.carbs;
        document.getElementById('edit-food-fat').value = food.fat;
        document.getElementById('edit-food-meal-type').value = food.mealType;
        document.getElementById('edit-food-available-time').value = food.availableTime;
        document.getElementById('edit-food-allergies').value = food.allergyWarnings && food.allergyWarnings[0] !== 'none' ?
            food.allergyWarnings.join(', ') : '';
        document.getElementById('edit-food-importance').value = food.nutrientsImportance || '';
    }

    editModal.classList.add('active');
}

async function handleUpdateFood(e) {
    e.preventDefault();

    const foodId = document.getElementById('edit-food-id').value;
    const foodData = {
        name: document.getElementById('edit-food-name').value,
        calories: parseInt(document.getElementById('edit-food-calories').value),
        protein: parseInt(document.getElementById('edit-food-protein').value),
        carbs: parseInt(document.getElementById('edit-food-carbs').value),
        fat: parseInt(document.getElementById('edit-food-fat').value),
        mealType: document.getElementById('edit-food-meal-type').value,
        availableTime: document.getElementById('edit-food-available-time').value,
        allergyWarnings: document.getElementById('edit-food-allergies').value ?
            document.getElementById('edit-food-allergies').value.split(',').map(a => a.trim()) : ['none'],
        nutrientsImportance: document.getElementById('edit-food-importance').value || 'Provides essential nutrients'
    };

    try {
        const response = await fetch('https://ict-dh-commerce-project.onrender.com/api/admin/foods', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'admin-secret-key'
            },
            body: JSON.stringify({
                id: foodId,
                data: foodData
            })
        });

        const result = await response.json();

        if (result.success) {
            showToast('Food updated successfully!', 'success');
            document.getElementById('edit-food-modal').classList.remove('active');
            loadAdminFoods();
            loadFoods(); // Refresh public food page
        } else {
            showToast('Error updating food: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error updating food:', error);
        showToast('Error updating food', 'error');
    }
}

async function deleteFood(foodId) {
    if (confirm('Are you sure you want to delete this food item? This action cannot be undone.')) {
        try {
            const response = await fetch('https://ict-dh-commerce-project.onrender.com/api/admin/foods', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'admin-secret-key'
                },
                body: JSON.stringify({ id: foodId })
            });

            const result = await response.json();

            if (result.success) {
                showToast('Food deleted successfully!', 'success');
                loadAdminFoods();
                loadFoods(); // Refresh public food page
            } else {
                showToast('Error deleting food: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Error deleting food:', error);
            showToast('Error deleting food', 'error');
        }
    }
}

async function loadAdminUsers() {
    if (!isAdmin) return;

    try {
        const snapshot = await db.collection('users').get();
        const usersList = document.getElementById('admin-users-list');
        usersList.innerHTML = '';

        snapshot.forEach(doc => {
            const user = doc.data();
            const userCard = `
                <div class="admin-user-card">
                    <div class="user-info">
                        <h4>${user.fullName}</h4>
                        <p>${user.username} • ${user.email}</p>
                        <p>${user.grade} • ${user.tradesCompleted || 0} trades</p>
                    </div>
                    <div class="user-actions">
                        <span class="admin-badge ${user.isAdmin ? 'admin' : 'user'}">
                            ${user.isAdmin ? 'Admin' : 'User'}
                        </span>
                        <button class="btn-secondary btn-sm toggle-admin" data-id="${doc.id}" data-admin="${user.isAdmin}">
                            ${user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                        </button>
                    </div>
                </div>
            `;
            usersList.innerHTML += userCard;
        });

        // Add event listeners for toggle admin buttons
        document.querySelectorAll('.toggle-admin').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const userId = e.target.dataset.id;
                const isCurrentlyAdmin = e.target.dataset.admin === 'true';
                await toggleAdminStatus(userId, !isCurrentlyAdmin);
            });
        });

    } catch (error) {
        console.error('Error loading admin users:', error);
    }
}

async function loadAdminTrades() {
    if (!isAdmin) return;

    try {
        const snapshot = await db.collection('transactions').get();
        const tradesList = document.getElementById('admin-trades-list');
        tradesList.innerHTML = '';

        for (const doc of snapshot.docs) {
            const trade = doc.data();

            // Get user names
            const fromUserDoc = await db.collection('users').doc(trade.fromUserId).get();
            const toUserDoc = await db.collection('users').doc(trade.toUserId).get();

            const fromUserName = fromUserDoc.exists ? fromUserDoc.data().fullName : 'Unknown';
            const toUserName = toUserDoc.exists ? toUserDoc.data().fullName : 'Unknown';

            // Get food names
            const offeredFoodDoc = await db.collection('foods').doc(trade.offeredFoodId).get();
            const requestedFoodDoc = trade.requestedFoodId !== 'all' ?
                await db.collection('foods').doc(trade.requestedFoodId).get() : null;

            const offeredFoodName = offeredFoodDoc.exists ? offeredFoodDoc.data().name : 'Unknown';
            const requestedFoodName = requestedFoodDoc && requestedFoodDoc.exists ?
                requestedFoodDoc.data().name : 'Anything';

            const tradeCard = `
                <div class="admin-trade-card">
                    <div class="trade-header">
                        <strong>${fromUserName} → ${toUserName}</strong>
                        <span class="trade-status ${trade.status}">${trade.status}</span>
                    </div>
                    <div class="trade-details">
                        <p><strong>Trade:</strong> ${offeredFoodName} for ${requestedFoodName}</p>
                        <p><strong>Time:</strong> ${trade.tradeDate} at ${trade.tradeTime}</p>
                        <p><strong>Created:</strong> ${formatDate(trade.createdAt)}</p>
                    </div>
                </div>
            `;
            tradesList.innerHTML += tradeCard;
        }

    } catch (error) {
        console.error('Error loading admin trades:', error);
    }
}

function openAddFoodModal() {
    document.getElementById('add-food-modal').classList.add('active');
}

async function handleAddFood(e) {
    e.preventDefault();

    const foodData = {
        name: document.getElementById('food-name').value,
        calories: parseInt(document.getElementById('food-calories').value),
        protein: parseInt(document.getElementById('food-protein').value),
        carbs: parseInt(document.getElementById('food-carbs').value),
        fat: parseInt(document.getElementById('food-fat').value),
        mealType: document.getElementById('food-meal-type').value,
        availableTime: document.getElementById('food-available-time').value,
        availableDate: new Date().toISOString().split('T')[0],
        allergyWarnings: document.getElementById('food-allergies').value ?
            document.getElementById('food-allergies').value.split(',').map(a => a.trim()) : ['none'],
        nutrientsImportance: document.getElementById('food-importance').value || 'Provides essential nutrients'
    };

    try {
        const response = await fetch('https://ict-dh-commerce-project.onrender.com/api/admin/foods', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'admin-secret-key'
            },
            body: JSON.stringify(foodData)
        });

        const result = await response.json();

        if (result.success) {
            showToast('Food added successfully!', 'success');
            document.getElementById('add-food-form').reset();
            document.getElementById('add-food-modal').classList.remove('active');
            loadAdminFoods();
            loadFoods(); // Refresh public food page
        } else {
            showToast('Error adding food: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error adding food:', error);
        showToast('Error adding food', 'error');
    }
}

async function toggleAdminStatus(userId, makeAdmin) {
    try {
        await db.collection('users').doc(userId).update({
            isAdmin: makeAdmin
        });

        showToast(`User ${makeAdmin ? 'made admin' : 'removed from admin'} successfully`, 'success');
        loadAdminUsers();
    } catch (error) {
        console.error('Error toggling admin status:', error);
        showToast('Error updating admin status', 'error');
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function clearTransactionFilters() {
    document.getElementById('receive-meal').value = '';
    document.getElementById('receive-category').value = '';
    loadOffers();
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);

    // Update icon
    const icon = document.getElementById('theme-toggle').querySelector('i');
    icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

    // Save to database if logged in
    if (currentUserId) {
        db.collection('users').doc(currentUserId).update({
            darkMode: newTheme === 'dark'
        });
    }
}

function handleDarkModeToggle(e) {
    const newTheme = e.target.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);

    if (currentUserId) {
        db.collection('users').doc(currentUserId).update({
            darkMode: e.target.checked
        });
    }
}

// ============================================
// DATA INITIALIZATION
// ============================================
async function initializeSampleFoods() {
    try {
        const snapshot = await db.collection('foods').limit(1).get();
        if (snapshot.empty) {
            // Add sample foods
            const batch = db.batch();
            sampleFoods.forEach(food => {
                const ref = db.collection('foods').doc();
                batch.set(ref, food);
            });
            await batch.commit();
            console.log('Sample foods added');
        }
    } catch (error) {
        console.error('Error adding sample foods:', error);
    }
}

async function loadWeeklyHighlights() {
    try {
        const highlightsGrid = document.getElementById('weekly-highlights');
        highlightsGrid.innerHTML = `
            <div class="food-card">
                <div class="food-img">
                    <i class="fas fa-utensils fa-3x"></i>
                </div>
                <div class="food-info">
                    <h4>Most Traded This Week</h4>
                    <p>Check the Food section for details</p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading highlights:', error);
    }
}

function updateStars(selector, rating) {
    const starsContainer = document.querySelector(selector);
    if (starsContainer) {
        starsContainer.innerHTML = generateStars(parseFloat(rating));
    }
}

// Initialize when page loads
window.onload = function () {
    if (window.location.hash) {
        const page = window.location.hash.substring(1);
        switchPage(page);
    }
};
