function setMenuState(header, open) {
  const button = header.querySelector(".site-nav-toggle");
  if (!button) return;
  header.classList.toggle("is-menu-open", open);
  button.setAttribute("aria-expanded", String(open));
  button.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
}

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : event.target.parentElement;
  if (!target) return;

  const toggle = target.closest(".site-nav-toggle");
  if (toggle) {
    const header = toggle.closest(".site-header");
    setMenuState(header, !header.classList.contains("is-menu-open"));
    return;
  }

  const openHeader = document.querySelector(".site-header.is-menu-open");
  if (!openHeader) return;
  if (!openHeader.contains(target) || target.closest(".site-header nav a")) {
    setMenuState(openHeader, false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const openHeader = document.querySelector(".site-header.is-menu-open");
  if (!openHeader) return;
  setMenuState(openHeader, false);
  openHeader.querySelector(".site-nav-toggle")?.focus();
});

window.addEventListener("resize", () => {
  if (window.innerWidth <= 1000) return;
  document.querySelectorAll(".site-header.is-menu-open").forEach((header) => setMenuState(header, false));
}, { passive: true });
