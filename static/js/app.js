/**
 * Content Dashboard — Frontend Application v2.4
 * Vanilla JS — no build step needed.
 * Features: Consolidated Media, Enhanced Links, Analytics, Dynamic Status,
 *           Dashboard Filters, Excel Export/Import, Title-case Media Names
 */

const API = "/api/v1";

// ===== State =====
let chartInstances = {};
let currentCalendarDate = new Date();
let allMedia = [];
let allStatusDefs = [];
let searchTimeout = null;

// ===== Navigation =====
document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
        document.querySelectorAll(".nav-item").forEach((i) => i.classList.remove("active"));
        item.classList.add("active");

        const page = item.dataset.page;
        document.getElementById("pageTitle").textContent = item.textContent.trim();

        document.querySelectorAll(".content-area").forEach((p) => (p.style.display = "none"));
        const el = document.getElementById("page-" + page);
        if (el) el.style.display = "block";

        switch (page) {
            case "dashboard": loadDashboard(); break;
            case "media": loadMediaPage(); break;
            case "links": loadLinks(); break;
            case "status-tracking": loadStatuses(); break;
            case "status-mgmt": loadStatusDefs(); break;
            case "analytics": loadAnalytics(); break;
            case "reports": loadReport(); break;
            case "statistics": loadStatistics(); break;
            case "tasks": loadTasks(); renderCalendar(); break;
        }
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
        const data = await api("/media/?page_size=200");
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
    // Restore previously selected value if still valid
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
    sel.innerHTML = '<option value="">-- Select Media --</option>';
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

        // Build stats cards based on data filter
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

        // Category chart - show placeholder if empty
        const catLabels = Object.keys(stats.category_distribution || {});
        const catValues = Object.values(stats.category_distribution || {});
        renderChart("categoryChart", "doughnut", {
            labels: catLabels.length ? catLabels : ["No Data"],
            datasets: [{ data: catValues.length ? catValues : [1], backgroundColor: catLabels.length ? ["#3b82f6", "#8b5cf6", "#f59e0b", "#22c55e", "#ef4444"] : ["#e2e8f0"] }],
        });

        // Status chart
        const statusLabels = Object.keys(stats.status_distribution || {});
        const statusValues = Object.values(stats.status_distribution || {});
        renderChart("statusChart", "bar", {
            labels: statusLabels.length ? statusLabels : ["No Data"],
            datasets: [{ label: "Count", data: statusValues.length ? statusValues : [0], backgroundColor: "#3b82f6", borderRadius: 4 }],
        });

        // Recent media
        let recentParams = "?page_size=10";
        if (categoryFilter) recentParams += `&media_category=${categoryFilter}`;
        const recent = await api(`/media/${recentParams}`);
        renderMediaTable(recent.items, "recentMediaTable");
    } catch (e) {
        console.error("[Dashboard]", e);
        toast("Failed to load dashboard: " + e.message, "error");
    }
}

