/**
 * Content Dashboard v2 — Frontend Application v4.0
 * Vanilla JS — no build step needed.
 * Features: Tags/Categories, Reminders, Content Calendar, Dynamic Analytics,
 *           Status Duplication, Full Export, Sort by updated_at, Tag Filtering,
 *           Content Ideas & Status section with comprehensive tag support.
 */

const API = "/api/v1";

// ===== State =====
let chartInstances = {};
let currentCalendarDate = new Date();
let contentCalendarDate = new Date();
let allMedia = [];
let allStatusDefs = [];
let searchTimeout = null;
let analyticsEnabled = true;

// ===== URL-based Navigation (path routing) =====
// Pages accessible via: /dashboard, /media, /links, /status-tracking, etc.

const KNOWN_PAGES = ["dashboard", "media", "links", "status-tracking", "status-mgmt",
    "content-calendar", "reminders", "analytics", "reports", "statistics", "tasks", "import-history"];

function navigateToPage(page, pushState = true) {
    document.querySelectorAll(".nav-item").forEach((i) => i.classList.remove("active"));
    const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navItem) {
        navItem.classList.add("active");
        document.getElementById("pageTitle").textContent = navItem.textContent.trim();
    }

    document.querySelectorAll(".content-area").forEach((p) => (p.style.display = "none"));
    const el = document.getElementById("page-" + page);
    if (el) el.style.display = "block";

    // Update URL path using History API (clean URLs, no hash)
    if (pushState) {
        const newPath = `/${page}`;
        if (window.location.pathname !== newPath) {
            history.pushState({ page }, "", newPath);
        }
    }

    switch (page) {
        case "dashboard": loadDashboard(); break;
        case "media": loadMediaPage(); break;
        case "links": loadLinks(); break;
        case "status-tracking": loadStatuses(); break;
        case "status-mgmt": loadStatusDefs(); break;
        case "content-calendar": loadContentCalendar(); break;
        case "reminders": loadReminders(); break;
        case "analytics": loadAnalytics(); break;
        case "reports": loadReport(); break;
        case "statistics": loadStatistics(); break;
        case "tasks": loadTasks(); renderCalendar(); break;
        case "import-history": loadImportHistory(); break;
    }
}

function getPageFromURL() {
    // Check path-based routing: /media, /links, etc.
    const path = window.location.pathname.replace(/^\//, ""); // strip leading /
    if (path && KNOWN_PAGES.includes(path)) {
        return path;
    }
    // Fallback: support legacy hash URLs for backward compatibility
    const hash = window.location.hash;
    if (hash && hash.startsWith("#/")) {
        const hashPage = hash.substring(2);
        if (KNOWN_PAGES.includes(hashPage)) return hashPage;
    }
    return null;
}

// Listen for browser back/forward navigation
window.addEventListener("popstate", (e) => {
    const page = (e.state && e.state.page) || getPageFromURL() || "dashboard";
    navigateToPage(page, false);
});

// Sidebar click handlers
document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
        const page = item.dataset.page;
        if (page === "api-docs") {
            window.open("/docs", "_blank");
            return;
        }
        navigateToPage(page);
    });
});

// ===== Toast =====
function toast(msg, type = "success") {
    const container = document.getElementById("toasts");
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

// ===== API helpers =====
async function api(path, opts = {}) {
    const res = await fetch(API + path, {
        headers: { "Content-Type": "application/json", ...opts.headers },
        ...opts,
    });
    if (res.status === 204) return null;
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || res.statusText);
    }
    return res.json();
}

function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function renderTags(tagsStr) {
    if (!tagsStr) return "";
    return tagsStr.split(",").map(t => t.trim()).filter(Boolean)
        .map(t => `<span class="badge badge-planned" style="font-size:.65rem;padding:2px 6px">${escapeHtml(t)}</span>`).join(" ");
}

// ===== Global Search =====
function handleSearch(event) {
    if (event.key === "Enter") {
        const query = document.getElementById("globalSearch").value.trim();
        if (query) searchMedia(query);
    }
}

async function searchMedia(query) {
    try {
        const data = await api(`/media/?search=${encodeURIComponent(query)}&page_size=50`);
        document.querySelectorAll(".nav-item").forEach((i) => i.classList.remove("active"));
        document.querySelector('[data-page="dashboard"]').classList.add("active");
        document.querySelectorAll(".content-area").forEach((p) => (p.style.display = "none"));
        document.getElementById("page-dashboard").style.display = "block";
        document.getElementById("pageTitle").textContent = `Search: "${query}"`;
        renderMediaTable(data.items, "recentMediaTable");
    } catch (e) {
        toast("Search failed: " + e.message, "error");
    }
}

// ===== Load All Media (for dropdowns) =====
async function loadAllMedia() {
    try {
        const data = await api("/media/?page_size=500");
        allMedia = data.items || [];
    } catch (_) {
        allMedia = [];
    }
}

// ===== Load Status Definitions (for dynamic dropdowns) =====
async function loadStatusDefinitions(context) {
    try {
        const params = context ? `?context=${context}` : "";
        const items = await api(`/status-definitions/${params}`);
        allStatusDefs = items || [];
    } catch (_) {
        allStatusDefs = [];
    }
}

function populateStatusDropdown(selectId, context) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const currentVal = sel.value;
    const filtered = allStatusDefs.filter(d =>
        d.usage_context === "all" || d.usage_context === context
    );
    sel.innerHTML = filtered.map(d =>
        `<option value="${escapeHtml(d.name)}">${escapeHtml(d.label)}</option>`
    ).join("");
    if (currentVal && [...sel.options].some(o => o.value === currentVal)) {
        sel.value = currentVal;
    }
}

function populateStatusFilterDropdown(selectId, context) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const currentVal = sel.value;
    const filtered = allStatusDefs.filter(d =>
        d.usage_context === "all" || d.usage_context === context
    );
    sel.innerHTML = '<option value="">All Statuses</option>' +
        filtered.map(d =>
            `<option value="${escapeHtml(d.name)}">${escapeHtml(d.label)}</option>`
        ).join("");
    if (currentVal && [...sel.options].some(o => o.value === currentVal)) {
        sel.value = currentVal;
    }
}

function populateMediaDropdown(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">-- None --</option>';
    allMedia.forEach((m) => {
        sel.innerHTML += `<option value="${m.id}">${escapeHtml(m.media_name)} (${m.media_category})</option>`;
    });
}

// ===== DASHBOARD =====
async function loadDashboard() {
    try {
        const categoryFilter = document.getElementById("dashboardCategoryFilter")?.value || "";
        const dataFilter = document.getElementById("dashboardDataFilter")?.value || "all";
        let statsParams = categoryFilter ? `?media_category=${categoryFilter}` : "";
        const stats = await api(`/dashboard/stats${statsParams}`);

        let statsHtml = "";
        if (dataFilter === "all" || dataFilter === "media") {
            statsHtml += `
                <div class="stat-card"><div class="label">Total Media</div><div class="value">${stats.total_media || 0}</div></div>
                <div class="stat-card"><div class="label">Movies</div><div class="value" style="color:var(--info)">${stats.total_movies || 0}</div></div>
                <div class="stat-card"><div class="label">Web Series</div><div class="value" style="color:var(--purple)">${stats.total_webseries || 0}</div></div>
                <div class="stat-card"><div class="label">Shows</div><div class="value" style="color:var(--warning)">${stats.total_shows || 0}</div></div>
                <div class="stat-card"><div class="label">Music</div><div class="value" style="color:var(--success)">${stats.total_music || 0}</div></div>
            `;
        }
        if (dataFilter === "all" || dataFilter === "links") {
            statsHtml += `<div class="stat-card"><div class="label">Total Links</div><div class="value">${stats.total_links || 0}</div></div>`;
        }
        if (dataFilter === "all" || dataFilter === "status") {
            const totalStatus = Object.values(stats.status_distribution || {}).reduce((a, b) => a + b, 0);
            statsHtml += `<div class="stat-card"><div class="label">Total Status</div><div class="value">${totalStatus}</div></div>`;
        }
        document.getElementById("dashboardStats").innerHTML = statsHtml;

        const catLabels = Object.keys(stats.category_distribution || {});
        const catValues = Object.values(stats.category_distribution || {});
        renderChart("categoryChart", "doughnut", {
            labels: catLabels.length ? catLabels : ["No Data"],
            datasets: [{ data: catValues.length ? catValues : [1], backgroundColor: catLabels.length ? ["#3b82f6", "#8b5cf6", "#f59e0b", "#22c55e", "#ef4444"] : ["#e2e8f0"] }],
        });

        const statusLabels = Object.keys(stats.status_distribution || {});
        const statusValues = Object.values(stats.status_distribution || {});
        renderChart("statusChart", "bar", {
            labels: statusLabels.length ? statusLabels : ["No Data"],
            datasets: [{ label: "Count", data: statusValues.length ? statusValues : [0], backgroundColor: "#3b82f6", borderRadius: 4 }],
        });

        let recentParams = "?page_size=10";
        if (categoryFilter) recentParams += `&media_category=${categoryFilter}`;
        const recent = await api(`/media/${recentParams}`);
        renderMediaTable(recent.items, "recentMediaTable");
    } catch (e) {
        console.error("[Dashboard]", e);
        toast("Failed to load dashboard: " + e.message, "error");
    }
}

// ===== MEDIA PAGE =====
async function loadMediaPage() {
    try {
        const category = document.getElementById("mediaCategoryFilter").value;
        const search = document.getElementById("mediaSearchInput").value.trim();
        const tags = document.getElementById("mediaTagsFilter")?.value.trim() || "";
        let params = "?page_size=50";
        if (category) params += `&media_category=${category}`;
        if (search) params += `&search=${encodeURIComponent(search)}`;
        if (tags) params += `&tags=${encodeURIComponent(tags)}`;
        const data = await api(`/media/${params}`);
        renderMediaTable(data.items, "mediaTable");
    } catch (e) {
        toast("Failed to load media: " + e.message, "error");
    }
}

