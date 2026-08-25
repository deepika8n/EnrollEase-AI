import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import { canonicalCourseSeeds, getCourseFormOptions } from "../data/courseCatalog";
import { useApp } from "../context/AppContext";
import { supabase, hasSupabaseEnv } from "../lib/supabase";
import { loadPublicCourses, submitPublicEnquiry } from "../services/mailerService";
import { getTodayIsoDate } from "../utils/enrollmentDateValidation";

const currentActivityOptions = ["Student", "Working"];
const enquirySteps = [
  {
    label: "Step 1",
    title: "Submit enquiry",
    badgeClass: "bg-[linear-gradient(135deg,#1e3a8a_0%,#2563eb_55%,#38bdf8_100%)] shadow-[0_12px_28px_rgba(37,99,235,0.26)]",
  },
  {
    label: "Step 2",
    title: "Get course guidance",
    badgeClass: "bg-[linear-gradient(135deg,#0f766e_0%,#14b8a6_52%,#67e8f9_100%)] shadow-[0_12px_28px_rgba(20,184,166,0.24)]",
  },
  {
    label: "Step 3",
    title: "Move to enroll",
    badgeClass: "bg-[linear-gradient(135deg,#166534_0%,#22c55e_50%,#86efac_100%)] shadow-[0_12px_28px_rgba(34,197,94,0.24)]",
  },
];
const STEP_VISUAL_URL = "https://t3.ftcdn.net/jpg/01/24/19/08/360_F_124190850_LFUc6G0en37Nzd60EpYEXpv5tciExvO9.jpg";
const CERTISURED_YOUTUBE_URL = "https://www.youtube.com/results?search_query=Certisured";
const formPanelClass = "rounded-[32px] border border-rose-100/90 bg-[linear-gradient(145deg,rgba(255,244,247,0.98),rgba(255,232,240,0.94))] shadow-[0_24px_60px_rgba(15,23,42,0.10)]";
const fieldSurfaceClasses = {
  full_name: "border-violet-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,243,255,0.94))] shadow-[0_10px_24px_rgba(139,92,246,0.08)]",
  email: "border-emerald-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,253,245,0.94))] shadow-[0_10px_24px_rgba(16,185,129,0.08)]",
  phone: "border-cyan-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,254,255,0.94))] shadow-[0_10px_24px_rgba(34,211,238,0.08)]",
  current_activity: "border-amber-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,251,235,0.94))] shadow-[0_10px_24px_rgba(245,158,11,0.08)]",
  place: "border-rose-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,241,242,0.94))] shadow-[0_10px_24px_rgba(244,63,94,0.07)]",
  course_id: "border-teal-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,253,250,0.94))] shadow-[0_10px_24px_rgba(20,184,166,0.08)]",
  remarks: "border-fuchsia-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,245,255,0.94))] shadow-[0_10px_24px_rgba(217,70,239,0.07)]",
  lead_date: "border-orange-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,237,0.94))] shadow-[0_10px_24px_rgba(249,115,22,0.08)]",
};

function createBlankForm() {
  return {
    full_name: "",
    email: "",
    phone: "",
    current_activity: "",
    place: "",
    course_name: "",
    course_id: "",
    remarks: "",
    lead_date: getTodayIsoDate(),
  };
}

function LabeledField({ label, children }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-700">{label}</p>
      {children}
    </div>
  );
}