// ===== MEDIA PAGE (Consolidated) =====
async function loadMediaPage() {
    try {
        const category = document.getElementById("mediaCategoryFilter").value;
        const search = document.getElementById("mediaSearchInput").value.trim();
        let params = "?page_size=50";
        if (category) params += `&media_category=${category}`;
        if (search) params += `&search=${encodeURIComponent(search)}`;
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
            <thead><tr><th>Name</th><th>Category</th><th>Genre</th><th>Director</th><th>Rating</th><th>Release Date</th><th>Available</th><th>Actions</th></tr></thead>
            <tbody>
                ${items.map((r) => {
                    const isAvail = r.is_available === "true";
                    return `<tr>
                    <td><strong>${escapeHtml(r.media_name)}</strong></td>
                    <td><span class="badge badge-proceed">${escapeHtml(r.media_category)}</span></td>
                    <td>${escapeHtml(r.genre || "—")}</td>
                    <td>${escapeHtml(r.director || "—")}</td>
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

// ===== LINKS (Enhanced) =====
async function loadLinks() {
    try {
        if (!allMedia.length) await loadAllMedia();
        const search = document.getElementById("linkSearchInput")?.value.trim() || "";
        const status = document.getElementById("linkStatusFilter")?.value || "";
        const category = document.getElementById("linkCategoryFilter")?.value || "";
        let params = "?";
        if (search) params += `search=${encodeURIComponent(search)}&`;
        if (status) params += `link_status=${status}&`;
        if (category) params += `link_category=${category}&`;

        const items = await api(`/media-links/${params}`);
        const container = document.getElementById("linksTable");
        if (!items.length) {
            container.innerHTML = `<div class="empty-state"><div class="icon">🔗</div><p>No links found.</p></div>`;
            return;
        }
        container.innerHTML = `
            <table>
                <thead><tr><th>Media</th><th>Platform</th><th>URL</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                    ${items.map((r) => {
                        const mediaName = allMedia.find(m => m.id === r.media_id)?.media_name || `#${r.media_id}`;
                        return `<tr>
                            <td>${escapeHtml(mediaName)}</td>
                            <td><span class="badge badge-proceed">${escapeHtml(r.platform)}</span></td>
                            <td><a href="${escapeHtml(r.url)}" target="_blank" style="color:var(--info);font-size:.78rem">${escapeHtml(r.url.length > 45 ? r.url.substring(0, 45) + '...' : r.url)}</a></td>
                            <td><span class="badge badge-planned">${escapeHtml(r.link_category || "—")}</span></td>
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
    document.getElementById("linkModalTitle").textContent = "Edit Link";
    document.getElementById("linkModal").classList.add("open");
}

function closeLinkModal() { document.getElementById("linkModal").classList.remove("open"); }

// Searchable media dropdown for links — with "create new" option
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
        toast(`Media "${name}" created. You can update details in Media tab.`);
        await loadAllMedia();
        selectMediaForLink(newMedia.id, newMedia.media_name, newMedia.media_category);
    } catch (e) { toast("Failed to create media: " + e.message, "error"); }
}

// Close dropdown on outside click
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
    try {
        await api(`/media-links/${id}`, { method: "DELETE" });
        toast("Link deleted.");
        loadLinks();
    } catch (e) { toast("Delete failed: " + e.message, "error"); }
}

function downloadLink(id) {
    window.open(`${API}/media-links/download/${id}`, "_blank");
}

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
        // Ensure allMedia is loaded for name resolution
        if (!allMedia.length) await loadAllMedia();
        // Load status definitions for dynamic dropdowns
        if (!allStatusDefs.length) await loadStatusDefinitions();
        populateStatusFilterDropdown("statusStatusFilter", "status_tracking");
        populateStatusDropdown("fStatusValue", "status_tracking");

        const items = await api("/media-status/");
        const container = document.getElementById("statusTable");

        const catFilter = document.getElementById("statusCategoryFilter")?.value || "";
        const statusFilter = document.getElementById("statusStatusFilter")?.value || "";
        const searchTerm = document.getElementById("statusSearchInput")?.value.trim().toLowerCase() || "";

        let filtered = items;
        if (catFilter || statusFilter || searchTerm) {
            filtered = items.filter(r => {
                const media = allMedia.find(m => m.id === r.media_id);
                const cat = media?.media_category || "";
                const name = media?.media_name?.toLowerCase() || "";
                if (catFilter && cat !== catFilter) return false;
                if (statusFilter && r.status !== statusFilter) return false;
                if (searchTerm && !name.includes(searchTerm)) return false;
                return true;
            });
        }

        if (!filtered.length) {
            container.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>No status entries found.</p></div>`;
            return;
        }
        container.innerHTML = `
            <table>
                <thead><tr><th>Media</th><th>Category</th><th>Status</th><th>Notes</th><th>Updated</th><th>Actions</th></tr></thead>
                <tbody>
                    ${filtered.map((r) => {
                        const media = allMedia.find(m => m.id === r.media_id);
                        const mediaName = media?.media_name || `#${r.media_id}`;
                        const mediaCat = media?.media_category || "—";
                        return `<tr>
                            <td><strong>${escapeHtml(mediaName)}</strong></td>
                            <td><span class="badge badge-proceed">${escapeHtml(mediaCat)}</span></td>
                            <td><span class="badge badge-${r.status}">${r.status.replace("_", " ")}</span></td>
                            <td>${escapeHtml(r.notes || "—")}</td>
                            <td>${new Date(r.updated_at).toLocaleDateString()}</td>
                            <td>
                                <button class="btn-outline" onclick='editStatus(${JSON.stringify(r).replace(/'/g, "&#39;")})'>✏️</button>
                                <button class="btn-danger" onclick="deleteStatus(${r.id})">🗑</button>
                            </td>
                        </tr>`;
                    }).join("")}
                </tbody>
            </table>
        `;
    } catch (e) { toast("Failed to load statuses: " + e.message, "error"); }
}

async function openStatusModal() {
    if (!allStatusDefs.length) await loadStatusDefinitions();
    // If still no definitions, auto-seed defaults
    if (!allStatusDefs.length) {
        try {
            await api("/status-definitions/seed", { method: "POST" });
            await loadStatusDefinitions();
            toast("Default statuses seeded automatically.", "success");
        } catch (_) {}
    }
    populateStatusDropdown("fStatusValue", "status_tracking");
    document.getElementById("statusEditId").value = "";
    document.getElementById("fStatusMediaSearch").value = "";
    document.getElementById("fStatusMediaId").value = "";
    document.getElementById("fStatusMediaCategory").value = "";
    document.getElementById("fStatusValue").value = "in_progress";
    document.getElementById("fStatusNotes").value = "";
    document.getElementById("statusMediaSearchDropdown").classList.remove("show");
    document.getElementById("statusModalTitle").textContent = "Add Status";
    document.getElementById("statusModal").classList.add("open");
}

async function editStatus(item) {
    if (!allStatusDefs.length) await loadStatusDefinitions();
    if (!allStatusDefs.length) {
        try {
            await api("/status-definitions/seed", { method: "POST" });
            await loadStatusDefinitions();
        } catch (_) {}
    }
    populateStatusDropdown("fStatusValue", "status_tracking");
    const media = allMedia.find(m => m.id === item.media_id);
    document.getElementById("statusEditId").value = item.id;
    document.getElementById("fStatusMediaSearch").value = media ? media.media_name : "";
    document.getElementById("fStatusMediaId").value = item.media_id;
    document.getElementById("fStatusMediaCategory").value = media ? media.media_category : "";
    document.getElementById("fStatusValue").value = item.status;
    document.getElementById("fStatusNotes").value = item.notes || "";
    document.getElementById("statusMediaSearchDropdown").classList.remove("show");
    document.getElementById("statusModalTitle").textContent = "Edit Status";
    document.getElementById("statusModal").classList.add("open");
}

function closeStatusModal() { document.getElementById("statusModal").classList.remove("open"); }

// Searchable media dropdown for status — with "create new" option
async function searchMediaForStatus() {
    const query = document.getElementById("fStatusMediaSearch").value.trim();
    const dropdown = document.getElementById("statusMediaSearchDropdown");
    if (query.length < 2) { dropdown.classList.remove("show"); return; }
    try {
        const results = await api(`/media-links/search-media?q=${encodeURIComponent(query)}`);
        let html = "";
        if (results.length) {
            html = results.map(m =>
                `<div class="autocomplete-item" onclick="selectMediaForStatus(${m.id}, '${escapeHtml(m.media_name).replace(/'/g, "\\'")}', '${m.media_category}')">${escapeHtml(m.media_name)}<span class="ac-category">${m.media_category}</span></div>`
            ).join("");
        }
        // Always show "Create New" option
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
}