function handleMediaSearch(event) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadMediaPage(), 300);
}

function renderMediaTable(items, containerId) {
    const container = document.getElementById(containerId);
    if (!items || !items.length) {
        container.innerHTML = `<div class="empty-state"><div class="icon">📂</div><p>No media content found.</p></div>`;
        return;
    }
    container.innerHTML = `
        <table>
            <thead><tr><th>Name</th><th>Category</th><th>Genre</th><th>Tags</th><th>Rating</th><th>Release Date</th><th>Available</th><th>Actions</th></tr></thead>
            <tbody>
                ${items.map((r) => {
                    const isAvail = r.is_available === "true";
                    return `<tr>
                    <td><strong>${escapeHtml(r.media_name)}</strong></td>
                    <td><span class="badge badge-proceed">${escapeHtml(r.media_category)}</span></td>
                    <td>${escapeHtml(r.genre || "—")}</td>
                    <td>${renderTags(r.tags)}</td>
                    <td>${r.rating != null ? `⭐ ${r.rating}` : "—"}</td>
                    <td>${r.release_date || "—"}</td>
                    <td>${isAvail ? `<span class="badge badge-proceed">✅ ${escapeHtml(r.available_on || "Yes")}</span>` : `<span class="badge badge-stopped">❌ No</span>`}</td>
                    <td>
                        <button class="btn-outline" style="padding:4px 10px;font-size:.72rem" onclick='editMedia(${JSON.stringify(r).replace(/'/g, "&#39;")})'>✏️</button>
                        <button class="btn-danger" style="padding:4px 10px;font-size:.72rem" onclick="deleteMedia(${r.id})">🗑</button>
                    </td>
                </tr>`;
                }).join("")}
            </tbody>
        </table>
    `;
}

// Media Modal
function openMediaModal() {
    document.getElementById("mediaEditId").value = "";
    document.getElementById("fMediaCategory").value = document.getElementById("mediaCategoryFilter")?.value || "movies";
    document.getElementById("fMediaName").value = "";
    document.getElementById("fReleaseDate").value = "";
    document.getElementById("fRating").value = "";
    document.getElementById("fGenre").value = "";
    document.getElementById("fDirector").value = "";
    document.getElementById("fCast").value = "";
    document.getElementById("fMediaTags").value = "";
    document.getElementById("fReview").value = "";
    document.getElementById("fIsAvailable").checked = false;
    document.getElementById("fAvailableOn").value = "";
    document.getElementById("availableOnGroup").style.display = "none";
    document.getElementById("mediaModalTitle").textContent = "Add Media";
    document.getElementById("mediaModal").classList.add("open");
}

function closeMediaModal() { document.getElementById("mediaModal").classList.remove("open"); }

function toggleAvailableOn() {
    const checked = document.getElementById("fIsAvailable").checked;
    document.getElementById("availableOnGroup").style.display = checked ? "block" : "none";
    if (!checked) document.getElementById("fAvailableOn").value = "";
}

function editAvailableOn() {
    const input = document.getElementById("fAvailableOn");
    input.focus();
    input.select();
}

function editMedia(item) {
    document.getElementById("mediaEditId").value = item.id;
    document.getElementById("fMediaCategory").value = item.media_category;
    document.getElementById("fMediaName").value = item.media_name;
    document.getElementById("fReleaseDate").value = item.release_date || "";
    document.getElementById("fRating").value = item.rating || "";
    document.getElementById("fGenre").value = item.genre || "";
    document.getElementById("fDirector").value = item.director || "";
    document.getElementById("fCast").value = item.cast_members || "";
    document.getElementById("fMediaTags").value = item.tags || "";
    document.getElementById("fReview").value = item.review || "";
    const isAvail = item.is_available === "true";
    document.getElementById("fIsAvailable").checked = isAvail;
    document.getElementById("fAvailableOn").value = item.available_on || "";
    document.getElementById("availableOnGroup").style.display = isAvail ? "block" : "none";
    document.getElementById("mediaModalTitle").textContent = "Edit Media";
    document.getElementById("mediaModal").classList.add("open");
}

async function saveMedia() {
    const id = document.getElementById("mediaEditId").value;
    const isAvailable = document.getElementById("fIsAvailable").checked;
    const payload = {
        media_category: document.getElementById("fMediaCategory").value,
        media_name: document.getElementById("fMediaName").value.trim(),
        release_date: document.getElementById("fReleaseDate").value || null,
        rating: document.getElementById("fRating").value ? parseFloat(document.getElementById("fRating").value) : null,
        genre: document.getElementById("fGenre").value.trim() || null,
        director: document.getElementById("fDirector").value.trim() || null,
        cast_members: document.getElementById("fCast").value.trim() || null,
        tags: document.getElementById("fMediaTags").value.trim() || null,
        review: document.getElementById("fReview").value.trim() || null,
        is_available: isAvailable ? "true" : "false",
        available_on: isAvailable ? (document.getElementById("fAvailableOn").value.trim() || null) : null,
    };
    if (!payload.media_name) { toast("Media name is required.", "error"); return; }
    try {
        if (id) {
            await api(`/media/${id}`, { method: "PUT", body: JSON.stringify(payload) });
            toast("Media updated.");
        } else {
            await api("/media/", { method: "POST", body: JSON.stringify(payload) });
            toast("Media created.");
        }
        closeMediaModal();
        loadMediaPage();
        loadAllMedia();
    } catch (e) { toast("Save failed: " + e.message, "error"); }
}

async function deleteMedia(id) {
    if (!confirm("Delete this media?")) return;
    try {
        await api(`/media/${id}`, { method: "DELETE" });
        toast("Media deleted.");
        loadMediaPage();
        loadAllMedia();
    } catch (e) { toast("Delete failed: " + e.message, "error"); }
}

// ===== LINKS =====
async function loadLinks() {
    try {
        if (!allMedia.length) await loadAllMedia();
        const search = document.getElementById("linkSearchInput")?.value.trim() || "";
        const status = document.getElementById("linkStatusFilter")?.value || "";
        const category = document.getElementById("linkCategoryFilter")?.value || "";
        const tagsFilter = document.getElementById("linkTagsFilter")?.value.trim().toLowerCase() || "";
        let params = "?";
        if (search) params += `search=${encodeURIComponent(search)}&`;
        if (status) params += `link_status=${status}&`;
        if (category) params += `link_category=${category}&`;
        if (tagsFilter) params += `tags=${encodeURIComponent(tagsFilter)}&`;

        const items = await api(`/media-links/${params}`);
        const container = document.getElementById("linksTable");
        if (!items.length) {
            container.innerHTML = `<div class="empty-state"><div class="icon">🔗</div><p>No links found.</p></div>`;
            return;
        }
        container.innerHTML = `
            <table>
                <thead><tr><th>Media</th><th>Platform</th><th>URL</th><th>Tags</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                    ${items.map((r) => {
                        const mediaName = allMedia.find(m => m.id === r.media_id)?.media_name || `#${r.media_id}`;
                        return `<tr>
                            <td>${escapeHtml(mediaName)}</td>
                            <td><span class="badge badge-proceed">${escapeHtml(r.platform)}</span></td>
                            <td><a href="${escapeHtml(r.url)}" target="_blank" style="color:var(--info);font-size:.78rem">${escapeHtml(r.url.length > 40 ? r.url.substring(0, 40) + '...' : r.url)}</a></td>
                            <td>${renderTags(r.tags)}</td>
                            <td><span class="badge badge-${r.link_status || 'active'}">${r.link_status || 'active'}</span></td>
                            <td>
                                <button class="btn-outline" style="padding:4px 8px;font-size:.7rem" onclick='editLink(${JSON.stringify(r).replace(/'/g, "&#39;")})'>✏️</button>
                                <button class="btn-outline" style="padding:4px 8px;font-size:.7rem" onclick="downloadLink(${r.id})">📥</button>
                                <button class="btn-danger" style="padding:4px 8px;font-size:.7rem" onclick="deleteLink(${r.id})">🗑</button>
                            </td>
                        </tr>`;
                    }).join("")}
                </tbody>
            </table>
        `;
    } catch (e) { toast("Failed to load links: " + e.message, "error"); }
}

function handleLinkSearch(event) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadLinks(), 300);
}

function openLinkModal() {
    document.getElementById("linkEditId").value = "";
    document.getElementById("fLinkUrl").value = "";
    document.getElementById("fLinkMediaSearch").value = "";
    document.getElementById("fLinkMediaId").value = "";
    document.getElementById("fLinkMediaCategory").value = "";
    document.getElementById("fLinkPlatform").value = "youtube";
    document.getElementById("fLinkStatus").value = "active";
    document.getElementById("fLinkDesc").value = "";
    document.getElementById("fLinkTags").value = "";
    document.getElementById("mediaSearchDropdown").classList.remove("show");
    document.getElementById("linkModalTitle").textContent = "Add Link";
    document.getElementById("linkModal").classList.add("open");
}

function editLink(item) {
    const media = allMedia.find(m => m.id === item.media_id);
    document.getElementById("linkEditId").value = item.id;
    document.getElementById("fLinkUrl").value = item.url;
    document.getElementById("fLinkMediaSearch").value = media ? media.media_name : "";
    document.getElementById("fLinkMediaId").value = item.media_id;
    document.getElementById("fLinkMediaCategory").value = item.link_category || (media ? media.media_category : "");
    document.getElementById("fLinkPlatform").value = item.platform;
    document.getElementById("fLinkStatus").value = item.link_status || "active";
    document.getElementById("fLinkDesc").value = item.description || "";
    document.getElementById("fLinkTags").value = item.tags || "";
    document.getElementById("linkModalTitle").textContent = "Edit Link";
    document.getElementById("linkModal").classList.add("open");
}

function closeLinkModal() { document.getElementById("linkModal").classList.remove("open"); }

async function searchMediaForLink() {
    const query = document.getElementById("fLinkMediaSearch").value.trim();
    const dropdown = document.getElementById("mediaSearchDropdown");
    if (query.length < 2) { dropdown.classList.remove("show"); return; }
    try {
        const results = await api(`/media-links/search-media?q=${encodeURIComponent(query)}`);
        let html = "";
        if (results.length) {
            html = results.map(m =>
                `<div class="autocomplete-item" onclick="selectMediaForLink(${m.id}, '${escapeHtml(m.media_name).replace(/'/g, "\\'")}', '${m.media_category}')">${escapeHtml(m.media_name)}<span class="ac-category">${m.media_category}</span></div>`
            ).join("");
        }
        html += `<div class="autocomplete-item" style="color:var(--info);font-weight:600;border-top:2px solid var(--border)" onclick="createNewMediaFromLink()">➕ Create "${escapeHtml(query)}" as new media</div>`;
        dropdown.innerHTML = html;
        dropdown.classList.add("show");
    } catch (_) { dropdown.classList.remove("show"); }
}

