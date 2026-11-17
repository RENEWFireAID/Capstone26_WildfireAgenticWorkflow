"use client";
import { useEffect, useState, useMemo } from "react";
import { TOOLTIP_STYLE, SHADOW, Panel, Placeholder, Stat } from "@/components/ui/app";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";

type R = Record<string, any>;
// Categorical colours from the FireAID palette; no reds or oranges, which mean fire or hazard.
const C = ["#236192","#87d1e6","#c99700","#111c4e","#5b8c5a","#94a3b8","#7a5c99","#3d8fb8","#a3a067","#475569"];
const NAVY = "#236192";
const TICK = {fontSize:10, fill:"#64748b"};
const TIP = {contentStyle:TOOLTIP_STYLE, labelStyle:{color:"white"}, itemStyle:{color:"white"}};
const get = (raw: string|null) => { try { return JSON.parse(raw??''); } catch { return null; } };
const rows = (p: any): R[] => !p ? [] : Array.isArray(p) ? p : Array.isArray(p?.results) ? p.results : [];
const grp = (rs: R[], k: string, n=10) => { const c: Record<string,number>={}; for(const r of rs){const v=String(r[k]??'Unknown').trim()||'Unknown'; c[v]=(c[v]||0)+1;} return Object.entries(c).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count).slice(0,n); };
const byYr = (rs: R[], k: string) => { const y: Record<string,Record<string,number>>={};const cs=new Set<string>(); for(const r of rs){const yr=String(r.year??'?');const c=String(r[k]??'Unknown').trim()||'Unknown';if(!y[yr])y[yr]={};y[yr][c]=(y[yr][c]||0)+1;cs.add(c);} return Object.entries(y).sort(([a],[b])=>Number(a)-Number(b)).map(([year,cv])=>({year,...cv})); };
const acreBuckets = (rs: R[]) => { const b: Record<string,number>={"<1ac":0,"1-10ac":0,"10-100ac":0,"100-1Kac":0,"1K-10Kac":0,">10Kac":0}; for(const r of rs){const a=Number(r.ESTIMATEDTOTALACRES??r.acres??0);if(a<1)b["<1ac"]++;else if(a<10)b["1-10ac"]++;else if(a<100)b["10-100ac"]++;else if(a<1000)b["100-1Kac"]++;else if(a<10000)b["1K-10Kac"]++;else b[">10Kac"]++;} return Object.entries(b).map(([range,count])=>({range,count})); };

function Card({title,children}:{title:string;children:React.ReactNode}){
  return <section className={`min-w-0 bg-white p-4 ${SHADOW}`}><h3 className="mb-3 text-base font-bold leading-tight text-navy-deep">{title}</h3>{children}</section>;
}
function Section({title,children}:{title:string;children:React.ReactNode}){
  return <div className="space-y-3"><h3 className="border-b border-slate-200 pb-1.5 font-mono! text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</h3>{children}</div>;
}
function Swatches({names}:{names:string[]}){
  return <ul className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-slate-600">{names.map((n,i)=><li key={n} className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0" style={{background:C[i%C.length]}} aria-hidden="true"/>{n}</li>)}</ul>;
}
function Bar1({data,xk="name",yk="count",color=NAVY}:{data:any[];xk?:string;yk?:string;color?:string}){
  return <ResponsiveContainer width="100%" height={220}><BarChart data={data} margin={{top:4,right:4,left:-12,bottom:55}}><CartesianGrid vertical={false} stroke="#e2e8f0"/><XAxis dataKey={xk} tick={TICK} angle={-40} textAnchor="end" interval={0} axisLine={{stroke:"#cbd5e1"}} tickLine={false}/><YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false}/><Tooltip {...TIP} cursor={{fill:"#e5eef5"}}/><Bar dataKey={yk} name="Fires" fill={color} maxBarSize={36}/></BarChart></ResponsiveContainer>;
}
function Pie1({data}:{data:{name:string;count:number}[]}){
  return <><ResponsiveContainer width="100%" height={190}><PieChart><Pie data={data} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={64} stroke={data.length>1?"#fff":"none"} label={({x,y,textAnchor,percent=0})=>percent>0.06?<text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fontSize={11} fill="#475569">{`${(percent*100).toFixed(0)}%`}</text>:null} labelLine={false}>{data.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Pie><Tooltip {...TIP}/></PieChart></ResponsiveContainer><Swatches names={data.map(d=>d.name)}/></>;
}
function Line1({data,cats}:{data:any[];cats:string[]}){
  return <><ResponsiveContainer width="100%" height={190}><LineChart data={data} margin={{top:4,right:8,left:-12,bottom:4}}><CartesianGrid vertical={false} stroke="#e2e8f0"/><XAxis dataKey="year" tick={TICK} axisLine={{stroke:"#cbd5e1"}} tickLine={false}/><YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false}/><Tooltip {...TIP}/>{cats.slice(0,6).map((c,i)=><Line key={c} type="monotone" dataKey={c} stroke={C[i%C.length]} dot={{r:2}} strokeWidth={2}/>)}</LineChart></ResponsiveContainer><Swatches names={cats.slice(0,6)}/></>;
}

