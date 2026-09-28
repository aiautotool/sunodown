const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID;
if (!token || !zoneId) throw new Error("Missing Cloudflare environment variables");

const api = "https://api.cloudflare.com/client/v4";
const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

async function cf(path, init = {}) {
  const response = await fetch(api + path, { ...init, headers });
  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new Error(JSON.stringify(body.errors || body));
  }
  return body;
}

const listed = await cf(`/zones/${zoneId}/rulesets`);
let ruleset = listed.result.find(
  (item) => item.phase === "http_request_origin" && item.kind === "zone",
);

const rule = {
  action: "route",
  action_parameters: {
    host_header: "sunoapp.aiautotool.com",
    origin: { host: "sunoapp.aiautotool.com", port: 443 },
    sni: { value: "sunoapp.aiautotool.com" },
  },
  expression: '(http.host eq "picai.online" or http.host eq "www.picai.online")',
  description: "Route picai hostnames to SunoDown Worker origin",
  enabled: true,
  ref: "picai_worker_origin",
};

if (!ruleset) {
  const created = await cf(`/zones/${zoneId}/rulesets`, {
    method: "POST",
    body: JSON.stringify({
      name: "picai-origin",
      description: "Origin override for picai.online",
      kind: "zone",
      phase: "http_request_origin",
      rules: [rule],
    }),
  });
  console.log(JSON.stringify({ success: true, ruleset: created.result.id }));
} else {
  const current = await cf(`/zones/${zoneId}/rulesets/${ruleset.id}`);
  const existing = current.result.rules?.find((item) => item.ref === rule.ref);
  const path = existing
    ? `/zones/${zoneId}/rulesets/${ruleset.id}/rules/${existing.id}`
    : `/zones/${zoneId}/rulesets/${ruleset.id}/rules`;
  const updated = await cf(path, {
    method: existing ? "PATCH" : "POST",
    body: JSON.stringify(rule),
  });
  console.log(JSON.stringify({ success: true, rule: updated.result.id }));
}
