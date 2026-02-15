"use client";

import React, { useState, FormEvent } from "react";
import { useCSVReader } from "react-papaparse";

function PopUp({
  showPopUp,
  closePopUp,
  children,
}: {
  showPopUp: boolean;
  closePopUp: React.MouseEventHandler<HTMLButtonElement>;
  children: React.ReactNode;
}) {
  const [term, setTerm] = useState("");
  const [def, setDef] = useState("");
  const { CSVReader } = useCSVReader();
  const [termBatch, setTermBatch] = useState<{ term: string; def: string }[]>();
  const [loading, setLoading] = useState(false);

  const handleFileSelect = async (results: any) => {
    const r = results.data as string[][];
    const wordSet = r
      .filter((row) => row.length >= 2)
      .map(([term, def]) => ({ term, def }));
    setTermBatch(wordSet);
  };

  const fileUpload = async (e: any) => {
    if (!termBatch || termBatch.length < 1) return;

    setLoading(true);
    try {
      const res = await fetch("/api/send_terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(termBatch),
      });

      const json = await res.json();

      if (!res.ok) {
        console.error(json.message);
      } else {
        console.log("Success:", json);
        setTerm("");
        setDef("");
        setTermBatch([]);
        closePopUp(e as any);
      }
    } catch (err) {
      console.error("Failed to submit terms:", err);
    } finally {
      setLoading(false);
    }
  };

  const sendTerm = async (e: FormEvent) => {
    e.preventDefault();

    console.log(`Adding to MongoDB term: ${term}, def: ${def}`);
    setLoading(true);

    try {
      const res = await fetch("/api/send_term", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term, def }),
      });

      const json = await res.json();

      if (!res.ok) {
        console.error(json.message);
      } else {
        console.log("Success:", json);
        setTerm("");
        setDef("");
        setTermBatch([]);
        closePopUp(e as any);
      }
    } catch (err) {
      console.error("Failed to submit term:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!showPopUp) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        
        if (e.target === e.currentTarget) (closePopUp as any)(e);
      }}
    >
      {/* overlay */}
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" />

      {/* modal card */}
      <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <div className="text-base font-semibold text-slate-900">
              Enter Terminology
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Add a single term or upload a CSV glossary.
            </div>
          </div>

          <button
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={closePopUp}
            type="button"
          >
            Close
          </button>
        </div>

        {/* content */}
        <div className="px-6 py-5">
          {children}

          {/* Single term form */}
          <form
            className="mt-2 grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_auto]"
            id="SingleTermSubmit"
            onSubmit={sendTerm}
          >
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Term
              </label>
              <input
                value={term}
                className="h-10 w-full rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FFCC33]/40"
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Term"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Definition
              </label>
              <input
                value={def}
                className="h-10 w-full rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FFCC33]/40"
                onChange={(e) => setDef(e.target.value)}
                placeholder="Definition"
              />
            </div>

            <button
              type="submit"
              className="h-10 rounded-full bg-[#003366] px-6 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 disabled:opacity-60"
              disabled={loading}
            >
              SUBMIT
            </button>
          </form>

          {/* divider */}
          <div className="my-5 border-t border-slate-100" />

          {/* CSV uploader */}
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Batch upload (CSV)
            </div>

            <CSVReader onUploadAccepted={handleFileSelect}>
              {({ getRootProps, acceptedFile, ProgressBar, getRemoveFileProps }: any) => (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        {...getRootProps()}
                        className="h-10 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Browse file
                      </button>

                      <span className="text-xs text-slate-500">
                        {acceptedFile ? (
                          <>
                            Selected:{" "}
                            <span className="font-medium text-slate-700">
                              {acceptedFile.name}
                            </span>
                          </>
                        ) : (
                          "No file selected"
                        )}
                      </span>

                      <button
                        type="button"
                        {...getRemoveFileProps()}
                        className="h-10 rounded-full bg-red-500 px-4 text-sm font-medium text-white hover:bg-red-600"
                      >
                        Remove
                      </button>
                    </div>

                    <button
                      type="button"
                      className="h-10 rounded-full bg-[#003366] px-6 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 disabled:opacity-60"
                      onClick={fileUpload}
                      disabled={loading}
                    >
                      UPLOAD
                    </button>
                  </div>

                  <div className="mt-3">
                    <ProgressBar />
                  </div>

                  {/* 小提示 */}
                  <div className="mt-2 text-xs text-slate-500">
                    CSV format: <span className="font-medium">term, definition</span>
                  </div>
                </>
              )}
            </CSVReader>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PopUp;
