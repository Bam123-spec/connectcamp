import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Linkedin,
  MapPin,
  Twitter,
} from "lucide-react";

const utilityLinks = [
  { label: "Are you a Student? Learn More", href: "#students" },
  { label: "Looking for Client Support?", href: "#support" },
];

const navItems = [
  { label: "Product", href: "#product" },
  { label: "Solutions", href: "#solutions" },
  { label: "Students", href: "#students" },
  { label: "Schools", href: "#schools" },
  { label: "Stories", href: "#stories" },
  { label: "Resources", href: "#interactive-demo" },
];

const heroPhrases = [
  "Support better outcomes",
  "Make data-driven decisions",
  "Drive engagement & retention",
];

const partnerLogos = [
  { src: "/ready-assets/cornell.svg", alt: "Cornell" },
  { src: "/ready-assets/seattle-university@2x.jpg", alt: "Seattle University" },
  { src: "/ready-assets/embry-riddle@2x.jpg", alt: "Embry-Riddle" },
  { src: "/ready-assets/sjsu-university@2x.jpg", alt: "SJSU" },
  { src: "/ready-assets/lamar-university.svg", alt: "Lamar University" },
  { src: "/ready-assets/spelman-college@2x.jpg", alt: "Spelman College" },
  { src: "/ready-assets/uhcl.svg", alt: "UHCL" },
  { src: "/ready-assets/st-lawrence-college.svg", alt: "St. Lawrence College" },
  { src: "/ready-assets/insitution-logos_bu-law.svg", alt: "Boston University School of Law" },
  { src: "/ready-assets/portland-community-college-logo-v2.svg", alt: "Portland Community College" },
  { src: "/ready-assets/smith-college-x2@2x.png", alt: "Smith College" },
  { src: "/ready-assets/university-of-wisconsin-eau-claire.svg", alt: "University of Wisconsin Eau-Claire" },
];

const stats = [
  { label: "Student Clubs", value: "87", suffix: "K+" },
  { label: "Event Registrations", value: "9", suffix: "M+" },
  { label: "Targeted Emails Delivered", value: "154", suffix: "M+" },
];

const testimonials = [
  {
    headline: "By creating a unified platform, we leveled the playing field for all students.",
    quote:
      "Prior to implementing CampusCord, our online community felt disconnected from the on-campus experience. By creating a unified platform, we leveled the playing field for all students. Events and community channels have become top engagement drivers, providing a central virtual town square that strengthens retention.",
    name: "Matt Weitzel",
    role: "IT Project Manager",
    location: "Rocky Mountain College of Art + Design",
  },
  {
    headline: "We saw a major lift in group participation and event promotion.",
    quote:
      "The platform's suite of engagement solutions made the student experience easier to manage and easier to measure. In a short period, we saw stronger participation, more event visibility, and better reporting for the teams responsible for engagement.",
    name: "Calvin L. Smith, Jr",
    role: "Former Senior Director of Student Leadership and Involvement",
    location: "Johns Hopkins University",
  },
];

const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Campus engagement", href: "#product" },
      { label: "Student experience", href: "#students" },
      { label: "Support and success", href: "#support" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Student engagement", href: "#solutions" },
      { label: "Academic success", href: "#schools" },
      { label: "Community and belonging", href: "#solutions" },
      { label: "Communications", href: "#solutions" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Success stories", href: "#stories" },
      { label: "Guides", href: "#interactive-demo" },
      { label: "Articles", href: "#interactive-demo" },
      { label: "Webinars", href: "#interactive-demo" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Client support", href: "#support" },
      { label: "Implementation", href: "#support" },
      { label: "Privacy", href: "#support" },
      { label: "Legal notice", href: "#support" },
    ],
  },
];

