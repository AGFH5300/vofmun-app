"use client";
import React from "react";
import {ProtectedRoute} from "@/components/protectedroute";

const Page = () => {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-soft-ivory">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-4xl font-extrabold text-deep-red text-center mb-12">
            GLOSSARY
          </h1>

          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow-lg p-6 border border-cool-grey">
              <h2 className="text-2xl font-bold text-deep-red mb-4">Points</h2>
              <div className="text-almost-black-green">
                <p className="mb-4">Parliamentary procedures used during debate:</p>
                <ul className="list-disc ml-6 space-y-2">
                  <li><strong>Point of Information:</strong> A question directed to the speaker</li>
                  <li><strong>Point of Order:</strong> Raised when parliamentary procedure is not being followed</li>
                  <li><strong>Point of Personal Privilege:</strong> Raised when there are issues affecting delegate comfort</li>
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 border border-cool-grey">
              <h2 className="text-2xl font-bold text-deep-red mb-4">Motions</h2>
              <div className="text-almost-black-green">
                <p className="mb-4">Formal proposals to change the course of debate:</p>
                <ul className="list-disc ml-6 space-y-2">
                  <li><strong>Motion to Open Debate:</strong> Begin formal debate on a topic</li>
                  <li><strong>Motion to Close Debate:</strong> End debate and move to voting</li>
                  <li><strong>Motion to Extend Debate:</strong> Continue discussion beyond the time limit</li>
                  <li><strong>Motion to Suspend Debate:</strong> Temporarily halt formal debate</li>
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 border border-cool-grey">
              <h2 className="text-2xl font-bold text-deep-red mb-4">Resolutions</h2>
              <div className="text-almost-black-green">
                <p className="mb-4">Formal documents expressing the committee's position:</p>
                <ul className="list-disc ml-6 space-y-2">
                  <li><strong>Draft Resolution:</strong> Initial proposal addressing the committee topic</li>
                  <li><strong>Amendment:</strong> Proposed changes to a draft resolution</li>
                  <li><strong>Preambular Clauses:</strong> Background information and justification</li>
                  <li><strong>Operative Clauses:</strong> Specific actions the committee recommends</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Page;