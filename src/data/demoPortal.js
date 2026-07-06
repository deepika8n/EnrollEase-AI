const svgToDataUrl = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

function createAvatar(name, accentA, accentB) {
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="${name}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${accentA}" />
          <stop offset="100%" stop-color="${accentB}" />
        </linearGradient>
      </defs>
      <rect width="320" height="320" rx="52" fill="url(#g)" />
      <circle cx="160" cy="124" r="56" fill="rgba(255,255,255,0.22)" />
      <path d="M80 274c18-48 55-72 80-72s62 24 80 72" fill="rgba(255,255,255,0.22)" />
      <text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="92" font-family="Arial, sans-serif" font-weight="700">
        ${getInitials(name)}
      </text>
    </svg>
  `);
}

function createIdCard(name, aadhaarId, accentA, accentB) {
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 420" role="img" aria-label="Aadhaar document for ${name}">
      <defs>
        <linearGradient id="doc" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${accentA}" />
          <stop offset="100%" stop-color="${accentB}" />
        </linearGradient>
      </defs>
      <rect width="720" height="420" rx="28" fill="#f8fafc" />
      <rect x="24" y="24" width="672" height="372" rx="24" fill="white" stroke="#dbeafe" stroke-width="4" />
      <rect x="24" y="24" width="672" height="76" rx="24" fill="url(#doc)" />
      <text x="54" y="72" fill="white" font-size="30" font-family="Arial, sans-serif" font-weight="700">Identity Proof</text>
      <rect x="54" y="130" width="122" height="150" rx="18" fill="#e2e8f0" />
      <circle cx="115" cy="176" r="34" fill="#cbd5e1" />
      <path d="M74 254c9-25 24-38 41-38s32 13 41 38" fill="#cbd5e1" />
      <text x="206" y="168" fill="#0f172a" font-size="30" font-family="Arial, sans-serif" font-weight="700">${name}</text>
      <text x="206" y="214" fill="#475569" font-size="24" font-family="Arial, sans-serif">Aadhaar ID</text>
      <text x="206" y="256" fill="#0f172a" font-size="28" font-family="Arial, sans-serif" font-weight="700">${aadhaarId}</text>
      <rect x="54" y="312" width="612" height="24" rx="12" fill="#dbeafe" />
      <rect x="54" y="348" width="480" height="18" rx="9" fill="#e2e8f0" />
    </svg>
  `);
}

export const googleFormFields = [
  { key: "full_name", label: "Student Name", type: "Short answer" },
  { key: "college_name", label: "College Name", type: "Short answer" },
  { key: "current_activity", label: "Currently Doing", type: "Dropdown" },
  { key: "place", label: "Place", type: "Short answer" },
  { key: "address", label: "Address", type: "Paragraph" },
  { key: "phone", label: "Student Phone Number", type: "Short answer" },
  { key: "email", label: "Email ID", type: "Short answer" },
  { key: "guardian_name", label: "Guardian Name", type: "Short answer" },
  { key: "guardian_relation", label: "Guardian Relation", type: "Short answer" },
  { key: "guardian_phone", label: "Guardian Number", type: "Short answer" },
  { key: "aadhaar_id", label: "Aadhaar ID Number", type: "Short answer" },
  { key: "student_photo", label: "Student Photo", type: "File upload" },
  { key: "aadhaar_document", label: "Aadhaar ID Photo", type: "File upload" },
  { key: "course_name", label: "Enrolled Course", type: "Dropdown" },
  { key: "payment_method", label: "Payment Method", type: "Multiple choice" },
  { key: "payment_plan", label: "Payment Type", type: "Multiple choice" },
  { key: "installments_planned", label: "Number of Installments", type: "Short answer" },
  { key: "total_fee", label: "Course Fee", type: "Short answer" },
  { key: "lead_date", label: "Lead Date", type: "Date" },
  { key: "enrolled_date", label: "Enrolled Date", type: "Date" },
  { key: "notes", label: "Notes", type: "Paragraph" },
];

