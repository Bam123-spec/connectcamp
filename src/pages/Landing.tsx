import { ArrowRight, CalendarDays, MessageSquare, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const featureCards = [
  {
    icon: Users,
    title: "Organize clubs clearly",
    description:
      "Keep club records, officers, and onboarding work in one clean workspace.",
  },
  {
    icon: CalendarDays,
    title: "Run events with less friction",
    description:
      "Track schedules, approvals, and follow-up details without bouncing between tools.",
  },
  {
    icon: MessageSquare,
    title: "Stay connected with officers",
    description:
      "Use one shared messaging layer for club threads, admin conversations, and support.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_48%,#eef5ff_100%)] text-slate-950">
      <header className="border-b border-slate-200/80 bg-white/88 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <ConnectCampWordmark />
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-slate-600 md:flex">
            <a href="#features" className="transition-colors hover:text-slate-950">
              Features
            </a>
            <a href="#workflow" className="transition-colors hover:text-slate-950">
              Workflow
            </a>
            <a href="#support" className="transition-colors hover:text-slate-950">
              Support
            </a>
          </nav>

          <Button asChild className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800">
            <Link to="/login">Log in</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pb-24 lg:pt-20">
          <div className="mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,420px)] lg:items-center">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#5a6fd8]">
                Student Life Operations
              </p>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                One place to manage clubs, events, and campus coordination.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                Connect Camp gives campus teams a straightforward way to handle club operations,
                messaging, approvals, forms, and support without a messy admin workflow.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild className="rounded-full bg-slate-950 px-6 text-white hover:bg-slate-800">
                  <Link to="/login">
                    Open admin login
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <a
                  href="#features"
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-950"
                >
                  Explore features
                </a>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
              <div className="grid gap-4 sm:grid-cols-2">
                <StatCard value="Clubs" label="Club oversight" helper="Track active organizations, officer coverage, and onboarding." />
                <StatCard value="Events" label="Event operations" helper="Keep schedules, approvals, and event details aligned." />
                <StatCard value="Messages" label="Shared inbox" helper="Coordinate with officers and admins in one messaging space." />
                <StatCard value="Support" label="Admin help" helper="Surface issues, requests, and documentation in the same platform." />
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Core Features
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                A normal, usable admin workspace.
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Connect Camp is built for the everyday work behind student organizations, not just a flashy dashboard.
              </p>
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {featureCards.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#e7f0ff_0%,#efeaff_100%)] text-[#5a6fd8]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid w-full max-w-6xl gap-6 rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.05)] lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Workflow
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Built for the actual work behind campus programs.
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <WorkflowStep
                step="01"
                title="Review"
                description="See what needs approval, follow-up, or scheduling without digging through disconnected tools."
              />
              <WorkflowStep
                step="02"
                title="Coordinate"
                description="Message clubs, manage staff handoffs, and keep support requests moving."
              />
              <WorkflowStep
                step="03"
                title="Track"
                description="Use analytics, audit history, and settings controls to keep the workspace reliable."
              />
            </div>
          </div>
        </section>

        <section id="support" className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-[28px] bg-slate-950 px-8 py-10 text-white shadow-[0_20px_60px_rgba(15,23,42,0.18)] lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/10">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-3xl font-semibold tracking-tight">Ready to get into the admin workspace?</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Sign in to manage the Connect Camp workspace, review activity, and keep club operations moving.
              </p>
            </div>

            <Button asChild className="rounded-full bg-white px-6 text-slate-950 hover:bg-slate-100">
              <Link to="/login">Go to login</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({
  value,
  label,
  helper,
}: {
  value: string;
  label: string;
  helper: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{value}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p>
    </div>
  );
}

function WorkflowStep({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5a6fd8]">{step}</p>
      <p className="mt-3 text-lg font-semibold text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function ConnectCampWordmark() {
  return (
    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
      <svg
        viewBox="0 0 160 160"
        className="h-12 w-12 shrink-0 sm:h-14 sm:w-14"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="connect-camp-logo-gradient" x1="16" y1="20" x2="136" y2="136" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#27b1ff" />
            <stop offset="56%" stopColor="#3c8cff" />
            <stop offset="100%" stopColor="#7a4de8" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#connect-camp-logo-gradient)" strokeLinecap="round" strokeLinejoin="round">
          <path d="M34 56a56 56 0 0 1 89-18" strokeWidth="15" />
          <path d="M20 85a69 69 0 0 1 26-50" strokeWidth="15" />
          <path d="M31 114A70 70 0 0 1 19 79" strokeWidth="15" />
          <path d="M53 134a70 70 0 0 1-16-10" strokeWidth="15" />
          <path d="M92 135a57 57 0 0 1-33 2" strokeWidth="15" />
          <path d="M120 120a57 57 0 0 1-18 13" strokeWidth="15" />
          <path d="M123 48a56 56 0 0 1 10 17" strokeWidth="15" />
          <path d="M92 48a30 30 0 1 0 0 64" strokeWidth="13" />
          <path d="M54 58a40 40 0 0 1 47-8" strokeWidth="11" opacity="0.95" />
          <path d="M51 104a40 40 0 0 1-2-37" strokeWidth="11" opacity="0.95" />
          <path d="M88 114a40 40 0 0 1-28-1" strokeWidth="11" opacity="0.95" />
        </g>
        <circle cx="112" cy="28" r="7" fill="url(#connect-camp-logo-gradient)" />
        <circle cx="130" cy="43" r="9" fill="url(#connect-camp-logo-gradient)" />
        <circle cx="58" cy="92" r="7" fill="url(#connect-camp-logo-gradient)" />
      </svg>
      <div className="min-w-0">
        <p className="truncate text-[1.55rem] font-light tracking-[-0.04em] text-[#7552d8] sm:text-[2.25rem]">
          Connect Camp
        </p>
      </div>
    </div>
  );
}

export default Landing;
