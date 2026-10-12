(() => {
  const views = [...document.querySelectorAll(".view")];
  const navButtons = [...document.querySelectorAll("[data-view]")];
  const currentSection = document.querySelector("#current-section");
  const sidebar = document.querySelector("#sidebar");
  const mobileMenu = document.querySelector(".mobile-menu");
  const validViews = new Set(views.map((view) => view.id.replace("view-", "")));

  function showView(name, updateHash = true) {
    const viewName = validViews.has(name) ? name : "inicio";
    views.forEach((view) => {
      const active = view.id === `view-${viewName}`;
      view.hidden = !active;
      view.classList.toggle("is-visible", active);
    });
    navButtons.forEach((button) => {
      const active = button.dataset.view === viewName;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    currentSection.textContent = document.querySelector(`#view-${viewName}`).dataset.title;
    document.title = `${currentSection.textContent} · Nexova Workspace`;
    if (updateHash && window.location.hash !== `#${viewName}`) {
      history.replaceState(null, "", `#${viewName}`);
    }
    sidebar.classList.remove("is-open");
    mobileMenu.setAttribute("aria-expanded", "false");
  }

  navButtons.forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });
  document.querySelectorAll("[data-navigate]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.navigate));
  });
  window.addEventListener("hashchange", () => {
    showView(window.location.hash.slice(1), false);
  });

  mobileMenu.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("is-open");
    mobileMenu.setAttribute("aria-expanded", String(isOpen));
    mobileMenu.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sidebar.classList.contains("is-open")) {
      sidebar.classList.remove("is-open");
      mobileMenu.setAttribute("aria-expanded", "false");
      mobileMenu.focus();
    }
  });

  document.querySelectorAll(".notice-close").forEach((button) => {
    button.addEventListener("click", () => button.closest(".notice").remove());
  });

  const search = document.querySelector("#team-search");
  const teamCards = [...document.querySelectorAll(".team-card")];
  const emptySearch = document.querySelector("#empty-search");
  search.addEventListener("input", () => {
    const query = search.value.trim().toLocaleLowerCase("es");
    let visibleCount = 0;
    teamCards.forEach((card) => {
      const matches = `${card.dataset.search} ${card.textContent}`.toLocaleLowerCase("es").includes(query);
      card.hidden = !matches;
      if (matches) visibleCount += 1;
    });
    emptySearch.hidden = visibleCount > 0;
  });

  const trackerBase = new URLSearchParams(window.location.search).get("tracker");
  const trackerOrigin = trackerBase && /^https?:\/\//i.test(trackerBase)
    ? trackerBase.replace(/\/$/, "")
    : "http://localhost:3000";
  document.querySelectorAll("[data-tracker-path]").forEach((link) => {
    link.href = `${trackerOrigin}${link.dataset.trackerPath}`;
  });

  document.querySelector("#year").textContent = String(new Date().getFullYear());
  showView(window.location.hash.slice(1), false);
})();
