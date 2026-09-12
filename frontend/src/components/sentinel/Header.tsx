"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SystemHealth } from "@/types/sentinel";
import { StatusBadge } from "./StatusBadge";
import {
  Shield,
  Radio,
  Activity,
  Menu,
  X,
} from "lucide-react";

interface HeaderProps {
  systemHealth: SystemHealth;
  backendOnline: boolean;
  clock: string;
  hasActiveIncident?: boolean;
  pendingApprovalsCount?: number;
}

export function Header({
  systemHealth,
  backendOnline,
  clock,
  hasActiveIncident = false,
  pendingApprovalsCount = 0,
}: HeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Overview", badge: null },
    {
      href: "/incidents",
      label: "Incidents",
      badge: hasActiveIncident ? "OUTAGE" : null,
      badgeColor: "bg-[#FF5C5C] text-white animate-pulse",
    },
    { href: "/fleet", label: "Fleet", badge: null },
    { href: "/agent", label: "AI Agent", badge: null },
    {
      href: "/governance",
      label: "Governance",
      badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount}` : null,
      badgeColor: "bg-[#B6FF4A] text-[#101010] font-bold animate-pulse",
    },
    { href: "/simulations", label: "Simulations", badge: null },
    { href: "/audit", label: "Audit", badge: null },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#303038] bg-[#101010]/95 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 shrink-0 group">
          <div className="w-9 h-9 rounded-xl bg-[#282830] border border-[#303038] flex items-center justify-center text-[#00D068] shadow-inner group-hover:border-[#00D068]/40 transition-colors">
            <Shield className="w-5 h-5 text-[#00D068]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-[#F5F5F5] text-base">SENTINEL</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#00D068] bg-[#00D068]/10 border border-[#00D068]/25 px-1.5 py-0.5 rounded">
                SRE 2.0
              </span>
            </div>
            <p className="text-[11px] text-[#A0A0A8] font-medium tracking-wide">
              Autonomous Operations
            </p>
          </div>
        </Link>

        {/* Center Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1 bg-[#181820] p-1 rounded-xl border border-[#303038]">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  isActive
                    ? "bg-[#00D068] text-[#101010] font-bold shadow-[0_0_15px_rgba(0,208,104,0.30)]"
                    : "text-[#A0A0A8] hover:text-[#F5F5F5] hover:bg-white/[0.04]"
                }`}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold tracking-wider uppercase ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Status Meta */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* UTC Clock */}
          <div className="hidden xl:flex items-center gap-1.5 text-xs text-[#A0A0A8] font-mono-tech bg-[#181820] border border-[#303038] px-2.5 py-1 rounded-lg">
            <Activity className="w-3.5 h-3.5 text-[#707078]" />
            <span>{clock || "00:00:00 UTC"}</span>
          </div>

          {/* Backend Ping Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-[#A0A0A8] bg-[#181820] border border-[#303038] px-2.5 py-1 rounded-lg">
            <Radio
              className={`w-3 h-3 ${
                backendOnline ? "text-[#00D068] animate-pulse" : "text-[#FF5C5C]"
              }`}
            />
            <span className="hidden md:inline">
              {backendOnline ? "Control Plane Online" : "Connecting..."}
            </span>
          </div>

          {/* System Status Badge */}
          <StatusBadge health={systemHealth} size="sm" />

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-[#181820] border border-[#303038] text-[#A0A0A8] hover:text-[#F5F5F5]"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#303038] bg-[#101010]/98 backdrop-blur-2xl px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between text-xs font-medium px-3.5 py-2.5 rounded-xl transition-all ${
                  isActive
                    ? "bg-[#00D068] text-[#101010] font-bold shadow-[0_0_15px_rgba(0,208,104,0.30)]"
                    : "text-[#A0A0A8] hover:text-[#F5F5F5] hover:bg-white/[0.04]"
                }`}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
