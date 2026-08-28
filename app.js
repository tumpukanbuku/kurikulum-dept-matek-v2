// ==========================================================================
// State Aplikasi & Inisialisasi Data
// ==========================================================================
let allCourses = (window.kurikulumData || []).sort((a, b) => {
  const semA = a.semester ?? 8;
  const semB = b.semester ?? 8;
  if (semA !== semB) return semA - semB;
  return a.kode.localeCompare(b.kode, "id-ID");
});
let filteredCourses = [...allCourses];

// State filter & tampilan
let currentQuery = "";
let currentProdi = "all";
let currentKategori = "all";
let currentSks = "all";
let currentViewMode = "grid"; // 'grid' atau 'table'

// ==========================================================================
// DOM Elements
// ==========================================================================
const searchInput = document.getElementById("search-input");
const clearSearchBtn = document.getElementById("clear-search");
const prodiFilters = document.getElementById("filter-prodi");
const kategoriFilter = document.getElementById("filter-kategori");
const sksFilter = document.getElementById("filter-sks");

const gridViewContainer = document.getElementById("grid-view");
const tableViewContainer = document.getElementById("table-view");
const tableBody = document.getElementById("table-body");
const emptyState = document.getElementById("empty-state");

const gridViewBtn = document.getElementById("view-grid-btn");
const tableViewBtn = document.getElementById("view-table-btn");
const themeToggleBtn = document.getElementById("theme-toggle");

const statTotalCourses = document.getElementById("stat-total-courses");
const statPrereqsCount = document.getElementById("stat-prereqs-count");
const resetFiltersBtn = document.getElementById("reset-filters-btn");

// Detail Dialog
const detailDialog = document.getElementById("course-detail-dialog");
const closeDialogBtn = document.getElementById("close-dialog-btn");

// ==========================================================================
// Logika Tema Gelap/Terang (Dark/Light Mode)
// ==========================================================================
function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  
  if (savedTheme === "dark" || (!savedTheme && systemPrefersDark)) {
    document.documentElement.setAttribute("data-theme", "dark");
    updateThemeToggleIcon(true);
  } else {
    document.documentElement.setAttribute("data-theme", "light");
    updateThemeToggleIcon(false);
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const isDark = currentTheme === "dark";
  const newTheme = isDark ? "light" : "dark";
  
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  updateThemeToggleIcon(!isDark);
}

function updateThemeToggleIcon(isDark) {
  const icon = themeToggleBtn.querySelector("i");
  if (isDark) {
    icon.className = "fa-solid fa-sun";
  } else {
    icon.className = "fa-solid fa-moon";
  }
}

// ==========================================================================
// Logika Pencarian & Pemfilteran Data
// ==========================================================================
function applyFilters() {
  const query = currentQuery.toLowerCase().trim();
  
  filteredCourses = allCourses.filter(course => {
    // 1. Filter Pencarian Text (Kode, Nama, Deskripsi, Prasyarat)
    const matchesQuery = !query || 
      course.nama.toLowerCase().includes(query) || 
      course.kode.toLowerCase().includes(query) || 
      course.deskripsi.toLowerCase().includes(query) ||
      (course.prasyarat && course.prasyarat.some(pre => pre.toLowerCase().includes(query)));
      
    // 2. Filter Program Studi
    const matchesProdi = currentProdi === "all" || 
      (course.prodi && course.prodi.includes(currentProdi));
      
    // 3. Filter Kategori
    const matchesKategori = currentKategori === "all" || 
      course.kategori === currentKategori;
      
    // 4. Filter SKS
    const matchesSks = currentSks === "all" || 
      course.sks.toString() === currentSks;
      
    return matchesQuery && matchesProdi && matchesKategori && matchesSks;
  });
  
  updateStatistics();
  renderContent();
}

function updateStatistics() {
  let totalSks = 0;
  let prereqsCount = 0;
  
  filteredCourses.forEach(course => {
    totalSks += course.sks;
    if (course.prasyarat && course.prasyarat.length > 0 && course.prasyarat[0] !== "Tidak ada") {
      prereqsCount++;
    }
  });
  
  statTotalCourses.innerText = filteredCourses.length;
  statPrereqsCount.innerText = prereqsCount;
}

