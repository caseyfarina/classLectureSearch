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
            keys: [
                { name: 'title', weight: 2 },
                { name: 'course', weight: 1 },
                { name: 'formatted_date', weight: 1 },
                { name: 'search_text', weight: 3 }
            ],
            threshold: 0.3,  // Stricter matching (was 0.4)
            includeScore: true,
            includeMatches: true,
            minMatchCharLength: 3,  // Require at least 3 characters (was 2)
            ignoreLocation: true,
            distance: 100  // Limit how far apart matched characters can be
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
        results = allChapters.map(chapter => ({ item: chapter, query: '', matches: [] }));
    } else {
        // Perform fuzzy search
        const searchResults = fuse.search(query);
        results = searchResults.map(result => ({
            item: result.item,
            query: query,
            matches: result.matches || []
        }));
    }

    // Filter by enabled courses
    results = results.filter(result => enabledCourses.includes(result.item.course));

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

    resultsDiv.innerHTML = results.map(result => createResultHTML(result.item, result.query, result.matches)).join('');
}

// Extract excerpt using Fuse.js match indices
function extractExcerptFromMatches(text, matches, maxLength = 200) {
    if (!matches || matches.length === 0 || !text) return null;

    // Find the first match position to center the excerpt around
    const firstMatchStart = matches[0][0];

    // Calculate excerpt boundaries (centered on first match)
    const contextBefore = 60;
    const contextAfter = maxLength - contextBefore;

    const start = Math.max(0, firstMatchStart - contextBefore);
    const end = Math.min(text.length, firstMatchStart + contextAfter);

    // Extract the excerpt
    let excerpt = text.substring(start, end);

    // Adjust match indices relative to excerpt start
    const adjustedMatches = matches
        .map(([matchStart, matchEnd]) => [matchStart - start, matchEnd - start + 1])
        .filter(([matchStart, matchEnd]) => matchStart >= 0 && matchEnd <= excerpt.length);

    // Add ellipsis
    if (start > 0) excerpt = '...' + excerpt;
    if (end < text.length) excerpt = excerpt + '...';

    // Escape HTML
    const escapedExcerpt = escapeHtml(excerpt);

    // Highlight matches using indices
    // Process matches in reverse to maintain correct positions
    let highlighted = escapedExcerpt;
    const ellipsisOffset = start > 0 ? 3 : 0; // Account for "..." at start

    for (let i = adjustedMatches.length - 1; i >= 0; i--) {
        let [matchStart, matchEnd] = adjustedMatches[i];
        matchStart += ellipsisOffset;
        matchEnd += ellipsisOffset;

        // Extract the matched text
        const before = highlighted.substring(0, matchStart);
        const match = highlighted.substring(matchStart, matchEnd);
        const after = highlighted.substring(matchEnd);

        highlighted = before + '<mark>' + match + '</mark>' + after;
    }

    return highlighted;
}

// Find matching excerpt from Fuse.js matches
function findMatchingExcerpt(transcriptSegment, matches, chapter) {
    if (!matches || !transcriptSegment) return null;

    // Try to find matches in transcript_segment first (most accurate)
    let transcriptMatches = matches.find(m => m.key === 'transcript_segment');

    // If not found, try search_text field
    if (!transcriptMatches) {
        transcriptMatches = matches.find(m => m.key === 'search_text');

        // If match is in search_text, need to offset indices
        // search_text = course + date + title + transcript_segment
        if (transcriptMatches && chapter) {
            const prefix = `${chapter.course} ${chapter.formatted_date} ${chapter.title} `;
            const offset = prefix.length;

            // Adjust indices to be relative to transcript_segment
            const adjustedIndices = transcriptMatches.indices
                .map(([start, end]) => [start - offset, end - offset])
                .filter(([start, end]) => start >= 0 && end <= transcriptSegment.length);

            if (adjustedIndices.length > 0) {
                return extractExcerptFromMatches(transcriptSegment, adjustedIndices);
            }
        }
    }

    if (!transcriptMatches || !transcriptMatches.indices || transcriptMatches.indices.length === 0) {
        return null;
    }

    return extractExcerptFromMatches(transcriptSegment, transcriptMatches.indices);
}

// Escape regex special characters
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Create HTML for a single result
function createResultHTML(chapter, query = '', matches = []) {
    const courseLower = chapter.course.toLowerCase();
    const videoLink = chapter.video_id
        ? `https://www.youtube.com/watch?v=${chapter.video_id}&t=${chapter.seconds}s`
        : '#';

    const linkDisabled = !chapter.video_id;

    // Find matching excerpt from transcript using Fuse.js match indices
    const excerpt = matches && matches.length > 0
        ? findMatchingExcerpt(chapter.transcript_segment, matches, chapter)
        : null;

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
