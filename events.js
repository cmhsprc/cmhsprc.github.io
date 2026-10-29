import { getClient, escapeHtml, dateLabel, bindSeeMore, pageNav, pageFooter } from "./site-data.js";

document.querySelector("#site-nav").innerHTML = pageNav("events");
document.querySelector("#site-footer").innerHTML = pageFooter();
const dhakaToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
function renderEvent(event) {
  const place = event.location ? escapeHtml(event.location) : "";
  const time = event.event_time ? " · " + escapeHtml(event.event_time) : "";
  const description = [event.summary, event.details].filter(Boolean).join("\n\n");
  return '<article class="site-card site-event-card"><div class="site-meta"><time>' + escapeHtml(dateLabel(event.event_date)) + time + '</time><span class="site-tag">' + escapeHtml(event.event_type) + '</span></div><h3>' + escapeHtml(event.title) + '</h3>' + (description ? '<div class="site-event-copy site-collapsible" data-collapsible>' + escapeHtml(description) + '</div><button class="site-see-more" data-see-more type="button" aria-expanded="false" hidden>See more</button>' : "") + (place ? '<p class="site-event-location">' + place + '</p>' : "") + '</article>';
}
async function loadEvents() {
  const { data, error } = await getClient().rpc("get_public_site_events", { p_limit: 200 });
  if (error) throw new Error("Could not load events. Run the latest supabase/schema.sql. " + error.message);
  const events = data || [];
  const upcoming = events.filter((event) => event.event_date >= dhakaToday);
  const past = events.filter((event) => event.event_date < dhakaToday);
  document.querySelector("#upcoming-events").innerHTML = upcoming.length ? upcoming.map(renderEvent).join("") : '<p class="site-empty">No upcoming events are posted. Check back for updates.</p>';
  document.querySelector("#past-events").innerHTML = past.length ? past.map(renderEvent).join("") : '<p class="site-empty">Published event recaps will appear here.</p>';
  bindSeeMore(document.querySelector("#upcoming-events"));
  bindSeeMore(document.querySelector("#past-events"));
}
loadEvents().catch((error) => { document.querySelector("#events-status").textContent = error.message || "Events could not load."; });
