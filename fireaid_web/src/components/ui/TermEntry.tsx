import React, { useState, useRef, ChangeEvent, FormEvent } from "react";

function PopUp({showPopUp, closePopUp, children}: {
    showPopUp: boolean,
    closePopUp: React.MouseEventHandler<HTMLButtonElement>,
    children: React.ReactNode,
}){
    const [term, setTerm] = useState('');
    const [def, setDef] = useState('');
    const [file, setFile] = useState<File>();
    const [loading, setLoading] = useState(false);

    const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files === null) {
            return
        }
        setFile(e.target.files[0]);
    };

    const handleFileSubmit = (e: FormEvent) => {
        e.preventDefault();
        console.log(`Submitting file ${file?.name}`);

        const fileReader = new FileReader();
        fileReader.onload = (event) => {
            const contents = event?.target?.result;
            console.log(contents);
        }

        if (file) {
            fileReader.readAsText(file);
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
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#003366] text-xs font-semibold text-white hover:bg-slate-900"
                    disabled={loading}
                >
                    SAVE
                </button>

            </form>

            <form
                onSubmit={handleFileSubmit}>
                <input
                    className="h-9 flex-1 border border-slate-300 bg-white px-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#FFCC33] focus:ring-1 focus:ring-[#FFCC33]"
                    type={"file"}
                    id={"csvFileSelect"}
                    accept={".csv"}
                    onChange={handleFileUpload}
                />

                <button
                    className="font-bold text-slate-800"
                    type="submit"
                    disabled={loading}
                >
                    UPLOAD
                </button>
            </form>

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
