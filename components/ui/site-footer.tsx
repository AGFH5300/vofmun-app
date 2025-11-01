import React from "react";
import { Link } from "@/src/router";

const quickLinks = [
  { label: "Register", href: "https://vofmun.org/register" },
  { label: "Resources", href: "https://vofmun.org/resources" },
  { label: "Our Team", href: "https://vofmun.org/team" },
];

const committeeLinks = [
  "General Assembly",
  "ECOSOC",
  "WHO",
  "UNODC",
  "UNCTAD",
  "ICJ",
  "IPCC",
];

const contactLinks = [
  {
    label: "contact@vofmun.org",
    href: "mailto:contact@vofmun.org",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/vofmun",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/vofmun",
  },
];

const SiteFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-800 bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-4">
          <div className="space-y-4">
            <Link to="/home" className="inline-flex flex-col gap-1 text-left">
              <span className="text-sm font-semibold tracking-[0.32em] text-gray-400">
                VOFMUN
              </span>
              <span className="text-2xl font-semibold text-white">VOFMUN</span>
            </Link>
            <p className="text-sm leading-relaxed text-gray-400">
              Empowering tomorrow&apos;s leaders through diplomatic excellence and global dialogue.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-gray-400">
              Quick Links
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-white">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors duration-200 hover:text-gray-300"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-gray-400">
              Committees
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-white">
              {committeeLinks.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-gray-400">
              Contact
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-white">
              {contactLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target={link.href.startsWith("http") ? "_blank" : undefined}
                    rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="transition-colors duration-200 hover:text-gray-300"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-slate-800 pt-6 text-sm text-gray-400 sm:flex sm:items-center sm:justify-between">
          <p>© {currentYear} Voices of the Future Model United Nations. All rights reserved.</p>
          <div className="mt-3 flex items-center gap-2 sm:mt-0">
            <span>Made by</span>
            <a
              href="https://anshgupta.site"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-400 transition-colors hover:text-blue-300 hover:underline"
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
