import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import heroSlide1 from "../assets/hero-slide-2.png";
import heroSlide2 from "../assets/hero-slide-3.png";
import heroSlide3 from "../assets/enrollment-hero.png";

const slides = [
  { image: heroSlide1, title: "Smart admission tracking" },
  { image: heroSlide2, title: "Simple course visibility" },
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

const WORD_DURATION_MS = 250;
const WORD_STAGGER_MS = 250;
const HEADING_HOLD_MS = 3000;
const HEADING_FADE_MS = 500;
const CTA_REVEAL_DELAY_MS = 250;

export default function LandingPageSimple() {
  const [slideIndex, setSlideIndex] = useState(0);
  const [visibleWords, setVisibleWords] = useState(1);
  const [headingFading, setHeadingFading] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);

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
          <Link
            to="/login?fresh=1"
            className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-b from-brand-500 to-brand-700 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(11,53,88,0.18)] transition duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_20px_40px_rgba(11,53,88,0.22)] focus:outline-none focus:ring-4 focus:ring-accent-100"
          >
            Launch Portal
          </Link>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-7xl px-4 py-10 md:px-8 lg:px-12 lg:py-16">
        <section className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div className="fade-in-up">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-brand-500/72">ENROLLEASE AI</p>
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
                  to="/login?fresh=1"
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-b from-brand-500 to-brand-700 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(11,53,88,0.18)] transition duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_22px_42px_rgba(11,53,88,0.22)] focus:outline-none focus:ring-4 focus:ring-accent-100"
                >
                  Open EnrollEase AI
                </Link>
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

      </main>

      <footer className="border-t border-slate-200/80 bg-white/74 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center md:px-8 lg:px-12">
          <p className="text-sm font-medium text-slate-600">© EnrollEase AI</p>
        </div>
      </footer>
    </div>
  );
}