export const googleAppsScriptSnippet = String.raw`function onFormSubmit(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Enrollments");
  const values = e.namedValues;

  const row = [
    new Date(),
    values["Student Name"]?.[0] || "",
    values["College Name"]?.[0] || "",
    values["Currently Doing"]?.[0] || "",
    values["Place"]?.[0] || "",
    values["Address"]?.[0] || "",
    values["Student Phone Number"]?.[0] || "",
    values["Email ID"]?.[0] || "",
    values["Guardian Name"]?.[0] || "",
    values["Guardian Relation"]?.[0] || "",
    values["Guardian Number"]?.[0] || "",
    values["Aadhaar ID Number"]?.[0] || "",
    values["Enrolled Course"]?.[0] || "",
    values["Payment Method"]?.[0] || "",
    values["Payment Type"]?.[0] || "",
    values["Number of Installments"]?.[0] || "",
    values["Course Fee"]?.[0] || "",
    values["Lead Date"]?.[0] || "",
    values["Enrolled Date"]?.[0] || "",
    values["Notes"]?.[0] || "",
  ];

  sheet.appendRow(row);
}`;

export const demoAdminAccount = {
  email: "admin@enrollease.ai",
  password: "Admin@123",
  full_name: "Admin",
};

export const demoCourses = [
  {
    id: "course-agentic-ai",
    course_name: "Agentic AI",
    duration: "6 Months",
    fee: 45000,
    batch: "Weekend Elite",
    active_status: true,
    mode: "Hybrid",
    seats: 24,
  },
  {
    id: "course-data-science",
    course_name: "Data Science",
    duration: "8 Months",
    fee: 52000,
    batch: "Morning Pro",
    active_status: true,
    mode: "Offline",
    seats: 28,
  },
  {
    id: "course-full-stack",
    course_name: "Full Stack Development",
    duration: "7 Months",
    fee: 48000,
    batch: "Evening Launch",
    active_status: true,
    mode: "Hybrid",
    seats: 30,
  },
  {
    id: "course-python",
    course_name: "Python Programming",
    duration: "4 Months",
    fee: 28000,
    batch: "Fast Track",
    active_status: true,
    mode: "Online",
    seats: 36,
  },
  {
    id: "course-digital",
    course_name: "Digital Marketing",
    duration: "5 Months",
    fee: 32000,
    batch: "Career Boost",
    active_status: true,
    mode: "Online",
    seats: 32,
  },
];

