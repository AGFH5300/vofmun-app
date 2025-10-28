import React from "react";

interface CountryFlagProps {
  countryName: string;
  className?: string;
  size?: "small" | "medium" | "large";
}

// Country name to ISO code mapping for common MUN countries
const COUNTRY_CODE_MAP: Record<string, string> = {
  "United States": "us",
  "United States of America": "us",
  "USA": "us",
  "United Kingdom": "gb",
  "UK": "gb",
  "China": "cn",
  "Russia": "ru",
  "Russian Federation": "ru",
  "France": "fr",
  "Germany": "de",
  "Japan": "jp",
  "India": "in",
  "Brazil": "br",
  "Canada": "ca",
  "Australia": "au",
  "Italy": "it",
  "Spain": "es",
  "Netherlands": "nl",
  "Sweden": "se",
  "Norway": "no",
  "Denmark": "dk",
  "Finland": "fi",
  "South Korea": "kr",
  "South Africa": "za",
  "Mexico": "mx",
  "Argentina": "ar",
  "Chile": "cl",
  "Egypt": "eg",
  "Nigeria": "ng",
  "Kenya": "ke",
  "Turkey": "tr",
  "Saudi Arabia": "sa",
  "Iran": "ir",
  "Israel": "il",
  "Pakistan": "pk",
  "Bangladesh": "bd",
  "Indonesia": "id",
  "Thailand": "th",
  "Vietnam": "vn",
  "Philippines": "ph",
  "Malaysia": "my",
  "Singapore": "sg",
  "New Zealand": "nz",
  "Poland": "pl",
  "Ukraine": "ua",
  "Czech Republic": "cz",
  "Greece": "gr",
  "Portugal": "pt",
  "Belgium": "be",
  "Austria": "at",
  "Switzerland": "ch",
  "Ireland": "ie",
  "Iceland": "is",
  "Luxembourg": "lu",
  "Malta": "mt",
  "Cyprus": "cy",
  "Estonia": "ee",
  "Latvia": "lv",
  "Lithuania": "lt",
  "Slovenia": "si",
  "Slovakia": "sk",
  "Croatia": "hr",
  "Bulgaria": "bg",
  "Romania": "ro",
  "Hungary": "hu",
  "Morocco": "ma",
  "Algeria": "dz",
  "Tunisia": "tn",
  "Libya": "ly",
  "Sudan": "sd",
  "Ethiopia": "et",
  "Ghana": "gh",
  "Senegal": "sn",
  "Ivory Coast": "ci",
  "Cameroon": "cm",
  "Zimbabwe": "zw",
  "Zambia": "zm",
  "Botswana": "bw",
  "Namibia": "na",
  "Madagascar": "mg",
  "Mauritius": "mu",
  "Seychelles": "sc",
  "UAE": "ae",
  "United Arab Emirates": "ae",
  "Qatar": "qa",
  "Kuwait": "kw",
  "Bahrain": "bh",
  "Oman": "om",
  "Yemen": "ye",
  "Jordan": "jo",
  "Lebanon": "lb",
  "Syria": "sy",
  "Iraq": "iq",
  "Afghanistan": "af",
  "Kazakhstan": "kz",
  "Uzbekistan": "uz",
  "Turkmenistan": "tm",
  "Kyrgyzstan": "kg",
  "Tajikistan": "tj",
  "Mongolia": "mn",
  "Nepal": "np",
  "Bhutan": "bt",
  "Sri Lanka": "lk",
  "Myanmar": "mm",
  "Cambodia": "kh",
  "Laos": "la",
  "Brunei": "bn",
  "Maldives": "mv",
  "Papua New Guinea": "pg",
  "Fiji": "fj",
  "Solomon Islands": "sb",
  "Vanuatu": "vu",
  "Samoa": "ws",
  "Tonga": "to",
  "Palau": "pw",
  "Micronesia": "fm",
  "Marshall Islands": "mh",
  "Kiribati": "ki",
  "Tuvalu": "tv",
  "Nauru": "nr",
  "Venezuela": "ve",
  "Colombia": "co",
  "Ecuador": "ec",
  "Peru": "pe",
  "Bolivia": "bo",
  "Paraguay": "py",
  "Uruguay": "uy",
  "Guyana": "gy",
  "Suriname": "sr",
  "French Guiana": "gf",
  "Cuba": "cu",
  "Jamaica": "jm",
  "Haiti": "ht",
  "Dominican Republic": "do",
  "Trinidad and Tobago": "tt",
  "Barbados": "bb",
  "Bahamas": "bs",
  "Belize": "bz",
  "Guatemala": "gt",
  "Honduras": "hn",
  "El Salvador": "sv",
  "Nicaragua": "ni",
  "Costa Rica": "cr",
  "Panama": "pa"
};

const getCountryCode = (countryName: string): string => {
  const normalizedName = countryName.trim();
  return COUNTRY_CODE_MAP[normalizedName]?.toLowerCase() || "un"; // fallback to UN flag
};

const CountryFlag: React.FC<CountryFlagProps> = ({
  countryName,
  className = "",
  size = "medium"
}) => {
  const countryCode = getCountryCode(countryName);

  const sizeClasses = {
    small: "w-6 h-4",
    medium: "w-8 h-6",
    large: "w-12 h-9"
  };

  return (
    <div className={`inline-block ${sizeClasses[size]} ${className}`}>
      <img
        src={`https://flagcdn.com/w80/${countryCode}.png`}
        alt={`${countryName} flag`}
        className="w-full h-full object-cover rounded-sm shadow-sm border border-cool-grey/30 hover:shadow-md transition-shadow duration-200"
        onError={(event) => {
          const target = event.currentTarget;
          target.src = "/images/logo.svg";
        }}
        data-testid={`flag-${countryCode}`}
      />
    </div>
  );
};

export default CountryFlag;