function selectMediaForLink(id, name, category) {
    document.getElementById("fLinkMediaId").value = id;
    document.getElementById("fLinkMediaSearch").value = name;
    document.getElementById("fLinkMediaCategory").value = category;
    document.getElementById("mediaSearchDropdown").classList.remove("show");
}

async function createNewMediaFromLink() {
    const name = document.getElementById("fLinkMediaSearch").value.trim();
    if (!name) { toast("Enter a media name.", "error"); return; }
    try {
        const newMedia = await api("/media/", { method: "POST", body: JSON.stringify({ media_category: "movies", media_name: name }) });
        toast(`Media "${name}" created.`);
        await loadAllMedia();
        selectMediaForLink(newMedia.id, newMedia.media_name, newMedia.media_category);
    } catch (e) { toast("Failed to create media: " + e.message, "error"); }
}

document.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete-wrapper")) {
        document.getElementById("mediaSearchDropdown")?.classList.remove("show");
        document.getElementById("statusMediaSearchDropdown")?.classList.remove("show");
    }
});

async function saveLink() {
    const id = document.getElementById("linkEditId").value;
    const mediaId = parseInt(document.getElementById("fLinkMediaId").value);
    const payload = {
        media_id: mediaId,
        platform: document.getElementById("fLinkPlatform").value,
        url: document.getElementById("fLinkUrl").value.trim(),
        description: document.getElementById("fLinkDesc").value.trim() || null,
        link_status: document.getElementById("fLinkStatus").value,
        link_category: document.getElementById("fLinkMediaCategory").value || null,
        tags: document.getElementById("fLinkTags").value.trim() || null,
    };
    if (!payload.media_id) { toast("Select a media item.", "error"); return; }
    if (!payload.url) { toast("URL is required.", "error"); return; }
    try {
        if (id) {
            await api(`/media-links/${id}`, { method: "PUT", body: JSON.stringify(payload) });
            toast("Link updated.");
        } else {
            await api("/media-links/", { method: "POST", body: JSON.stringify(payload) });
            toast("Link added.");
        }
        closeLinkModal();
        loadLinks();
    } catch (e) { toast("Failed to save link: " + e.message, "error"); }
}

async function deleteLink(id) {
    if (!confirm("Delete this link?")) return;
    try { await api(`/media-links/${id}`, { method: "DELETE" }); toast("Link deleted."); loadLinks(); }
    catch (e) { toast("Delete failed: " + e.message, "error"); }
}

function downloadLink(id) { window.open(`${API}/media-links/download/${id}`, "_blank"); }

function downloadAllLinks() {
    const category = document.getElementById("linkCategoryFilter")?.value || "";
    const status = document.getElementById("linkStatusFilter")?.value || "";
    let url = `${API}/media-links/download-all/export?`;
    if (category) url += `link_category=${category}&`;
    if (status) url += `link_status=${status}&`;
    window.open(url, "_blank");
}

// ===== STATUS TRACKING =====
function handleStatusSearch(event) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadStatuses(), 300);
}

async function loadStatuses() {
    try {
        if (!allMedia.length) await loadAllMedia();
        if (!allStatusDefs.length) await loadStatusDefinitions();
        populateStatusFilterDropdown("statusStatusFilter", "status_tracking");
        populateStatusDropdown("fStatusValue", "status_tracking");

        const items = await api("/media-status/");
        const container = document.getElementById("statusTable");

        const catFilter = document.getElementById("statusCategoryFilter")?.value || "";
        const statusFilter = document.getElementById("statusStatusFilter")?.value || "";
        const searchTerm = document.getElementById("statusSearchInput")?.value.trim().toLowerCase() || "";
        const tagsFilter = document.getElementById("statusTagsFilter")?.value.trim().toLowerCase() || "";

        let filtered = items;
        if (catFilter || statusFilter || searchTerm || tagsFilter) {
            filtered = items.filter(r => {
                const media = allMedia.find(m => m.id === r.media_id);
                const cat = media?.media_category || "";
                const name = media?.media_name?.toLowerCase() || "";
                const tags = (r.tags || "").toLowerCase();
                if (catFilter && cat !== catFilter) return false;
                if (statusFilter && r.status !== statusFilter) return false;
                if (searchTerm && !name.includes(searchTerm)) return false;
                if (tagsFilter && !tags.includes(tagsFilter)) return false;
                return true;
            });
        }

        if (!filtered.length) {
            container.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>No status entries found.</p></div>`;
            return;
        }
        container.innerHTML = `
            <table>
                <thead><tr><th>Media</th><th>Category</th><th>Status</th><th>Tags</th><th>Notes</th><th>Updated</th><th>Actions</th></tr></thead>
                <tbody>
                    ${filtered.map((r) => {
                        const media = allMedia.find(m => m.id === r.media_id);
                        const mediaName = media?.media_name || `#${r.media_id}`;
                        const mediaCat = media?.media_category || "—";
                        return `<tr>
                            <td><strong>${escapeHtml(mediaName)}</strong></td>
                            <td><span class="badge badge-proceed">${escapeHtml(mediaCat)}</span></td>
                            <td><span class="badge badge-${r.status}">${r.status.replace("_", " ")}</span></td>
                            <td>${renderTags(r.tags)}</td>
                            <td>${escapeHtml(r.notes || "—")}</td>
                            <td>${new Date(r.updated_at).toLocaleDateString()}</td>
                            <td>
                                <button class="btn-outline" style="padding:3px 7px;font-size:.68rem" onclick='editStatus(${JSON.stringify(r).replace(/'/g, "&#39;")})'>✏️</button>
                                <button class="btn-outline" style="padding:3px 7px;font-size:.68rem" onclick="duplicateStatus(${r.id})">📋</button>
                                <button class="btn-danger" style="padding:3px 7px;font-size:.68rem" onclick="deleteStatus(${r.id})">🗑</button>
                            </td>
                        </tr>`;
                    }).join("")}
                </tbody>
            </table>
        `;
    } catch (e) { toast("Failed to load statuses: " + e.message, "error"); }
}

async function duplicateStatus(id) {
    try {
        await api(`/media-status/${id}/duplicate`, { method: "POST" });
        toast("Status duplicated. You can now edit the copy.");
        loadStatuses();
    } catch (e) { toast("Duplicate failed: " + e.message, "error"); }
}

async function openStatusModal() {
    if (!allStatusDefs.length) await loadStatusDefinitions();
    if (!allStatusDefs.length) {
        try { await api("/status-definitions/seed", { method: "POST" }); await loadStatusDefinitions(); toast("Default statuses seeded.", "success"); } catch (_) {}
    }
    populateStatusDropdown("fStatusValue", "status_tracking");
    document.getElementById("statusEditId").value = "";
    document.getElementById("fStatusMediaSearch").value = "";
    document.getElementById("fStatusMediaId").value = "";
    document.getElementById("fStatusMediaCategory").value = "";
    document.getElementById("fStatusValue").value = "in_progress";
    document.getElementById("fStatusTags").value = "";
    document.getElementById("fStatusNotes").value = "";
    document.getElementById("statusMediaSearchDropdown").classList.remove("show");
    document.getElementById("statusLinkInfo").style.display = "none";
    document.getElementById("statusLinkDetails").innerHTML = "";
    document.getElementById("statusModalTitle").textContent = "Add Status";
    document.getElementById("statusModal").classList.add("open");
}

async function editStatus(item) {
    if (!allStatusDefs.length) await loadStatusDefinitions();
    if (!allStatusDefs.length) { try { await api("/status-definitions/seed", { method: "POST" }); await loadStatusDefinitions(); } catch (_) {} }
    populateStatusDropdown("fStatusValue", "status_tracking");
    const media = allMedia.find(m => m.id === item.media_id);
    document.getElementById("statusEditId").value = item.id;
    document.getElementById("fStatusMediaSearch").value = media ? media.media_name : "";
    document.getElementById("fStatusMediaId").value = item.media_id;
    document.getElementById("fStatusMediaCategory").value = media ? media.media_category : "";
    document.getElementById("fStatusValue").value = item.status;
    document.getElementById("fStatusTags").value = item.tags || "";
    document.getElementById("fStatusNotes").value = item.notes || "";
    document.getElementById("statusMediaSearchDropdown").classList.remove("show");
    document.getElementById("statusModalTitle").textContent = "Edit Status";
    document.getElementById("statusModal").classList.add("open");
}

function closeStatusModal() { document.getElementById("statusModal").classList.remove("open"); }

async function searchMediaForStatus() {
    const query = document.getElementById("fStatusMediaSearch").value.trim();
    const dropdown = document.getElementById("statusMediaSearchDropdown");
    if (query.length < 2) { dropdown.classList.remove("show"); return; }
    try {
        const results = await api(`/media-status/search-all?q=${encodeURIComponent(query)}`);
        let html = "";

        // Media results section
        if (results.media && results.media.length) {
            html += `<div class="autocomplete-section-header">📋 Media</div>`;
            html += results.media.map(m =>
                `<div class="autocomplete-item" onclick="selectMediaForStatus(${m.id}, '${escapeHtml(m.media_name).replace(/'/g, "\\'")}', '${m.media_category}')">${escapeHtml(m.media_name)}<span class="ac-category">${m.media_category}</span></div>`
            ).join("");
        }

        // Link results section
        if (results.links && results.links.length) {
            html += `<div class="autocomplete-section-header">🔗 Links</div>`;
            html += results.links.map(lnk =>
                `<div class="autocomplete-item autocomplete-item-link" onclick="selectLinkForStatus(${lnk.media_id}, '${escapeHtml(lnk.media_name).replace(/'/g, "\\'")}', '${lnk.media_category}', '${escapeHtml(lnk.platform)}', '${escapeHtml(lnk.url).replace(/'/g, "\\'")}')">
                    <span class="ac-link-name">${escapeHtml(lnk.media_name)}</span>
                    <span class="ac-link-platform">${lnk.platform}</span>
                    <span class="ac-link-url" title="${escapeHtml(lnk.url)}">${escapeHtml(lnk.url.length > 40 ? lnk.url.substring(0, 40) + '...' : lnk.url)}</span>
                </div>`
            ).join("");
        }

        // Create new option
        html += `<div class="autocomplete-item" style="color:var(--info);font-weight:600;border-top:2px solid var(--border)" onclick="createNewMediaFromStatus()">➕ Create "${escapeHtml(query)}" as new media</div>`;
        dropdown.innerHTML = html;
        dropdown.classList.add("show");
    } catch (_) { dropdown.classList.remove("show"); }
}

