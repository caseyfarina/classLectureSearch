// Lecture Search Application
let allChapters = [];
let fuse = null;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const resultsDiv = document.getElementById('results');
const statsDiv = document.getElementById('stats');
const filterAVC185 = document.getElementById('filterAVC185');
const filterAVC200 = document.getElementById('filterAVC200');
const filterAVC240 = document.getElementById('filterAVC240');

// Load chapter data
async function loadChapters() {
    try {
        const response = await fetch('chapters.json');
        allChapters = await response.json();

        // Initialize Fuse.js for fuzzy search
        fuse = new Fuse(allChapters, {
            keys: ['title', 'course', 'formatted_date', 'search_text'],
            threshold: 0.4,
            includeScore: true,
            minMatchCharLength: 2
        });

        // Display initial results (all chapters)
        displayResults(allChapters);

        // Update stats
        updateStats(allChapters.length, allChapters.length);

    } catch (error) {
        resultsDiv.innerHTML = `
            <div class="no-results">
                <h3>Error Loading Data</h3>
                <p>Could not load lecture chapters. Please try again later.</p>
                <p style="color: #999; font-size: 0.9rem; margin-top: 1rem;">${error.message}</p>
            </div>
        `;
    }
}

// Search function
function performSearch() {
    const query = searchInput.value.trim();
    const enabledCourses = getEnabledCourses();

    let results;

    if (query === '') {
        // No search query - show all (filtered by course)
        results = allChapters;
    } else {
        // Perform fuzzy search
        const searchResults = fuse.search(query);
        results = searchResults.map(result => result.item);
    }

    // Filter by enabled courses
    results = results.filter(chapter => enabledCourses.includes(chapter.course));

    // Display results
    displayResults(results);

    // Update stats
    updateStats(results.length, allChapters.length);
}

// Get enabled courses from checkboxes
function getEnabledCourses() {
    const courses = [];
    if (filterAVC185.checked) courses.push('AVC185');
    if (filterAVC200.checked) courses.push('AVC200');
    if (filterAVC240.checked) courses.push('AVC240');
    return courses;
}

// Display results
function displayResults(results) {
    if (results.length === 0) {
        resultsDiv.innerHTML = `
            <div class="no-results">
                <h3>No Results Found</h3>
                <p>Try a different search term or adjust your filters.</p>
            </div>
        `;
        return;
    }

    resultsDiv.innerHTML = results.map(chapter => createResultHTML(chapter)).join('');
}

// Create HTML for a single result
function createResultHTML(chapter) {
    const courseLower = chapter.course.toLowerCase();
    const videoLink = chapter.video_id
        ? `https://www.youtube.com/watch?v=${chapter.video_id}&t=${chapter.seconds}s`
        : '#';

    const linkDisabled = !chapter.video_id;

    return `
        <div class="result-item">
            <div class="result-header">
                <span class="course-badge ${courseLower}">${chapter.course}</span>
                <span class="result-date">${chapter.formatted_date}</span>
            </div>
            <div class="result-title">${escapeHtml(chapter.title)}</div>
            ${linkDisabled
                ? `<span style="color: #999; font-size: 0.9rem;">Video link not available</span>`
                : `<a href="${videoLink}" class="result-link" target="_blank" rel="noopener">
                    <span class="timestamp">${chapter.timestamp}</span>
                    <span>Watch in YouTube</span>
                </a>`
            }
        </div>
    `;
}

// Update stats display
function updateStats(shown, total) {
    const query = searchInput.value.trim();
    const enabledCourses = getEnabledCourses();

    if (query === '' && enabledCourses.length === 3) {
        statsDiv.innerHTML = `Showing all <strong>${total}</strong> chapters`;
    } else if (query === '') {
        statsDiv.innerHTML = `Showing <strong>${shown}</strong> of <strong>${total}</strong> chapters (filtered by course)`;
    } else {
        statsDiv.innerHTML = `Found <strong>${shown}</strong> results for "${escapeHtml(query)}"`;
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event Listeners
searchButton.addEventListener('click', performSearch);

searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        performSearch();
    }
});

// Real-time search as user types (with debounce)
let searchTimeout;
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(performSearch, 300);
});

// Filter changes
filterAVC185.addEventListener('change', performSearch);
filterAVC200.addEventListener('change', performSearch);
filterAVC240.addEventListener('change', performSearch);

// Initialize
loadChapters();
