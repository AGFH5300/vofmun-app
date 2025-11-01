import React from "react";
const quickLinks = [
  { label: "Register", href: "https://vofmun.org/register" },
  { label: "Resources", href: "https://vofmun.org/resources" },
  { label: "Our Team", href: "https://vofmun.org/about" },
];

const committees = [
  "General Assembly",
  "ECOSOC",
  "WHO",
  "UNODC",
  "UNCTAD",
  "ICJ",
  "IPRDC",
];

const contactLinks = [
  { label: "contact@vofmun.org", href: "mailto:contact@vofmun.org" },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/vofmun" },
  { label: "Instagram", href: "https://www.instagram.com/vofmun" },
];

const SiteFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[#1e293b] bg-[#0f172a] text-slate-300">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-4">
          <div className="space-y-3 text-slate-100">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-slate-400">VOFMUN</p>
            <p className="text-lg font-semibold text-white">
              Empowering tomorrow&apos;s leaders through diplomatic excellence and global dialogue.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.32em] text-slate-400">Quick Links</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="transition-colors duration-200 hover:text-white"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.32em] text-slate-400">Committees</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {committees.map((committee) => (
                <li key={committee}>{committee}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.32em] text-slate-400">Contact</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {contactLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="transition-colors duration-200 hover:text-white"
                    target={link.href.startsWith("http") ? "_blank" : undefined}
                    rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-[#1e293b] pt-8 text-xs text-slate-500 sm:flex sm:items-center sm:justify-between sm:text-sm">
          <p>© {currentYear} Voices of the Future Model United Nations. All rights reserved.</p>
          <p className="mt-3 sm:mt-0">
            Made by <span className="font-medium text-slate-300">Ansh Gupta</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