function selectMediaForStatus(id, name, category) {
    document.getElementById("fStatusMediaId").value = id;
    document.getElementById("fStatusMediaSearch").value = name;
    document.getElementById("fStatusMediaCategory").value = category;
    document.getElementById("statusMediaSearchDropdown").classList.remove("show");
    // Hide link info when selecting from media directly
    document.getElementById("statusLinkInfo").style.display = "none";
    document.getElementById("statusLinkDetails").innerHTML = "";
}

function selectLinkForStatus(mediaId, mediaName, mediaCategory, platform, url) {
    document.getElementById("fStatusMediaId").value = mediaId;
    document.getElementById("fStatusMediaSearch").value = mediaName;
    document.getElementById("fStatusMediaCategory").value = mediaCategory;
    document.getElementById("statusMediaSearchDropdown").classList.remove("show");
    // Show link info badge
    document.getElementById("statusLinkInfo").style.display = "block";
    document.getElementById("statusLinkDetails").innerHTML = `
        <span class="link-badge-platform">${escapeHtml(platform)}</span>
        <a href="${escapeHtml(url)}" target="_blank" class="link-badge-url">${escapeHtml(url.length > 50 ? url.substring(0, 50) + '...' : url)}</a>
    `;
}

async function createNewMediaFromStatus() {
    const name = document.getElementById("fStatusMediaSearch").value.trim();
    if (!name) { toast("Enter a media name.", "error"); return; }
    try {
        const newMedia = await api("/media/", { method: "POST", body: JSON.stringify({ media_category: "movies", media_name: name }) });
        toast(`Media "${name}" created.`);
        await loadAllMedia();
        selectMediaForStatus(newMedia.id, newMedia.media_name, newMedia.media_category);
    } catch (e) { toast("Failed to create media: " + e.message, "error"); }
}

async function saveStatus() {
    const id = document.getElementById("statusEditId").value;
    const mediaIdRaw = document.getElementById("fStatusMediaId").value;
    const mediaId = parseInt(mediaIdRaw);
    const payload = {
        media_id: mediaId,
        status: document.getElementById("fStatusValue").value,
        tags: document.getElementById("fStatusTags").value.trim() || null,
        notes: document.getElementById("fStatusNotes").value.trim() || null,
    };
    if (!mediaIdRaw || isNaN(mediaId)) { toast("Search and select a media item.", "error"); return; }
    if (!payload.status) { toast("Please select a status.", "error"); return; }
    try {
        if (id) {
            await api(`/media-status/${id}`, { method: "PUT", body: JSON.stringify(payload) });
            toast("Status updated.");
        } else {
            await api("/media-status/", { method: "POST", body: JSON.stringify(payload) });
            toast("Status added.");
        }
        closeStatusModal();
        loadStatuses();
    } catch (e) { toast("Failed to save status: " + e.message, "error"); }
}

async function deleteStatus(id) {
    if (!confirm("Delete this status entry?")) return;
    try { await api(`/media-status/${id}`, { method: "DELETE" }); toast("Status deleted."); loadStatuses(); }
    catch (e) { toast("Delete failed: " + e.message, "error"); }
}

// ===== STATUS MANAGEMENT =====
async function loadStatusDefs() {
    try {
        const items = await api("/status-definitions/all");
        await loadStatusDefinitions();
        const container = document.getElementById("statusDefsTable");
        if (!items.length) {
            container.innerHTML = `<div class="empty-state"><div class="icon">🏷️</div><p>No status definitions yet. Click "Seed Defaults" to add standard statuses.</p></div>`;
            return;
        }
        container.innerHTML = `
            <table>
                <thead><tr><th>Name</th><th>Label</th><th>Context</th><th>Color</th><th>Active</th><th>Actions</th></tr></thead>
                <tbody>
                    ${items.map(r => `<tr>
                        <td><code>${escapeHtml(r.name)}</code></td>
                        <td><strong>${escapeHtml(r.label)}</strong></td>
                        <td><span class="badge badge-planned">${escapeHtml(r.usage_context)}</span></td>
                        <td>${escapeHtml(r.color || "—")}</td>
                        <td><span class="badge badge-${r.is_active === 'true' ? 'proceed' : 'stopped'}">${r.is_active === 'true' ? 'Active' : 'Inactive'}</span></td>
                        <td>
                            <button class="btn-outline" onclick='editStatusDef(${JSON.stringify(r).replace(/'/g, "&#39;")})'>✏️</button>
                            <button class="btn-danger" onclick="deleteStatusDef(${r.id})">🗑</button>
                        </td>
                    </tr>`).join("")}
                </tbody>
            </table>
        `;
    } catch (e) { toast("Failed to load status definitions: " + e.message, "error"); }
}

function openStatusDefModal() { document.getElementById("statusDefEditId").value = ""; document.getElementById("fStatusDefName").value = ""; document.getElementById("fStatusDefLabel").value = ""; document.getElementById("fStatusDefContext").value = "all"; document.getElementById("fStatusDefColor").value = ""; document.getElementById("fStatusDefDesc").value = ""; document.getElementById("statusDefModalTitle").textContent = "Add Status Name"; document.getElementById("statusDefModal").classList.add("open"); }
function editStatusDef(item) { document.getElementById("statusDefEditId").value = item.id; document.getElementById("fStatusDefName").value = item.name; document.getElementById("fStatusDefLabel").value = item.label; document.getElementById("fStatusDefContext").value = item.usage_context || "all"; document.getElementById("fStatusDefColor").value = item.color || ""; document.getElementById("fStatusDefDesc").value = item.description || ""; document.getElementById("statusDefModalTitle").textContent = "Edit Status Name"; document.getElementById("statusDefModal").classList.add("open"); }
function closeStatusDefModal() { document.getElementById("statusDefModal").classList.remove("open"); }

async function saveStatusDef() {
    const id = document.getElementById("statusDefEditId").value;
    const payload = { name: document.getElementById("fStatusDefName").value.trim(), label: document.getElementById("fStatusDefLabel").value.trim(), usage_context: document.getElementById("fStatusDefContext").value, color: document.getElementById("fStatusDefColor").value.trim() || null, description: document.getElementById("fStatusDefDesc").value.trim() || null };
    if (!payload.name || !payload.label) { toast("Name and Label are required.", "error"); return; }
    try {
        if (id) { await api(`/status-definitions/${id}`, { method: "PUT", body: JSON.stringify(payload) }); toast("Updated."); }
        else { await api("/status-definitions/", { method: "POST", body: JSON.stringify(payload) }); toast("Created."); }
        closeStatusDefModal(); loadStatusDefs();
    } catch (e) { toast("Failed: " + e.message, "error"); }
}

async function deleteStatusDef(id) { if (!confirm("Delete?")) return; try { await api(`/status-definitions/${id}`, { method: "DELETE" }); toast("Deleted."); loadStatusDefs(); } catch (e) { toast("Failed: " + e.message, "error"); } }
async function seedDefaultStatuses() { try { const r = await api("/status-definitions/seed", { method: "POST" }); toast(r.message); loadStatusDefs(); } catch (e) { toast("Seed failed: " + e.message, "error"); } }

// ===== CONTENT CALENDAR =====
async function loadContentCalendar() {
    const year = contentCalendarDate.getFullYear();
    const month = contentCalendarDate.getMonth();
    document.getElementById("contentCalendarTitle").textContent = contentCalendarDate.toLocaleString("default", { month: "long", year: "numeric" });
    const lastDay = new Date(year, month + 1, 0);
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

    try {
        const events = await api(`/calendar/events?start_date=${startDate}&end_date=${endDate}`);
        const eventsByDate = {};
        events.forEach(e => { eventsByDate[e.date] = eventsByDate[e.date] || []; eventsByDate[e.date].push(e); });

        const startDow = new Date(year, month, 1).getDay();
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

        let html = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => `<div class="calendar-day-header">${d}</div>`).join("");
        for (let i = 0; i < startDow; i++) html += `<div class="calendar-day other-month"></div>`;
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const dayEvents = eventsByDate[dateStr] || [];
            const classes = ["calendar-day"];
            if (dateStr === todayStr) classes.push("today");
            if (dayEvents.length) classes.push("has-tasks");
            const dots = dayEvents.slice(0, 3).map(e => `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${e.color};margin:1px"></span>`).join("");
            html += `<div class="${classes.join(" ")}">${d}${dots ? `<div style="margin-top:2px">${dots}</div>` : ""}</div>`;
        }
        document.getElementById("contentCalendarGrid").innerHTML = html;

        // Events list
        if (events.length) {
            document.getElementById("contentCalendarEvents").innerHTML = `<table><thead><tr><th>Date</th><th>Title</th><th>Type</th><th>Category</th></tr></thead><tbody>${events.map(e => `<tr><td>${e.date}</td><td>${escapeHtml(e.title)}</td><td><span class="badge" style="background:${e.color};color:#fff">${e.type}</span></td><td>${escapeHtml(e.category || e.reminder_type || "")}</td></tr>`).join("")}</tbody></table>`;
        } else {
            document.getElementById("contentCalendarEvents").innerHTML = `<div class="empty-state"><p>No events this month.</p></div>`;
        }
    } catch (e) { toast("Failed to load calendar: " + e.message, "error"); }
}