// ==========================================================================
// Logika Rendering Antarmuka (View Mode)
// ==========================================================================
function renderContent() {
  // Kosongkan container
  gridViewContainer.innerHTML = "";
  tableBody.innerHTML = "";
  
  if (filteredCourses.length === 0) {
    gridViewContainer.style.display = "none";
    tableViewContainer.style.display = "none";
    emptyState.style.display = "flex";
    return;
  }
  
  emptyState.style.display = "none";
  
  if (currentViewMode === "grid") {
    gridViewContainer.style.display = "grid";
    tableViewContainer.style.display = "none";
    renderGridView();
  } else {
    gridViewContainer.style.display = "none";
    tableViewContainer.style.display = "block";
    renderTableView();
  }
}

// Render sebagai Grid Kartu (Grid View)
function renderGridView() {
  filteredCourses.forEach(course => {
    const card = document.createElement("div");
    card.className = "course-card";
    
    // Cek irisan prodi
    const isOverlap = course.prodi && course.prodi.length > 1;
    
    // Siapkan badge prodi
    let prodiHtml = "";
    course.prodi.forEach(p => {
      let labelClass = "prodi-badge";
      if (p === "Matematika") labelClass += " mat";
      else if (p === "Statistika") labelClass += " stat";
      else if (p === "Ilmu Aktuaria") labelClass += " aktu";
      
      if (isOverlap) labelClass += " overlap";
      prodiHtml += `<span class="${labelClass}">${p}</span>`;
    });
    
    card.innerHTML = `
      <div class="card-top">
        <span class="card-code">${course.kode}</span>
        <span class="card-sks">${course.sks} SKS</span>
      </div>
      <h3 class="card-name">${course.nama}</h3>
      <div class="card-bottom">
        <span class="card-category">${course.kategori.replace("Mata Kuliah ", "")}</span>
        <div class="card-prodis">
          ${prodiHtml}
        </div>
      </div>
    `;
    
    card.addEventListener("click", () => openCourseDetail(course));
    gridViewContainer.appendChild(card);
  });
}

// Render sebagai Baris Tabel (Table View)
function renderTableView() {
  filteredCourses.forEach((course, index) => {
    const row = document.createElement("tr");
    
    row.innerHTML = `
      <td style="text-align: center; color: var(--text-faint); font-weight: 600;">${index + 1}</td>
      <td class="table-code">${course.kode}</td>
      <td class="table-name">${course.nama}</td>
      <td class="table-category">${course.kategori}</td>
      <td class="table-sks">${course.sks}</td>
      <td class="table-semester">${course.semester || "—"}</td>
    `;
    
    row.addEventListener("click", () => openCourseDetail(course));
    tableBody.appendChild(row);
  });
}

// ==========================================================================
// Logika Dialog Detail & MathJax (UI/UX Enhance)
// ==========================================================================
function openCourseDetail(course) {
  document.getElementById("modal-course-name").innerText = course.nama;
  document.getElementById("modal-course-code").innerText = course.kode;
  document.getElementById("modal-sks").innerText = `${course.sks} SKS`;
  
  const modalCategory = document.getElementById("modal-category");
  modalCategory.innerText = course.kategori;
  
  // Render prodi tags di modal
  const modalProdiList = document.getElementById("modal-prodi-list");
  modalProdiList.innerHTML = "";
  course.prodi.forEach(p => {
    const tag = document.createElement("span");
    let labelClass = "dialog-prodi-tag";
    if (p === "Matematika") labelClass += " mat";
    else if (p === "Statistika") labelClass += " stat";
    else if (p === "Ilmu Aktuaria") labelClass += " aktu";
    
    tag.className = labelClass;
    tag.innerText = p;
    modalProdiList.appendChild(tag);
  });
  
  // Render deskripsi (LaTeX support)
  const modalDescription = document.getElementById("modal-description");
  modalDescription.innerHTML = course.deskripsi || "Tidak ada deskripsi mata kuliah pada berkas sumber.";
  
  // Render prasyarat
  const modalPrereqs = document.getElementById("modal-prereqs");
  modalPrereqs.innerHTML = "";
  
  if (course.prasyarat && course.prasyarat.length > 0 && course.prasyarat[0] !== "Tidak ada") {
    course.prasyarat.forEach(preCode => {
      // Cari jika ada objek mata kuliah prasyarat dengan kode yang cocok
      const foundPre = allCourses.find(c => c.kode === preCode);
      const preLabel = foundPre ? `${preCode} - ${foundPre.nama}` : preCode;
      
      const link = document.createElement("a");
      link.className = "prereq-link";
      link.innerHTML = preLabel;
      
      if (foundPre) {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          // Buka langsung detail prasyarat tersebut
          openCourseDetail(foundPre);
        });
      }
      modalPrereqs.appendChild(link);
    });
  } else {
    modalPrereqs.innerHTML = '<span class="prereq-empty">Tidak ada prasyarat</span>';
  }
  
  // Render referensi buku wajib
  const modalReferences = document.getElementById("modal-references");
  modalReferences.innerHTML = "";
  if (course.referensi && course.referensi.length > 0) {
    course.referensi.forEach(ref => {
      const li = document.createElement("li");
      li.innerText = ref;
      modalReferences.appendChild(li);
    });
  } else {
    modalReferences.innerHTML = '<li class="prereq-empty">Tidak ada referensi buku terdaftar</li>';
  }
  
  // Buka Dialog Native
  detailDialog.showModal();
  
  // Render ulang rumus LaTeX dinamis di dalam modal menggunakan MathJax
  if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
    window.MathJax.typesetPromise([modalDescription]).catch((err) => console.log(err.message));
  }
}