const studentSeeds = [
  {
    id: "student-priya-nair",
    accentA: "#f97316",
    accentB: "#fb7185",
    full_name: "Priya Nair",
    email: "priya.nair@example.com",
    phone: "9876501122",
    alternate_phone: "9000001122",
    address: "21 Green Meadows, Indiranagar, Bengaluru",
    place: "Bengaluru",
    college_name: "Christ University",
    current_activity: "Final Year BCA",
    guardian_name: "Sunil Nair",
    guardian_relation: "Father",
    guardian_phone: "9876501001",
    aadhaar_id: "5234 7821 1189",
    lead_source: "Instagram",
    notes: "Ready to start immediately and already attended demo session.",
  },
  {
    id: "student-karthik-reddy",
    accentA: "#2563eb",
    accentB: "#14b8a6",
    full_name: "Karthik Reddy",
    email: "karthik.reddy@example.com",
    phone: "9866002233",
    alternate_phone: "9866002299",
    address: "9 Lake View Road, Madhapur, Hyderabad",
    place: "Hyderabad",
    college_name: "JNTU Hyderabad",
    current_activity: "Working Professional",
    guardian_name: "Rama Reddy",
    guardian_relation: "Father",
    guardian_phone: "9866002001",
    aadhaar_id: "6677 1234 5588",
    lead_source: "Referral",
    notes: "Needs evening batches due to work schedule.",
  },
  {
    id: "student-aditi-sharma",
    accentA: "#7c3aed",
    accentB: "#ec4899",
    full_name: "Aditi Sharma",
    email: "aditi.sharma@example.com",
    phone: "9811003344",
    alternate_phone: "9811003301",
    address: "44 Civil Lines, Jaipur",
    place: "Jaipur",
    college_name: "Poornima University",
    current_activity: "Final Year BTech",
    guardian_name: "Meena Sharma",
    guardian_relation: "Mother",
    guardian_phone: "9811003000",
    aadhaar_id: "4455 7788 9911",
    lead_source: "Website",
    notes: "Waiting for parent discussion before payment.",
  },
  {
    id: "student-sameer-khan",
    accentA: "#f59e0b",
    accentB: "#f97316",
    full_name: "Sameer Khan",
    email: "sameer.khan@example.com",
    phone: "9899004455",
    alternate_phone: "9899004499",
    address: "18 Bhopal Heights, Arera Colony, Bhopal",
    place: "Bhopal",
    college_name: "Barkatullah University",
    current_activity: "Job Seeker",
    guardian_name: "Parveen Khan",
    guardian_relation: "Brother",
    guardian_phone: "9899004001",
    aadhaar_id: "2233 5544 8899",
    lead_source: "Seminar",
    notes: "Left because of relocation and travel constraints.",
  },
  {
    id: "student-neha-patel",
    accentA: "#0ea5e9",
    accentB: "#22c55e",
    full_name: "Neha Patel",
    email: "neha.patel@example.com",
    phone: "9877705566",
    alternate_phone: "9877705501",
    address: "5 Riverfront Residency, Ahmedabad",
    place: "Ahmedabad",
    college_name: "GLS University",
    current_activity: "Freelancer",
    guardian_name: "Ritesh Patel",
    guardian_relation: "Father",
    guardian_phone: "9877705000",
    aadhaar_id: "7865 1243 5521",
    lead_source: "WhatsApp Campaign",
    notes: "Performs well, asked for EMI reminder two days before due date.",
  },
  {
    id: "student-rahul-das",
    accentA: "#8b5cf6",
    accentB: "#06b6d4",
    full_name: "Rahul Das",
    email: "rahul.das@example.com",
    phone: "9888806677",
    alternate_phone: "9888806601",
    address: "72 Salt Lake Sector 2, Kolkata",
    place: "Kolkata",
    college_name: "Techno India",
    current_activity: "Second Year BSc",
    guardian_name: "Mala Das",
    guardian_relation: "Mother",
    guardian_phone: "9888806000",
    aadhaar_id: "6432 1188 9944",
    lead_source: "Campus Drive",
    notes: "Interested in UI UX, wants more portfolio samples.",
  },
  {
    id: "student-kavya-menon",
    accentA: "#ef4444",
    accentB: "#f59e0b",
    full_name: "Kavya Menon",
    email: "kavya.menon@example.com",
    phone: "9844007788",
    alternate_phone: "9844007702",
    address: "8 Palm Grove, Kochi",
    place: "Kochi",
    college_name: "CUSAT",
    current_activity: "Final Year MCA",
    guardian_name: "Bindu Menon",
    guardian_relation: "Mother",
    guardian_phone: "9844007000",
    aadhaar_id: "7744 1100 2200",
    lead_source: "Referral",
    notes: "Requested flexibility for partial upfront payment.",
  },
  {
    id: "student-joseph-mathew",
    accentA: "#14b8a6",
    accentB: "#3b82f6",
    full_name: "Joseph Mathew",
    email: "joseph.mathew@example.com",
    phone: "9895108899",
    alternate_phone: "9895108801",
    address: "13 Skyline Avenue, Trivandrum",
    place: "Trivandrum",
    college_name: "Kerala University",
    current_activity: "Graduate",
    guardian_name: "Mathew Joseph",
    guardian_relation: "Father",
    guardian_phone: "9895108000",
    aadhaar_id: "8899 3322 1100",
    lead_source: "LinkedIn",
    notes: "Hot lead, asked for data science placement stats.",
  },
  {
    id: "student-mehul-soni",
    accentA: "#f43f5e",
    accentB: "#a855f7",
    full_name: "Mehul Soni",
    email: "mehul.soni@example.com",
    phone: "9825009900",
    alternate_phone: "9825009001",
    address: "34 Sunrise Apartments, Surat",
    place: "Surat",
    college_name: "SVNIT",
    current_activity: "Working Professional",
    guardian_name: "Dhara Soni",
    guardian_relation: "Spouse",
    guardian_phone: "9825009000",
    aadhaar_id: "5599 7711 2244",
    lead_source: "Walk-in",
    notes: "Dropped after comparing fees with a shorter workshop.",
  },
  {
    id: "student-ishita-rao",
    accentA: "#22c55e",
    accentB: "#06b6d4",
    full_name: "Ishita Rao",
    email: "ishita.rao@example.com",
    phone: "9812301234",
    alternate_phone: "9812301200",
    address: "67 Jubilee Hills, Hyderabad",
    place: "Hyderabad",
    college_name: "Osmania University",
    current_activity: "Intern",
    guardian_name: "Srinivas Rao",
    guardian_relation: "Father",
    guardian_phone: "9812301000",
    aadhaar_id: "2100 4411 5522",
    lead_source: "YouTube",
    notes: "Completed documentation in one go and paid full fee.",
  },
];

