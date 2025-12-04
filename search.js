// Lecture Search Application - Using MiniSearch
let allChapters = [];
let miniSearch = null;

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

        // Add unique ID to each chapter for MiniSearch
        allChapters = allChapters.map((chapter, index) => ({
            ...chapter,
            id: index
        }));

        // Initialize MiniSearch
        miniSearch = new MiniSearch({
            fields: ['title', 'transcript_segment', 'course', 'formatted_date'],
            storeFields: ['course', 'date', 'formatted_date', 'sort_date', 'timestamp', 'seconds', 'title', 'video_id', 'transcript_segment', 'thumbnail'],
            searchOptions: {
                boost: { title: 3, transcript_segment: 1 },
                prefix: true,  // Enable prefix matching ("rend" matches "render")
                fuzzy: 0.2     // Light fuzzy matching for typos only
            }
        });

        // Index all chapters
        miniSearch.addAll(allChapters);

        // Display initial results (all chapters)
        displayResults(allChapters.map(ch => ({ item: ch, query: '' })));

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
        results = allChapters
            .filter(chapter => enabledCourses.includes(chapter.course))
            .map(chapter => ({ item: chapter, query: '' }));
    } else {
        // Perform MiniSearch
        const searchResults = miniSearch.search(query, {
            filter: (result) => enabledCourses.includes(result.course)
        });

        results = searchResults.map(result => ({
            item: result,
            query: query
        }));
    }

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

    resultsDiv.innerHTML = results.map(result => createResultHTML(result.item, result.query)).join('');
}

// Highlight search terms in text
function highlightTerms(text, query) {
    if (!query || !text) return escapeHtml(text);

    // Split query into words and escape for regex
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    if (terms.length === 0) return escapeHtml(text);

    // Escape HTML first
    let result = escapeHtml(text);

    // Create pattern that matches whole words or prefixes
    for (const term of terms) {
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Match word boundaries - the term at start of word
        const pattern = new RegExp(`(\\b${escapedTerm}\\w*)`, 'gi');
        result = result.replace(pattern, '<mark>$1</mark>');
    }

    return result;
}

// Extract excerpt around matching terms
function extractExcerpt(text, query, maxLength = 200) {
    if (!text) return null;
    if (!query) return null;

    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    if (terms.length === 0) return null;

    const lowerText = text.toLowerCase();

    // Find the first matching term
    let firstMatchIndex = -1;
    for (const term of terms) {
        const idx = lowerText.indexOf(term);
        if (idx !== -1 && (firstMatchIndex === -1 || idx < firstMatchIndex)) {
            firstMatchIndex = idx;
        }
    }

    if (firstMatchIndex === -1) return null;

    // Calculate excerpt boundaries centered on match
    const contextBefore = 60;
    const start = Math.max(0, firstMatchIndex - contextBefore);
    const end = Math.min(text.length, start + maxLength);

    let excerpt = text.substring(start, end);

    // Add ellipsis
    if (start > 0) excerpt = '...' + excerpt;
    if (end < text.length) excerpt = excerpt + '...';

    // Highlight the terms
    return highlightTerms(excerpt, query);
}

// Create HTML for a single result
function createResultHTML(chapter, query = '') {
    const courseLower = chapter.course.toLowerCase();
    const videoLink = chapter.video_id
        ? `https://www.youtube.com/watch?v=${chapter.video_id}&t=${chapter.seconds}s`
        : '#';

    const linkDisabled = !chapter.video_id;

    // Extract and highlight excerpt from transcript
    const excerpt = query ? extractExcerpt(chapter.transcript_segment, query) : null;

    // Thumbnail HTML
    const thumbnailHTML = chapter.thumbnail
        ? `<img src="${chapter.thumbnail}" alt="Chapter thumbnail" class="result-thumbnail" loading="lazy">`
        : '';

    return `
        <div class="result-item">
            ${thumbnailHTML}
            <div class="result-content">
                <div class="result-header">
                    <span class="course-badge ${courseLower}">${chapter.course}</span>
                    <span class="result-date">${chapter.formatted_date}</span>
                </div>
                <div class="result-title">${escapeHtml(chapter.title)}</div>
                ${excerpt ? `<div class="result-excerpt">${excerpt}</div>` : ''}
                ${linkDisabled
                    ? `<span style="color: #999; font-size: 0.9rem;">Video link not available</span>`
                    : `<a href="${videoLink}" class="result-link" target="_blank" rel="noopener">
                        <span class="timestamp">${chapter.timestamp}</span>
                        <span>Watch in YouTube</span>
                    </a>`
                }
            </div>
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