export default function FireDashboard() {
  const [data, setData] = useState<R[]>([]);
  function load(){ setData(rows(get(localStorage.getItem("mcp:last_result")))); }
  useEffect(()=>{ load(); window.addEventListener("mcp:updated",load); return ()=>window.removeEventListener("mcp:updated",load); },[]);

  const totalAcres  = useMemo(()=>data.reduce((s,r)=>s+Number(r.ESTIMATEDTOTALACRES??r.acres??0),0),[data]);
  const totalCost   = useMemo(()=>data.reduce((s,r)=>s+Number(r.ESTIMATEDTOTALCOST??0),0),[data]);
  const structures  = useMemo(()=>data.reduce((s,r)=>s+Number(r.STRUCTURESBURNED??0),0),[data]);
  const prescCount  = useMemo(()=>data.filter(r=>r.PRESCRIBEDFIRE==="Y"||r.prescribed==="Y").length,[data]);

  const fireCause     = useMemo(()=>grp(data,"FIRECAUSE"),[data]);
  const genCause      = useMemo(()=>grp(data,"GENERALCAUSE"),[data]);
  const specCause     = useMemo(()=>grp(data,"SPECIFICCAUSE"),[data]);
  const fuelType      = useMemo(()=>grp(data,"PRIMARYFUELTYPE"),[data]);
  const mgmtOpt       = useMemo(()=>grp(data,"MGMTOPTIONID"),[data]);
  const suppStrat     = useMemo(()=>grp(data,"SUPPRESSIONSTRATEGY"),[data]);
  const ownerKind     = useMemo(()=>grp(data,"OWNERKIND"),[data]);
  const slope         = useMemo(()=>grp(data,"ORIGINSLOPE"),[data]);
  const aspect        = useMemo(()=>grp(data,"ORIGINASPECT"),[data]);
  const elevation     = useMemo(()=>grp(data,"ORIGINELEVATION"),[data]);
  const mgmtOrg       = useMemo(()=>grp(data,"MGMTORGID"),[data]);
  const prescribed    = useMemo(()=>grp(data,"PRESCRIBEDFIRE"),[data]);
  const acresDist     = useMemo(()=>acreBuckets(data),[data]);
  const causeByYear   = useMemo(()=>byYr(data,"GENERALCAUSE"),[data]);
  const fuelByYear    = useMemo(()=>byYr(data,"PRIMARYFUELTYPE"),[data]);
  const topCauses     = useMemo(()=>genCause.slice(0,5).map(d=>d.name),[genCause]);
  const topFuels      = useMemo(()=>fuelType.slice(0,5).map(d=>d.name),[fuelType]);
  const byYear        = useMemo(()=>grp(data,"year").map(d=>({...d,name:String(d.name)})).sort((a,b)=>Number(a.name)-Number(b.name)),[data]);

  if(!data.length) return <Panel title="Fire Data Dashboard"><Placeholder height="py-6">No data yet. Run a query to chart causes, fuels, terrain and response for the fires it returns.</Placeholder></Panel>;

  const fmt = (n:number) => n>=1e6?(n/1e6).toFixed(1)+"M":n>=1000?(n/1000).toFixed(1)+"K":n.toFixed(0);

  return (
    <div className="space-y-6">
      <Panel title="Fire Data Dashboard" subtitle={`${data.length.toLocaleString("en-US")} records from the last query`}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
          {[["Total Fires", data.length.toLocaleString()],["Total Acres", fmt(totalAcres)],["Prescribed", `${prescCount} (${(prescCount/data.length*100).toFixed(0)}%)`],["Structures Burned", structures.toLocaleString()]].map(([label,val])=>(
            <Stat key={label} label={label} value={val} />
          ))}
        </dl>
      </Panel>

      <Section title="Cause Analysis">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card title="Fire Cause (Human / Natural)"><Pie1 data={fireCause}/></Card>
          <Card title="General Cause (Top 10)"><Bar1 data={genCause}/></Card>
          <Card title="Specific Cause (Top 10)"><Bar1 data={specCause}/></Card>
        </div>
      </Section>

      <Section title="Vegetation & Fuel">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card title="Primary Fuel Type (Top 10)"><Bar1 data={fuelType}/></Card>
          <Card title="Fuel Type Trend by Year"><Line1 data={fuelByYear} cats={topFuels}/></Card>
        </div>
      </Section>

      <Section title="Terrain (Origin)">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card title="Origin Slope"><Bar1 data={slope}/></Card>
          <Card title="Origin Aspect"><Bar1 data={aspect}/></Card>
          <Card title="Origin Elevation"><Bar1 data={elevation}/></Card>
        </div>
      </Section>

      <Section title="Management & Response">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card title="Management Option"><Bar1 data={mgmtOpt}/></Card>
          <Card title="Suppression Strategy"><Bar1 data={suppStrat}/></Card>
          <Card title="Management Org"><Bar1 data={mgmtOrg}/></Card>
        </div>
      </Section>

      <Section title="Ownership & Prescribed">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card title="Land Ownership"><Pie1 data={ownerKind}/></Card>
          <Card title="Prescribed Fire (Y/N)"><Pie1 data={prescribed}/></Card>
          <Card title="Fire Size Distribution"><Bar1 data={acresDist} xk="range"/></Card>
        </div>
      </Section>

      <Section title="Trends Over Time">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card title="Fires by Year"><Bar1 data={byYear}/></Card>
          <Card title="General Cause Trend by Year"><Line1 data={causeByYear} cats={topCauses}/></Card>
        </div>
      </Section>
    </div>
  );
}