const enrollmentSeeds = [
  {
    id: "enrollment-priya",
    student_id: "student-priya-nair",
    course_id: "course-agentic-ai",
    batch: "Weekend Elite",
    pipeline_stage: "Enrolled",
    lead_date: "2026-06-05",
    enrolled_date: "2026-06-09",
    follow_up_date: "2026-07-01",
    payment_method: "UPI",
    payment_plan: "One Time",
    total_fee: 45000,
    amount_paid: 45000,
    installments_planned: 1,
    installments_paid: 1,
    installment_amount: 45000,
    next_due_date: "",
    payment_status: "Paid",
    enrollment_status: "Active",
    verification_status: "Approved",
    remarks: "Orientation completed and batch access shared.",
    dropout_reason: "",
    last_payment_date: "2026-06-09",
    payment_history: [
      { id: "pay-priya-1", label: "Full Fee", amount: 45000, mode: "UPI", date: "2026-06-09", status: "Paid" },
    ],
  },
  {
    id: "enrollment-karthik",
    student_id: "student-karthik-reddy",
    course_id: "course-data-science",
    batch: "Morning Pro",
    pipeline_stage: "Enrolled",
    lead_date: "2026-05-21",
    enrolled_date: "2026-05-28",
    follow_up_date: "2026-07-03",
    payment_method: "EMI",
    payment_plan: "EMI",
    total_fee: 52000,
    amount_paid: 26000,
    installments_planned: 4,
    installments_paid: 2,
    installment_amount: 13000,
    next_due_date: "2026-07-03",
    payment_status: "Partial",
    enrollment_status: "Active",
    verification_status: "Approved",
    remarks: "Consistent payer, next EMI due in first week of July.",
    dropout_reason: "",
    last_payment_date: "2026-06-03",
    payment_history: [
      { id: "pay-karthik-1", label: "Installment 1", amount: 13000, mode: "UPI", date: "2026-05-28", status: "Paid" },
      { id: "pay-karthik-2", label: "Installment 2", amount: 13000, mode: "Cash", date: "2026-06-03", status: "Paid" },
    ],
  },
  {
    id: "enrollment-aditi",
    student_id: "student-aditi-sharma",
    course_id: "course-full-stack",
    batch: "Evening Launch",
    pipeline_stage: "Enquiry",
    lead_date: "2026-06-24",
    enrolled_date: "",
    follow_up_date: "2026-06-30",
    payment_method: "Pending",
    payment_plan: "Pending",
    total_fee: 48000,
    amount_paid: 0,
    installments_planned: 0,
    installments_paid: 0,
    installment_amount: 0,
    next_due_date: "",
    payment_status: "Pending",
    enrollment_status: "Follow-up",
    verification_status: "Pending",
    remarks: "Needs parent call with counsellor.",
    dropout_reason: "",
    last_payment_date: "",
    payment_history: [],
  },
  {
    id: "enrollment-sameer",
    student_id: "student-sameer-khan",
    course_id: "course-python",
    batch: "Fast Track",
    pipeline_stage: "Dropout",
    lead_date: "2026-05-29",
    enrolled_date: "2026-06-05",
    follow_up_date: "",
    payment_method: "EMI",
    payment_plan: "EMI",
    total_fee: 28000,
    amount_paid: 9000,
    installments_planned: 4,
    installments_paid: 1,
    installment_amount: 7000,
    next_due_date: "",
    payment_status: "Overdue",
    enrollment_status: "Dropped",
    verification_status: "Requested Correction",
    remarks: "Relocated to another city before second installment.",
    dropout_reason: "Shifted to another city and could not attend classes.",
    last_payment_date: "2026-06-05",
    payment_history: [
      { id: "pay-sameer-1", label: "Joining Amount", amount: 9000, mode: "UPI", date: "2026-06-05", status: "Paid" },
    ],
  },
  {
    id: "enrollment-neha",
    student_id: "student-neha-patel",
    course_id: "course-digital",
    batch: "Career Boost",
    pipeline_stage: "Enrolled",
    lead_date: "2026-06-01",
    enrolled_date: "2026-06-07",
    follow_up_date: "2026-07-05",
    payment_method: "EMI",
    payment_plan: "EMI",
    total_fee: 32000,
    amount_paid: 16000,
    installments_planned: 4,
    installments_paid: 2,
    installment_amount: 8000,
    next_due_date: "2026-07-05",
    payment_status: "Partial",
    enrollment_status: "Active",
    verification_status: "Approved",
    remarks: "Good progress, one final EMI pending.",
    dropout_reason: "",
    last_payment_date: "2026-06-19",
    payment_history: [
      { id: "pay-neha-1", label: "Installment 1", amount: 8000, mode: "UPI", date: "2026-06-07", status: "Paid" },
      { id: "pay-neha-2", label: "Installment 2", amount: 8000, mode: "UPI", date: "2026-06-19", status: "Paid" },
    ],
  },
  {
    id: "enrollment-rahul",
    student_id: "student-rahul-das",
    course_id: "course-full-stack",
    batch: "Evening Launch",
    pipeline_stage: "Enquiry",
    lead_date: "2026-06-26",
    enrolled_date: "",
    follow_up_date: "2026-07-01",
    payment_method: "Pending",
    payment_plan: "Pending",
    total_fee: 48000,
    amount_paid: 0,
    installments_planned: 0,
    installments_paid: 0,
    installment_amount: 0,
    next_due_date: "",
    payment_status: "Pending",
    enrollment_status: "Follow-up",
    verification_status: "Pending",
    remarks: "Asked for previous student portfolio examples.",
    dropout_reason: "",
    last_payment_date: "",
    payment_history: [],
  },
  {
    id: "enrollment-kavya",
    student_id: "student-kavya-menon",
    course_id: "course-full-stack",
    batch: "Evening Launch",
    pipeline_stage: "Enrolled",
    lead_date: "2026-05-30",
    enrolled_date: "2026-06-11",
    follow_up_date: "2026-06-29",
    payment_method: "Cash",
    payment_plan: "One Time",
    total_fee: 48000,
    amount_paid: 15000,
    installments_planned: 1,
    installments_paid: 0,
    installment_amount: 48000,
    next_due_date: "2026-06-29",
    payment_status: "Partial",
    enrollment_status: "Active",
    verification_status: "Approved",
    remarks: "Promised to clear balance before classes start.",
    dropout_reason: "",
    last_payment_date: "2026-06-11",
    payment_history: [
      { id: "pay-kavya-1", label: "Advance", amount: 15000, mode: "Cash", date: "2026-06-11", status: "Paid" },
    ],
  },
  {
    id: "enrollment-joseph",
    student_id: "student-joseph-mathew",
    course_id: "course-data-science",
    batch: "Morning Pro",
    pipeline_stage: "Enquiry",
    lead_date: "2026-06-22",
    enrolled_date: "",
    follow_up_date: "2026-06-29",
    payment_method: "Pending",
    payment_plan: "Pending",
    total_fee: 52000,
    amount_paid: 0,
    installments_planned: 0,
    installments_paid: 0,
    installment_amount: 0,
    next_due_date: "",
    payment_status: "Pending",
    enrollment_status: "Follow-up",
    verification_status: "Pending",
    remarks: "Counsellor to share placement deck.",
    dropout_reason: "",
    last_payment_date: "",
    payment_history: [],
  },
  {
    id: "enrollment-mehul",
    student_id: "student-mehul-soni",
    course_id: "course-agentic-ai",
    batch: "Weekend Elite",
    pipeline_stage: "Dropout",
    lead_date: "2026-05-18",
    enrolled_date: "",
    follow_up_date: "",
    payment_method: "Pending",
    payment_plan: "Pending",
    total_fee: 45000,
    amount_paid: 0,
    installments_planned: 0,
    installments_paid: 0,
    installment_amount: 0,
    next_due_date: "",
    payment_status: "Pending",
    enrollment_status: "Dropped",
    verification_status: "Rejected",
    remarks: "Lost to lower-ticket competitor workshop.",
    dropout_reason: "Budget concern after comparing with a shorter workshop.",
    last_payment_date: "",
    payment_history: [],
  },
  {
    id: "enrollment-ishita",
    student_id: "student-ishita-rao",
    course_id: "course-python",
    batch: "Fast Track",
    pipeline_stage: "Enrolled",
    lead_date: "2026-06-02",
    enrolled_date: "2026-06-04",
    follow_up_date: "2026-07-02",
    payment_method: "UPI",
    payment_plan: "One Time",
    total_fee: 28000,
    amount_paid: 28000,
    installments_planned: 1,
    installments_paid: 1,
    installment_amount: 28000,
    next_due_date: "",
    payment_status: "Paid",
    enrollment_status: "Active",
    verification_status: "Approved",
    remarks: "Strong candidate, completed onboarding pack.",
    dropout_reason: "",
    last_payment_date: "2026-06-04",
    payment_history: [
      { id: "pay-ishita-1", label: "Full Fee", amount: 28000, mode: "UPI", date: "2026-06-04", status: "Paid" },
    ],
  },
];