// Close dialog
closeDialogBtn.addEventListener("click", () => {
  detailDialog.close();
});

// Close dialog click outside (backdrop)
detailDialog.addEventListener("click", (e) => {
  const dialogDimensions = detailDialog.getBoundingClientRect();
  if (
    e.clientX < dialogDimensions.left ||
    e.clientX > dialogDimensions.right ||
    e.clientY < dialogDimensions.top ||
    e.clientY > dialogDimensions.bottom
  ) {
    detailDialog.close();
  }
});

// ==========================================================================
// Bootstrapping & Event Listeners
// ==========================================================================
function initApp() {
  initTheme();
  
  // Search input listeners
  searchInput.addEventListener("input", (e) => {
    currentQuery = e.target.value;
    applyFilters();
  });
  
  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    currentQuery = "";
    applyFilters();
  });
  

  
  // Prodi Filter Pills click listeners
  prodiFilters.addEventListener("click", (e) => {
    if (e.target.classList.contains("pill-btn")) {
      prodiFilters.querySelectorAll(".pill-btn").forEach(btn => btn.classList.remove("active"));
      e.target.classList.add("active");
      currentProdi = e.target.dataset.value;
      applyFilters();
    }
  });
  
  // Select Dropdown listeners
  kategoriFilter.addEventListener("change", (e) => {
    currentKategori = e.target.value;
    applyFilters();
  });
  
  sksFilter.addEventListener("change", (e) => {
    currentSks = e.target.value;
    applyFilters();
  });
  
  // Reset all filters button
  const resetAll = () => {
    searchInput.value = "";
    currentQuery = "";
    currentKategori = "all";
    currentSks = "all";
    currentProdi = "all";
    
    kategoriFilter.value = "all";
    sksFilter.value = "all";
    
    prodiFilters.querySelectorAll(".pill-btn").forEach(btn => btn.classList.remove("active"));
    prodiFilters.querySelector('[data-value="all"]').classList.add("active");
    
    applyFilters();
  };
  
  resetFiltersBtn.addEventListener("click", resetAll);
  
  // View Toggle listeners
  gridViewBtn.addEventListener("click", () => {
    if (currentViewMode !== "grid") {
      currentViewMode = "grid";
      gridViewBtn.classList.add("active");
      tableViewBtn.classList.remove("active");
      renderContent();
    }
  });
  
  tableViewBtn.addEventListener("click", () => {
    if (currentViewMode !== "table") {
      currentViewMode = "table";
      tableViewBtn.classList.add("active");
      gridViewBtn.classList.remove("active");
      renderContent();
    }
  });
  
  // Theme Toggle listener
  themeToggleBtn.addEventListener("click", toggleTheme);
  
  // Jalankan render awal
  applyFilters();
}

window.addEventListener("DOMContentLoaded", initApp);
