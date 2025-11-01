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
            <h3 className="mb-4 text-base font-semibold sm:text-lg">Quick Links</h3>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <a href="https://vofmun.org/signup" className="text-gray-400 transition-colors hover:text-white">
                  Register
                </a>
              </li>
              <li>
                <a href="https://vofmun.org/resources" className="text-gray-400 transition-colors hover:text-white">
                  Resources
                </a>
              </li>
              <li>
                <a href="https://vofmun.org/founders" className="text-gray-400 transition-colors hover:text-white">
                  Our Team
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-base font-semibold sm:text-lg">Committees</h3>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <a href="https://vofmun.org/committees/ga1" className="text-gray-400 transition-colors hover:text-white">
                  General Assembly
                </a>
              </li>
              <li>
                <a href="https://vofmun.org/committees/ecosoc" className="text-gray-400 transition-colors hover:text-white">
                  ECOSOC
                </a>
              </li>
              <li>
                <a href="https://vofmun.org/committees/who" className="text-gray-400 transition-colors hover:text-white">
                  WHO
                </a>
              </li>
              <li>
                <a href="https://vofmun.org/committees/unodc" className="text-gray-400 transition-colors hover:text-white">
                  UNODC
                </a>
              </li>
              <li>
                <a href="https://vofmun.org/committees/uncstd" className="text-gray-400 transition-colors hover:text-white">
                  UNCSTD
                </a>
              </li>
              <li>
                <a href="https://vofmun.org/committees/icj" className="text-gray-400 transition-colors hover:text-white">
                  ICJ
                </a>
              </li>
              <li>
                <a href="https://vofmun.org/committees/icrcc" className="text-gray-400 transition-colors hover:text-white">
                  ICRCC
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-base font-semibold sm:text-lg">Contact</h3>
            <ul className="space-y-2 text-xs sm:text-sm text-gray-400">
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
