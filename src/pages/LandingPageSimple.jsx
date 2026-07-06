import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import heroSlide1 from "../assets/hero-slide-2.png";
import heroSlide2 from "../assets/hero-slide-3.png";
import heroSlide3 from "../assets/enrollment-hero.png";
import enrolleaseLogo from "../assets/enrollease-logo.svg";
import { formatCurrency } from "../utils/formatters";
import { publicCourseCatalog } from "../data/courseCatalog";

const slides = [
  { image: heroSlide1, title: "Admissions" },
  { image: heroSlide2, title: "Courses" },
  { image: heroSlide3, title: "Enrollments" },
];

export default function LandingPageSimple() {
  const [slideIndex, setSlideIndex] = useState(0);
  const [activeCourseKey, setActiveCourseKey] = useState(publicCourseCatalog[0].key);
  const activeCourse = publicCourseCatalog.find((course) => course.key === activeCourseKey) || publicCourseCatalog[0];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % slides.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f9fcff_0%,#eef7ff_100%)]">
      <header className="border-b border-sky-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 md:px-8 lg:px-12">
          <div className="flex items-center gap-4">
            <img src={enrolleaseLogo} alt="EnrollEase AI logo" className="h-14 w-14 rounded-[18px]" />
            <div>
              <p className="text-sm uppercase tracking-[0.34em] text-sky-700">EnrollEase AI</p>
              <p className="mt-1 text-sm text-slate-500">Admissions portal</p>
            </div>
          </div>
          <Link to="/login" className="button-primary">
            Admin Login
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 md:px-8 lg:px-12 lg:py-14">
        <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex flex-col justify-center">
            <p className="text-sm uppercase tracking-[0.3em] text-sky-700">Simple admission management</p>
            <h1 className="mt-4 font-display text-5xl font-bold leading-tight text-slate-950 md:text-6xl">
              Manage enquiries, enrollments, and payments.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-slate-600">
              Student records, EMI tracking, one-time payments, and course admissions in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/login" className="button-primary">
                Open Portal
              </Link>
            </div>
          </div>

          <div className="panel overflow-hidden p-4">
            <div className="relative overflow-hidden rounded-[28px]">
              <div
                className="flex transition-transform duration-1000 ease-out"
                style={{ transform: `translateX(-${slideIndex * 100}%)` }}
              >
                {slides.map((slide) => (
                  <div key={slide.title} className="relative min-w-full">
                    <img src={slide.image} alt={slide.title} className="h-[420px] w-full object-cover object-center" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/60 to-transparent p-6">
                      <p className="font-display text-3xl font-bold text-white">{slide.title}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute bottom-5 right-5 flex gap-2">
                {slides.map((slide, index) => (
                  <button
                    key={slide.title}
                    type="button"
                    aria-label={`Show slide ${index + 1}`}
                    onClick={() => setSlideIndex(index)}
                    className={`h-2.5 rounded-full ${slideIndex === index ? "w-8 bg-white" : "w-2.5 bg-white/60"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="courses" className="mt-14">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-sky-700">Available Courses</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-slate-950">Course List</h2>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {publicCourseCatalog.map((course) => (
              <button
                key={course.key}
                type="button"
                onClick={() => setActiveCourseKey(course.key)}
                className={`rounded-full border px-5 py-3 text-sm font-semibold transition ${
                  activeCourse.key === course.key
                    ? "border-sky-600 bg-sky-600 text-white shadow-[0_18px_40px_rgba(14,116,214,0.22)]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:text-slate-950"
                }`}
              >
                {course.course_name}
              </button>
            ))}
          </div>

          <div className="panel mt-8 overflow-hidden p-4">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <img src={activeCourse.image} alt={activeCourse.course_name} className="h-full w-full rounded-[28px] object-cover" />

              <div className="px-2 py-3">
                <p className="text-sm uppercase tracking-[0.24em] text-sky-700">{activeCourse.mode}</p>
                <h3 className="mt-3 font-display text-4xl font-bold text-slate-950">{activeCourse.course_name}</h3>
                <div className="mt-6 space-y-3 text-base leading-7 text-slate-600">
                  {activeCourse.summary.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Duration <span className="ml-2 font-semibold text-slate-900">{activeCourse.duration}</span>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Fee <span className="ml-2 font-semibold text-slate-900">{formatCurrency(activeCourse.fee)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