async function createNewMediaFromStatus() {
    const name = document.getElementById("fStatusMediaSearch").value.trim();
    if (!name) { toast("Enter a media name.", "error"); return; }
    try {
        const newMedia = await api("/media/", { method: "POST", body: JSON.stringify({ media_category: "movies", media_name: name }) });
        toast(`Media "${name}" created. You can update details in Media tab.`);
        await loadAllMedia();
        selectMediaForStatus(newMedia.id, newMedia.media_name, newMedia.media_category);
    } catch (e) { toast("Failed to create media: " + e.message, "error"); }
}

async function saveStatus() {
    const id = document.getElementById("statusEditId").value;
    const mediaIdRaw = document.getElementById("fStatusMediaId").value;
    const mediaId = parseInt(mediaIdRaw);
    const statusVal = document.getElementById("fStatusValue").value;
    const payload = {
        media_id: mediaId,
        status: statusVal,
        notes: document.getElementById("fStatusNotes").value.trim() || null,
    };
    if (!mediaIdRaw || isNaN(mediaId)) { toast("Search and select a media item.", "error"); return; }
    if (!statusVal) { toast("Please select a status. If none available, go to Status Management → Seed Defaults.", "error"); return; }
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
    try {
        await api(`/media-status/${id}`, { method: "DELETE" });
        toast("Status deleted.");
        loadStatuses();
    } catch (e) { toast("Delete failed: " + e.message, "error"); }
}