function prevContentCalMonth() { contentCalendarDate.setMonth(contentCalendarDate.getMonth() - 1); loadContentCalendar(); }
function nextContentCalMonth() { contentCalendarDate.setMonth(contentCalendarDate.getMonth() + 1); loadContentCalendar(); }

// ===== REMINDERS =====
async function loadReminders() {
    try {
        const upcoming = document.getElementById("reminderUpcoming")?.checked ? "&upcoming=true" : "";
        const items = await api(`/reminders/?${upcoming}`);
        const container = document.getElementById("remindersTable");
        if (!items.length) {
            container.innerHTML = `<div class="empty-state"><div class="icon">🔔</div><p>No reminders.</p></div>`;
            return;
        }
        container.innerHTML = `<table><thead><tr><th>Title</th><th>Date</th><th>Type</th><th>Media</th><th>Sent</th><th>Actions</th></tr></thead><tbody>${items.map(r => {
            const media = allMedia.find(m => m.id === r.media_id);
            return `<tr>
                <td><strong>${escapeHtml(r.title)}</strong>${r.message ? `<br><small style="color:var(--text-secondary)">${escapeHtml(r.message)}</small>` : ""}</td>
                <td>${new Date(r.reminder_date).toLocaleString()}</td>
                <td><span class="badge badge-planned">${r.reminder_type}</span></td>
                <td>${media ? escapeHtml(media.media_name) : "—"}</td>
                <td>${r.is_sent ? '✅' : '⏳'}</td>
                <td>
                    ${!r.is_sent ? `<button class="btn-outline" style="padding:3px 7px;font-size:.68rem" onclick="markReminderSent(${r.id})">✓ Done</button>` : ""}
                    <button class="btn-danger" style="padding:3px 7px;font-size:.68rem" onclick="deleteReminder(${r.id})">🗑</button>
                </td>
            </tr>`;
        }).join("")}</tbody></table>`;
    } catch (e) { toast("Failed to load reminders: " + e.message, "error"); }
}

function openReminderModal() {
    document.getElementById("reminderEditId").value = "";
    document.getElementById("fReminderTitle").value = "";
    document.getElementById("fReminderDate").value = "";
    document.getElementById("fReminderType").value = "deadline";
    document.getElementById("fReminderMessage").value = "";
    populateMediaDropdown("fReminderMediaId");
    document.getElementById("reminderModalTitle").textContent = "Add Reminder";
    document.getElementById("reminderModal").classList.add("open");
}
function closeReminderModal() { document.getElementById("reminderModal").classList.remove("open"); }

async function saveReminder() {
    const id = document.getElementById("reminderEditId").value;
    const mediaId = document.getElementById("fReminderMediaId").value;
    const payload = {
        title: document.getElementById("fReminderTitle").value.trim(),
        reminder_date: document.getElementById("fReminderDate").value ? new Date(document.getElementById("fReminderDate").value).toISOString() : null,
        reminder_type: document.getElementById("fReminderType").value,
        media_id: mediaId ? parseInt(mediaId) : null,
        message: document.getElementById("fReminderMessage").value.trim() || null,
    };
    if (!payload.title) { toast("Title required.", "error"); return; }
    if (!payload.reminder_date) { toast("Date required.", "error"); return; }
    try {
        if (id) { await api(`/reminders/${id}`, { method: "PUT", body: JSON.stringify(payload) }); toast("Reminder updated."); }
        else { await api("/reminders/", { method: "POST", body: JSON.stringify(payload) }); toast("Reminder created."); }
        closeReminderModal(); loadReminders();
    } catch (e) { toast("Failed: " + e.message, "error"); }
}

async function markReminderSent(id) { try { await api(`/reminders/${id}/mark-sent`, { method: "POST" }); toast("Marked as sent."); loadReminders(); } catch (e) { toast("Failed: " + e.message, "error"); } }
async function deleteReminder(id) { if (!confirm("Delete?")) return; try { await api(`/reminders/${id}`, { method: "DELETE" }); toast("Deleted."); loadReminders(); } catch (e) { toast("Failed: " + e.message, "error"); } }

// ===== ANALYTICS (Dynamic) =====
async function loadAnalytics() {
    try {
        const cat = document.getElementById("analyticsCategory")?.value || "";
        const params = cat ? `?media_category=${cat}` : "";
        const data = await api(`/analytics/overview${params}`);

        document.getElementById("analyticsStats").innerHTML = `
            <div class="stat-card"><div class="label">Total Media</div><div class="value">${data.total_media}</div></div>
            <div class="stat-card"><div class="label">Available</div><div class="value" style="color:var(--success)">${data.availability.available}</div></div>
            <div class="stat-card"><div class="label">Unavailable</div><div class="value" style="color:var(--danger)">${data.availability.unavailable}</div></div>
            <div class="stat-card"><div class="label">Tasks Pending</div><div class="value" style="color:var(--warning)">${data.task_stats.pending}</div></div>
            <div class="stat-card"><div class="label">Unique Tags</div><div class="value">${Object.keys(data.tag_distribution).length}</div></div>
        `;

        // Tag distribution chart
        const tagLabels = Object.keys(data.tag_distribution).slice(0, 15);
        const tagValues = tagLabels.map(k => data.tag_distribution[k]);
        renderChart("analyticsTagChart", "bar", {
            labels: tagLabels.length ? tagLabels : ["No tags"],
            datasets: [{ label: "Count", data: tagValues.length ? tagValues : [0], backgroundColor: "#8b5cf6", borderRadius: 4 }],
        });

        // Top rated
        const topNames = data.top_rated.map(m => m.name.substring(0, 20));
        const topRatings = data.top_rated.map(m => m.rating);
        renderChart("analyticsRatingChart", "bar", {
            labels: topNames.length ? topNames : ["No data"],
            datasets: [{ label: "Rating", data: topRatings.length ? topRatings : [0], backgroundColor: "#f59e0b", borderRadius: 4 }],
        });

        // Platform distribution
        renderChart("analyticsPlatformChart", "doughnut", {
            labels: Object.keys(data.platform_distribution),
            datasets: [{ data: Object.values(data.platform_distribution), backgroundColor: ["#ef4444", "#f59e0b", "#3b82f6", "#22c55e", "#8b5cf6", "#ec4899", "#6b7280"] }],
        });

        // Status distribution
        renderChart("analyticsStatusFlowChart", "bar", {
            labels: Object.keys(data.status_distribution),
            datasets: [{ label: "Count", data: Object.values(data.status_distribution), backgroundColor: "#3b82f6", borderRadius: 4 }],
        });

        // Most linked table
        const mlContainer = document.getElementById("analyticsMostLinked");
        if (data.most_linked_media.length) {
            mlContainer.innerHTML = `<table><thead><tr><th>Media</th><th>Category</th><th>Links</th></tr></thead><tbody>${data.most_linked_media.map(m => `<tr><td>${escapeHtml(m.name)}</td><td><span class="badge badge-proceed">${m.category}</span></td><td>${m.link_count}</td></tr>`).join("")}</tbody></table>`;
        } else {
            mlContainer.innerHTML = `<div class="empty-state"><p>No linked media yet.</p></div>`;
        }
    } catch (e) { toast("Failed to load analytics: " + e.message, "error"); }
}

// ===== REPORTS =====
async function loadReport() {
    try {
        const category = document.getElementById("reportCategory").value;
        const status = document.getElementById("reportStatus").value;
        let params = "?";
        if (category) params += `media_category=${category}&`;
        if (status) params += `status=${status}&`;
        const data = await api(`/dashboard/reports${params}`);
        renderChart("ratingChart", "bar", { labels: Object.keys(data.by_rating), datasets: [{ label: "Count", data: Object.values(data.by_rating), backgroundColor: ["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#3b82f6"], borderRadius: 4 }] });
        renderChart("reportCategoryChart", "doughnut", { labels: Object.keys(data.by_category), datasets: [{ data: Object.values(data.by_category), backgroundColor: ["#3b82f6", "#8b5cf6", "#f59e0b", "#22c55e"] }] });
        renderMediaTable(data.items, "reportTable");
    } catch (e) { toast("Failed to load report: " + e.message, "error"); }
}

function exportCSV() { const cat = document.getElementById("reportCategory").value; let url = `${API}/dashboard/export/csv`; if (cat) url += `?media_category=${cat}`; window.open(url, "_blank"); }

