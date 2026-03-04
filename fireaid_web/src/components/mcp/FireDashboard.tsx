"use client";
import { useEffect, useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";

type R = Record<string, any>;
const C = ["#2563eb","#16a34a","#dc2626","#d97706","#7c3aed","#0891b2","#be185d","#65a30d","#ea580c","#4f46e5"];
const get = (raw: string|null) => { try { return JSON.parse(raw??''); } catch { return null; } };
const rows = (p: any): R[] => !p ? [] : Array.isArray(p) ? p : Array.isArray(p?.results) ? p.results : [];
const grp = (rs: R[], k: string, n=10) => { const c: Record<string,number>={}; for(const r of rs){const v=String(r[k]??'Unknown').trim()||'Unknown'; c[v]=(c[v]||0)+1;} return Object.entries(c).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count).slice(0,n); };
const byYr = (rs: R[], k: string) => { const y: Record<string,Record<string,number>>={};const cs=new Set<string>(); for(const r of rs){const yr=String(r.year??'?');const c=String(r[k]??'Unknown').trim()||'Unknown';if(!y[yr])y[yr]={};y[yr][c]=(y[yr][c]||0)+1;cs.add(c);} return Object.entries(y).sort(([a],[b])=>Number(a)-Number(b)).map(([year,cv])=>({year,...cv})); };
const acreBuckets = (rs: R[]) => { const b: Record<string,number>={"<1ac":0,"1-10ac":0,"10-100ac":0,"100-1Kac":0,"1K-10Kac":0,">10Kac":0}; for(const r of rs){const a=Number(r.ESTIMATEDTOTALACRES??r.acres??0);if(a<1)b["<1ac"]++;else if(a<10)b["1-10ac"]++;else if(a<100)b["10-100ac"]++;else if(a<1000)b["100-1Kac"]++;else if(a<10000)b["1K-10Kac"]++;else b[">10Kac"]++;} return Object.entries(b).map(([range,count])=>({range,count})); };

function Card({title,children}:{title:string;children:React.ReactNode}){
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 text-sm font-semibold text-slate-800">{title}</div>{children}</div>;
}
function Bar1({data,xk="name",yk="count",color="#2563eb"}:{data:any[];xk?:string;yk?:string;color?:string}){
  return <ResponsiveContainer width="100%" height={220}><BarChart data={data} margin={{top:4,right:4,left:0,bottom:55}}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey={xk} tick={{fontSize:9}} angle={-40} textAnchor="end" interval={0}/><YAxis tick={{fontSize:9}}/><Tooltip/><Bar dataKey={yk} fill={color} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer>;
}
function Pie1({data}:{data:{name:string;count:number}[]}){
  return <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={data} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({name,percent})=>percent>0.06?`${(percent*100).toFixed(0)}%`:""} labelLine={false}>{data.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer>;
}
function Line1({data,cats}:{data:any[];cats:string[]}){
  return <ResponsiveContainer width="100%" height={220}><LineChart data={data} margin={{top:4,right:8,left:0,bottom:4}}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="year" tick={{fontSize:9}}/><YAxis tick={{fontSize:9}}/><Tooltip/><Legend wrapperStyle={{fontSize:9}}/>{cats.slice(0,6).map((c,i)=><Line key={c} type="monotone" dataKey={c} stroke={C[i%C.length]} dot={false} strokeWidth={2}/>)}</LineChart></ResponsiveContainer>;
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

  if(!data.length) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">No data. Run a query first.</div>;

  const fmt = (n:number) => n>=1e6?(n/1e6).toFixed(1)+"M":n>=1000?(n/1000).toFixed(1)+"K":n.toFixed(0);

  return (
    <div className="space-y-4">
      <div className="text-lg font-bold text-slate-900">Fire Data Dashboard <span className="text-xs font-normal text-slate-400">({data.length} records)</span></div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Total Fires", data.length.toLocaleString()],["Total Acres", fmt(totalAcres)],["Prescribed", `${prescCount} (${(prescCount/data.length*100).toFixed(0)}%)`],["Structures Burned", structures.toLocaleString()]].map(([label,val])=>(
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-xl font-bold text-slate-900">{val}</div>
          </div>
        ))}
      </div>

      {/* 起火原因 */}
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 pt-2">Cause Analysis</div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="Fire Cause (Human / Natural)"><Pie1 data={fireCause}/></Card>
        <Card title="General Cause (Top 10)"><Bar1 data={genCause} color="#2563eb"/></Card>
        <Card title="Specific Cause (Top 10)"><Bar1 data={specCause} color="#dc2626"/></Card>
      </div>

      {/* 植被与燃料 */}
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 pt-2">Vegetation & Fuel</div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Primary Fuel Type (Top 10)"><Bar1 data={fuelType} color="#16a34a"/></Card>
        <Card title="Fuel Type Trend by Year"><Line1 data={fuelByYear} cats={topFuels}/></Card>
      </div>

      {/* 地形 */}
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 pt-2">Terrain (Origin)</div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="Origin Slope"><Bar1 data={slope} color="#d97706"/></Card>
        <Card title="Origin Aspect"><Bar1 data={aspect} color="#0891b2"/></Card>
        <Card title="Origin Elevation"><Bar1 data={elevation} color="#7c3aed"/></Card>
      </div>

      {/* 管理与应对 */}
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 pt-2">Management & Response</div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="Management Option"><Bar1 data={mgmtOpt} color="#7c3aed"/></Card>
        <Card title="Suppression Strategy"><Bar1 data={suppStrat} color="#d97706"/></Card>
        <Card title="Management Org"><Bar1 data={mgmtOrg} color="#0891b2"/></Card>
      </div>

      {/* 土地所有权与计划烧除 */}
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 pt-2">Ownership & Prescribed</div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="Land Ownership"><Pie1 data={ownerKind}/></Card>
        <Card title="Prescribed Fire (Y/N)"><Pie1 data={prescribed}/></Card>
        <Card title="Fire Size Distribution"><Bar1 data={acresDist} xk="range" color="#ea580c"/></Card>
      </div>

      {/* 时间趋势 */}
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 pt-2">Trends Over Time</div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Fires by Year"><Bar1 data={byYear} color="#2563eb"/></Card>
        <Card title="General Cause Trend by Year"><Line1 data={causeByYear} cats={topCauses}/></Card>
      </div>
    </div>
  );
}
