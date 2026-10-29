import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const config = window.CLUB_SUPABASE_CONFIG || {};
const categories = [
  { role: "Administrator (ADM)", list: "admins-list", count: "admins-count", empty: "Executive profiles will appear here when they are ready." },
  { role: "Delegate", list: "delegates-list", count: "delegates-count", empty: "Delegate profiles will appear here when they are ready." },
  { role: "Trainer (EM)", list: "trainers-list", count: "trainers-count", empty: "Trainer profiles will appear here when they are ready." },
  { role: "Assistant Trainer (EM)", list: "assistant-trainers-list", count: "assistant-trainers-count", empty: "Assistant trainer profiles will appear here when they are ready." }
];
const rolePriority = ["President", "Vice President", "General Secretary", "Joint Secretary", "Treasurer", "Organizing Secretary", "IT Secretary", "Publicity Secretary", "Volunteer Coordinator", "Event Volunteer", "Technical Volunteer", "Content Volunteer", "Executive Member", "Delegate", "Trainer", "Assistant Trainer"];
const roleRank = (position) => { const rank = rolePriority.indexOf(String(position || "")); return rank < 0 ? rolePriority.length : rank; };
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
let formerCommitteeGroups = new Map();
let teamClient = null;

function renderPersonCard(name, position, photoUrl, fallbackLabel) {
  const initials = String(name).trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
  const portrait = photoUrl
    ? '<img class="team-portrait" src="' + escapeHtml(photoUrl) + '" alt="Portrait of ' + escapeHtml(name) + '" loading="lazy">'
    : '<div class="team-portrait-placeholder" aria-hidden="true"><span>' + escapeHtml(initials || "CM") + '</span></div>';
  return '<article class="team-person-card">' + portrait + '<div class="team-person-copy"><p class="team-person-role">' +
    escapeHtml(position || fallbackLabel) + '</p><h3 class="team-person-name">' + escapeHtml(name) + '</h3></div></article>';
}
function selectTeamTab(tabName) {
  document.querySelectorAll("[data-team-tab]").forEach((tab) => {
    const selected = tab.dataset.teamTab === tabName;
    tab.classList.toggle("is-selected", selected);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  document.querySelector("#current-team-panel").hidden = tabName !== "current";
  document.querySelector("#former-team-panel").hidden = tabName !== "former";
}
function renderFormerTerm(term) {
  const members = (formerCommitteeGroups.get(term) || []).slice().sort((a, b) =>
    roleRank(a.position_title) - roleRank(b.position_title) ||
    String(a.position_title).localeCompare(String(b.position_title)) ||
    String(a.full_name).localeCompare(String(b.full_name))
  );
  document.querySelector("#former-selected-term").textContent = term;
  document.querySelector("#former-selected-count").textContent = members.length + (members.length === 1 ? " member" : " members");
  document.querySelector("#former-committees-list").innerHTML = members.map((member) => {
    const photoUrl = member.photo_path ? teamClient.storage.from("club-materials").getPublicUrl(member.photo_path).data.publicUrl : "";
    return renderPersonCard(member.full_name, member.position_title, photoUrl, "Former committee");
  }).join("") || '<p class="team-empty">No members are listed for this term.</p>';
}
document.querySelectorAll("[data-team-tab]").forEach((tab) => {
  tab.addEventListener("click", () => selectTeamTab(tab.dataset.teamTab));
});
selectTeamTab("current");
document.querySelector("#former-committee-terms").addEventListener("click", (event) => {
  const button = event.target.closest("[data-former-term]");
  if (!button) return;
  document.querySelectorAll("[data-former-term]").forEach((termButton) => {
    const selected = termButton === button;
    termButton.classList.toggle("is-selected", selected);
    termButton.setAttribute("aria-pressed", String(selected));
  });
  renderFormerTerm(button.dataset.formerTerm);
});

async function loadTeam() {
  if (!config.url || !config.publishableKey) throw new Error("Supabase settings are missing. Check admin/config.js.");
  const client = createClient(config.url, config.publishableKey);
  teamClient = client;
  const { data, error } = await client.rpc("get_public_club_team");
  if (error) throw new Error("Could not load the club team. Run the latest supabase/schema.sql. " + error.message);
  const membersByRole = new Map(categories.map((category) => [category.role, []]));
  (data || []).forEach((member) => {
    if (membersByRole.has(member.team_role)) membersByRole.get(member.team_role).push({
      name: member.full_name,
      position: member.position_title,
      photoUrl: member.photo_path ? client.storage.from("club-materials").getPublicUrl(member.photo_path).data.publicUrl : ""
    });
  });
  categories.forEach((category) => {
    const people = membersByRole.get(category.role).filter((member) => member.name).sort((a, b) => roleRank(a.position) - roleRank(b.position) || a.name.localeCompare(b.name));
    document.querySelector("#" + category.count).textContent = String(people.length);
    document.querySelector("#" + category.list).innerHTML = people.length
      ? people.map((member) => renderPersonCard(member.name, member.position, member.photoUrl, category.role)).join("")
      : '<p class="team-empty">' + escapeHtml(category.empty) + "</p>";
  });

  const { data: formerMembers, error: formerError } = await client.rpc("get_public_former_committees");
  if (formerError) {
    document.querySelector("#former-committee-terms").innerHTML = "";
    document.querySelector("#former-selected-term").textContent = "";
    document.querySelector("#former-selected-count").textContent = "";
    document.querySelector("#former-committees-list").innerHTML = '<p class="team-empty">Former committees are temporarily unavailable. Run the updated supabase/schema.sql to enable the archive.</p>';
    return;
  }
  formerCommitteeGroups = new Map();
  (formerMembers || []).forEach((member) => {
    if (!member.term_label || !member.full_name) return;
    if (!formerCommitteeGroups.has(member.term_label)) formerCommitteeGroups.set(member.term_label, []);
    formerCommitteeGroups.get(member.term_label).push(member);
  });
  const terms = [...formerCommitteeGroups.keys()].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  document.querySelector("#former-committee-terms").innerHTML = terms.map((term, index) =>
    '<button type="button" class="former-term-button' + (index === 0 ? " is-selected" : "") +
    '" data-former-term="' + escapeHtml(term) + '" aria-pressed="' + (index === 0 ? "true" : "false") + '">' +
    escapeHtml(term) + "</button>"
  ).join("");
  if (terms.length) renderFormerTerm(terms[0]);
  else {
    document.querySelector("#former-selected-term").textContent = "";
    document.querySelector("#former-selected-count").textContent = "";
    document.querySelector("#former-committees-list").innerHTML = '<p class="team-empty">Former committee records will appear here when they are added.</p>';
  }
}
loadTeam().catch((error) => {
  document.querySelector("#team-status").textContent = error.message || "The club team could not load. Please refresh later.";
  categories.forEach((category) => {
    document.querySelector("#" + category.list).innerHTML = '<p class="team-empty">Team list temporarily unavailable.</p>';
    document.querySelector("#" + category.count).textContent = "—";
  });
});
