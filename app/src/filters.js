// Sidebar filter/search UI. Populates checkbox groups from values present in
// the dataset, and applies filters with AND logic across categories and OR
// logic within each category. An unchecked category does not filter.
export function initFilters(siteData, onFilterChange) {
  const features = siteData.features || [];

  const searchInput = document.getElementById('search-input');
  const resetButton = document.getElementById('reset-filters');
  const groups = {
    land_manager: document.querySelector('#filter-land-manager .checkbox-group'),
    access: document.querySelector('#filter-access .checkbox-group'),
    amenities: document.querySelector('#filter-amenities .checkbox-group'),
  };

  buildCheckboxGroup(groups.land_manager, 'land_manager', uniqueValues(features, (p) => p.land_manager));
  buildCheckboxGroup(groups.access, 'access', uniqueValues(features, (p) => p.access));
  buildCheckboxGroup(
    groups.amenities,
    'amenities',
    uniqueValues(features, (p) => (Array.isArray(p.amenities) ? p.amenities : [])),
  );

  const applyFilters = () => {
    const filtered = filterFeatures(features, {
      query: searchInput.value,
      land_manager: checkedValues(groups.land_manager),
      access: checkedValues(groups.access),
      amenities: checkedValues(groups.amenities),
    });

    onFilterChange({ type: 'FeatureCollection', features: filtered });
  };

  searchInput.addEventListener('input', applyFilters);
  document.getElementById('sidebar').addEventListener('change', (e) => {
    if (e.target.matches('input[type="checkbox"]')) applyFilters();
  });

  resetButton.addEventListener('click', () => {
    searchInput.value = '';
    for (const box of document.querySelectorAll('#sidebar input[type="checkbox"]')) {
      box.checked = false;
    }
    applyFilters();
  });

  initSidebarToggle();
}

// Pure filter predicate, exported for testing.
// criteria: { query: string, land_manager: Set, access: Set, amenities: Set }
// A site must match the name query AND match each checked category; within a
// category, any checked value matches (OR). A category with nothing checked
// does not filter.
export function filterFeatures(features, criteria) {
  const query = (criteria.query || '').trim().toLowerCase();
  const checked = {
    land_manager: criteria.land_manager || new Set(),
    access: criteria.access || new Set(),
    amenities: criteria.amenities || new Set(),
  };

  return features.filter((f) => {
    const p = f.properties || {};

    if (query && !(p.name || '').toLowerCase().includes(query)) return false;

    if (checked.land_manager.size > 0 && !checked.land_manager.has(p.land_manager)) return false;
    if (checked.access.size > 0 && !checked.access.has(p.access)) return false;
    if (checked.amenities.size > 0) {
      const siteAmenities = Array.isArray(p.amenities) ? p.amenities : [];
      if (!siteAmenities.some((a) => checked.amenities.has(a))) return false;
    }

    return true;
  });
}

function uniqueValues(features, extract) {
  const values = new Set();
  for (const f of features) {
    const v = extract(f.properties || {});
    if (Array.isArray(v)) v.forEach((x) => x && values.add(x));
    else if (v) values.add(v);
  }
  return [...values].sort();
}

function buildCheckboxGroup(container, name, values) {
  container.innerHTML = '';
  if (values.length === 0) {
    container.innerHTML = '<p class="empty-note">None in dataset</p>';
    return;
  }
  for (const value of values) {
    const id = `filter-${name}-${value}`;
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    label.htmlFor = id;
    label.innerHTML = `<input type="checkbox" id="${id}" name="${name}" value="${value}" /> ${value}`;
    container.appendChild(label);
  }
}

function checkedValues(container) {
  return new Set(
    [...container.querySelectorAll('input[type="checkbox"]:checked')].map((el) => el.value),
  );
}

// Collapse the sidebar to a toggle button on narrow viewports.
function initSidebarToggle() {
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');

  const syncToggleState = () => {
    const collapsed = sidebar.classList.contains('collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
  };

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    syncToggleState();
  });

  // Start collapsed on small screens, expanded on desktop.
  const mq = window.matchMedia('(max-width: 600px)');
  const applyInitial = () => {
    sidebar.classList.toggle('collapsed', mq.matches);
    toggle.classList.toggle('hidden', !mq.matches);
    syncToggleState();
  };
  mq.addEventListener('change', applyInitial);
  applyInitial();
}
