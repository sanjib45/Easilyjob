/**
 * Navigation Registry Configuration
 * Defines role-based navigation sections and active route matching rules.
 */

export const navigationConfig = {
  RECRUITER: {
    portalBadge: "Recruiter Portal",
    homeHref: "/recruiter",
    sections: [
      {
        title: "Menu",
        items: [
          {
            key: "dashboard",
            label: "Dashboard",
            icon: "briefcase",
            href: "/recruiter",
            matchExact: true,
          },
          {
            key: "post-job",
            label: "Post a Job",
            icon: "plus",
            href: "/jobs/new",
            matchPrefixes: ["/jobs/new"],
          },
          {
            key: "applicants",
            label: "Applicants",
            icon: "users",
            href: "/recruiter/applicants",
            matchPrefixes: ["/recruiter/applicants", "/jobs/"],
          },
          {
            key: "interviews",
            label: "Interviews",
            icon: "calendar",
            href: "/recruiter/interviews",
            matchPrefixes: ["/recruiter/interviews"],
          },
        ],
      },
      {
        title: "Workspace & Public",
        items: [
          {
            key: "job-board",
            label: "Job Board",
            icon: "eye",
            href: "/jobs",
            matchExact: true,
          },
          {
            key: "messages",
            label: "Direct Messages",
            icon: "message-square",
            href: "/messages",
            matchPrefixes: ["/messages"],
          },
        ],
      },
    ],
  },
  APPLICANT: {
    portalBadge: "Candidate Portal",
    homeHref: "/jobs",
    sections: [
      {
        title: "Explore & Apply",
        items: [
          {
            key: "browse-jobs",
            label: "Browse Jobs",
            icon: "search",
            href: "/jobs",
            matchPrefixes: ["/jobs"],
          },
          {
            key: "my-applications",
            label: "My Applications",
            icon: "briefcase",
            href: "/applicant/applications",
            matchPrefixes: ["/applicant/applications"],
          },
          {
            key: "messages",
            label: "Direct Messages",
            icon: "message-square",
            href: "/messages",
            matchPrefixes: ["/messages"],
          },
        ],
      },
      {
        title: "Account",
        items: [
          {
            key: "profile",
            label: "Profile & Resume",
            icon: "user",
            href: "/applicant/profile",
            matchPrefixes: ["/applicant/profile"],
          },
        ],
      },
    ],
  },
};

/**
 * Resolves the active navigation item key based on longest prefix match.
 */
export const resolveActiveKey = (role, currentPath) => {
  const config = navigationConfig[role] || navigationConfig.APPLICANT;
  let bestMatchKey = "";
  let longestMatchLength = -1;

  config.sections.forEach((section) => {
    section.items.forEach((item) => {
      if (item.matchExact && currentPath === item.href) {
        if (item.href.length > longestMatchLength) {
          bestMatchKey = item.key;
          longestMatchLength = item.href.length;
        }
      } else if (item.matchPrefixes) {
        item.matchPrefixes.forEach((prefix) => {
          if (currentPath === prefix || currentPath.startsWith(prefix)) {
            if (prefix.length > longestMatchLength) {
              bestMatchKey = item.key;
              longestMatchLength = prefix.length;
            }
          }
        });
      }
    });
  });

  return bestMatchKey;
};