// ===== STATISTICS =====
async function loadStatistics() {
    try {
        const data = await api("/dashboard/statistics");
        document.getElementById("statisticsStats").innerHTML = `
            <div class="stat-card"><div class="label">Total Media</div><div class="value">${data.total_media}</div></div>
            <div class="stat-card"><div class="label">In Progress</div><div class="value" style="color:var(--warning)">${data.in_progress}</div></div>
            <div class="stat-card"><div class="label">Stopped</div><div class="value" style="color:var(--danger)">${data.stopped}</div></div>
            <div class="stat-card"><div class="label">Reviewed</div><div class="value" style="color:var(--success)">${data.reviewed}</div></div>
            <div class="stat-card"><div class="label">Tasks Pending</div><div class="value">${data.tasks.pending}</div></div>
            <div class="stat-card"><div class="label">Tasks Done</div><div class="value" style="color:var(--success)">${data.tasks.completed}</div></div>
        `;
        renderChart("statsStatusChart", "pie", { labels: Object.keys(data.status_counts).length ? Object.keys(data.status_counts) : ["No Data"], datasets: [{ data: Object.values(data.status_counts).length ? Object.values(data.status_counts) : [1], backgroundColor: ["#22c55e", "#3b82f6", "#ef4444", "#f59e0b", "#8b5cf6", "#6b7280", "#ec4899"] }] });
        renderChart("statsTaskChart", "doughnut", { labels: ["Pending", "In Progress", "Completed"], datasets: [{ data: [data.tasks.pending, data.tasks.in_progress, data.tasks.completed], backgroundColor: ["#f59e0b", "#3b82f6", "#22c55e"] }] });
    } catch (e) { toast("Failed to load statistics: " + e.message, "error"); }
}

// ===== TODO TASKS =====
async function loadTasks() {
    try {
        const filter = document.getElementById("taskFilter").value;
        let params = filter ? `?status=${filter}` : "";
        const items = await api(`/tasks/${params}`);
        const container = document.getElementById("tasksList");
        if (!items.length) { container.innerHTML = `<div class="empty-state"><div class="icon">✅</div><p>No tasks.</p></div>`; return; }
        container.innerHTML = items.map((t) => `
            <div class="task-card priority-${t.priority}">
                <div class="task-title">${escapeHtml(t.title)}</div>
                <div class="task-meta">
                    <span class="badge badge-${t.status}">${t.status.replace("_", " ")}</span>
                    <span class="badge badge-${t.priority}">${t.priority}</span>
                    ${t.due_date ? `<span>📅 ${t.due_date}</span>` : ""}
                    <span>📁 ${t.category}</span>
                    ${t.reminder ? `<span>🔔 ${new Date(t.reminder).toLocaleDateString()}</span>` : ""}
                </div>
                ${t.tags ? `<div style="margin-top:4px">${renderTags(t.tags)}</div>` : ""}
                ${t.description ? `<p style="font-size:.78rem;color:var(--text-secondary);margin-top:6px">${escapeHtml(t.description)}</p>` : ""}
                <div class="task-actions">
                    <button class="btn-outline" style="padding:3px 8px;font-size:.7rem" onclick='editTask(${JSON.stringify(t).replace(/'/g, "&#39;")})'>✏️ Edit</button>
                    <button class="btn-danger" style="padding:3px 8px;font-size:.7rem" onclick="deleteTask(${t.id})">🗑</button>
                </div>
            </div>
        `).join("");
    } catch (e) { toast("Failed to load tasks: " + e.message, "error"); }
}

function openTaskModal() {
    document.getElementById("taskEditId").value = "";
    document.getElementById("fTaskTitle").value = "";
    document.getElementById("fTaskDesc").value = "";
    document.getElementById("fTaskDueDate").value = "";
    document.getElementById("fTaskPriority").value = "medium";
    document.getElementById("fTaskCategory").value = "general";
    document.getElementById("fTaskStatus").value = "pending";
    document.getElementById("fTaskTags").value = "";
    document.getElementById("fTaskReminder").value = "";
    document.getElementById("taskModalTitle").textContent = "Add Task";
    document.getElementById("taskModal").classList.add("open");
}
function closeTaskModal() { document.getElementById("taskModal").classList.remove("open"); }

function editTask(item) {
    document.getElementById("taskEditId").value = item.id;
    document.getElementById("fTaskTitle").value = item.title;
    document.getElementById("fTaskDesc").value = item.description || "";
    document.getElementById("fTaskDueDate").value = item.due_date || "";
    document.getElementById("fTaskPriority").value = item.priority;
    document.getElementById("fTaskCategory").value = item.category;
    document.getElementById("fTaskStatus").value = item.status;
    document.getElementById("fTaskTags").value = item.tags || "";
    document.getElementById("fTaskReminder").value = item.reminder ? item.reminder.slice(0, 16) : "";
    document.getElementById("taskModalTitle").textContent = "Edit Task";
    document.getElementById("taskModal").classList.add("open");
}

async function saveTask() {
    const id = document.getElementById("taskEditId").value;
    const reminderVal = document.getElementById("fTaskReminder").value;
    const payload = {
        title: document.getElementById("fTaskTitle").value.trim(),
        description: document.getElementById("fTaskDesc").value.trim() || null,
        due_date: document.getElementById("fTaskDueDate").value || null,
        priority: document.getElementById("fTaskPriority").value,
        category: document.getElementById("fTaskCategory").value,
        status: document.getElementById("fTaskStatus").value,
        tags: document.getElementById("fTaskTags").value.trim() || null,
        reminder: reminderVal ? new Date(reminderVal).toISOString() : null,
    };
    if (!payload.title) { toast("Title is required.", "error"); return; }
    try {
        if (id) { await api(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(payload) }); toast("Task updated."); }
        else { await api("/tasks/", { method: "POST", body: JSON.stringify(payload) }); toast("Task created."); }
        closeTaskModal(); loadTasks(); renderCalendar();
    } catch (e) { toast("Save failed: " + e.message, "error"); }
}

async function deleteTask(id) { if (!confirm("Delete?")) return; try { await api(`/tasks/${id}`, { method: "DELETE" }); toast("Deleted."); loadTasks(); renderCalendar(); } catch (e) { toast("Failed: " + e.message, "error"); } }

