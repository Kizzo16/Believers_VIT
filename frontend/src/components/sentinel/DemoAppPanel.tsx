"use client";

import React, { useState, useEffect } from "react";
import { Database, Plus, RefreshCw, Server, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DemoItem {
  id: number;
  name: string;
  status: string;
  created_at: string;
}

interface DemoAppPanelProps {
  onRefreshTrigger?: () => void;
}

export function DemoAppPanel({ onRefreshTrigger }: DemoAppPanelProps) {
  const [items, setItems] = useState<DemoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appState, setAppState] = useState<string>("NORMAL");
  const [newItemName, setNewItemName] = useState("");
  const [newItemStatus, setNewItemStatus] = useState("HEALTHY");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:8001/api/items");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.message || `HTTP ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setItems(data.items || []);
      setAppState(data.state || "NORMAL");
    } catch (err: any) {
      setError(err.message || "Failed to reach Demo Backend API");
      setAppState("DEGRADED_OR_OFFLINE");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    const interval = setInterval(fetchItems, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("http://localhost:8001/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newItemName, status: newItemStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.message || "Failed to create item");
      }
      setNewItemName("");
      await fetchItems();
      if (onRefreshTrigger) onRefreshTrigger();
    } catch (err: any) {
      alert(`Error creating item: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    switch (appState) {
      case "NORMAL":
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#58DC9C]/10 text-[#58DC9C] border border-[#58DC9C]/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            System State: NORMAL
          </span>
        );
      case "DATABASE_FAILURE":
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FF5C5C]/10 text-[#FF5C5C] border border-[#FF5C5C]/20">
            <AlertCircle className="w-3.5 h-3.5" />
            State: DATABASE FAILURE
          </span>
        );
      case "API_FAILURE":
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FFB800]/10 text-[#FFB800] border border-[#FFB800]/20">
            <ShieldAlert className="w-3.5 h-3.5" />
            State: API FAILURE (HTTP 500)
          </span>
        );
      case "CONFIGURATION_FAILURE":
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FF9F43]/10 text-[#FF9F43] border border-[#FF9F43]/20">
            <AlertCircle className="w-3.5 h-3.5" />
            State: CONFIGURATION FAILURE
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FF5C5C]/10 text-[#FF5C5C] border border-[#FF5C5C]/20">
            <AlertCircle className="w-3.5 h-3.5" />
            State: DEGRADED / OFFLINE
          </span>
        );
    }
  };

  return (
    <div className="bg-[#282830] rounded-3xl p-6 border border-[#303038] space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#303038]">
        <div>
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-[#B6FF4A]" />
            <h3 className="text-lg font-bold text-[#F5F5F5]">
              Module 1: Demo Application & Environment
            </h3>
          </div>
          <p className="text-xs text-[#A0A0A8] mt-1">
            Real-time REST API connected to PostgreSQL database (<code className="text-[#B6FF4A]">sentinel-db</code>)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchItems}
            isLoading={loading}
            className="text-xs flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Database Connection & Item Creation Form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <form onSubmit={handleAddItem} className="md:col-span-1 p-4 rounded-2xl bg-[#181820] border border-[#303038] space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#F5F5F5]">
            <Database className="w-4 h-4 text-[#B6FF4A]" />
            <span>Add Record to PostgreSQL</span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-[#A0A0A8]">Service / Item Name</label>
            <input
              type="text"
              placeholder="e.g. Auth Service Node 2"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full bg-[#282830] border border-[#383842] rounded-xl px-3 py-1.5 text-xs text-[#F5F5F5] focus:outline-none focus:border-[#B6FF4A]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-[#A0A0A8]">Initial Status</label>
            <select
              value={newItemStatus}
              onChange={(e) => setNewItemStatus(e.target.value)}
              className="w-full bg-[#282830] border border-[#383842] rounded-xl px-3 py-1.5 text-xs text-[#F5F5F5] focus:outline-none focus:border-[#B6FF4A]"
            >
              <option value="HEALTHY">HEALTHY</option>
              <option value="DEGRADED">DEGRADED</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>

          <Button
            type="submit"
            size="sm"
            isLoading={isSubmitting}
            className="w-full justify-center text-xs flex items-center gap-1 bg-[#B6FF4A] text-black hover:bg-[#A3EB36]"
          >
            <Plus className="w-3.5 h-3.5" />
            Insert Record
          </Button>
        </form>

        {/* PostgreSQL Live Table */}
        <div className="md:col-span-2 p-4 rounded-2xl bg-[#181820] border border-[#303038] flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#303038]">
            <span className="text-xs font-semibold text-[#F5F5F5] flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[#58DC9C]" />
              Live PostgreSQL Records (<code className="text-[#A0A0A8]">demo_items</code>)
            </span>
            <span className="text-[11px] text-[#A0A0A8]">{items.length} records</span>
          </div>

          {error ? (
            <div className="p-4 rounded-xl bg-[#FF5C5C]/10 border border-[#FF5C5C]/20 text-[#FF5C5C] text-xs space-y-1 my-auto">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Backend Connection Error
              </div>
              <p className="text-[11px] font-mono leading-relaxed">{error}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-6 text-xs text-[#A0A0A8]">No records found in PostgreSQL</div>
          ) : (
            <div className="overflow-x-auto max-h-44">
              <table className="w-full text-left text-xs text-[#F5F5F5]">
                <thead className="text-[11px] uppercase text-[#A0A0A8] border-b border-[#303038]">
                  <tr>
                    <th className="pb-2">ID</th>
                    <th className="pb-2">Item Name</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#282830]">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-[#202028]">
                      <td className="py-2 font-mono text-[#A0A0A8]">#{item.id}</td>
                      <td className="py-2 font-medium">{item.name}</td>
                      <td className="py-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            item.status === "HEALTHY"
                              ? "bg-[#58DC9C]/10 text-[#58DC9C]"
                              : "bg-[#FFB800]/10 text-[#FFB800]"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2 text-[11px] text-[#A0A0A8] font-mono">
                        {new Date(item.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
