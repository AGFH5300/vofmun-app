import React from "react";
import { Link } from "@/src/router";

const quickLinks = [
  { label: "Sign Up", href: "https://site-4ux9.onrender.com/signup" },
  { label: "Resources", href: "https://site-4ux9.onrender.com/resources" },
  { label: "Founders", href: "https://site-4ux9.onrender.com/founders" },
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

const brandDarkRed = "#B22222";
const serifHeadingFont = "var(--font-dm-serif-display, 'DM Serif Display', serif)";
const sansFontFamily = "var(--font-dm-sans, 'DM Sans', 'Segoe UI', sans-serif)";

const SiteFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="border-t border-slate-800 bg-gray-900 text-white"
      style={{ fontFamily: sansFontFamily }}
    >
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-4">
          <div className="space-y-4">
            <Link to="/home" className="inline-flex flex-col gap-1 text-left">
              <span
                className="text-2xl font-semibold"
                style={{ color: brandDarkRed, fontFamily: serifHeadingFont }}
              >
                VOFMUN
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-gray-400">
              Empowering tomorrow&apos;s leaders through diplomatic excellence and global dialogue.
            </p>
          </div>

          <div>
            <h3
              className="text-sm"
              style={{ color: brandDarkRed, fontFamily: serifHeadingFont }}
            >
              Quick Links
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-gray-400">
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
            <h3
              className="font-semibold text-base sm:text-lg mb-3 sm:mb-4"
              style={{ color: brandDarkRed, fontFamily: serifHeadingFont }}
            >
              Committees
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-gray-400">
              {committeeLinks.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3
              className="text-sm"
              style={{ color: brandDarkRed, fontFamily: serifHeadingFont }}
            >
              Contact
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-gray-400">
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
