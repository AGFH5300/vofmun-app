import React from "react";
import { Link } from "@/src/router";
import { Instagram, Linkedin } from "lucide-react";

const delegateLinks = [
  { label: "Home", href: "/home" },
  { label: "Live Updates", href: "/live-updates" },
  { label: "Glossary", href: "/glossary" },
  { label: "Resolutions", href: "/resolutions" },
  { label: "Speech Repository", href: "/speechrepo" },
  { label: "Messaging", href: "/messages" },
];

const resourceLinks = [
  {
    label: "VOFMUN Homepage",
    href: "https://vofmun.org",
  },
  {
    label: "Resources",
    href: "https://vofmun.org/resources",
  },
  {
    label: "Conference Updates",
    href: "https://vofmun.org/live",
  },
  {
    label: "Delegate Registration",
    href: "https://vofmun.org/register",
  },
];

const socialLinks = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/vofmun",
    icon: Linkedin,
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/vofmun",
    icon: Instagram,
  },
];

const SiteFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/15 bg-gradient-to-b from-deep-red via-dark-burgundy to-deep-red text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <Link to="/home" className="flex items-center gap-3 text-white">
              <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white/15 shadow-[0_12px_30px_-20px_rgba(0,0,0,0.45)] ring-1 ring-white/25 backdrop-blur">
                <img src="/logo.svg" alt="VOFMUN" className="h-full w-full object-contain" />
              </span>
              <div className="text-left leading-tight">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/70">VOFMUN</p>
                <p className="text-lg font-semibold text-white">Delegate Hub</p>
              </div>
            </Link>
            <p className="mt-5 text-sm leading-relaxed text-white/75">
              Empowering tomorrow&apos;s leaders through structured preparation, timely updates, and a beautifully organised conference hub.
            </p>
          </div>

          <div className="grid flex-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-white/70">Delegate Hub</h3>
              <ul className="mt-4 space-y-3 text-sm text-white/80">
                {delegateLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="transition-colors duration-200 hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-white/70">Resources</h3>
              <ul className="mt-4 space-y-3 text-sm text-white/80">
                {resourceLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors duration-200 hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-white/70">Connect</h3>
              <ul className="mt-4 space-y-3 text-sm text-white/80">
                <li>
                  <a
                    href="mailto:contact@vofmun.org"
                    className="transition-colors duration-200 hover:text-white"
                  >
                    contact@vofmun.org
                  </a>
                </li>
                {socialLinks.map(({ label, href, icon: Icon }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 transition-colors duration-200 hover:text-white"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
                        <Icon size={16} />
                      </span>
                      <span>{label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/15 pt-6 text-xs text-white/60 sm:flex sm:items-center sm:justify-between sm:text-sm">
          <p>© {currentYear} Voices of the Future Model United Nations. All rights reserved.</p>
          <div className="mt-3 flex items-center gap-2 sm:mt-0">
            <span>Made by</span>
            <a
              href="https://anshgupta.site"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-white transition-colors hover:text-white/80 hover:underline"
            >
              Ansh Gupta
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
