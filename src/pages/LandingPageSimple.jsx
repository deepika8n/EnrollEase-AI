import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import { decorateCourseRecord, publicCourseCatalog } from "../data/courseCatalog";
import { supabase, hasSupabaseEnv } from "../lib/supabase";
import { loadPublicCourses } from "../services/mailerService";
import heroSlide1 from "../assets/hero-slide-2.png";
import heroSlide3 from "../assets/enrollment-hero.png";

const slides = [
  { image: heroSlide1, title: "Smart admission tracking" },
  { image: heroSlide3, title: "Clean enrollment workflows" },
];

const heroWords = [
  "Transforming",
  "Student",
  "Admissions",
  "Into",
  "Intelligent",
  "Decisions",
];

const hiringPartners = [
  { key: "zomato", label: "Zomato" },
  { key: "rupeek", label: "Rupeek" },
  { key: "bajaj-finserv", label: "Bajaj Finserv" },
  { key: "ibm", label: "IBM" },
  { key: "virtusa", label: "Virtusa" },
  { key: "flipkart", label: "Flipkart" },
  { key: "tcs", label: "TCS" },
  { key: "waah-jobs", label: "Waah Jobs" },
  { key: "brillio", label: "Brillio" },
  { key: "grofers", label: "Grofers" },
  { key: "razorpay", label: "Razorpay" },
  { key: "practo", label: "Practo" },
  { key: "accenture", label: "Accenture" },
  { key: "amazon", label: "Amazon" },
];

const WORD_DURATION_MS = 250;
const WORD_STAGGER_MS = 250;
const HEADING_HOLD_MS = 3000;
const HEADING_FADE_MS = 500;
const CTA_REVEAL_DELAY_MS = 250;

function formatCourseFee(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function CertisuredGrowthIllustration() {
  return (
    <svg viewBox="0 0 760 620" className="h-full w-full" aria-hidden="true">
      <rect width="760" height="620" rx="32" fill="#ffffff" />
      <path d="M30 545h680" stroke="#102f56" strokeWidth="3" strokeLinecap="round" />
      <path d="M82 544 140 458 232 458 287 510 372 372 454 372 546 122 612 122" fill="none" stroke="#102f56" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M610 122 665 122" stroke="#102f56" strokeWidth="4" strokeLinecap="round" />
      <path d="M660 120 650 84 684 93" fill="none" stroke="#102f56" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="118" y="387" width="103" height="158" fill="#31e87b" stroke="#102f56" strokeWidth="4" />
      <rect x="240" y="439" width="99" height="106" fill="#31e87b" stroke="#102f56" strokeWidth="4" />
      <rect x="366" y="314" width="100" height="231" fill="#31e87b" stroke="#102f56" strokeWidth="4" />
      <rect x="485" y="122" width="148" height="423" fill="#31e87b" stroke="#102f56" strokeWidth="4" />
      <path d="M455 546 541 162" stroke="#102f56" strokeWidth="4" />
      <path d="M476 546 562 162" stroke="#102f56" strokeWidth="4" />
      <path d="M502 546h72" stroke="#102f56" strokeWidth="4" />
      <path d="M492 488h50M503 433h49M516 378h51M528 322h51M539 269h50M551 215h49" stroke="#102f56" strokeWidth="4" strokeLinecap="round" />
      <circle cx="558" cy="104" r="48" fill="#102f56" />
      <path d="M535 104a23 23 0 1 1 46 0 23 23 0 1 1-46 0Z" fill="#31e87b" />
      <path d="m547 103 9 9 18-22" fill="none" stroke="#102f56" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M557 152v44" stroke="#102f56" strokeWidth="6" strokeLinecap="round" />
      <path d="M536 89c-11-16-30-14-36 0M578 89c11-16 30-14 36 0" fill="none" stroke="#102f56" strokeWidth="4" strokeLinecap="round" />
      <circle cx="532" cy="229" r="13" fill="#102f56" />
      <path d="M532 242v83M532 262l-28 39M532 262l31 30" stroke="#102f56" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 514c18 0 34 6 47 18 9-23 22-42 39-57M634 490c16-1 29-6 39-18 5 23 11 43 26 61M654 448c6-33 18-57 36-74" fill="none" stroke="#102f56" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M95 544c-2-45-11-89-29-132M87 544c16-32 31-68 49-107M658 544c-6-40-8-83 5-125" fill="none" stroke="#102f56" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {[165, 287, 410, 532].map((x) => (
        <path key={x} d={`M${x} 539v13`} stroke="#102f56" strokeWidth="4" strokeLinecap="round" />
      ))}
    </svg>
  );
}

