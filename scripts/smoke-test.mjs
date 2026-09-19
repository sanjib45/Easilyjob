import http from "http";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const testPort = process.env.SMOKE_PORT || "3099";

const server = spawn("node", ["app.js"], {
  cwd: root,
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, PORT: testPort },
});
let out = "";

server.stdout.on("data", (d) => {
  out += d;
  if (out.includes("Server running")) runTests();
});
server.stderr.on("data", (d) => {
  out += d;
});

function req(method, path, body, cookies = "") {
  return new Promise((resolve, reject) => {
    const data = body ? new URLSearchParams(body).toString() : "";
    const r = http.request(
      {
        hostname: "localhost",
        port: Number(testPort),
        path,
        method,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(data),
          Cookie: cookies,
        },
      },
      (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: b }));
      }
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

function getCookies(setCookie) {
  if (!setCookie) return "";
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  return arr.map((c) => c.split(";")[0]).join("; ");
}

function mergeCookies(...parts) {
  const map = new Map();
  for (const part of parts.filter(Boolean)) {
    for (const pair of part.split("; ")) {
      const [k, ...v] = pair.split("=");
      if (k) map.set(k.trim(), v.join("="));
    }
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function runTests() {
  await new Promise((r) => setTimeout(r, 500));
  const home = await req("GET", "/");
  const publicUploadProbe = await req("GET", "/uploads/nonexistent-resume.pdf");
  const unauthenticatedApplicants = await req("GET", "/recruiter/applicants");
  const loginPage = await req("GET", "/login");
  const csrfMatch = loginPage.body.match(/name="_csrf" value="([^"]+)"/);
  const csrf = csrfMatch ? csrfMatch[1] : "";
  const loginCookies = getCookies(loginPage.headers["set-cookie"]);
  const login = await req(
    "POST",
    "/login",
    { email: "recruiter@demo.com", password: "Password123!", _csrf: csrf },
    loginCookies
  );
  const authCookies = mergeCookies(loginCookies, getCookies(login.headers["set-cookie"]));
  const dash = await req("GET", "/recruiter", null, authCookies);
  const applicants = await req("GET", "/recruiter/applicants", null, authCookies);
  const filteredApplicants = await req("GET", "/recruiter/applicants?sort=status&status=SHORTLISTED&page=1&limit=10", null, authCookies);
  const interviews = await req("GET", "/recruiter/interviews", null, authCookies);
  const result = {
    port: testPort,
    home: home.status,
    publicUploadProbe: publicUploadProbe.status,
    unauthenticatedApplicants: unauthenticatedApplicants.status,
    login: login.status,
    loginLocation: login.headers.location || null,
    loginInvalidMessage: login.body.includes("Invalid email or password"),
    csrfPresent: Boolean(csrf),
    csrfCookiePresent: loginCookies.includes("csrf_token="),
    dashboard: dash.status,
    applicants: applicants.status,
    filteredApplicants: filteredApplicants.status,
    interviews: interviews.status,
    dashboardLocation: dash.headers.location || null,
    hasAccessCookie: authCookies.includes("access_token="),
    ok:
      home.status === 200 &&
      publicUploadProbe.status === 404 &&
      unauthenticatedApplicants.status === 302 &&
      login.status === 302 &&
      dash.status === 200 &&
      applicants.status === 200 &&
      filteredApplicants.status === 200 &&
      interviews.status === 200 &&
      authCookies.includes("access_token="),
  };
  console.log(JSON.stringify(result, null, 2));
  server.kill();
  process.exit(result.ok ? 0 : 1);
}

setTimeout(() => {
  console.error("timeout", out);
  server.kill();
  process.exit(1);
}, 15000);
