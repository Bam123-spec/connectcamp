import {
  ArrowRight,
  BarChart3,
  BadgeCheck,
  CalendarDays,
  HeartHandshake,
  Layers3,
  Lock,
  Megaphone,
  Search,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

const navItems = [
  { label: "Product", href: "#platform" },
  { label: "Solutions", href: "#features" },
  { label: "Security", href: "#security" },
  { label: "Stories", href: "#stories" },
  { label: "Resources", href: "#footer" },
];

const partnerLogos = [
  { src: "/ready-assets/cornell.svg", alt: "Cornell" },
  { src: "/ready-assets/seattle-university@2x.jpg", alt: "Seattle University" },
  { src: "/ready-assets/embry-riddle@2x.jpg", alt: "Embry-Riddle" },
  { src: "/ready-assets/sjsu-university@2x.jpg", alt: "San Jose State University" },
  { src: "/ready-assets/lamar-university.svg", alt: "Lamar University" },
  { src: "/ready-assets/spelman-college@2x.jpg", alt: "Spelman College" },
  { src: "/ready-assets/uhcl.svg", alt: "University of Houston-Clear Lake" },
  { src: "/ready-assets/st-lawrence-college.svg", alt: "St. Lawrence College" },
  { src: "/ready-assets/insitution-logos_bu-law.svg", alt: "Boston University School of Law" },
  { src: "/ready-assets/portland-community-college-logo-v2.svg", alt: "Portland Community College" },
  { src: "/ready-assets/smith-college-x2@2x.png", alt: "Smith College" },
  { src: "/ready-assets/university-of-wisconsin-eau-claire.svg", alt: "University of Wisconsin Eau-Claire" },
];

const platformRows: Array<{ icon: LucideIcon; title: string; description: string }> = [
  {
    icon: CalendarDays,
    title: "Events",
    description: "Publish and manage events with approvals, audiences, and attendance tracking in one place.",
  },
  {
    icon: Users,
    title: "Student organizations",
    description: "Keep club rosters, officers, memberships, and activity organized without scattered tools.",
  },
  {
    icon: Megaphone,
    title: "Communication",
    description: "Send targeted announcements and reminders that reach the right students at the right time.",
  },
  {
    icon: Layers3,
    title: "Discovery feed",
    description: "Surface opportunities and resources in a structured feed students can actually navigate.",
  },
  {
    icon: BarChart3,
    title: "Admin dashboard",
    description: "Give staff a single operational view of publishing, moderation, and open work.",
  },
  {
    icon: Search,
    title: "Analytics",
    description: "Understand participation, activity, and engagement trends across campus audiences.",
  },
  {
    icon: HeartHandshake,
    title: "Retention insights",
    description: "Connect engagement signals to student belonging and persistence conversations.",
  },
];

const roleRows = [
  {
    title: "Student Life teams",
    description: "Coordinate campus programming and communication from a single operational workspace.",
  },
  {
    title: "Club leaders",
    description: "Publish events, share updates, and keep members engaged without extra systems.",
  },
  {
    title: "Advisors",
    description: "See what clubs need and support participation with clear context and approvals.",
  },
  {
    title: "Admins",
    description: "Maintain structure, permissions, and reporting with fewer handoffs and fewer tools.",
  },
  {
    title: "Students",
    description: "Find what matters faster, stay informed, and participate without hunting across apps.",
  },
];

const outcomes = [
  {
    title: "Higher participation",
    description: "Centralized discovery helps students find events, organizations, and support faster.",
  },
  {
    title: "Stronger belonging",
    description: "A consistent campus experience makes it easier for students to find community.",
  },
  {
    title: "Clearer retention signals",
    description: "Engagement data gives staff a better read on who is connected and who needs help.",
  },
  {
    title: "Cleaner operations",
    description: "Fewer point solutions mean less maintenance, less duplication, and easier reporting.",
  },
];

const securityRows = [
  {
    title: "Roles and permissions",
    description: "Scope access for admins, advisors, and club leaders with clear publishing controls.",
  },
  {
    title: "Access control",
    description: "Protect sensitive workflows and keep content approval and editing rights explicit.",
  },
  {
    title: "Reporting and auditability",
    description: "Review activity, approvals, and changes so teams can trust the system of record.",
  },
];

const testimonials = [
  {
    quote:
      "CampusCord gives teams one place to manage communication, events, and reporting without stitching together separate tools.",
    author: "Director of Student Engagement",
    school: "Mid-sized university",
  },
  {
    quote:
      "The platform creates a more consistent experience for students while giving staff the visibility they need to support participation.",
    author: "Associate Dean of Students",
    school: "Private college",
  },
];

const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Platform overview", href: "#platform" },
      { label: "Events", href: "#features" },
      { label: "Organizations", href: "#features" },
      { label: "Communication", href: "#features" },
      { label: "Analytics", href: "#outcomes" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Student Life", href: "#roles" },
      { label: "Club leaders", href: "#roles" },
      { label: "Advisors", href: "#roles" },
      { label: "Administrators", href: "#security" },
      { label: "Students", href: "#roles" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Case studies", href: "#stories" },
      { label: "Implementation", href: "#book-demo" },
      { label: "Security", href: "#security" },
      { label: "Support", href: "#book-demo" },
      { label: "Contact sales", href: "#book-demo" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#top" },
      { label: "Careers", href: "#book-demo" },
      { label: "Privacy", href: "#top" },
      { label: "Terms", href: "#top" },
      { label: "Contact", href: "mailto:hello@campuscord.com" },
    ],
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950" style={{ fontFamily: "Inter, sans-serif" }}>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
        <div className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-2 text-xs font-medium text-slate-600 sm:px-6 lg:px-8">
            <p className="leading-5">
              CampusCord helps colleges centralize events, communication, and engagement insights.
            </p>
            <a
              href="#book-demo"
              className="inline-flex shrink-0 items-center gap-2 text-blue-600 transition-colors hover:text-blue-800"
            >
              Book a Demo
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
          <a href="#top" className="shrink-0">
            <BrandLogo />
          </a>

          <nav className="hidden items-center gap-1 text-sm font-medium text-slate-700 lg:flex">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="rounded-md px-3 py-2 transition-colors hover:bg-white hover:text-slate-950"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <a
            href="#book-demo"
            className="inline-flex h-11 items-center rounded-md border border-blue-600 bg-blue-600 px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md"
          >
            Book a Demo
          </a>
        </div>
      </header>

      <main id="top">
        <section className="border-b border-slate-200 bg-white py-16 lg:py-20">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Higher education engagement platform
              </p>

              <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-[4.25rem] lg:leading-[0.94]">
                Unify campus engagement in one connected platform.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                CampusCord helps colleges centralize events, student organizations, communications,
                and engagement insights so students can discover what matters and staff can support
                participation across campus.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#book-demo"
                  className="inline-flex h-11 items-center rounded-md border border-blue-600 bg-blue-600 px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md"
                >
                  Book a Demo
                </a>
                <a
                  href="#platform"
                  className="inline-flex h-11 items-center rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-950 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-sm"
                >
                  Explore Platform
                </a>
              </div>

              <div className="mt-10 grid gap-0 border border-slate-200 bg-white sm:grid-cols-3">
                {[
                  {
                    title: "One system",
                    text: "Replace disconnected tools with a single engagement workspace.",
                  },
                  {
                    title: "Real reporting",
                    text: "See publishing, participation, and activity without switching contexts.",
                  },
                  {
                    title: "Campus-ready",
                    text: "Built for higher-ed teams that need structure and accountability.",
                  },
                ].map((item, index) => (
                  <div
                    key={item.title}
                    className={`p-5 ${index > 0 ? "border-t border-slate-200 sm:border-t-0 sm:border-l" : ""}`}
                  >
                    <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <figure className="overflow-hidden border border-slate-200 bg-white shadow-lg">
                <img
                  src="/ready-assets/ready-campus-overview.webp"
                  alt="CampusCord dashboard preview"
                  className="block h-auto w-full"
                  loading="eager"
                />
              </figure>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {[
                  "Events and approvals",
                  "Organizations and membership",
                  "Communication and insights",
                ].map((label) => (
                  <div
                    key={label}
                    className="border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-950"
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50 py-10">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Trusted by colleges and universities
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Institutional partners across North America
                </h2>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-slate-500">
                A simple logo strip keeps the page grounded and gives the eye a clean break before
                the platform story begins.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {partnerLogos.map((logo) => (
                <div
                  key={logo.alt}
                  className="flex h-16 items-center justify-center border border-slate-200 bg-white px-4"
                >
                  <img
                    src={logo.src}
                    alt={logo.alt}
                    className="max-h-8 w-auto max-w-full object-contain grayscale opacity-80"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="problem" className="border-b border-slate-200 bg-white py-16 lg:py-20">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                The problem
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">
                Campus communication is fragmented, inconsistent, and hard to measure.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-slate-600">
                Students bounce between portals, email, club pages, and social channels. Staff
                manage approvals, events, and communication in disconnected systems. The result is
                lower participation, less visibility, and more operational overhead.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  "Too many tools create duplicate work and inconsistent branding.",
                  "Students miss opportunities because there is no single source of truth.",
                  "Staff lose time stitching together reporting across systems.",
                ].map((item, index) => (
                  <div key={item} className="flex gap-3 border border-slate-200 bg-slate-50 p-4">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center border border-slate-300 bg-white text-xs font-semibold text-blue-600">
                      0{index + 1}
                    </span>
                    <p className="text-sm leading-6 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden border border-slate-200 bg-slate-50 shadow-md">
              <img
                src="/ready-assets/na-optimize-operations-5.webp"
                alt="Campus team operations dashboard"
                className="block h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        <section id="platform" className="border-b border-slate-200 bg-slate-50 py-16 lg:py-20">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_0.96fr] lg:px-8">
            <div className="order-2 lg:order-1">
              <figure className="overflow-hidden border border-slate-200 bg-white shadow-md">
                <img
                  src="/ready-assets/na-support-student-and-academic-success-0.webp"
                  alt="CampusCord platform and student success preview"
                  className="block h-full w-full object-cover"
                  loading="lazy"
                />
              </figure>
            </div>

            <div className="order-1 lg:order-2">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Platform
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">
                One system for campus engagement
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-slate-600">
                CampusCord gives higher-ed teams a single operational layer for engagement, support,
                and reporting so programs stay visible and staff keep momentum without extra
                friction.
              </p>

              <div className="mt-8 space-y-0 border border-slate-200 bg-white">
                {[
                  "Create and approve campus events from one queue.",
                  "Keep organizations, officers, and memberships organized.",
                  "Publish communication that reaches the right students.",
                  "Surface activities and resources in a structured discovery feed.",
                ].map((text, index) => (
                  <div
                    key={text}
                    className={`flex items-start gap-3 p-4 ${index > 0 ? "border-t border-slate-200" : ""}`}
                  >
                    <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                    <p className="text-sm leading-6 text-slate-700">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-b border-slate-200 bg-white py-16 lg:py-20">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Features
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">
                Built for the operational work that keeps campus moving
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-slate-600">
                The structure stays plain on purpose. CampusCord should feel like enterprise
                software for higher education: clear, organized, and easy to scan.
              </p>

              <div className="mt-8 overflow-hidden border border-slate-200 bg-slate-50">
                <img
                  src="/ready-assets/na-strengthen-student-engagement-0.webp"
                  alt="Students using campus engagement tools"
                  className="block h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>

            <div className="border border-slate-200 bg-white">
              {platformRows.map((row, index) => {
                const Icon = row.icon;
                return (
                  <div
                    key={row.title}
                    className={`flex items-start gap-4 p-5 ${index > 0 ? "border-t border-slate-200" : ""}`}
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-slate-200 bg-slate-50 text-blue-600">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{row.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{row.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="roles" className="border-b border-slate-200 bg-slate-50 py-16 lg:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Role-based workflow
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  Designed for every campus audience
                </h2>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-slate-500">
                A structured product should answer different needs without changing the system
                underneath it.
              </p>
            </div>

            <div className="mt-8 grid border border-slate-200 bg-white lg:grid-cols-5">
              {roleRows.map((row, index) => (
                <div
                  key={row.title}
                  className={`p-5 ${index > 0 ? "border-t border-slate-200 lg:border-t-0 lg:border-l" : ""}`}
                >
                  <p className="text-sm font-semibold text-slate-950">{row.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{row.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="outcomes" className="border-b border-slate-200 bg-white py-16 lg:py-20">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_0.92fr] lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Outcomes
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">
                Engagement, belonging, retention, participation
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-slate-600">
                The goal is not decorative software. It is better participation, clearer support,
                and a campus experience students can actually navigate.
              </p>

              <div className="mt-8 grid gap-0 border border-slate-200 bg-slate-50 sm:grid-cols-2">
                {outcomes.map((item, index) => (
                  <div
                    key={item.title}
                    className={`p-5 ${index > 0 ? "border-t border-slate-200 sm:border-t-0 sm:border-l" : ""}`}
                  >
                    <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden border border-slate-200 bg-slate-50 shadow-md">
              <img
                src="/ready-assets/na-foster-community-and-belonging-0.webp"
                alt="Students using a campus engagement experience"
                className="block h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        <section id="security" className="border-b border-slate-200 bg-slate-50 py-16 lg:py-20">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Security and admin
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">
                Roles, permissions, access control, and reporting
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-slate-600">
                Higher-ed software has to be trustworthy. CampusCord keeps access predictable and
                reviewable so campus teams can operate with confidence.
              </p>

              <div className="mt-8 space-y-4">
                {securityRows.map((item) => (
                  <div key={item.title} className="flex gap-3 border border-slate-200 bg-white p-4">
                    <Lock className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden border border-slate-200 bg-white shadow-md">
              <img
                src="/ready-assets/na-optimize-operations-5.webp"
                alt="Administrative analytics and reporting preview"
                className="block h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        <section id="stories" className="border-b border-slate-200 bg-slate-950 py-16 text-white lg:py-20">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_0.96fr] lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">
                Case study
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight lg:text-4xl">
                A practical platform for campus teams that need fewer tools and better visibility.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-white/70">
                CampusCord is built for the same operational pressure that campus teams already
                live with: keeping students informed, keeping programs organized, and keeping
                leadership informed with clean reporting.
              </p>

              <div className="mt-8 space-y-4">
                {testimonials.map((testimonial) => (
                  <div key={testimonial.author} className="border border-white/10 bg-white/5 p-5">
                    <p className="text-base leading-7 text-white/90">“{testimonial.quote}”</p>
                    <div className="mt-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">{testimonial.author}</p>
                        <p className="text-sm text-white/60">{testimonial.school}</p>
                      </div>
                      <BadgeCheck className="h-5 w-5 shrink-0 text-blue-300" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden border border-white/10 bg-white/5">
              <img
                src="/ready-assets/na-support-student-and-academic-success-0.webp"
                alt="CampusCord testimonial supporting image"
                className="block h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        <section id="book-demo" className="border-b border-slate-200 bg-white py-16 lg:py-20">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_0.96fr] lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Final CTA
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">
                Ready to see CampusCord in action?
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-slate-600">
                Book a demo to see how one connected platform can streamline events, organizations,
                communication, and reporting for your campus.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="mailto:hello@campuscord.com"
                  className="inline-flex h-11 items-center rounded-md border border-blue-600 bg-blue-600 px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md"
                >
                  Book a Demo
                </a>
                <a
                  href="#platform"
                  className="inline-flex h-11 items-center rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-950 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-sm"
                >
                  Explore Platform
                </a>
              </div>

              <div className="mt-8 grid gap-0 border border-slate-200 bg-slate-50 sm:grid-cols-3">
                {[
                  "Implementation support",
                  "Campus-ready workflows",
                  "Clean reporting and access control",
                ].map((label, index) => (
                  <div
                    key={label}
                    className={`p-5 ${index > 0 ? "border-t border-slate-200 sm:border-t-0 sm:border-l" : ""}`}
                  >
                    <p className="text-sm font-semibold text-slate-950">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden border border-slate-200 bg-slate-50 shadow-md">
              <img
                src="/ready-assets/ready-campus-overview.webp"
                alt="CampusCord overview preview"
                className="block h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </section>
      </main>

      <footer id="footer" className="bg-slate-50 py-14">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 border-t border-slate-200 pt-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.8fr]">
            <div>
              <BrandLogo compact />
              <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">
                CampusCord is a campus engagement and communication platform for colleges and
                universities that want a cleaner operating model.
              </p>

              <div className="mt-6 flex items-center gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center border border-slate-300 bg-white text-blue-600">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">hello@campuscord.com</p>
                  <p className="text-xs text-slate-500">Enterprise sales and support</p>
                </div>
              </div>
            </div>

                  {footerColumns.map((column) => (
              <div key={column.title}>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  {column.title}
                </p>
                <ul className="mt-4 space-y-3 text-sm text-slate-700">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a className="transition-colors hover:text-slate-950" href={link.href}>
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500 lg:flex-row lg:items-center lg:justify-between">
            <p>© 2026 CampusCord. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a href="#problem" className="transition-colors hover:text-slate-950">
                Problem
              </a>
              <a href="#platform" className="transition-colors hover:text-slate-950">
                Platform
              </a>
              <a href="#security" className="transition-colors hover:text-slate-950">
                Security
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src="/images/logo/campus-cord-logo.png"
      alt="CampusCord"
      className={compact ? "h-8 w-auto" : "h-9 w-auto sm:h-10"}
      draggable={false}
    />
  );
}

export default Landing;