export default function PublicEnquiryPage() {
  const { courses } = useApp();
  const [publicCourses, setPublicCourses] = useState([]);
  const [courseLoadError, setCourseLoadError] = useState("");
  const [form, setForm] = useState(createBlankForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const courseOptions = useMemo(
    () => getCourseFormOptions(publicCourses.length ? publicCourses : courses?.length ? courses : canonicalCourseSeeds),
    [publicCourses, courses],
  );

  useEffect(() => {
    if (!hasSupabaseEnv || !supabase) {
      return;
    }

    let mounted = true;
    const loadCourses = async () => {
      try {
        const loadedCourses = await loadPublicCourses();
        if (mounted && Array.isArray(loadedCourses) && loadedCourses.length) {
          setPublicCourses(loadedCourses);
        }
      } catch (loadError) {
        if (!mounted) return;
        setCourseLoadError(loadError.message || "Unable to load course options.");
      }
    };

    void loadCourses();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStepIndex((current) => (current + 1) % enquirySteps.length);
    }, 2200);

    return () => window.clearInterval(timer);
  }, []);

  const handleChange = (key, value) => {
    setForm((prev) => {
      const nextForm = { ...prev, [key]: value };
      if (key === "course_id") {
        const selectedCourse = courseOptions.find((item) => item.id === value) || null;
        nextForm.course_name = selectedCourse?.course_name || "";
      }
      return nextForm;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await submitPublicEnquiry({
        student: {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          current_activity: form.current_activity.trim(),
          place: form.place.trim(),
        },
        enrollment: {
          course_id: form.course_id,
          course_name: form.course_name,
          remarks: form.remarks.trim(),
          lead_date: form.lead_date,
        },
      });

      setSuccess("Your enquiry has been submitted. Please check your email for acknowledgement.");
      setForm(createBlankForm());
    } catch (submitError) {
      setError(submitError.message || "Unable to submit your enquiry right now.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.10),transparent_24%),radial-gradient(circle_at_92%_18%,rgba(16,185,129,0.10),transparent_20%),radial-gradient(circle_at_42%_96%,rgba(245,158,11,0.12),transparent_18%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1480px]">
        <header className="mb-8 flex items-center justify-between">
          <BrandLogo
            size="sm"
            subtitle="Admissions OS"
            className="gap-4"
            iconClassName="h-[3rem] w-[3rem] rounded-[18px]"
            wordmarkClassName="text-[1.8rem] tracking-[-0.055em]"
            subtitleClassName="text-[11px] tracking-[0.28em] text-brand-500/72"
          />
          <Link to="/" className="button-secondary px-4 py-2 text-sm">Back to Home</Link>
        </header>

        <section className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <div className="flex flex-col items-center justify-center px-4 py-6">
            <img
              src={STEP_VISUAL_URL}
              alt="Enrollment steps visual"
              className="h-48 w-auto max-w-full object-contain mix-blend-multiply md:h-56"
            />
            <div className="mt-6 flex min-w-0 flex-col items-center text-center">
              <span
                key={enquirySteps[activeStepIndex].label}
                className={`inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-bold uppercase tracking-[0.18em] text-white animate-[pulse_1.6s_ease-in-out_infinite] ${enquirySteps[activeStepIndex].badgeClass}`}
              >
                {enquirySteps[activeStepIndex].label}
              </span>
              <p
                key={enquirySteps[activeStepIndex].title}
                className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] text-slate-950 animate-[fadeUp_450ms_ease_both]"
              >
                {enquirySteps[activeStepIndex].title}
              </p>
            </div>

            <section className="mt-8 w-full max-w-xl overflow-hidden rounded-[30px] border border-cyan-100 bg-[linear-gradient(145deg,#ecfeff_0%,#ffffff_46%,#f7fee7_100%)] p-5 shadow-[0_24px_56px_rgba(8,145,178,0.13)] md:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] bg-[linear-gradient(135deg,#dc2626_0%,#ef4444_56%,#fb7185_100%)] shadow-[0_16px_32px_rgba(220,38,38,0.24)]">
                  <span className="ml-1 h-0 w-0 border-y-[12px] border-l-[18px] border-y-transparent border-l-white" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-600">Learn before you enquire</p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-slate-950">
                    Watch CERTISURED on YouTube
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Explore workshops, course insights, and student learning moments before choosing your program.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={CERTISURED_YOUTUBE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0891b2,#10b981)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(8,145,178,0.22)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(16,185,129,0.24)]"
                >
                  Watch on YouTube
                </a>
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <div className="flex justify-center px-1">
              <h1 className="bg-[linear-gradient(120deg,#1e3a8a_0%,#ec4899_24%,#f59e0b_48%,#10b981_72%,#2563eb_100%)] bg-[length:220%_220%] bg-clip-text text-center font-display text-4xl font-semibold tracking-[-0.06em] text-transparent drop-shadow-[0_10px_30px_rgba(37,99,235,0.18)] animate-[certisuredGradientShift_6s_ease-in-out_infinite] md:text-5xl">
                Student Form
              </h1>
            </div>

            <form
              onSubmit={handleSubmit}
              className={`${formPanelClass} p-6 md:p-8`}
            >
            <section>
              <h2 className="section-title">Student Details</h2>
              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <input
                  value={form.full_name}
                  onChange={(event) => handleChange("full_name", event.target.value)}
                  placeholder="Student name"
                  required
                  className={fieldSurfaceClasses.full_name}
                />
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => handleChange("email", event.target.value)}
                  placeholder="Email"
                  required
                  className={fieldSurfaceClasses.email}
                />
                <input
                  value={form.phone}
                  onChange={(event) => handleChange("phone", event.target.value)}
                  placeholder="Phone"
                  required
                  className={fieldSurfaceClasses.phone}
                />
                <select
                  value={form.current_activity}
                  onChange={(event) => handleChange("current_activity", event.target.value)}
                  required
                  className={fieldSurfaceClasses.current_activity}
                >
                  <option value="">I am a</option>
                  {currentActivityOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <input
                  value={form.place}
                  onChange={(event) => handleChange("place", event.target.value)}
                  placeholder="City"
                  required
                  className={fieldSurfaceClasses.place}
                />
                <select
                  value={form.course_id}
                  onChange={(event) => handleChange("course_id", event.target.value)}
                  required
                  className={`${fieldSurfaceClasses.course_id} md:col-span-2 xl:col-span-3`}
                >
                  <option value="">Choose interested course</option>
                  {courseOptions.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.course_name}
                    </option>
                  ))}
                </select>
                <div className="md:col-span-2 xl:col-span-3">
                  <textarea
                    rows="4"
                    className={`w-full ${fieldSurfaceClasses.remarks}`}
                    placeholder="Remarks"
                    value={form.remarks}
                    onChange={(event) => handleChange("remarks", event.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="mt-6">
              <h2 className="section-title">Admission Details</h2>
              <div className="mt-6 grid gap-4 md:max-w-[22rem]">
                <LabeledField label="Enquiry Date *">
                  <input
                    type="date"
                    value={form.lead_date}
                    max={getTodayIsoDate()}
                    onChange={(event) => handleChange("lead_date", event.target.value)}
                    required
                    className={fieldSurfaceClasses.lead_date}
                  />
                </LabeledField>
              </div>
            </section>

            {error ? <p className="mt-5 text-sm font-semibold text-brand-500">{error}</p> : null}
            {success ? <p className="mt-5 text-sm font-semibold text-emerald-600">{success}</p> : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="submit" disabled={submitting} className="button-primary px-6 py-3 disabled:opacity-60">
                {submitting ? "Saving..." : "Save Enquiry"}
              </button>
            </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
