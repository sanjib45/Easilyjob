import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const recruiter = await prisma.user.upsert({
    where: { email: "recruiter@demo.com" },
    update: {},
    create: {
      name: "Demo Recruiter",
      email: "recruiter@demo.com",
      passwordHash,
      role: "RECRUITER",
      emailVerified: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "applicant@demo.com" },
    update: {},
    create: {
      name: "Demo Applicant",
      email: "applicant@demo.com",
      passwordHash,
      role: "APPLICANT",
      emailVerified: true,
    },
  });

  const existing = await prisma.job.count({ where: { recruiterId: recruiter.id } });
  if (existing === 0) {
    await prisma.job.createMany({
      data: [
        {
          category: "Software Development",
          designation: "Full Stack Developer",
          location: "Bangalore",
          companyName: "Coding Ninjas",
          salary: "8-12 LPA",
          openings: 3,
          skills: JSON.stringify(["JavaScript", "React", "Node.js"]),
          applyBy: new Date("2026-12-20"),
          recruiterId: recruiter.id,
        },
        {
          category: "UI/UX Design",
          designation: "Product Designer",
          location: "Remote",
          companyName: "DesignHub",
          salary: "6-9 LPA",
          openings: 2,
          skills: JSON.stringify(["Figma", "Sketch", "Adobe XD"]),
          applyBy: new Date("2026-12-25"),
          recruiterId: recruiter.id,
        },
      ],
    });
  }

  console.log("Seed complete.");
  console.log("  recruiter@demo.com / Password123!");
  console.log("  applicant@demo.com / Password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
