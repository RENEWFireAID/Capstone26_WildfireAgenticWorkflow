import React, { useState, useRef, ChangeEvent, FormEvent, CSSProperties } from "react";
import { useCSVReader } from 'react-papaparse';


function PopUp({showPopUp, closePopUp, children}: {
    showPopUp: boolean,
    closePopUp: React.MouseEventHandler<HTMLButtonElement>,
    children: React.ReactNode,
}){
    const [term, setTerm] = useState('');
    const [def, setDef] = useState('');
    const { CSVReader } = useCSVReader();
    const [termBatch, setTermBatch] = useState<{ term: string, def: string }[]>();
    const [loading, setLoading] = useState(false);


    const handleFileSelect = async (results: any) => {
        let r = results.data as string[][];

        const wordSet = r
            .filter(row => row.length >= 2)
            .map(([term, def]) => ({term, def}));

        setTermBatch(wordSet);
    }

    const fileUpload = async (e: any) => {
        if (termBatch == null || termBatch.length < 1) {
            return;
        }

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
    }

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
  
    if (!showPopUp) {return null}

    return (
        <div className="PopUp" >
            {children}

            <h3 className="font-bold text-slate-800">Enter Terminology</h3>

            <form
                className="mt-2 flex items-center gap-2"
                id="SingleTermSubmit"
                onSubmit={sendTerm}
            >
                <input
                    className="h-9 flex-1 rounded-full border border-slate-300 bg-white px-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#FFCC33] focus:ring-1 focus:ring-[#FFCC33]"
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Term"
                />
                
                <input
                    className="h-9 flex-1 rounded-full border border-slate-300 bg-white px-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#FFCC33] focus:ring-1 focus:ring-[#FFCC33]"
                    onChange={(e) => setDef(e.target.value)}
                    placeholder="Definition"
                />
                
                <button
                    type="submit"
                    className="flex h-9 w-12 items-center justify-center rounded-full bg-[#003366] text-xs font-semibold text-white hover:bg-slate-900"
                    disabled={loading}
                >
                    SUBMIT
                </button>

            </form>

            <CSVReader
                onUploadAccepted={handleFileSelect}
                >
                {({
                    getRootProps,
                    acceptedFile,
                    ProgressBar,
                    getRemoveFileProps,
                }: any) => (
                    <>
                    <div className="flex gap-2 h-15">
                        <button type='button' {...getRootProps()} 
                                className="flex h-9 w-30 items-center justify-center border border-slate-300 bg-white px-3 text-xs text-black outline-none placeholder:text-slate-400 focus:border-[#FFCC33] focus:ring-1 focus:ring-[#FFCC33]">
                            Browse file
                        </button>
                        <div className="items-center justify-center text-xs font-semibold text-black">
                            {acceptedFile && acceptedFile.name}
                        </div>
                        <button {...getRemoveFileProps()}
                                className="flex h-9 w-15 items-center justify-center rounded-full bg-[#FF0000] text-xs font-semibold text-white hover:bg-slate-900">
                            Remove
                        </button>
                        <button
                            className="flex h-9 w-20 items-center justify-center rounded-full bg-[#003366] text-xs font-semibold text-white hover:bg-slate-900"
                            onClick={fileUpload}
                            disabled={loading}
                        >
                            UPLOAD
                        </button>
                    </div>
                    <ProgressBar/>
                    </>
                )}
            </CSVReader>

            <button 
                className="mt-2 rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50" 
                onClick={closePopUp}
            >
                close
            </button>
        </div>
    );
};


export default PopUp;
