import { getClient, escapeHtml, dateLabel, richContent, bindSeeMore, pageNav, pageFooter } from "./site-data.js";

const $ = (selector) => document.querySelector(selector);
const rolePriority = ["President", "Vice President", "General Secretary", "Joint Secretary", "Treasurer", "Organizing Secretary", "IT Secretary", "Publicity Secretary", "Volunteer Coordinator", "Event Volunteer", "Technical Volunteer", "Content Volunteer", "Executive Member", "Delegate", "Trainer", "Assistant Trainer"];
const roleRank = (position) => { const rank = rolePriority.indexOf(String(position || "")); return rank < 0 ? rolePriority.length : rank; };
const eventCard = (event) => {
  const description = [event.summary, event.details].filter(Boolean).join("\n\n") || "Club event";
  const location = event.location ? '<p class="site-event-location">' + escapeHtml(event.location) + '</p>' : "";
  return '<article class="site-card site-event-card"><div class="site-meta"><time>' + escapeHtml(dateLabel(event.event_date)) + (event.event_time ? " · " + escapeHtml(event.event_time) : "") + '</time><span class="site-tag">' + escapeHtml(event.event_type) + '</span></div><h3>' + escapeHtml(event.title) + '</h3><div class="site-event-copy site-collapsible" data-collapsible>' + escapeHtml(description) + '</div><button class="site-see-more" data-see-more type="button" aria-expanded="false" hidden>See more</button>' + location + '</article>';
};
const postCard = (post) => '<article class="site-card"><div class="site-meta"><span>' + escapeHtml(dateLabel(post.created_at)) + '</span><span class="site-tag">' + (post.category === "material" ? "Class material" : "Announcement") + '</span></div><h3>' + escapeHtml(post.title) + '</h3><p>' + escapeHtml(post.batch_name || "Club") + '</p><div class="site-prose-rich site-collapsible" data-collapsible>' + richContent(post.body) + '</div><button class="site-see-more" data-see-more type="button" aria-expanded="false" hidden>See more</button></article>';

async function loadHome() {
  const client = getClient();
  const [pages, events, posts, team] = await Promise.all([
    client.rpc("get_public_site_pages"), client.rpc("get_public_site_events", { p_limit: 3 }),
    client.rpc("get_public_site_blog", { p_limit: 3, p_offset: 0 }), client.rpc("get_public_club_team")
  ]);
  const failures = [pages, events, posts, team].filter((result) => result.error);
  if (failures.length) $("#home-status").textContent = "Some website content is unavailable. Apply the latest supabase/schema.sql. " + failures[0].error.message;
  const home = (pages.data || []).find((item) => item.slug === "home");
  const join = (pages.data || []).find((item) => item.slug === "join");
  if (home) {
    $("#home-title").innerHTML = escapeHtml(home.title) + "<br><span>" + escapeHtml(home.subtitle) + "</span>";
    $("#home-subtitle").textContent = home.hero_intro || "";
    $("#about-title").textContent = home.section_title || "About the club";
    $("#about-body").textContent = home.body || "";
  }
  if (join) { $("#home-join-title").textContent = join.title || "Join the club"; $("#home-join-intro").textContent = join.subtitle || join.hero_intro || ""; }
  const eventRows = events.data || [];
  $("#home-events").innerHTML = eventRows.length ? eventRows.map(eventCard).join("") : '<p class="site-empty">No events have been published yet. Check back for club updates.</p>';
  bindSeeMore($("#home-events"));
  const postRows = posts.data || [];
  $("#home-blog").innerHTML = postRows.length ? postRows.map(postCard).join("") : '<p class="site-empty">No posts have been published yet.</p>';
  bindSeeMore($("#home-blog"));
  const members = (team.data || []).slice().sort((a, b) => roleRank(a.position_title || a.team_role) - roleRank(b.position_title || b.team_role) || String(a.full_name).localeCompare(String(b.full_name)));
  const featured = members.slice(0, 6);
  $("#home-team").innerHTML = featured.length ? featured.map((member) => '<span class="site-person"><strong>' + escapeHtml(member.full_name) + '</strong><span>' + escapeHtml(member.position_title || member.team_role) + '</span></span>').join("") : '<p class="site-empty">The club team will be listed here.</p>';
}

document.querySelector("#site-nav").innerHTML = pageNav("home");
document.querySelector("#site-footer").innerHTML = pageFooter();
loadHome().catch((error) => { $("#home-status").textContent = error.message || "The website could not load. Please refresh later."; });
