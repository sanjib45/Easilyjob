import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { JSONFilePreset } from "lowdb/node";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const dbFile = path.join(dataDir, "db.json");

fs.mkdirSync(dataDir, { recursive: true });

const seedJobs = [
  {
    id: "101",
    jobcategory: "Software Development",
    jobdesignation: "Full Stack Developer",
    joblocation: "Bangalore",
    companyname: "Coding Ninjas",
    salary: "8-12 LPA",
    openings: 3,
    applyby: "2026-12-20",
    skillrequired: ["JavaScript", "React", "Node.js"],
    jobposted: new Date().toISOString(),
    recruiterId: "seed-recruiter",
    applicants: [],
  },
  {
    id: "102",
    jobcategory: "UI/UX Design",
    jobdesignation: "Product Designer",
    joblocation: "Remote",
    companyname: "DesignHub",
    salary: "6-9 LPA",
    openings: 2,
    applyby: "2026-12-25",
    skillrequired: ["Figma", "Sketch", "Adobe XD"],
    jobposted: new Date().toISOString(),
    recruiterId: "seed-recruiter",
    applicants: [],
  },
];

const defaultData = {
  users: [],
  jobs: seedJobs,
};

/** Shared lowdb instance. Data lives in data/db.json and persists across restarts. */
export const db = await JSONFilePreset(dbFile, defaultData);
