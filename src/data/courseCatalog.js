const svgToDataUrl = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const normalizeValue = (value = "") => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function splitTitle(title = "") {
  const words = title.split(" ").filter(Boolean);
  if (words.length <= 2) return [title];
  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
}

function createCourseIllustration({ course_name: courseName, badge, accentA, accentB, icon }) {
  const titleLines = splitTitle(courseName);
  const firstLineY = titleLines.length > 1 ? 214 : 238;
  const secondLineY = 280;

  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 560" role="img" aria-label="${courseName} course illustration">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${accentA}" />
          <stop offset="100%" stop-color="${accentB}" />
        </linearGradient>
        <linearGradient id="panel" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.26)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0.08)" />
        </linearGradient>
      </defs>
      <rect width="960" height="560" rx="42" fill="url(#bg)" />
      <circle cx="790" cy="126" r="118" fill="rgba(255,255,255,0.16)" />
      <circle cx="866" cy="216" r="48" fill="rgba(255,255,255,0.18)" />
      <circle cx="746" cy="254" r="34" fill="rgba(255,255,255,0.12)" />
      <rect x="70" y="84" width="170" height="46" rx="23" fill="rgba(255,255,255,0.16)" />
      <text x="155" y="113" text-anchor="middle" fill="white" font-size="20" font-family="Arial, sans-serif" font-weight="700" letter-spacing="2">${badge}</text>
      <text x="70" y="${firstLineY}" fill="white" font-size="64" font-family="Arial, sans-serif" font-weight="700">${titleLines[0]}</text>
      ${titleLines[1] ? `<text x="70" y="${secondLineY}" fill="white" font-size="64" font-family="Arial, sans-serif" font-weight="700">${titleLines[1]}</text>` : ""}
      <text x="70" y="346" fill="rgba(255,255,255,0.92)" font-size="28" font-family="Arial, sans-serif">Project-based training</text>
      <rect x="70" y="392" width="256" height="98" rx="28" fill="url(#panel)" stroke="rgba(255,255,255,0.24)" />
      <text x="110" y="451" fill="white" font-size="52" font-family="Arial, sans-serif" font-weight="700">${icon}</text>
      <rect x="618" y="338" width="232" height="132" rx="34" fill="rgba(15,23,42,0.12)" stroke="rgba(255,255,255,0.18)" />
      <rect x="652" y="374" width="160" height="18" rx="9" fill="rgba(255,255,255,0.72)" />
      <rect x="652" y="408" width="110" height="18" rx="9" fill="rgba(255,255,255,0.44)" />
      <rect x="652" y="442" width="140" height="18" rx="9" fill="rgba(255,255,255,0.28)" />
    </svg>
  `);
}

const catalog = [
  {
    key: "agentic-ai",
    course_name: "Agentic AI",
    legacyNames: ["Agentic AI"],
    legacyIds: ["course-agentic-ai"],
    duration: "6 Months",
    fee: 45000,
    batch: "Weekend Elite",
    badge: "AI LAB",
    mode: "Automation",
    summary: [
      "Build AI agents that reason, plan, and automate real tasks.",
      "Learn tools, memory, workflows, and deployment through live projects.",
    ],
    accentA: "#1d4ed8",
    accentB: "#06b6d4",
    icon: "AI",
  },
  {
    key: "data-science",
    course_name: "Data Science",
    legacyNames: ["Data Science", "Data Analytics"],
    legacyIds: ["course-data-science"],
    duration: "8 Months",
    fee: 52000,
    batch: "Morning Pro",
    badge: "ANALYTICS",
    mode: "Insights",
    summary: [
      "Turn raw business data into clear dashboards and useful insights.",
      "Work with Excel, SQL, reporting, and decision-ready visual analysis.",
    ],
    accentA: "#0f766e",
    accentB: "#14b8a6",
    icon: "DA",
  },
  {
    key: "full-stack-development",
    course_name: "Full Stack Development",
    legacyNames: ["Full Stack Development", "Python Full Stack"],
    legacyIds: ["course-full-stack"],
    duration: "7 Months",
    fee: 48000,
    batch: "Evening Launch",
    badge: "WEB BUILD",
    mode: "Development",
    summary: [
      "Create modern web apps with Python, APIs, databases, and UI basics.",
      "Build end-to-end projects from backend logic to final deployment.",
    ],
    accentA: "#2563eb",
    accentB: "#7c3aed",
    icon: "FS",
  },
  {
    key: "python-programming",
    course_name: "Python Programming",
    legacyNames: ["Python Programming", "Power BI"],
    legacyIds: ["course-python"],
    duration: "4 Months",
    fee: 28000,
    batch: "Fast Track",
    badge: "PYTHON CORE",
    mode: "Programming",
    summary: [
      "Learn Python fundamentals, problem-solving, and practical coding workflows.",
      "Build confidence with scripts, logic, data handling, and mini projects.",
    ],
    accentA: "#ca8a04",
    accentB: "#f97316",
    icon: "PY",
  },
  {
    key: "digital-marketing",
    course_name: "Digital Marketing",
    legacyNames: ["Digital Marketing", "Java Full Stack"],
    legacyIds: ["course-digital"],
    duration: "5 Months",
    fee: 32000,
    batch: "Career Boost",
    badge: "BRAND BOOST",
    mode: "Marketing",
    summary: [
      "Learn social media strategy, paid campaigns, SEO, and content planning.",
      "Practice real campaign workflows with performance tracking and reporting.",
    ],
    accentA: "#ea580c",
    accentB: "#ef4444",
    icon: "DM",
  },
];

export const batchOptions = ["Morning", "Afternoon", "Evening"];

export const canonicalCourseSeeds = catalog.map((item) => ({
  course_name: item.course_name,
  duration: item.duration,
  fee: item.fee,
  batch: item.batch,
  active_status: true,
}));

export const publicCourseCatalog = catalog.map((item) => ({
  ...item,
  image: createCourseIllustration(item),
}));

function courseMatchesCatalog(course, catalogItem) {
  const normalizedName = normalizeValue(course?.course_name);
  return (
    catalogItem.legacyIds.includes(course?.id)
    || normalizeValue(catalogItem.course_name) === normalizedName
    || catalogItem.legacyNames.some((name) => normalizeValue(name) === normalizedName)
  );
}

export function findCatalogCourse(reference = "") {
  const normalizedReference = normalizeValue(reference);
  if (!normalizedReference && !reference) return null;

  return publicCourseCatalog.find((catalogItem) => (
    catalogItem.key === reference
    || catalogItem.legacyIds.includes(reference)
    || normalizeValue(catalogItem.course_name) === normalizedReference
    || catalogItem.legacyNames.some((name) => normalizeValue(name) === normalizedReference)
  )) || null;
}

export function findCourseByReference(sourceCourses = [], references = []) {
  const referenceList = (Array.isArray(references) ? references : [references]).filter(Boolean);
  if (!referenceList.length) return null;

  const normalizedReferences = referenceList.map((reference) => normalizeValue(reference));
  const catalogMatches = referenceList.map((reference) => findCatalogCourse(reference)).filter(Boolean);

  return sourceCourses.find((course) => {
    if (referenceList.some((reference) => course?.id === reference)) {
      return true;
    }

    if (normalizedReferences.includes(normalizeValue(course?.course_name))) {
      return true;
    }

    return catalogMatches.some((catalogItem) => courseMatchesCatalog(course, catalogItem));
  }) || null;
}

export function getCourseFormOptions(sourceCourses = []) {
  return publicCourseCatalog.map((catalogItem) => {
    const sourceCourse = sourceCourses.find((course) => courseMatchesCatalog(course, catalogItem));

    return {
      ...sourceCourse,
      id: sourceCourse?.id || catalogItem.legacyIds[0] || catalogItem.key,
      course_name: catalogItem.course_name,
      duration: sourceCourse?.duration || catalogItem.duration,
      fee: Number(sourceCourse?.fee) || catalogItem.fee,
      mode: sourceCourse?.mode || catalogItem.mode,
      summary: catalogItem.summary,
      image: catalogItem.image,
    };
  });
}

export function decorateCourseRecord(course) {
  const catalogItem = publicCourseCatalog.find((item) => courseMatchesCatalog(course, item));
  if (!catalogItem) return course;

  return {
    ...course,
    course_name: catalogItem.course_name,
    duration: course.duration || catalogItem.duration,
    fee: Number(course.fee) || catalogItem.fee,
    mode: course.mode || catalogItem.mode,
    summary: catalogItem.summary,
    image: catalogItem.image,
  };
}