export const sampleEmailTemplates = [
  {
    id: "template-followup",
    template_name: "Follow-up reminder",
    subject: "Quick follow-up on your course enquiry",
    body: "Hi there, just checking whether you need any help with course details, fees, or batch timings.",
  },
  {
    id: "template-enrolled",
    template_name: "Enrollment confirmed",
    subject: "Your enrollment is confirmed",
    body: "Welcome to EnrollEase AI. Your seat has been reserved and the onboarding team will reach out shortly.",
  },
  {
    id: "template-emi",
    template_name: "EMI due reminder",
    subject: "Friendly reminder: upcoming EMI payment",
    body: "This is a reminder that your next installment is due soon. Please contact us if you need support.",
  },
];

export const sampleEmailLogs = [
  { id: "email-1", enrollment_id: "enrollment-karthik", email_type: "EMI due reminder", status: "Sent", sent_at: "2026-06-26" },
  { id: "email-2", enrollment_id: "enrollment-aditi", email_type: "Follow-up reminder", status: "Queued", sent_at: "2026-06-27" },
];

export const sampleAgentLogs = [
  {
    id: "agent-1",
    enrollment_id: "enrollment-joseph",
    user_message: "What should we share with Joseph to improve conversion?",
    agent_response: "Share the placement deck, alumni projects, and the next Morning Pro batch start date to strengthen the conversation.",
    next_action: "Send placement deck and batch timeline",
    created_at: "2026-06-27T11:00:00.000Z",
  },
];

