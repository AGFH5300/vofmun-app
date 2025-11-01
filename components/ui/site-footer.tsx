import React from "react";
import { Linkedin, Instagram } from "lucide-react";

const SiteFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center space-x-2">
              <span className="text-lg font-bold sm:text-xl">VOFMUN</span>
            </div>
            <p className="text-xs leading-relaxed text-gray-400 sm:text-sm">
              Empowering tomorrow&apos;s leaders through diplomatic excellence and global dialogue.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-base font-semibold text-white sm:text-lg">Delegate Hub</h3>
            <ul className="space-y-2 text-xs text-gray-400 sm:text-sm">
              <li>
                <a href="/home" className="text-gray-400 transition-colors hover:text-white">
                  Home
                </a>
              </li>
              <li>
                <a href="/live-updates" className="text-gray-400 transition-colors hover:text-white">
                  Live Updates
                </a>
              </li>
              <li>
                <a href="/glossary" className="text-gray-400 transition-colors hover:text-white">
                  Glossary
                </a>
              </li>
              <li>
                <a href="/speechrepo" className="text-gray-400 transition-colors hover:text-white">
                  Speech Repository
                </a>
              </li>
              <li>
                <a href="/resolutions" className="text-gray-400 transition-colors hover:text-white">
                  Resolutions
                </a>
              </li>
              <li>
                <a href="/messages" className="text-gray-400 transition-colors hover:text-white">
                  Messaging
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-base font-semibold text-white sm:text-lg">Get Started</h3>
            <ul className="space-y-2 text-xs text-gray-400 sm:text-sm">
              <li>
                <a href="https://vofmun.org" className="text-gray-400 transition-colors hover:text-white">
                  VOFMUN Homepage
                </a>
              </li>
              <li>
                <a href="https://vofmun.org/resources" className="text-gray-400 transition-colors hover:text-white">
                  Resources
                </a>
              </li>
              <li>
                <a href="https://vofmun.org/live" className="text-gray-400 transition-colors hover:text-white">
                  Conference Updates
                </a>
              </li>
              <li>
                <a href="https://vofmun.org/register" className="text-gray-400 transition-colors hover:text-white">
                  Delegate Registration
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-base font-semibold text-white sm:text-lg">Contact</h3>
            <ul className="space-y-2 text-xs text-gray-400 sm:text-sm">
              <li>contact@vofmun.org</li>
              <li>
                <a
                  href="https://www.linkedin.com/company/vofmun"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 transition-colors hover:text-white"
                >
                  <Linkedin size={16} />
                  <span>LinkedIn</span>
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/vofmun"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 transition-colors hover:text-white"
                >
                  <Instagram size={16} />
                  <span>Instagram</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-gray-800 pt-6 text-center text-xs text-gray-500 sm:mt-16 sm:pt-8 sm:text-sm">
          <p>© {currentYear} Voices of the Future Model United Nations. All rights reserved.</p>
          <p className="mt-2">
            Made by {" "}
            <a
              href="https://anshgupta.site"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              Ansh Gupta
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