// ===== STATUS MANAGEMENT =====
async function loadStatusDefs() {
    try {
        const items = await api("/status-definitions/all");
        // Also refresh the active definitions cache for dropdowns
        await loadStatusDefinitions();
        const container = document.getElementById("statusDefsTable");
        if (!items.length) {
            container.innerHTML = `<div class="empty-state"><div class="icon">🏷️</div><p>No status definitions yet. Click "Seed Defaults" to add standard statuses.</p></div>`;
            return;
        }
        container.innerHTML = `
            <table>
                <thead><tr><th>Name</th><th>Label</th><th>Context</th><th>Color</th><th>Description</th><th>Active</th><th>Actions</th></tr></thead>
                <tbody>
                    ${items.map(r => `<tr>
                        <td><code>${escapeHtml(r.name)}</code></td>
                        <td><strong>${escapeHtml(r.label)}</strong></td>
                        <td><span class="badge badge-planned">${escapeHtml(r.usage_context)}</span></td>
                        <td>${escapeHtml(r.color || "—")}</td>
                        <td>${escapeHtml(r.description || "—")}</td>
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

function openStatusDefModal() {
    document.getElementById("statusDefEditId").value = "";
    document.getElementById("fStatusDefName").value = "";
    document.getElementById("fStatusDefLabel").value = "";
    document.getElementById("fStatusDefContext").value = "all";
    document.getElementById("fStatusDefColor").value = "";
    document.getElementById("fStatusDefDesc").value = "";
    document.getElementById("statusDefModalTitle").textContent = "Add Status Name";
    document.getElementById("statusDefModal").classList.add("open");
}

function editStatusDef(item) {
    document.getElementById("statusDefEditId").value = item.id;
    document.getElementById("fStatusDefName").value = item.name;
    document.getElementById("fStatusDefLabel").value = item.label;
    document.getElementById("fStatusDefContext").value = item.usage_context || "all";
    document.getElementById("fStatusDefColor").value = item.color || "";
    document.getElementById("fStatusDefDesc").value = item.description || "";
    document.getElementById("statusDefModalTitle").textContent = "Edit Status Name";
    document.getElementById("statusDefModal").classList.add("open");
}

function closeStatusDefModal() { document.getElementById("statusDefModal").classList.remove("open"); }

async function saveStatusDef() {
    const id = document.getElementById("statusDefEditId").value;
    const payload = {
        name: document.getElementById("fStatusDefName").value.trim(),
        label: document.getElementById("fStatusDefLabel").value.trim(),
        usage_context: document.getElementById("fStatusDefContext").value,
        color: document.getElementById("fStatusDefColor").value.trim() || null,
        description: document.getElementById("fStatusDefDesc").value.trim() || null,
    };
    if (!payload.name || !payload.label) { toast("Name and Label are required.", "error"); return; }
    try {
        if (id) {
            await api(`/status-definitions/${id}`, { method: "PUT", body: JSON.stringify(payload) });
            toast("Status definition updated.");
        } else {
            await api("/status-definitions/", { method: "POST", body: JSON.stringify(payload) });
            toast("Status definition created.");
        }
        closeStatusDefModal();
        loadStatusDefs();
    } catch (e) { toast("Failed to save: " + e.message, "error"); }
}

async function deleteStatusDef(id) {
    if (!confirm("Delete this status definition?")) return;
    try {
        await api(`/status-definitions/${id}`, { method: "DELETE" });
        toast("Status definition deleted.");
        loadStatusDefs();
    } catch (e) { toast("Delete failed: " + e.message, "error"); }
}

async function seedDefaultStatuses() {
    try {
        const result = await api("/status-definitions/seed", { method: "POST" });
        toast(result.message);
        loadStatusDefs();
    } catch (e) { toast("Seed failed: " + e.message, "error"); }
}

// ===== ANALYTICS (New Tab) =====
async function loadAnalytics() {
    try {
        const stats = await api("/dashboard/stats");
        const report = await api("/dashboard/reports?");

        document.getElementById("analyticsStats").innerHTML = `
            <div class="stat-card"><div class="label">Total Media</div><div class="value">${stats.total_media}</div></div>
            <div class="stat-card"><div class="label">Total Links</div><div class="value">${stats.total_links}</div></div>
            <div class="stat-card"><div class="label">Total Tasks</div><div class="value">${stats.total_tasks}</div></div>
            <div class="stat-card"><div class="label">Avg Rating</div><div class="value">${report.items.length ? (report.items.reduce((s,i) => s + (i.rating||0), 0) / report.items.filter(i=>i.rating).length || 0).toFixed(1) : '—'}</div></div>
        `;

        // Category bar chart
        renderChart("analyticsCategoryChart", "bar", {
            labels: Object.keys(stats.category_distribution),
            datasets: [{ label: "Media Count", data: Object.values(stats.category_distribution), backgroundColor: ["#3b82f6", "#8b5cf6", "#f59e0b", "#22c55e"], borderRadius: 4 }],
        });

        // Rating distribution
        renderChart("analyticsRatingChart", "bar", {
            labels: Object.keys(report.by_rating),
            datasets: [{ label: "Count", data: Object.values(report.by_rating), backgroundColor: ["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#3b82f6"], borderRadius: 4 }],
        });

        // Links by platform
        const links = await api("/media-links/");
        const platformCounts = {};
        links.forEach(l => { platformCounts[l.platform] = (platformCounts[l.platform] || 0) + 1; });
        renderChart("analyticsPlatformChart", "doughnut", {
            labels: Object.keys(platformCounts),
            datasets: [{ data: Object.values(platformCounts), backgroundColor: ["#ef4444", "#f59e0b", "#3b82f6", "#22c55e", "#8b5cf6", "#ec4899", "#6b7280"] }],
        });

        // Status flow
        renderChart("analyticsStatusFlowChart", "bar", {
            labels: Object.keys(stats.status_distribution),
            datasets: [{ label: "Count", data: Object.values(stats.status_distribution), backgroundColor: "#8b5cf6", borderRadius: 4 }],
        });
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
        renderChart("ratingChart", "bar", {
            labels: Object.keys(data.by_rating),
            datasets: [{ label: "Count", data: Object.values(data.by_rating), backgroundColor: ["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#3b82f6"], borderRadius: 4 }],
        });
        renderChart("reportCategoryChart", "doughnut", {
            labels: Object.keys(data.by_category),
            datasets: [{ data: Object.values(data.by_category), backgroundColor: ["#3b82f6", "#8b5cf6", "#f59e0b", "#22c55e"] }],
        });
        renderMediaTable(data.items, "reportTable");
    } catch (e) { toast("Failed to load report: " + e.message, "error"); }
}

function exportCSV() {
    const category = document.getElementById("reportCategory").value;
    let url = `${API}/dashboard/export/csv`;
    if (category) url += `?media_category=${category}`;
    window.open(url, "_blank");
}

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
            <div class="stat-card"><div class="label">Tasks Completed</div><div class="value" style="color:var(--success)">${data.tasks.completed}</div></div>
        `;
        const statusLabels = Object.keys(data.status_counts);
        const statusValues = Object.values(data.status_counts);
        renderChart("statsStatusChart", "pie", {
            labels: statusLabels.length ? statusLabels : ["No Data"],
            datasets: [{ data: statusValues.length ? statusValues : [1], backgroundColor: ["#22c55e", "#3b82f6", "#ef4444", "#f59e0b", "#8b5cf6", "#6b7280", "#ec4899"] }],
        });
        renderChart("statsTaskChart", "doughnut", {
            labels: ["Pending", "In Progress", "Completed"],
            datasets: [{ data: [data.tasks.pending, data.tasks.in_progress, data.tasks.completed], backgroundColor: ["#f59e0b", "#3b82f6", "#22c55e"] }],
        });
    } catch (e) { toast("Failed to load statistics: " + e.message, "error"); }
}

// ===== TODO TASKS =====
async function loadTasks() {
    try {
        const filter = document.getElementById("taskFilter").value;
        let params = filter ? `?status=${filter}` : "";
        const items = await api(`/tasks/${params}`);
        const container = document.getElementById("tasksList");
        if (!items.length) {
            container.innerHTML = `<div class="empty-state"><div class="icon">✅</div><p>No tasks. Add one!</p></div>`;
            return;
        }
        container.innerHTML = items.map((t) => `
            <div class="task-card priority-${t.priority}">
                <div class="task-title">${escapeHtml(t.title)}</div>
                <div class="task-meta">
                    <span class="badge badge-${t.status}">${t.status.replace("_", " ")}</span>
                    <span class="badge badge-${t.priority}">${t.priority}</span>
                    ${t.due_date ? `<span>📅 ${t.due_date}</span>` : ""}
                    <span>📁 ${t.category}</span>
                </div>
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
    document.getElementById("taskModalTitle").textContent = "Edit Task";
    document.getElementById("taskModal").classList.add("open");
}

async function saveTask() {
    const id = document.getElementById("taskEditId").value;
    const payload = {
        title: document.getElementById("fTaskTitle").value.trim(),
        description: document.getElementById("fTaskDesc").value.trim() || null,
        due_date: document.getElementById("fTaskDueDate").value || null,
        priority: document.getElementById("fTaskPriority").value,
        category: document.getElementById("fTaskCategory").value,
        status: document.getElementById("fTaskStatus").value,
    };
    if (!payload.title) { toast("Title is required.", "error"); return; }
    try {
        if (id) {
            await api(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(payload) });
            toast("Task updated.");
        } else {
            await api("/tasks/", { method: "POST", body: JSON.stringify(payload) });
            toast("Task created.");
        }
        closeTaskModal();
        loadTasks();
        renderCalendar();
    } catch (e) { toast("Save failed: " + e.message, "error"); }
}

