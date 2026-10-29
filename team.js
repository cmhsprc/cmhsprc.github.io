import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const config = window.CLUB_SUPABASE_CONFIG || {};
const rolePriority = ["President", "Vice President", "General Secretary", "Joint Secretary", "Treasurer", "Organizing Secretary", "IT Secretary", "Publicity Secretary", "Volunteer Coordinator", "Trainer", "Assistant Trainer", "Executive Member", "Volunteer"];
const roleRank = (position) => {
  const rank = rolePriority.indexOf(String(position || ""));
  return rank < 0 ? rolePriority.length : rank;
};
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
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
  ["committee", "former", "advisors", "volunteers"].forEach((panel) => {
    document.querySelector("#" + panel + "-team-panel").hidden = panel !== tabName;
  });
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
selectTeamTab("committee");
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
  teamClient = createClient(config.url, config.publishableKey);

  const { data: committee, error: committeeError } = await teamClient.rpc("get_public_club_team");
  if (committeeError) throw new Error("Could not load the committee. Run the latest supabase/schema.sql. " + committeeError.message);
  const members = (committee || []).filter((member) =>
    member.team_role === "Committee" || member.team_role === "Administrator (ADM)"
  ).sort((a, b) => roleRank(a.position_title) - roleRank(b.position_title) || a.full_name.localeCompare(b.full_name));
  document.querySelector("#committee-count").textContent = String(members.length);
  document.querySelector("#committee-members").innerHTML = members.length
    ? members.map((member) => {
        const photoUrl = member.photo_path ? teamClient.storage.from("club-materials").getPublicUrl(member.photo_path).data.publicUrl : "";
        return renderPersonCard(member.full_name, member.position_title, photoUrl, "Committee member");
      }).join("")
    : '<p class="team-empty">Committee members will appear here when they are added.</p>';

  const { data: volunteers, error: volunteerError } = await teamClient.rpc("get_public_club_volunteers");
  if (volunteerError) {
    document.querySelector("#volunteers-count").textContent = "—";
    document.querySelector("#volunteer-members").innerHTML = '<p class="team-empty">The volunteer list is temporarily unavailable. Run the updated supabase/schema.sql to enable it.</p>';
  } else {
    const volunteerList = (volunteers || []).filter((volunteer) => volunteer.full_name)
      .sort((a, b) => roleRank(a.position_title) - roleRank(b.position_title) || a.full_name.localeCompare(b.full_name));
    document.querySelector("#volunteers-count").textContent = String(volunteerList.length);
    document.querySelector("#volunteer-members").innerHTML = volunteerList.length
      ? volunteerList.map((volunteer) => {
          const photoUrl = volunteer.photo_path ? teamClient.storage.from("club-materials").getPublicUrl(volunteer.photo_path).data.publicUrl : "";
          return renderPersonCard(volunteer.full_name, volunteer.position_title, photoUrl, "Volunteer");
        }).join("")
      : '<p class="team-empty">Volunteer profiles will appear here when they are added.</p>';
  }

  const { data: formerMembers, error: formerError } = await teamClient.rpc("get_public_former_committees");
  if (formerError) {
    document.querySelector("#former-committee-terms").innerHTML = "";
    document.querySelector("#former-selected-term").textContent = "";
    document.querySelector("#former-selected-count").textContent = "";
    document.querySelector("#former-committees-list").innerHTML = '<p class="team-empty">Former committees are temporarily unavailable. Run the updated supabase/schema.sql to enable the archive.</p>';
  } else {
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

  const { data: advisors, error: advisorError } = await teamClient.rpc("get_public_club_advisors");
  if (advisorError) {
    document.querySelector("#advisors-count").textContent = "—";
    document.querySelector("#advisor-members").innerHTML = '<p class="team-empty">Advisors are temporarily unavailable. Run the updated supabase/schema.sql to enable this section.</p>';
    return;
  }
  const advisorList = (advisors || []).filter((advisor) => advisor.full_name);
  document.querySelector("#advisors-count").textContent = String(advisorList.length);
  document.querySelector("#advisor-members").innerHTML = advisorList.length
    ? advisorList.map((advisor) => {
        const photoUrl = advisor.photo_path ? teamClient.storage.from("club-materials").getPublicUrl(advisor.photo_path).data.publicUrl : "";
        return renderPersonCard(advisor.full_name, advisor.position_title, photoUrl, "Club advisor");
      }).join("")
    : '<p class="team-empty">Advisor profiles will appear here when they are added.</p>';
}
loadTeam().catch((error) => {
  document.querySelector("#team-status").textContent = error.message || "The club executives could not load. Please refresh later.";
  document.querySelector("#committee-count").textContent = "—";
  document.querySelector("#committee-members").innerHTML = '<p class="team-empty">The committee list is temporarily unavailable.</p>';
  document.querySelector("#former-committees-list").innerHTML = '<p class="team-empty">Former committee list is temporarily unavailable.</p>';
  document.querySelector("#advisor-members").innerHTML = '<p class="team-empty">Advisor list is temporarily unavailable.</p>';
  document.querySelector("#volunteers-count").textContent = "—";
  document.querySelector("#volunteer-members").innerHTML = '<p class="team-empty">Volunteer list is temporarily unavailable.</p>';
});