export function createDemoStudents() {
  return studentSeeds.map((student) => ({
    ...student,
    photo_url: createAvatar(student.full_name, student.accentA, student.accentB),
    aadhaar_document_url: createIdCard(student.full_name, student.aadhaar_id, student.accentA, student.accentB),
    created_at: student.id === "student-mehul-soni" ? "2026-05-18" : "2026-06-01",
  }));
}

export function createDemoDocuments(students, enrollments) {
  return enrollments.flatMap((enrollment) => {
    const student = students.find((item) => item.id === enrollment.student_id);
    if (!student) return [];

    const docs = [
      {
        id: `${enrollment.id}-photo`,
        enrollment_id: enrollment.id,
        document_type: "Student Photo",
        file_url: student.photo_url,
        verification_status: enrollment.verification_status === "Approved" ? "Approved" : "Pending",
        remarks: "Profile image attached.",
        uploaded_at: enrollment.lead_date,
      },
      {
        id: `${enrollment.id}-aadhaar`,
        enrollment_id: enrollment.id,
        document_type: "Aadhaar ID Photo",
        file_url: student.aadhaar_document_url,
        verification_status: enrollment.verification_status === "Rejected" ? "Rejected" : enrollment.verification_status,
        remarks: enrollment.pipeline_stage === "Dropout" ? "Verification paused after dropout." : "Identity proof available.",
        uploaded_at: enrollment.lead_date,
      },
    ];

    if (enrollment.payment_history.length) {
      docs.push({
        id: `${enrollment.id}-payment`,
        enrollment_id: enrollment.id,
        document_type: "Payment Proof",
        file_url: "#",
        verification_status: enrollment.payment_status === "Paid" ? "Approved" : "Pending",
        remarks: "Payment transaction captured in portal.",
        uploaded_at: enrollment.last_payment_date || enrollment.enrolled_date || enrollment.lead_date,
      });
    }

    return docs;
  });
}

export function createDemoPortalState() {
  const students = createDemoStudents();
  const enrollments = enrollmentSeeds.map((item) => ({ ...item, created_at: item.lead_date }));
  const documents = createDemoDocuments(students, enrollments);

  return {
    authUser: { id: "demo-admin-user", email: demoAdminAccount.email },
    currentUser: {
      id: "profile-admin",
      user_id: "demo-admin-user",
      full_name: demoAdminAccount.full_name,
      email: demoAdminAccount.email,
      role: "admin",
      created_at: "2026-06-01",
    },
    profiles: [
      {
        id: "profile-admin",
        user_id: "demo-admin-user",
        full_name: demoAdminAccount.full_name,
        email: demoAdminAccount.email,
        role: "admin",
        created_at: "2026-06-01",
      },
    ],
    students,
    courses: demoCourses,
    enrollments,
    documents,
    emailTemplates: sampleEmailTemplates,
    emailLogs: sampleEmailLogs,
    agentLogs: sampleAgentLogs,
    pdfRecords: [],
    auditLogs: [],
    adminAccount: demoAdminAccount,
  };
}