function Landing() {
  const [heroIndex, setHeroIndex] = useState(0);
  const [testimonialIndex, setTestimonialIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % heroPhrases.length);
    }, 3000);

    return () => window.clearInterval(timer);
  }, []);

  const currentTestimonial = testimonials[testimonialIndex];

  return (
    <div
      className="min-h-screen bg-white text-[#0B0F19]"
      style={{ fontFamily: "Figtree, sans-serif" }}
    >
      <header className="sticky top-0 z-40 border-b border-[#0B0F19]/8 bg-white/96 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 py-3 text-[11px] font-medium text-[#0B0F19]/58 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {utilityLinks.map((item) => (
                <a key={item.label} href={item.href} className="transition-colors hover:text-[#0B0F19]">
                  {item.label}
                </a>
              ))}
            </div>
            <span className="hidden sm:inline">
              Student engagement platform for campus life, communications, and belonging.
            </span>
          </div>
        </div>

        <div className="border-t border-[#0B0F19]/8 bg-white">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
            <BrandLogo />

            <nav className="hidden items-center gap-1 text-sm font-medium text-[#0B0F19]/70 lg:flex">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="rounded-full px-3 py-2 transition-colors hover:bg-[#F5F7FA] hover:text-[#0B0F19]"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <a
              href="#support"
              className="inline-flex items-center gap-2 rounded-full border border-[#0B0F19]/10 bg-white px-4 py-2.5 text-sm font-semibold text-[#0B0F19] transition-colors hover:bg-[#F5F7FA]"
            >
              Let&apos;s Talk
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-[#0B0F19]/8 bg-white py-14 lg:py-16">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0B0F19]/52">
                Ready to level up your student experience?
              </p>

              <div className="mt-4 flex items-start gap-3">
                <div className="min-w-0">
                  <h1 className="text-5xl font-semibold tracking-[-0.05em] text-[#0B0F19] sm:text-6xl lg:text-[4.7rem] lg:leading-[0.95]">
                    {heroPhrases[heroIndex]}
                  </h1>
                </div>
                <img
                  src="/ready-assets/large-arrow-right.svg"
                  alt=""
                  className="mt-2 hidden h-8 w-8 shrink-0 lg:block"
                />
              </div>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#0B0F19]/72 sm:text-xl">
                The unified engagement and success hub that helps students navigate college with confidence.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#interactive-demo"
                  className="inline-flex items-center gap-2 rounded-full bg-[#2563EB] px-5 py-3 text-sm font-bold text-white shadow-[0_14px_30px_rgba(37,99,235,0.18)] transition-transform hover:-translate-y-0.5 hover:bg-[#1D4ED8]"
                >
                  Explore CampusCord
                  <img src="/ready-assets/large-arrow-right.svg" alt="" className="h-4 w-4" />
                </a>
                <a
                  href="#support"
                  className="inline-flex items-center gap-2 rounded-full border border-[#0B0F19]/10 bg-white px-5 py-3 text-sm font-medium text-[#0B0F19] transition-colors hover:bg-[#F5F7FA]"
                >
                  Let&apos;s Talk
                  <img src="/ready-assets/large-arrow-right.svg" alt="" className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="overflow-hidden border border-[#0B0F19]/10 bg-[#F5F7FA] shadow-[0_24px_60px_rgba(11,15,25,0.08)]">
                <img
                  src="/ready-assets/ready-campus-overview.webp"
                  alt="CampusCord product preview"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="absolute -bottom-5 left-5 right-5 hidden rounded-[20px] border border-[#0B0F19]/10 bg-white px-5 py-4 shadow-[0_12px_30px_rgba(11,15,25,0.08)] lg:block">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0B0F19]/48">
                  Campus life, finally connected.
                </p>
                <p className="mt-2 text-sm leading-6 text-[#0B0F19]/70">
                  Events, clubs, communications, and student support in one cleaner experience.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#0B0F19]/8 bg-[#F5F7FA] py-8">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden border-y border-[#0B0F19]/10 bg-white py-5">
              <div className="ready-marquee-track flex w-max items-center gap-10">
                {[...partnerLogos, ...partnerLogos].map((logo, index) => (
                  <img
                    key={`${logo.alt}-${index}`}
                    src={logo.src}
                    alt={logo.alt}
                    className="h-9 w-auto max-w-[160px] shrink-0 object-contain opacity-80 grayscale"
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#0B0F19]/8 bg-white py-14 lg:py-18">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-2xl font-medium tracking-[-0.03em] text-[#0B0F19] lg:text-3xl">
              Driving success for more than 7 million students since 2005
            </h2>

            <div className="mt-10 grid gap-0 border-y border-[#0B0F19]/10 bg-white md:grid-cols-3">
              {stats.map((stat, index) => (
                <div
                  key={stat.label}
                  className={`px-6 py-6 ${index > 0 ? "border-t border-[#0B0F19]/10 md:border-t-0 md:border-l" : ""} border-[#0B0F19]/10`}
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0B0F19]/48">
                    {stat.label}
                  </p>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="text-4xl font-semibold tracking-[-0.05em] text-[#0B0F19] lg:text-5xl">
                      {stat.value}
                    </span>
                    <span className="pb-1 text-2xl font-semibold tracking-[-0.04em] text-[#0B0F19]">
                      {stat.suffix}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-[#0B0F19]/8 bg-white py-14 lg:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0B0F19]/52">
                  Solutions
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#0B0F19] lg:text-4xl">
                  Engagement. Belonging. Success. All in one place.
                </h2>
                <p className="mt-4 max-w-xl text-base leading-8 text-[#0B0F19]/70">
                  The CampusCord platform is a unified student engagement and success hub that brings campus life, academics, and student services together into one personalized experience.
                </p>
                <p className="mt-4 max-w-xl text-base leading-8 text-[#0B0F19]/70">
                  CampusCord helps institutions drive measurable engagement and belonging, improve student satisfaction and retention, and streamline processes so staff can focus on students. It gives every student a modern, frictionless way to navigate college life while enabling IT to consolidate systems into a single, secure engagement platform.
                </p>
                <a
                  href="#interactive-demo"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#2563EB] transition-colors hover:text-[#1D4ED8]"
                >
                  Explore Student Engagement
                  <img src="/ready-assets/large-arrow-right.svg" alt="" className="h-4 w-4" />
                </a>
              </div>

              <div className="overflow-hidden border border-[#0B0F19]/10 bg-white shadow-[0_18px_40px_rgba(11,15,25,0.04)]">
                <img
                  src="/ready-assets/ready-campus-overview.webp"
                  alt="CampusCord overview"
                  className="block h-auto w-full"
                />
              </div>
            </div>
          </div>
        </section>

        <SideBySideSection
          eyebrow="Solutions"
          title="Drive student engagement and retention"
          description="Increase students’ sense of community and belonging by connecting them to the right people, programs, and resources through one personalized web and mobile platform."
          body="Help more students stay, graduate, and launch their careers by giving them clear pathways through each stage of their journey, timely access to the support and services they need, and meaningful engagement in student life and campus experiences."
          image="/ready-assets/na-strengthen-student-engagement-0.webp"
          imageAlt="Student engagement illustration"
          reverse
          buttonLabel="Learn More"
          buttonHref="#interactive-demo"
        />

        <SideBySideSection
          eyebrow="Solutions"
          title="Give every student a modern, frictionless way to navigate college life with success"
          description="Deliver a simple, unified experience where students can easily see what is coming next, manage tasks and deadlines, and know where to go for help."
          body="Provide a single secure and accessible platform for engagement across the entire student experience, from classes to co-curricular activities to events. CampusCord integrates with existing systems like the SIS and LMS, consolidating multiple point solutions into fewer systems with less complexity and vendor management."
          image="/ready-assets/na-support-student-and-academic-success-0.webp"
          imageAlt="Student academic success illustration"
        />

        <SideBySideSection
          eyebrow="Solutions"
          title="Make better decisions to drive engagement and retention"
          description="Help administrators across the campus incorporate engagement data into decision-making."
          body="Use analytics to understand how student engagement is changing over time so you can quickly see what is working, where to intervene, and which experiences have the greatest impact on satisfaction and persistence. Connect engagement data to your broader analytics stack and give campus teams flexible, self-service reporting so they can focus efforts where they have the most impact and clearly demonstrate the effect on retention and ROI."
          image="/ready-assets/na-optimize-operations-5.webp"
          imageAlt="Data and operations illustration"
          reverse
          buttonLabel="Learn More"
          buttonHref="#interactive-demo"
        />

        <SideBySideSection
          eyebrow="Support"
          title="Relax!"
          description="Receive expert implementation and ongoing support from CampusCord. Launch quickly with guidance from implementation and campus success specialists who align setup and rollout with your goals."
          body="Support your team’s success with ongoing training, a vibrant user community, and responsive help so you can stay focused on supporting students instead of managing technology."
          image="/ready-assets/na-foster-community-and-belonging-0.webp"
          imageAlt="Community and belonging illustration"
          buttonLabel="Read the St. Lawrence College Success Story"
          buttonHref="#stories"
        />

        <section id="interactive-demo" className="border-b border-[#0B0F19]/8 bg-white py-14 lg:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[#0B0F19] lg:text-4xl">
                Explore CampusCord
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-[#0B0F19]/70">
                Get an inside look at what makes CampusCord the hub of campus involvement.
              </p>
            </div>

            <div className="mt-10 mx-auto max-w-5xl">
              <div className="overflow-hidden border border-[#0B0F19]/10 bg-[#F5F7FA] shadow-[0_20px_48px_rgba(11,15,25,0.08)]">
                <img
                  src="/ready-assets/ready-campus-overview.webp"
                  alt="CampusCord overview preview"
                  className="block h-auto w-full"
                />
              </div>
            </div>
          </div>
        </section>

        <section id="stories" className="border-b border-[#0B0F19]/8 bg-[#F5F7FA] py-14 lg:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0B0F19]/52">
                  Testimonials
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#0B0F19] lg:text-4xl">
                  What campus leaders are saying
                </h2>
                <p className="mt-4 text-base leading-8 text-[#0B0F19]/70">
                  The tone should feel like the platform is already part of daily campus life.
                </p>

                <div className="mt-8 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setTestimonialIndex((current) => (current - 1 + testimonials.length) % testimonials.length)
                    }
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#0B0F19]/10 bg-white text-[#0B0F19] transition-colors hover:bg-[#F5F7FA]"
                    aria-label="Previous testimonial"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setTestimonialIndex((current) => (current + 1) % testimonials.length)
                    }
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#0B0F19]/10 bg-white text-[#0B0F19] transition-colors hover:bg-[#F5F7FA]"
                    aria-label="Next testimonial"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-6 flex items-center gap-2">
                  {testimonials.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setTestimonialIndex(index)}
                      className={`h-2.5 rounded-full transition-all ${
                        index === testimonialIndex ? "w-8 bg-[#2563EB]" : "w-2.5 bg-[#0B0F19]/18"
                      }`}
                      aria-label={`Show testimonial ${index + 1}`}
                      aria-pressed={index === testimonialIndex}
                    />
                  ))}
                </div>
              </div>

              <div className="border border-[#0B0F19]/10 bg-white p-6 shadow-[0_20px_48px_rgba(11,15,25,0.06)] lg:p-8">
                <p className="text-2xl font-semibold tracking-[-0.04em] text-[#0B0F19]">
                  “{currentTestimonial.headline}”
                </p>
                <p className="mt-5 text-base leading-8 text-[#0B0F19]/74">
                  “{currentTestimonial.quote}”
                </p>

                <div className="mt-8 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#0B0F19]">{currentTestimonial.name}</p>
                    <p className="text-xs uppercase tracking-[0.22em] text-[#0B0F19]/52">
                      {currentTestimonial.role}
                    </p>
                    <p className="mt-1 text-sm text-[#0B0F19]/60">{currentTestimonial.location}</p>
                  </div>
                  <BadgeCheck className="h-5 w-5 shrink-0 text-[#2563EB]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="support" className="border-b border-[#0B0F19]/8 bg-white py-14 lg:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0B0F19]/52">
                  Get started today!
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#0B0F19] lg:text-4xl">
                  Experience the future of campus engagement
                </h2>
                <p className="mt-4 max-w-xl text-base leading-8 text-[#0B0F19]/70">
                  Let&apos;s start discussing ways your institution can improve communications and experiences to increase retention and drive student success.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href="mailto:hello@campuscord.com"
                    className="inline-flex items-center gap-2 rounded-full bg-[#2563EB] px-5 py-3 text-sm font-bold text-white shadow-[0_14px_30px_rgba(37,99,235,0.18)] transition-transform hover:-translate-y-0.5 hover:bg-[#1D4ED8]"
                  >
                    Get in Touch
                    <img src="/ready-assets/large-arrow-right.svg" alt="" className="h-4 w-4" />
                  </a>
                  <a
                    href="tel:18775887508"
                    className="inline-flex items-center gap-2 rounded-full border border-[#0B0F19]/10 px-5 py-3 text-sm font-medium text-[#0B0F19] transition-colors hover:bg-[#F5F7FA]"
                  >
                    +1 (877) 588-7508
                    <img src="/ready-assets/large-arrow-right.svg" alt="" className="h-4 w-4" />
                  </a>
                </div>
              </div>

              <div className="grid gap-0 border-t border-[#0B0F19]/10 sm:grid-cols-2">
                <div className="border-b border-[#0B0F19]/10 p-6 sm:border-r">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-1 h-5 w-5 shrink-0 text-[#2563EB]" />
                    <p className="text-sm leading-7 text-[#0B0F19]/70">
                      100 Summit Drive
                      <br />
                      Burlington, MA 01803, USA
                    </p>
                  </div>
                </div>

                {footerColumns.map((column, index) => (
                  <div
                    key={column.title}
                    className={`border-b border-[#0B0F19]/10 p-6 ${
                      index % 2 === 0 ? "sm:border-r" : ""
                    }`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0B0F19]/48">
                      {column.title}
                    </p>
                    <ul className="mt-4 space-y-3 text-sm text-[#0B0F19]/68">
                      {column.links.map((link) => (
                        <li key={link.label}>
                          <a
                            href={link.href}
                            className="transition-colors hover:text-[#0B0F19]"
                          >
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white py-7">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p className="text-sm text-[#0B0F19]/60">© 2026 CampusCord. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <a
              href="https://www.facebook.com"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#0B0F19]/10 text-[#0B0F19]/72 transition-colors hover:bg-[#F5F7FA]"
              aria-label="Facebook"
            >
              <Facebook className="h-4 w-4" />
            </a>
            <a
              href="https://x.com"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#0B0F19]/10 text-[#0B0F19]/72 transition-colors hover:bg-[#F5F7FA]"
              aria-label="X"
            >
              <Twitter className="h-4 w-4" />
            </a>
            <a
              href="https://www.linkedin.com"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#0B0F19]/10 text-[#0B0F19]/72 transition-colors hover:bg-[#F5F7FA]"
              aria-label="LinkedIn"
            >
              <Linkedin className="h-4 w-4" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SideBySideSection({
  eyebrow,
  title,
  description,
  body,
  image,
  imageAlt,
  reverse = false,
  buttonLabel,
  buttonHref = "#support",
}: {
  eyebrow: string;
  title: string;
  description: string;
  body: string;
  image: string;
  imageAlt: string;
  reverse?: boolean;
  buttonLabel?: string;
  buttonHref?: string;
}) {
  return (
    <section className={`border-b border-[#0B0F19]/8 py-14 lg:py-20 ${reverse ? "bg-[#F5F7FA]" : "bg-white"}`}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className={reverse ? "lg:order-2" : ""}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0B0F19]/52">
              {eyebrow}
            </p>
            <h3 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#0B0F19] lg:text-4xl">
              {title}
            </h3>
            <p className="mt-4 max-w-xl text-base leading-8 text-[#0B0F19]/70">
              {description}
            </p>
            <p className="mt-4 max-w-xl text-base leading-8 text-[#0B0F19]/70">
              {body}
            </p>
            {buttonLabel ? (
              <a
                href={buttonHref}
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#2563EB] transition-colors hover:text-[#1D4ED8]"
              >
                {buttonLabel}
                <img src="/ready-assets/large-arrow-right.svg" alt="" className="h-4 w-4" />
              </a>
            ) : null}
          </div>

          <div className={reverse ? "lg:order-1 lg:justify-self-start" : "lg:justify-self-end"}>
            <div className="overflow-hidden border border-[#0B0F19]/10 bg-white shadow-[0_18px_40px_rgba(11,15,25,0.04)]">
              <img src={image} alt={imageAlt} className="block h-auto w-full" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src="/images/logo/campus-cord-logo.png"
      alt="CampusCord"
      className={compact ? "h-9 w-auto" : "h-10 w-auto sm:h-11"}
      draggable={false}
    />
  );
}

export default Landing;
