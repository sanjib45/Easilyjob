import http from "http";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const server = spawn("node", ["app.js"], {
  cwd: root,
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, PORT: "3098" },
});

server.stdout.on("data", (d) => {
  console.log("STDOUT:", d.toString());
});
server.stderr.on("data", (d) => {
  console.error("STDERR:", d.toString());
});

setTimeout(async () => {
  try {
    const loginRes = await fetch("http://localhost:3098/login");
    const loginHtml = await loginRes.text();
    const csrfMatch = loginHtml.match(/name="_csrf" value="([^"]+)"/);
    const csrf = csrfMatch ? csrfMatch[1] : "";
    const cookie = loginRes.headers.get("set-cookie");

    const appEmail = `app_err_${Date.now()}@demo.com`;
    const regRes = await fetch("http://localhost:3098/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookie,
      },
      body: new URLSearchParams({
        name: "App Test",
        email: appEmail,
        password: "Password123!",
        role: "APPLICANT",
        _csrf: csrf,
      }),
      redirect: "manual",
    });

    const authCookie = regRes.headers.get("set-cookie");
    console.log("Auth Cookie:", authCookie);

    const dashRes = await fetch("http://localhost:3098/applicant", {
      headers: { Cookie: authCookie },
    });
    console.log("Dash Status:", dashRes.status);
    const dashBody = await dashRes.text();
    console.log("Dash Body Snippet:", dashBody.slice(0, 500));
  } catch (e) {
    console.error("Fetch error:", e);
  } finally {
    server.kill();
    process.exit(0);
  }
}, 2000);