function PartnerLogo({ partnerKey, label }) {
  switch (partnerKey) {
    case "zomato":
      return (
        <svg viewBox="0 0 260 70" className="h-12 w-auto" aria-label={label}>
          <text x="8" y="48" fill="#ef4f5f" fontSize="44" fontStyle="italic" fontWeight="800" fontFamily="Outfit, Arial, sans-serif">zomato</text>
        </svg>
      );
    case "rupeek":
      return (
        <svg viewBox="0 0 260 70" className="h-12 w-auto" aria-label={label}>
          <path d="M12 16 42 31 42 46 12 31Z" fill="#ff5a36" />
          <path d="M42 31 72 46 72 61 42 46Z" fill="#ff5a36" opacity="0.95" />
          <text x="92" y="46" fill="#ff5a36" fontSize="42" fontStyle="italic" fontWeight="800" fontFamily="Outfit, Arial, sans-serif">rupeek</text>
        </svg>
      );
    case "bajaj-finserv":
      return (
        <svg viewBox="0 0 320 80" className="h-14 w-auto" aria-label={label}>
          <defs>
            <linearGradient id="bajajOrb" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4fc3ff" />
              <stop offset="100%" stopColor="#0d67b4" />
            </linearGradient>
          </defs>
          <circle cx="38" cy="40" r="28" fill="url(#bajajOrb)" stroke="#0f6eb8" strokeWidth="3" />
          <circle cx="38" cy="40" r="18" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.95" />
          <path d="M25 26h16c7 0 12 4 12 10 0 4-2 7-6 9 5 2 8 6 8 11 0 7-6 12-15 12H25Zm14 13c3 0 5-1 5-4s-2-4-5-4h-6v8Zm2 19c4 0 6-2 6-5 0-4-2-5-6-5h-8v10Z" fill="#ffffff" />
          <text x="78" y="34" fill="#1478c8" fontSize="28" fontWeight="800" fontFamily="Outfit, Arial, sans-serif">BAJAJ</text>
          <text x="78" y="62" fill="#1478c8" fontSize="28" fontWeight="800" fontFamily="Outfit, Arial, sans-serif">FINSERV</text>
        </svg>
      );
    case "ibm":
      return (
        <svg viewBox="0 0 220 80" className="h-14 w-auto" aria-label={label}>
          {["I", "B", "M"].map((letter, index) => (
            <g key={letter} transform={`translate(${index * 64},0)`}>
              {[14, 24, 34, 44, 54, 64].map((y) => (
                <rect key={y} x="8" y={y} width="52" height="5" fill="#1f70c1" rx="2.5" />
              ))}
              <text x="12" y="58" fill="#1f70c1" fontSize="58" fontWeight="800" fontFamily="Outfit, Arial, sans-serif">{letter}</text>
            </g>
          ))}
        </svg>
      );
    case "virtusa":
      return (
        <svg viewBox="0 0 250 70" className="h-12 w-auto" aria-label={label}>
          <text x="8" y="47" fill="#4b4fc1" fontSize="46" fontWeight="700" fontFamily="Plus Jakarta Sans, Arial, sans-serif">virtusa</text>
          <circle cx="56" cy="14" r="4" fill="#ff8b2b" />
          <text x="222" y="22" fill="#7d82d9" fontSize="12" fontWeight="700" fontFamily="Arial, sans-serif">®</text>
        </svg>
      );
    case "flipkart":
      return (
        <svg viewBox="0 0 250 70" className="h-12 w-auto" aria-label={label}>
          <text x="8" y="46" fill="#2478d3" fontSize="42" fontStyle="italic" fontWeight="800" fontFamily="Outfit, Arial, sans-serif">Flipkart</text>
          <rect x="162" y="14" width="38" height="38" rx="4" fill="#ffd21f" />
          <path d="M178 22c0-4 3-7 7-7 2 0 4 1 5 2" fill="none" stroke="#f4b400" strokeWidth="3" strokeLinecap="round" />
          <text x="171" y="46" fill="#2478d3" fontSize="30" fontWeight="900" fontFamily="Outfit, Arial, sans-serif">f</text>
        </svg>
      );
    case "tcs":
      return (
        <svg viewBox="0 0 220 70" className="h-12 w-auto" aria-label={label}>
          <defs>
            <linearGradient id="tcsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff7a00" />
              <stop offset="50%" stopColor="#ff2d7a" />
              <stop offset="100%" stopColor="#6036d9" />
            </linearGradient>
          </defs>
          <text x="8" y="48" fill="url(#tcsGrad)" fontSize="54" fontWeight="800" fontFamily="Outfit, Arial, sans-serif">tcs</text>
          <text x="98" y="30" fill="#1773c1" fontSize="15" fontWeight="700" fontFamily="Plus Jakarta Sans, Arial, sans-serif">TATA</text>
          <text x="98" y="46" fill="#1773c1" fontSize="15" fontWeight="700" fontFamily="Plus Jakarta Sans, Arial, sans-serif">CONSULTANCY</text>
          <text x="98" y="62" fill="#1773c1" fontSize="15" fontWeight="700" fontFamily="Plus Jakarta Sans, Arial, sans-serif">SERVICES</text>
        </svg>
      );
    case "waah-jobs":
      return (
        <svg viewBox="0 0 220 70" className="h-12 w-auto" aria-label={label}>
          <text x="8" y="30" fill="#ff7b22" fontSize="34" fontWeight="900" fontFamily="Outfit, Arial, sans-serif">waah</text>
          <text x="86" y="56" fill="#4a2b93" fontSize="34" fontWeight="900" fontFamily="Outfit, Arial, sans-serif">JOBS</text>
          <circle cx="128" cy="47" r="7" fill="#ff9a00" />
        </svg>
      );
    case "brillio":
      return (
        <svg viewBox="0 0 220 70" className="h-12 w-auto" aria-label={label}>
          <text x="8" y="47" fill="#5d5f63" fontSize="44" fontWeight="800" fontFamily="Outfit, Arial, sans-serif">brillio</text>
          <circle cx="108" cy="58" r="5" fill="#9fd637" />
          <circle cx="124" cy="58" r="5" fill="#b7db31" />
        </svg>
      );
    case "grofers":
      return (
        <svg viewBox="0 0 180 90" className="h-14 w-auto" aria-label={label}>
          <rect x="12" y="8" width="70" height="70" fill="#f56f2a" rx="2" />
          <circle cx="47" cy="40" r="19" fill="#ffffff" />
          <path d="M53 27c8 0 13 6 13 13v9H52v-8h5c0-4-2-6-6-6-4 0-8 3-8 10 0 8 5 12 12 12 5 0 9-2 11-4l3 6c-4 4-10 6-16 6-12 0-21-9-21-20 0-11 8-18 19-18Z" fill="#f56f2a" />
          <circle cx="66" cy="18" r="5" fill="#ffffff" />
          <text x="12" y="88" fill="#f56f2a" fontSize="18" fontWeight="800" fontFamily="Outfit, Arial, sans-serif">GROFERS</text>
        </svg>
      );
    case "razorpay":
      return (
        <svg viewBox="0 0 260 70" className="h-12 w-auto" aria-label={label}>
          <path d="M14 49 26 18 44 18 32 49Z" fill="#2c69c9" />
          <path d="M34 49 58 18 74 18 50 49Z" fill="#184e9d" />
          <text x="76" y="47" fill="#2352a3" fontSize="42" fontStyle="italic" fontWeight="800" fontFamily="Outfit, Arial, sans-serif">Razorpay</text>
        </svg>
      );
    case "practo":
      return (
        <svg viewBox="0 0 240 70" className="h-12 w-auto" aria-label={label}>
          <circle cx="18" cy="36" r="7" fill="#36b6de" />
          <text x="30" y="46" fill="#2f3b93" fontSize="42" fontWeight="800" fontFamily="Outfit, Arial, sans-serif">practo</text>
          <circle cx="205" cy="36" r="7" fill="#36b6de" />
        </svg>
      );
    case "accenture":
      return (
        <svg viewBox="0 0 260 70" className="h-12 w-auto" aria-label={label}>
          <text x="8" y="48" fill="#111827" fontSize="42" fontWeight="700" fontFamily="Plus Jakarta Sans, Arial, sans-serif">accenture</text>
          <path d="M152 16h24l-18 8Z" fill="#b51cff" />
        </svg>
      );
    case "amazon":
      return (
        <svg viewBox="0 0 250 70" className="h-12 w-auto" aria-label={label}>
          <text x="8" y="42" fill="#111827" fontSize="42" fontWeight="800" fontFamily="Outfit, Arial, sans-serif">amazon</text>
          <path d="M52 52c34 17 94 17 126-2" fill="none" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round" />
          <path d="M167 48 177 51 170 58" fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return <span className="partners-marquee-name">{label}</span>;
  }
}


export default function LandingPageSimple() {
  const navigate = useNavigate();
  const [slideIndex, setSlideIndex] = useState(0);
  const [visibleWords, setVisibleWords] = useState(1);
  const [headingFading, setHeadingFading] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);
  const [flippedCourses, setFlippedCourses] = useState({});
  const [showAdminAlert, setShowAdminAlert] = useState(false);
  const [publicCourses, setPublicCourses] = useState([]);
  const courses = useMemo(
    () => (publicCourses.length ? publicCourses.map(decorateCourseRecord) : publicCourseCatalog),
    [publicCourses],
  );

  useEffect(() => {
    if (!hasSupabaseEnv || !supabase) {
      return undefined;
    }

    let mounted = true;

    const loadCourses = async () => {
      try {
        const loadedCourses = await loadPublicCourses();
        if (mounted && Array.isArray(loadedCourses) && loadedCourses.length) {
          setPublicCourses(loadedCourses);
        }
      } catch {
        // Keep showing the static catalog fallback on error.
      }
    };

    void loadCourses();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % slides.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeouts = [];

    const schedule = (callback, delay) => {
      const timeoutId = window.setTimeout(() => {
        if (!cancelled) {
          callback();
        }
      }, delay);
      timeouts.push(timeoutId);
    };

    const runHeroCycle = () => {
      setVisibleWords(1);
      setHeadingFading(false);
      setSubtitleVisible(false);
      setCtaVisible(false);

      for (let index = 1; index < heroWords.length; index += 1) {
        schedule(() => setVisibleWords(index + 1), index * WORD_STAGGER_MS);
      }

      const headingFinishedAt = (heroWords.length - 1) * WORD_STAGGER_MS + WORD_DURATION_MS;
      schedule(() => setSubtitleVisible(true), headingFinishedAt);
      schedule(() => setCtaVisible(true), headingFinishedAt + CTA_REVEAL_DELAY_MS);
      schedule(() => setHeadingFading(true), headingFinishedAt + HEADING_HOLD_MS);
      schedule(runHeroCycle, headingFinishedAt + HEADING_HOLD_MS + HEADING_FADE_MS);
    };

    runHeroCycle();

    return () => {
      cancelled = true;
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  const toggleCourseCard = (courseKey) => {
    setFlippedCourses((prev) => ({
      ...prev,
      [courseKey]: !prev[courseKey],
    }));
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(11,53,88,0.08),transparent_24%),radial-gradient(circle_at_82%_10%,rgba(77,122,156,0.07),transparent_20%),radial-gradient(circle_at_66%_78%,rgba(30,207,107,0.05),transparent_17%),linear-gradient(180deg,#fcfdff_0%,#f5f8fb_100%)] text-brand-500">
      <div className="pointer-events-none absolute left-[-4rem] top-[-3rem] h-72 w-72 rounded-full bg-brand-200/30 blur-[110px]" />
      <div className="pointer-events-none absolute right-[-5rem] top-14 h-[22rem] w-[22rem] rounded-full bg-brand-100/35 blur-[130px]" />
      <div className="pointer-events-none absolute bottom-[-8rem] left-[22%] h-[18rem] w-[18rem] rounded-full bg-accent-100/25 blur-[140px]" />

      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/78 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 md:px-8 lg:px-12">
          <BrandLogo
            size="sm"
            subtitle="Admissions OS"
            className="gap-4"
            iconClassName="h-[3.15rem] w-[3.15rem] rounded-[18px] shadow-[0_16px_30px_rgba(11,53,88,0.12)]"
            wordmarkClassName="text-[1.95rem] tracking-[-0.055em]"
            subtitleClassName="text-[11px] tracking-[0.28em] text-brand-500/72"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAdminAlert(true)}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-[0_12px_28px_rgba(11,53,88,0.06)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-500 focus:outline-none focus:ring-4 focus:ring-accent-100"
            >
              Admin Login
            </button>
            <Link
              to="/enquiry"
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-b from-brand-500 to-brand-700 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(11,53,88,0.18)] transition duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_20px_40px_rgba(11,53,88,0.22)] focus:outline-none focus:ring-4 focus:ring-accent-100"
            >
              Enquire Now
            </Link>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-7xl px-4 py-10 md:px-8 lg:px-12 lg:py-16">
        <section className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div className="fade-in-up">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-brand-500/72">ENROLLEASE  AI</p>
            <h1
              aria-label="Transforming Student Admissions Into Intelligent Decisions"
              className={`hero-heading-live mt-4 min-h-[5.9em] max-w-3xl font-display text-5xl font-semibold leading-[0.98] tracking-[-0.06em] text-slate-950 md:text-6xl ${headingFading ? "is-fading" : ""}`}
            >
              {heroWords.map((word, index) => (
                <span
                  key={word}
                  className={`hero-word ${index < visibleWords ? "is-visible" : "is-hidden"}`}
                >
                  {word}
                </span>
              ))}
            </h1>
            {subtitleVisible ? (
              <p className="fade-in-up mt-6 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                Built to streamline enquiries, admissions, documents, and fee management.
              </p>
            ) : null}
            {ctaVisible ? (
              <div className="fade-in-up mt-9 flex flex-wrap gap-4">
                <Link
                  to="/enquiry"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-brand-500 shadow-[0_18px_36px_rgba(11,53,88,0.08)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 focus:outline-none focus:ring-4 focus:ring-accent-100"
                >
                  Enquire Now
                </Link>
                <a
                  href="#courses"
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-b from-brand-500 to-brand-700 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(11,53,88,0.18)] transition duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_22px_42px_rgba(11,53,88,0.22)] focus:outline-none focus:ring-4 focus:ring-accent-100"
                >
                  View Courses
                </a>
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-[32px] border border-white/85 bg-white/84 p-4 shadow-[0_28px_70px_rgba(9,30,66,0.10)] backdrop-blur-xl md:p-5">
            <div className="relative overflow-hidden rounded-[30px]">
              <div
                className="flex transition-transform duration-1000 ease-out"
                style={{ transform: `translateX(-${slideIndex * 100}%)` }}
              >
                {slides.map((slide) => (
                  <div key={slide.title} className="relative min-w-full">
                    <img src={slide.image} alt={slide.title} className="h-[460px] w-full object-cover object-center" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-800/86 via-brand-500/22 to-transparent p-7">
                      <p className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-white">
                        {slide.title}
                      </p>
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
                    className={`h-2.5 rounded-full transition ${slideIndex === index ? "w-9 bg-white shadow-[0_0_18px_rgba(255,255,255,0.35)]" : "w-2.5 bg-white/55"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="courses" className="mt-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div className="max-w-2xl">
              <h2 className="font-display text-5xl font-semibold leading-[1.18] tracking-[-0.05em] text-slate-950 md:text-6xl">
                <span className="certisured-heading-glow block">Be more than Certified</span>
                <span className="certisured-heading-glow mt-3 block">Be Certisured</span>
              </h2>
              <p className="mt-10 max-w-xl text-[1.1rem] leading-[1.75] tracking-[0.02em] text-slate-800 md:text-[1.25rem]">
                Ranked number 1 for offline and online courses on advanced technology across many websites.
              </p>
            </div>

            <div className="certisured-illustration-wrap">
              <CertisuredGrowthIllustration />
            </div>
          </div>
        </section>

        <section className="mt-16">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-brand-500/72">Courses</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.05em] text-slate-950 md:text-5xl">
              Explore your current course lineup
            </h2>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {courses.map((course) => {
              const flipped = Boolean(flippedCourses[course.key]);
              return (
                <button
                  key={course.key}
                  type="button"
                  onClick={() => toggleCourseCard(course.key)}
                  className="course-flip-card"
                >
                  <span className={`course-flip-card-inner ${flipped ? "is-flipped" : ""}`}>
                    <span className="course-flip-face course-flip-front">
                      <h3 className="mt-1 font-display text-[1.28rem] font-semibold leading-tight tracking-[-0.04em] text-white">
                        {course.course_name}
                      </h3>
                      <p className="mt-3 text-[13px] leading-6 text-white/95">
                        {course.summary?.[0] || course.duration}
                      </p>
                      <span className="mt-auto inline-flex w-fit items-center rounded-full bg-white/18 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                        View Fee
                      </span>
                    </span>
                    <span className="course-flip-face course-flip-back">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
                        {course.course_name}
                      </span>
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/72">
                        Course Fee
                      </p>
                      <p className="course-fee-reveal mt-3 font-display text-[2.45rem] font-semibold leading-none tracking-[-0.05em] text-white">
                        {formatCourseFee(course.fee)}
                      </p>
                      <p className="mt-4 text-[12px] leading-5 text-white/90">
                        {course.duration}
                      </p>
                      <span className="course-glow-chip mt-auto inline-flex w-fit items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                        EnrollEase Pick
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-16 overflow-hidden rounded-[28px] border border-white/80 bg-white/78 px-5 py-8 shadow-[0_18px_50px_rgba(9,30,66,0.08)] backdrop-blur-xl md:px-7">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-brand-500/72">Placements</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.05em] text-slate-950 md:text-4xl">
              Our hiring partners
            </h2>
          </div>

          <div className="partners-marquee-shell mt-8">
            <div className="partners-marquee-track">
              {hiringPartners.map((partner) => (
                <div key={partner.key} className="partners-marquee-item">
                  <PartnerLogo partnerKey={partner.key} label={partner.label} />
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      {showAdminAlert ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] border border-white/85 bg-white p-6 shadow-[0_30px_80px_rgba(9,30,66,0.22)] md:p-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-rose-500">Restricted Access</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.05em] text-slate-950">
              Admin login is for authorized staff only
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Students should not sign in here. This area is protected for administrators who manage enquiries, enrollments, student records, and payments.
            </p>
            <div className="mt-6 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
              Security notice: only approved admin credentials can access the dashboard. Unauthorized users will not be able to continue.
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowAdminAlert(false)}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition duration-200 hover:border-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdminAlert(false);
                  navigate("/admin-login?fresh=1");
                }}
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-b from-brand-500 to-brand-700 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(11,53,88,0.18)] transition duration-200 hover:-translate-y-0.5 hover:brightness-105"
              >
                Continue as Admin
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="border-t border-slate-200/80 bg-white/74 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center md:px-8 lg:px-12">
          <p className="text-sm font-medium text-slate-600">© EnrollEase AI</p>
        </div>
      </footer>
    </div>
  );
}
