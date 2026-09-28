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
let started = false;

server.stdout.on("data", (d) => {
  out += d;
  if (!started && out.includes("Server running")) {
    started = true;
    runTests();
  }
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
  try {
    await new Promise((r) => setTimeout(r, 600));

    // 1. Basic Public & Unauthenticated Sweeps
    const home = await req("GET", "/");
    const publicUploadProbe = await req("GET", "/uploads/nonexistent-resume.pdf");
    const unauthDashboard = await req("GET", "/recruiter");
    const unauthApplicants = await req("GET", "/recruiter/applicants");
    const unauthInterviews = await req("GET", "/recruiter/interviews");

    // 2. CSRF & Recruiter A Login
    const loginPage = await req("GET", "/login");
    const csrfMatch = loginPage.body.match(/name="_csrf" value="([^"]+)"/);
    const csrf = csrfMatch ? csrfMatch[1] : "";
    const loginCookies = getCookies(loginPage.headers["set-cookie"]);

    const loginA = await req(
      "POST",
      "/login",
      { email: "recruiter@demo.com", password: "Password123!", _csrf: csrf },
      loginCookies
    );
    const authCookiesA = mergeCookies(loginCookies, getCookies(loginA.headers["set-cookie"]));

    // 3. Recruiter A Dashboard & List Views
    const dashA = await req("GET", "/recruiter", null, authCookiesA);
    const applicantsA = await req("GET", "/recruiter/applicants", null, authCookiesA);
    const filteredApplicants = await req(
      "GET",
      "/recruiter/applicants?sort=status&status=SHORTLISTED&page=1&limit=10",
      null,
      authCookiesA
    );
    const interviewsA = await req("GET", "/recruiter/interviews", null, authCookiesA);

    // 4. Pagination & Query Bounds Resilience
    const outOfBoundsPage = await req("GET", "/recruiter/applicants?page=9999", null, authCookiesA);
    const invalidSortParam = await req("GET", "/recruiter/applicants?sort=DROP%20TABLE", null, authCookiesA);

    // 5. Register Recruiter B (Tenant Isolation Testing)
    const registerPage = await req("GET", "/register");
    const regCsrfMatch = registerPage.body.match(/name="_csrf" value="([^"]+)"/);
    const regCsrf = regCsrfMatch ? regCsrfMatch[1] : csrf;
    const regCookies = getCookies(registerPage.headers["set-cookie"]);

    const bEmail = `recruiterB_${Date.now()}@demo.com`;
    const regB = await req(
      "POST",
      "/register",
      {
        name: "Recruiter B",
        email: bEmail,
        password: "Password123!",
        role: "RECRUITER",
        _csrf: regCsrf,
      },
      regCookies
    );
    const authCookiesB = mergeCookies(regCookies, getCookies(regB.headers["set-cookie"]));

    // 6. Cross-Tenant Isolation Assertions: Recruiter B accessing Recruiter A's items
    // First find an application ID from Recruiter A's list if present
    const appIdMatch = applicantsA.body.match(/\/recruiter\/applicants\/([a-z0-9]+)"/i);
    const appIdA = appIdMatch ? appIdMatch[1] : null;

    let crossTenantAccessStatus = 404;
    let crossTenantUpdateStatus = 404;

    if (appIdA) {
      const crossGet = await req("GET", `/recruiter/applicants/${appIdA}`, null, authCookiesB);
      crossTenantAccessStatus = crossGet.status;

      const crossPost = await req(
        "POST",
        `/recruiter/applicants/${appIdA}`,
        { status: "SHORTLISTED", recruiterNote: "Hacked", _csrf: regCsrf },
        authCookiesB
      );
      crossTenantUpdateStatus = crossPost.status;
    }

    // 7. Share Result Pre-completion Guard Check
    const intIdMatch = interviewsA.body.match(/\/recruiter\/interviews\/([a-z0-9]+)"/i);
    const intId = intIdMatch ? intIdMatch[1] : null;
    let sharePreCompletionStatus = 400;

    if (intId) {
      const shareCheck = await req("GET", `/recruiter/interviews/${intId}/share-result`, null, authCookiesA);
      sharePreCompletionStatus = shareCheck.status;
    }

    // 8. Applicant Registration and Applicant Portal Sweeps
    const appEmail = `applicant_${Date.now()}@demo.com`;
    const regApplicant = await req(
      "POST",
      "/register",
      {
        name: "Test Applicant",
        email: appEmail,
        password: "Password123!",
        role: "APPLICANT",
        _csrf: regCsrf,
      },
      regCookies
    );
    const appAuthCookies = mergeCookies(regCookies, getCookies(regApplicant.headers["set-cookie"]));

    const applicantDash = await req("GET", "/applicant", null, appAuthCookies);
    const applicantApps = await req("GET", "/applicant/applications", null, appAuthCookies);
    const applicantSaved = await req("GET", "/applicant/saved", null, appAuthCookies);
    const applicantProfile = await req("GET", "/applicant/profile", null, appAuthCookies);

    const hasConfirmModalAttr = applicantDash.body.includes('data-confirm') || dashA.body.includes('data-confirm');

    const testResults = {
      port: testPort,
      home: home.status,
      publicUploadProbe: publicUploadProbe.status,
      unauthenticatedDashboard: unauthDashboard.status,
      unauthenticatedApplicants: unauthApplicants.status,
      unauthenticatedInterviews: unauthInterviews.status,
      loginA: loginA.status,
      dashboardA: dashA.status,
      applicantsA: applicantsA.status,
      filteredApplicants: filteredApplicants.status,
      interviewsA: interviewsA.status,
      outOfBoundsPage: outOfBoundsPage.status,
      invalidSortParam: invalidSortParam.status,
      registerB: regB.status,
      crossTenantAccessStatus,
      crossTenantUpdateStatus,
      sharePreCompletionStatus,
      applicantDash: applicantDash.status,
      applicantApps: applicantApps.status,
      applicantSaved: applicantSaved.status,
      applicantProfile: applicantProfile.status,
      hasConfirmModalAttr,
      hasAccessCookie: authCookiesA.includes("access_token="),
      ok:
        home.status === 200 &&
        publicUploadProbe.status === 404 &&
        unauthDashboard.status === 302 &&
        unauthApplicants.status === 302 &&
        unauthInterviews.status === 302 &&
        loginA.status === 302 &&
        dashA.status === 200 &&
        applicantsA.status === 200 &&
        filteredApplicants.status === 200 &&
        interviewsA.status === 200 &&
        outOfBoundsPage.status === 200 &&
        invalidSortParam.status === 200 &&
        applicantDash.status === 200 &&
        applicantApps.status === 200 &&
        applicantSaved.status === 200 &&
        applicantProfile.status === 200 &&
        hasConfirmModalAttr &&
        (crossTenantAccessStatus === 404 || crossTenantAccessStatus === 302) &&
        (crossTenantUpdateStatus === 404 || crossTenantUpdateStatus === 302) &&
        (sharePreCompletionStatus === 400 || sharePreCompletionStatus === 302) &&
        authCookiesA.includes("access_token="),
    };

    console.log(JSON.stringify(testResults, null, 2));
    if (!testResults.ok) {
      console.error("SERVER LOGS ON FAILURE:\n", out);
    }
    server.kill();
    process.exit(testResults.ok ? 0 : 1);
  } catch (err) {
    console.error("Test execution failed:", err);
    server.kill();
    process.exit(1);
  }
}

setTimeout(() => {
  console.error("Timeout waiting for server startup", out);
  server.kill();
  process.exit(1);
}, 20000);
