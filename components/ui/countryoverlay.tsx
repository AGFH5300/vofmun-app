import React from "react";
import CountryFlag from "./countryflag";

interface Country {
  countryID: string;
  flag: string;
  name: string;
}

interface CountryOverlayProps {
  countries: Country[];
  speechTags: string[];
  toggleCountrySelection: (countryID: string) => void;
  closeCountryOverlay: () => void;
}

const CountryOverlay: React.FC<CountryOverlayProps> = ({
  countries,
  speechTags,
  toggleCountrySelection,
  closeCountryOverlay,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-deep-red/20 via-dark-burgundy/10 to-transparent backdrop-blur-lg animate-fadein">
    <div className="bg-gradient-to-br from-white/95 via-soft-rose/90 to-pale-aqua/80 backdrop-blur-xl text-almost-black-green rounded-3xl p-10 max-h-[85vh] w-[90vw] max-w-lg overflow-y-auto relative shadow-2xl border border-deep-red/20 animate-slidein-up">
      <button
        className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center text-2xl font-bold text-deep-red hover:text-dark-burgundy bg-soft-rose/50 hover:bg-deep-red/10 rounded-full transition-all duration-300 animate-btn-pop shadow-lg hover:shadow-xl hover:scale-110"
        onClick={closeCountryOverlay}
        data-testid="button-close-overlay"
      >
        ×
      </button>
      <h2 className="text-3xl font-serif font-bold mb-8 pr-12 bg-gradient-to-r from-deep-red via-dark-burgundy to-deep-red bg-clip-text text-transparent animate-text-pop drop-shadow-sm">
        🌍 Select Delegations
      </h2>
      <div className="flex flex-col gap-2">
        {countries.map((country, idx) => (
          <div
            key={country.countryID}
            className="px-5 py-4 rounded-2xl bg-gradient-to-r from-white/80 via-soft-rose/40 to-pale-aqua/40 hover:from-deep-red/5 hover:via-soft-rose/60 hover:to-pale-aqua/60 text-almost-black-green border border-cool-grey/30 hover:border-deep-red/40 flex items-center gap-4 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] animate-fadein-up backdrop-blur-sm"
            style={{ animationDelay: `${idx * 40}ms` }}
            onClick={() => toggleCountrySelection(country.countryID)}
            data-testid={`country-item-${country.countryID}`}
          >
            <input
              type="checkbox"
              checked={speechTags.includes(country.countryID)}
              onChange={() => toggleCountrySelection(country.countryID)}
              className="w-5 h-5 text-deep-red bg-soft-rose border-deep-red/30 rounded-md focus:ring-deep-red focus:ring-2 transition-all duration-200 animate-btn-pop"
              data-testid={`checkbox-${country.countryID}`}
            />
            <div className="animate-bounce-slow">
              <CountryFlag 
                countryName={country.name} 
                size="medium"
                className="drop-shadow-sm"
              />
            </div>
            <span className="font-body font-semibold text-lg animate-text-pop flex-1">{country.name}</span>
          </div>
        ))}
      </div>
      
      {/* Decorative elements */}
      <div className="absolute -top-4 -left-4 w-8 h-8 bg-deep-red/20 rounded-full animate-float"></div>
      <div className="absolute -bottom-4 -right-4 w-6 h-6 bg-dark-burgundy/20 rounded-full animate-float" style={{ animationDelay: '1s' }}></div>
    </div>
  </div>
);

export default CountryOverlay;