// ===== CALENDAR (Tasks) =====
async function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    document.getElementById("calendarTitle").textContent = currentCalendarDate.toLocaleString("default", { month: "long", year: "numeric" });
    const lastDay = new Date(year, month + 1, 0);
    const startDow = new Date(year, month, 1).getDay();
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
    let taskDates = new Set();
    try { const tasks = await api(`/tasks/calendar?start_date=${startDate}&end_date=${endDate}`); tasks.forEach((t) => { if (t.due_date) taskDates.add(t.due_date); }); } catch (_) {}
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    let html = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<div class="calendar-day-header">${d}</div>`).join("");
    for (let i = 0; i < startDow; i++) html += `<div class="calendar-day other-month"></div>`;
    for (let d = 1; d <= lastDay.getDate(); d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const classes = ["calendar-day"];
        if (dateStr === todayStr) classes.push("today");
        if (taskDates.has(dateStr)) classes.push("has-tasks");
        html += `<div class="${classes.join(" ")}" onclick="selectCalendarDate('${dateStr}')">${d}</div>`;
    }
    document.getElementById("calendarGrid").innerHTML = html;
}

function selectCalendarDate(dateStr) { document.getElementById("fTaskDueDate").value = dateStr; openTaskModal(); }
function prevMonth() { currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1); renderCalendar(); }
function nextMonth() { currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1); renderCalendar(); }

// ===== CHARTS =====
function renderChart(canvasId, type, data) {
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    chartInstances[canvasId] = new Chart(ctx, {
        type, data,
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: type === "bar" ? "top" : "right", labels: { font: { size: 11 } } } },
            scales: type === "bar" ? { y: { beginAtZero: true, ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } } : undefined,
        },
    });
}

// ===== EXCEL EXPORT / IMPORT / TEMPLATES =====
function exportExcel(type) {
    let url = `${API}/excel/export/${type}`;
    if (type === "media") { const cat = document.getElementById("mediaCategoryFilter")?.value; if (cat) url += `?media_category=${cat}`; }
    else if (type === "links") { const cat = document.getElementById("linkCategoryFilter")?.value; const status = document.getElementById("linkStatusFilter")?.value; let p = []; if (cat) p.push(`link_category=${cat}`); if (status) p.push(`link_status=${status}`); if (p.length) url += "?" + p.join("&"); }
    window.open(url, "_blank");
}

function exportFullExcel() { window.open(`${API}/excel/export/full`, "_blank"); }
function downloadTemplate(type) { window.open(`${API}/excel/templates/${type}`, "_blank"); }

async function importExcel(type, input) {
    const file = input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    // Show loading toast for large files
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    toast(`⏳ Uploading ${file.name} (${sizeMB}MB)... Please wait.`, "info");

    try {
        const startTime = Date.now();
        const res = await fetch(`${API}/excel/import/${type}`, { method: "POST", body: formData });
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const data = await res.json();
        if (!res.ok) { toast(data.detail || "Import failed", "error"); return; }
        data._elapsed = elapsed;
        data._historyId = data.import_history_id;
        showImportResults(type, file.name, data);
        if (type === "media") { loadMediaPage(); loadAllMedia(); }
        else if (type === "links") { loadLinks(); }
        else if (type === "status") { loadStatuses(); }
    } catch (e) { toast("Import failed: " + e.message, "error"); }
    input.value = "";
}

function showImportResults(type, fileName, data) {
    const summary = data.summary || {};
    const errors = data.errors || [];
    const totalRows = summary.total_rows || 0;
    const totalProcessed = summary.total_processed || 0;
    const successful = summary.successful || data.created || 0;
    const failed = summary.failed || errors.length || 0;
    const skippedEmpty = summary.skipped_empty || 0;

    const successRate = totalProcessed > 0 ? Math.round((successful / totalProcessed) * 100) : 0;
    const failRate = totalProcessed > 0 ? Math.round((failed / totalProcessed) * 100) : 0;

    // Group errors by issue_type
    const errorsByType = {};
    errors.forEach(err => {
        const t = err.issue_type || "other";
        if (!errorsByType[t]) errorsByType[t] = [];
        errorsByType[t].push(err);
    });

    const issueTypeLabels = {
        "missing_field": "⚠️ Missing Required Field",
        "duplicate": "🔁 Already In Database",
        "duplicate_in_file": "📄 Duplicate Within File",
        "validation": "❌ Validation Error",
        "reference_missing": "🔍 Reference Not Found",
        "exception": "💥 Unexpected Error",
        "other": "❓ Other",
    };

    const issueTypeColors = {
        "missing_field": "#f59e0b",
        "duplicate": "#8b5cf6",
        "duplicate_in_file": "#6b7280",
        "validation": "#ef4444",
        "reference_missing": "#3b82f6",
        "exception": "#dc2626",
        "other": "#9ca3af",
    };

    const elapsed = data._elapsed ? ` &middot; ⏱️ ${data._elapsed}s` : "";

    let html = `
        <div style="margin-bottom:16px;padding:12px 16px;background:var(--body-bg);border-radius:var(--radius);border:1px solid var(--border)">
            <p style="margin:0;font-size:.82rem;color:var(--text-secondary)">
                📁 <strong>${escapeHtml(fileName)}</strong> &middot; Type: <strong>${type.charAt(0).toUpperCase() + type.slice(1)}</strong>${elapsed}
            </p>
        </div>

        <!-- Performance Chart + Summary -->
        <div style="display:flex;gap:20px;align-items:center;margin-bottom:24px;flex-wrap:wrap">
            <!-- Donut Chart -->
            <div style="width:140px;height:140px;flex-shrink:0">
                <canvas id="importResultChart"></canvas>
            </div>

            <!-- Stats Summary -->
            <div style="flex:1;min-width:200px">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                    <div style="background:var(--body-bg);padding:12px 14px;border-radius:var(--radius);border:1px solid var(--border)">
                        <div style="font-size:.7rem;color:var(--text-secondary);text-transform:uppercase">Total Rows</div>
                        <div style="font-size:1.5rem;font-weight:700">${totalRows}</div>
                    </div>
                    <div style="background:var(--body-bg);padding:12px 14px;border-radius:var(--radius);border:1px solid var(--border)">
                        <div style="font-size:.7rem;color:var(--text-secondary);text-transform:uppercase">Processed</div>
                        <div style="font-size:1.5rem;font-weight:700">${totalProcessed}</div>
                    </div>
                    <div style="background:var(--body-bg);padding:12px 14px;border-radius:var(--radius);border:1px solid #bbf7d0">
                        <div style="font-size:.7rem;color:var(--success);text-transform:uppercase">✅ Ingested</div>
                        <div style="font-size:1.5rem;font-weight:700;color:var(--success)">${successful}</div>
                    </div>
                    <div style="background:var(--body-bg);padding:12px 14px;border-radius:var(--radius);border:1px solid ${failed > 0 ? '#fecaca' : 'var(--border)'}">
                        <div style="font-size:.7rem;color:${failed > 0 ? 'var(--danger)' : 'var(--text-secondary)'};text-transform:uppercase">❌ Issues</div>
                        <div style="font-size:1.5rem;font-weight:700;color:${failed > 0 ? 'var(--danger)' : 'var(--text-secondary)'}">${failed}</div>
                    </div>
                </div>
                ${skippedEmpty > 0 ? `<div style="margin-top:8px;font-size:.72rem;color:var(--text-secondary)">⏭️ ${skippedEmpty} empty row(s) skipped</div>` : ""}
            </div>
        </div>

        <!-- Progress Bar -->
        <div style="margin-bottom:24px">
            <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:6px;font-weight:500">
                <span>Import Performance</span>
                <span style="color:${successRate >= 80 ? 'var(--success)' : successRate >= 50 ? 'var(--warning)' : 'var(--danger)'}">${successRate}% Success</span>
            </div>
            <div style="background:var(--body-bg);border-radius:10px;height:18px;overflow:hidden;border:1px solid var(--border)">
                <div style="height:100%;display:flex">
                    <div style="width:${successRate}%;background:linear-gradient(90deg,#22c55e,#4ade80);transition:width .5s ease;border-radius:${failRate === 0 ? '10px' : '10px 0 0 10px'}"></div>
                    <div style="width:${failRate}%;background:linear-gradient(90deg,#ef4444,#f87171);transition:width .5s ease;border-radius:${successRate === 0 ? '10px' : '0 10px 10px 0'}"></div>
                </div>
            </div>
            <div style="display:flex;gap:16px;margin-top:6px;font-size:.72rem;color:var(--text-secondary)">
                <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#22c55e;margin-right:4px"></span>Ingested: ${successful}</span>
                <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ef4444;margin-right:4px"></span>Issues: ${failed}</span>
                ${skippedEmpty > 0 ? `<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#9ca3af;margin-right:4px"></span>Skipped: ${skippedEmpty}</span>` : ""}
            </div>
        </div>
    `;

    // Errors Detail Section
    if (errors.length > 0) {
        html += `
        <div style="border:1px solid #fecaca;border-radius:var(--radius);padding:16px;background:#fff5f5">
            <h4 style="margin:0 0 8px;color:var(--danger);font-size:.92rem">⚠️ ${errors.length} Row(s) Need Attention</h4>
            <p style="font-size:.78rem;color:var(--text-secondary);margin:0 0 14px">
                These rows were <strong>not imported</strong>. Fix them in your spreadsheet and <strong>re-upload</strong> to complete the import.
            </p>

            <!-- Issue Type Breakdown -->
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">`;

        for (const [issueType, items] of Object.entries(errorsByType)) {
            const label = issueTypeLabels[issueType] || issueType;
            const color = issueTypeColors[issueType] || "#6b7280";
            html += `<span style="display:inline-flex;align-items:center;gap:4px;font-size:.72rem;padding:4px 10px;border-radius:20px;background:${color}15;border:1px solid ${color}40;color:${color}">${label}: <strong>${items.length}</strong></span>`;
        }
        html += `</div>`;

        // Error table
        html += `
            <div style="max-height:280px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);background:var(--card-bg)">
                <table style="font-size:.75rem;width:100%;border-collapse:collapse">
                    <thead style="position:sticky;top:0;background:var(--body-bg);z-index:1">
                        <tr>
                            <th style="padding:10px 8px;text-align:left;border-bottom:2px solid var(--border);font-weight:600">Row #</th>
                            <th style="padding:10px 8px;text-align:left;border-bottom:2px solid var(--border);font-weight:600">Issue Type</th>
                            <th style="padding:10px 8px;text-align:left;border-bottom:2px solid var(--border);font-weight:600">Row Data</th>
                            <th style="padding:10px 8px;text-align:left;border-bottom:2px solid var(--border);font-weight:600">What to Fix</th>
                        </tr>
                    </thead>
                    <tbody>`;

        errors.forEach((err, idx) => {
            const dataStr = err.data ? Object.entries(err.data)
                .filter(([_, v]) => v)
                .map(([k, v]) => `<strong>${k}</strong>: ${escapeHtml(String(v).substring(0, 25))}`)
                .join(" | ") : "—";
            const typeLabel = issueTypeLabels[err.issue_type] || err.issue_type;
            const color = issueTypeColors[err.issue_type] || "#6b7280";
            const bgColor = idx % 2 === 0 ? "transparent" : "var(--body-bg)";
            html += `<tr style="background:${bgColor}">
                <td style="padding:8px;font-weight:700;color:var(--text-primary)">${err.row}</td>
                <td style="padding:8px"><span style="font-size:.65rem;padding:2px 8px;border-radius:12px;background:${color}15;color:${color};border:1px solid ${color}30;white-space:nowrap">${typeLabel}</span></td>
                <td style="padding:8px;font-size:.7rem;color:var(--text-secondary)">${dataStr}</td>
                <td style="padding:8px;color:var(--danger);font-weight:500">${escapeHtml(err.issue)}</td>
            </tr>`;
        });

        html += `</tbody></table></div>
        </div>`;
    } else {
        html += `<div style="text-align:center;padding:30px;background:#f0fdf4;border-radius:var(--radius);border:1px solid #bbf7d0">
            <div style="font-size:2.5rem">🎉</div>
            <p style="margin-top:10px;font-weight:700;font-size:1.05rem;color:var(--success)">All records imported successfully!</p>
            <p style="margin-top:4px;font-size:.8rem;color:var(--text-secondary)">No issues found — all ${successful} records are now in the database.</p>
        </div>`;
    }

    document.getElementById("importResultsBody").innerHTML = html;
    document.getElementById("importResultsTitle").textContent = `📊 Import Results — ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    document.getElementById("importResultsModal").classList.add("open");

    // Render the donut chart after modal is visible
    setTimeout(() => {
        const ctx = document.getElementById("importResultChart");
        if (ctx && typeof Chart !== 'undefined') {
            new Chart(ctx, {
                type: "doughnut",
                data: {
                    labels: ["Ingested", "Issues", ...(skippedEmpty > 0 ? ["Skipped"] : [])],
                    datasets: [{
                        data: [successful, failed, ...(skippedEmpty > 0 ? [skippedEmpty] : [])],
                        backgroundColor: ["#22c55e", "#ef4444", ...(skippedEmpty > 0 ? ["#9ca3af"] : [])],
                        borderWidth: 2,
                        borderColor: "#fff",
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    cutout: "65%",
                    plugins: {
                        legend: { display: false },
                        tooltip: { bodyFont: { size: 11 } },
                    },
                },
                plugins: [{
                    id: "centerText",
                    afterDraw(chart) {
                        const { ctx: c, width, height } = chart;
                        c.save();
                        c.font = "bold 18px Inter, sans-serif";
                        c.textAlign = "center";
                        c.textBaseline = "middle";
                        c.fillStyle = successRate >= 80 ? "#22c55e" : successRate >= 50 ? "#f59e0b" : "#ef4444";
                        c.fillText(`${successRate}%`, width / 2, height / 2);
                        c.restore();
                    }
                }]
            });
        }
    }, 100);
}

function closeImportResultsModal() {
    document.getElementById("importResultsModal").classList.remove("open");
}

function goToImportHistory() {
    closeImportResultsModal();
    // Navigate to import-history page
    document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
    const navItem = document.querySelector('[data-page="import-history"]');
    if (navItem) navItem.classList.add("active");
    document.querySelectorAll(".content-area").forEach(p => p.style.display = "none");
    document.getElementById("page-import-history").style.display = "block";
    document.getElementById("pageTitle").textContent = "Import History";
    loadImportHistory();
}

// ===== IMPORT HISTORY PAGE =====
let currentHistoryId = null;
let importRecordSearchTimeout = null;

async function loadImportHistory() {
    try {
        const typeFilter = document.getElementById("importHistoryTypeFilter")?.value || "";
        let params = typeFilter ? `?import_type=${typeFilter}` : "";
        const items = await api(`/excel/import-history${params}`);

        // Summary of last import
        const summaryEl = document.getElementById("importHistorySummary");
        if (items.length > 0) {
            const last = items[0];
            summaryEl.innerHTML = `
                <div class="stats-row">
                    <div class="stat-card">
                        <div class="label">Last Import</div>
                        <div class="value" style="font-size:1.2rem">${escapeHtml(last.file_name)}</div>
                        <div class="sub">${new Date(last.created_at).toLocaleString()}</div>
                    </div>
                    <div class="stat-card">
                        <div class="label">Success Rate</div>
                        <div class="value" style="color:${last.success_rate >= 80 ? 'var(--success)' : last.success_rate >= 50 ? 'var(--warning)' : 'var(--danger)'}">${last.success_rate}%</div>
                    </div>
                    <div class="stat-card">
                        <div class="label">✅ Ingested</div>
                        <div class="value" style="color:var(--success)">${last.successful}</div>
                    </div>
                    <div class="stat-card">
                        <div class="label">❌ Failed</div>
                        <div class="value" style="color:${last.failed > 0 ? 'var(--danger)' : 'var(--text-secondary)'}">${last.failed}</div>
                    </div>
                    <div class="stat-card">
                        <div class="label">Total Imports</div>
                        <div class="value">${items.length}</div>
                    </div>
                </div>`;
        } else {
            summaryEl.innerHTML = `<div class="empty-state"><p>No imports yet. Upload a template to get started.</p></div>`;
        }

        // History table
        const container = document.getElementById("importHistoryTable");
        if (!items.length) {
            container.innerHTML = `<div class="empty-state"><div class="icon">📦</div><p>No import history found.</p></div>`;
            return;
        }
        container.innerHTML = `
            <table>
                <thead><tr>
                    <th>Date</th><th>Type</th><th>File</th><th>Total</th><th>✅ Success</th><th>❌ Failed</th><th>Rate</th><th>Actions</th>
                </tr></thead>
                <tbody>
                    ${items.map(h => {
                        const rateColor = h.success_rate >= 80 ? 'var(--success)' : h.success_rate >= 50 ? 'var(--warning)' : 'var(--danger)';
                        return `<tr>
                            <td>${new Date(h.created_at).toLocaleString()}</td>
                            <td><span class="badge badge-proceed">${h.import_type}</span></td>
                            <td style="font-size:.78rem">${escapeHtml(h.file_name)}</td>
                            <td>${h.total_processed}</td>
                            <td style="color:var(--success);font-weight:600">${h.successful}</td>
                            <td style="color:${h.failed > 0 ? 'var(--danger)' : 'inherit'};font-weight:${h.failed > 0 ? '600' : 'normal'}">${h.failed}</td>
                            <td><span style="color:${rateColor};font-weight:600">${h.success_rate}%</span></td>
                            <td>
                                <button class="btn-outline" style="padding:3px 8px;font-size:.7rem" onclick="viewImportRecords(${h.id}, '${escapeHtml(h.file_name)}')">📋 View</button>
                                <button class="btn-outline" style="padding:3px 8px;font-size:.7rem" onclick="exportImportRecordsById(${h.id}, 'failed', 'excel')">📥 Errors</button>
                            </td>
                        </tr>`;
                    }).join("")}
                </tbody>
            </table>`;
    } catch (e) { toast("Failed to load import history: " + e.message, "error"); }
}

function viewImportRecords(historyId, fileName) {
    currentHistoryId = historyId;
    document.getElementById("importRecordsSection").style.display = "block";
    document.getElementById("importRecordsTitle").textContent = `Records: ${fileName}`;
    document.getElementById("importRecordStatusFilter").value = "";
    document.getElementById("importRecordSearch").value = "";
    loadImportRecords();
}

async function loadImportRecords() {
    if (!currentHistoryId) return;
    try {
        const status = document.getElementById("importRecordStatusFilter")?.value || "";
        const search = document.getElementById("importRecordSearch")?.value.trim() || "";
        let params = `?page_size=100`;
        if (status) params += `&status=${status}`;
        if (search) params += `&search=${encodeURIComponent(search)}`;

        const data = await api(`/excel/import-history/${currentHistoryId}/records${params}`);
        const container = document.getElementById("importRecordsTable");

        if (!data.records.length) {
            container.innerHTML = `<div class="empty-state"><p>No records match your filter.</p></div>`;
            return;
        }

        container.innerHTML = `
            <div style="font-size:.75rem;color:var(--text-secondary);padding:8px 16px">Showing ${data.records.length} of ${data.total} records</div>
            <table style="font-size:.82rem">
                <thead><tr>
                    <th>Row</th><th>Status</th><th>Name</th><th>Issue</th><th>Details</th>
                </tr></thead>
                <tbody>
                    ${data.records.map(r => {
                        const isFailed = r.status === "failed";
                        const rowStyle = isFailed ? 'background:#fff5f5;' : '';
                        const errorTooltip = r.error_message ? `title="${escapeHtml(r.error_message)}"` : '';
                        return `<tr style="${rowStyle}" ${errorTooltip}>
                            <td>${r.row_number}</td>
                            <td>${isFailed ? '<span class="badge badge-stopped" style="font-size:.68rem">❌ Failed</span>' : '<span class="badge badge-proceed" style="font-size:.68rem">✅ Success</span>'}</td>
                            <td><strong>${escapeHtml(r.record_name || "—")}</strong></td>
                            <td>${isFailed ? `<span style="color:var(--danger);font-size:.75rem" title="${escapeHtml(r.error_message || '')}">${escapeHtml(r.issue_type || "error")}</span>` : "—"}</td>
                            <td style="font-size:.72rem;color:var(--text-secondary);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(r.error_message || '')}">${isFailed ? escapeHtml(r.error_message || "") : "✓"}</td>
                        </tr>`;
                    }).join("")}
                </tbody>
            </table>`;
    } catch (e) { toast("Failed to load records: " + e.message, "error"); }
}

function handleImportRecordSearch() {
    clearTimeout(importRecordSearchTimeout);
    importRecordSearchTimeout = setTimeout(() => loadImportRecords(), 300);
}

function exportImportRecords(format) {
    if (!currentHistoryId) return;
    const status = document.getElementById("importRecordStatusFilter")?.value || "";
    let url = `${API}/excel/import-history/${currentHistoryId}/export?format=${format}`;
    if (status) url += `&status=${status}`;
    window.open(url, "_blank");
}

function exportImportRecordsById(historyId, status, format) {
    let url = `${API}/excel/import-history/${historyId}/export?format=${format}`;
    if (status) url += `&status=${status}`;
    window.open(url, "_blank");
}

// ===== IMPORT SCHEDULE =====
function openScheduleModal() {
    document.getElementById("scheduleModal").classList.add("open");
    loadCurrentSchedules();
}
function closeScheduleModal() { document.getElementById("scheduleModal").classList.remove("open"); }

async function loadCurrentSchedules() {
    try {
        const items = await api("/excel/schedule");
        const container = document.getElementById("currentSchedules");
        if (!items.length) { container.innerHTML = `<p style="font-size:.78rem;color:var(--text-secondary)">No schedules configured.</p>`; return; }
        container.innerHTML = `
            <h4 style="font-size:.85rem;margin-bottom:8px">Current Schedules</h4>
            <table style="font-size:.78rem">
                <thead><tr><th>Type</th><th>Interval</th><th>Next Run</th><th></th></tr></thead>
                <tbody>${items.map(s => `<tr>
                    <td><span class="badge badge-proceed">${s.import_type}</span></td>
                    <td>${s.interval}</td>
                    <td>${s.next_run ? new Date(s.next_run).toLocaleString() : "—"}</td>
                    <td><button class="btn-danger" style="padding:2px 6px;font-size:.65rem" onclick="deleteSchedule(${s.id})">🗑</button></td>
                </tr>`).join("")}</tbody>
            </table>`;
    } catch (_) {}
}

async function saveSchedule() {
    const importType = document.getElementById("fScheduleType").value;
    const interval = document.getElementById("fScheduleInterval").value;
    const email = document.getElementById("fScheduleEmail").value.trim();
    const inApp = document.getElementById("fScheduleInApp").checked;
    try {
        let url = `/excel/schedule?import_type=${importType}&interval=${interval}&notify_in_app=${inApp}`;
        if (email) url += `&notify_email=${encodeURIComponent(email)}`;
        await api(url, { method: "POST" });
        toast(`Schedule for ${importType} saved (${interval}).`);
        loadCurrentSchedules();
    } catch (e) { toast("Failed to save schedule: " + e.message, "error"); }
}

async function deleteSchedule(id) {
    if (!confirm("Delete this schedule?")) return;
    try { await api(`/excel/schedule/${id}`, { method: "DELETE" }); toast("Schedule deleted."); loadCurrentSchedules(); }
    catch (e) { toast("Failed: " + e.message, "error"); }
}

// ===== Health & Analytics Config =====
async function loadHealth() {
    try { const h = await api("/health"); document.getElementById("envBadge").textContent = h.environment.toUpperCase(); } catch (_) {}
}

async function checkAnalyticsConfig() {
    try {
        const config = await api("/analytics/config");
        analyticsEnabled = config.enabled;
        if (!analyticsEnabled) {
            document.getElementById("navAnalytics").style.display = "none";
        }
    } catch (_) {}
}

// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {
    loadHealth();
    loadAllMedia();
    loadStatusDefinitions();
    checkAnalyticsConfig();

    // Route to the page specified in URL path, or default to dashboard
    const initialPage = getPageFromURL() || "dashboard";
    navigateToPage(initialPage);
});
