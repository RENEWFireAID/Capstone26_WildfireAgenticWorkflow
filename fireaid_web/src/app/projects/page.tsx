"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Plus, Trash2, LayoutGrid, Database, BarChart3, Terminal, FolderOpen } from "lucide-react";

const SIDEBAR_ITEMS = [
  { key: "apps",          label: "APPS",   icon: LayoutGrid, href: "/apps" },
  { key: "data",          label: "DATA",   icon: Database,   href: "/data" },
  { key: "visualization", label: "VISUAL", icon: BarChart3,  href: "/visualization" },
  { key: "prompt",        label: "PROMPT", icon: Terminal,   href: "/prompt" },
];

type Project = {
  _id: string;
  title: string;
  description: string;
  tag: string;
  updatedAt: string;
};

function timeAgo(date: string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

export default function ProjectsPage() {
  const [projects, setProjects]   = useState<Project[]>([]);
  const [search, setSearch]       = useState("");
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle]         = useState("");
  const [description, setDesc]    = useState("");
  const [tag, setTag]             = useState("General");
  const [saving, setSaving]       = useState(false);

  async function fetchProjects() {
    setLoading(true);
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data);
    setLoading(false);
  }

  useEffect(() => { fetchProjects(); }, []);

  async function createProject() {
    if (!title.trim()) return;
    setSaving(true);
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, tag }),
    });
    setTitle(""); setDesc(""); setTag("General");
    setShowModal(false);
    setSaving(false);
    fetchProjects();
  }

  async function deleteProject(id: string) {
    if (!confirm("Delete this project?")) return;
    await fetch("/api/projects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchProjects();
  }

  const filtered = projects.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex w-full min-h-screen">
      {/* SIDEBAR */}
      <aside className="w-14 bg-white border-r border-slate-200 flex flex-col items-center py-6 gap-2 shrink-0">
        {SIDEBAR_ITEMS.map(({ key, label, icon: Icon, href }) => (
          <Link key={key} href={href}
            className="rounded-xl text-slate-400 hover:bg-slate-100 hover:text-[#003366] transition w-11 py-2.5 flex flex-col items-center gap-1 text-[8px] font-semibold tracking-widest">
            <Icon size={18} strokeWidth={1.8} />
            {label}
          </Link>
        ))}
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col bg-slate-50">
        {/* Header */}
        <div className="bg-slate-50 px-12 py-10 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">FireAID</p>
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Projects</h1>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#003366] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#002244] transition"
          >
            <Plus size={16} />
            New project
          </button>
        </div>

        <div className="flex-1 px-12 py-8">
          {/* Search */}
          <div className="relative max-w-lg mb-8">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white outline-none focus:border-[#003366] transition"
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Projects grid */}
          {loading ? (
            <div className="text-slate-400 text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
              <FolderOpen size={48} strokeWidth={1} />
              <p className="text-sm">No projects yet — create your first one!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl">
              {filtered.map(p => (
                <div key={p._id}
                  className="group bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-slate-300 transition-all flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-block bg-blue-50 text-blue-600 text-[10px] font-semibold px-2.5 py-0.5 rounded-full mb-2">
                        {p.tag}
                      </span>
                      <h3 className="text-base font-semibold text-slate-800 group-hover:text-[#003366] transition">
                        {p.title}
                      </h3>
                    </div>
                    <button
                      onClick={() => deleteProject(p._id)}
                      className="opacity-0 group-hover:opacity-100 transition text-slate-300 hover:text-red-400 ml-2 shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  {p.description && (
                    <p className="text-xs text-slate-400 leading-relaxed">{p.description}</p>
                  )}
                  <p className="text-[10px] text-slate-300 mt-auto">Updated {timeAgo(p.updatedAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md flex flex-col gap-5">
            <h2 className="text-lg font-semibold text-slate-900">New Project</h2>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 font-medium">Title</label>
              <input
                className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#003366] transition"
                placeholder="Project title"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 font-medium">Description</label>
              <textarea
                rows={3}
                className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#003366] transition resize-none"
                placeholder="What is this project about?"
                value={description}
                onChange={e => setDesc(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 font-medium">Tag</label>
              <select
                className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#003366] transition bg-white"
                value={tag}
                onChange={e => setTag(e.target.value)}
              >
                <option>General</option>
                <option>Fire Analysis</option>
                <option>Research</option>
                <option>Weather</option>
                <option>Prediction</option>
              </select>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={createProject}
                disabled={saving || !title.trim()}
                className="px-5 py-2 rounded-xl bg-[#003366] text-white text-sm font-semibold hover:bg-[#002244] disabled:opacity-40 transition"
              >
                {saving ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}