async function deleteTask(id) {
    if (!confirm("Delete this task?")) return;
    try {
        await api(`/tasks/${id}`, { method: "DELETE" });
        toast("Task deleted.");
        loadTasks();
        renderCalendar();
    } catch (e) { toast("Delete failed: " + e.message, "error"); }
}

// ===== CALENDAR =====
async function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    document.getElementById("calendarTitle").textContent = currentCalendarDate.toLocaleString("default", { month: "long", year: "numeric" });
    const lastDay = new Date(year, month + 1, 0);
    const startDow = new Date(year, month, 1).getDay();
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
    let taskDates = new Set();
    try {
        const tasks = await api(`/tasks/calendar?start_date=${startDate}&end_date=${endDate}`);
        tasks.forEach((t) => { if (t.due_date) taskDates.add(t.due_date); });
    } catch (_) {}
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    let html = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<div class="calendar-day-header">${d}</div>`).join("");
    for (let i = 0; i < startDow; i++) {
        const d = new Date(year, month, -(startDow - i - 1));
        html += `<div class="calendar-day other-month">${d.getDate()}</div>`;
    }
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
    if (type === "media") {
        const cat = document.getElementById("mediaCategoryFilter")?.value;
        if (cat) url += `?media_category=${cat}`;
    } else if (type === "links") {
        const cat = document.getElementById("linkCategoryFilter")?.value;
        const status = document.getElementById("linkStatusFilter")?.value;
        let params = [];
        if (cat) params.push(`link_category=${cat}`);
        if (status) params.push(`link_status=${status}`);
        if (params.length) url += "?" + params.join("&");
    }
    window.open(url, "_blank");
}

function downloadTemplate(type) {
    window.open(`${API}/excel/templates/${type}`, "_blank");
}

async function importExcel(type, input) {
    const file = input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
        const res = await fetch(`${API}/excel/import/${type}`, { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) { toast(data.detail || "Import failed", "error"); return; }
        toast(`${data.message}${data.errors?.length ? ` (${data.errors.length} errors)` : ""}`);
        if (data.errors?.length) {
            console.warn("Import errors:", data.errors);
            toast(`⚠️ ${data.errors.length} rows had errors. Check console.`, "error");
        }
        // Reload the page data
        if (type === "media") { loadMediaPage(); loadAllMedia(); }
        else if (type === "links") { loadLinks(); }
        else if (type === "status") { loadStatuses(); }
    } catch (e) { toast("Import failed: " + e.message, "error"); }
    input.value = ""; // Reset file input
}

// ===== Health badge =====
async function loadHealth() {
    try { const h = await api("/health"); document.getElementById("envBadge").textContent = h.environment.toUpperCase(); } catch (_) {}
}

// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {
    loadHealth();
    loadAllMedia();
    loadStatusDefinitions();
    loadDashboard();
});
