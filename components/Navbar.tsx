"use client";

import React, { useState } from "react";
import { usePsyNova } from "@/lib/store";
import {
  Stethoscope,
  Menu,
  X,
  LogOut,
  CalendarDays,
  ClipboardList,
  FileText,
  Wallet,
  Crown,
  UserCircle,
  LayoutDashboard,
  Users,
  UserCheck,
  RotateCcw,
  MessageSquareWarning,
  CreditCard,
  Settings,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  id: string;
  label: string;
  icon?: LucideIcon | null;
};

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenRoleSelector: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenRoleSelector,
}) => {
  const { user, logout } = usePsyNova();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /* ============================================================
     GUEST NAVIGATION
  ============================================================ */

  const guestNavItems: NavItem[] = [
    { id: "home", label: "Home" },
    { id: "psychiatrists", label: "Psychiatrists" },
    { id: "reviews", label: "Reviews" },
    { id: "support", label: "Support" },
  ];

  /* ============================================================
     PATIENT NAVIGATION
  ============================================================ */

  const patientNavItems: NavItem[] = [
    { id: "home", label: "Home" },
    { id: "psychiatrists", label: "Psychiatrists" },
    { id: "reviews", label: "Reviews" },
    { id: "support", label: "Support" },
    {
      id: "patient-dashboard",
      label: "My Bookings",
      icon: CalendarDays,
    },
  ];

  /* ============================================================
     DOCTOR NAVIGATION

     Doctors do NOT book sessions.
     Doctors only manage:
     - Availability
     - Consultations
     - Documents
     - Earnings
     - Profile boosting
     - Profile
  ============================================================ */

  const doctorNavItems: NavItem[] = [
    {
      id: "doctor-portal",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "doctor-availability",
      label: "Availability",
      icon: CalendarDays,
    },
    {
      id: "doctor-consultations",
      label: "Consultations",
      icon: ClipboardList,
    },
    {
      id: "doctor-documents",
      label: "Documents",
      icon: FileText,
    },
    {
      id: "doctor-earnings",
      label: "Earnings",
      icon: Wallet,
    },
    {
      id: "doctor-boost",
      label: "Boost Profile",
      icon: Crown,
    },
    {
      id: "doctor-profile",
      label: "Profile",
      icon: UserCircle,
    },
  ];
  /* ============================================================
     ADMIN NAVIGATION

     Admin gets direct access to important administrative
     functions instead of a generic "Admin Dashboard" button.
  ============================================================ */
  const adminNavItems: NavItem[] = [
    {
      id: "admin-overview",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      id: "admin-users",
      label: "Users",
      icon: Users,
    },
    {
      id: "admin-psychiatrists",
      label: "Psychiatrists",
      icon: UserCheck,
    },
    {
      id: "admin-bookings",
      label: "Bookings",
      icon: ClipboardList,
    },
    {
      id: "admin-refunds",
      label: "Refunds",
      icon: RotateCcw,
    },
    {
      id: "admin-complaints",
      label: "Complaints",
      icon: MessageSquareWarning,
    },
    {
      id: "admin-payments",
      label: "Payments",
      icon: CreditCard,
    },
    {
      id: "admin-documents",
      label: "Documents",
      icon: FileText,
    },
    {
      id: "admin-settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  /* ============================================================
     SELECT NAVIGATION BASED ON ROLE
  ============================================================ */

  const role = user.role as string;

  const getNavItems = () => {
    switch (role) {
      case "psychiatrist":
        return doctorNavItems;

      case "patient":
        return patientNavItems;

      case "admin":
        return adminNavItems;

      default:
        return guestNavItems;
    }
  };

  const navItems = getNavItems();

  /* ============================================================
     NAVIGATION CLICK
  ============================================================ */

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setMobileMenuOpen(false);

    if (
      user.role === "psychiatrist" &&
      id.startsWith("doctor-")
    ) {
      requestAnimationFrame(() => {
        const element = document.getElementById(id);

        if (element) {
          element.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      });
    }
  };
  /* ============================================================
     ACCOUNT DASHBOARD
  ============================================================ */

  const handleAccountClick = () => {
    if (user.role === "patient") {
      setActiveTab("patient-dashboard");
    } else if (user.role === "psychiatrist") {
      setActiveTab("doctor-portal");
    } else if (user.role === "admin") {
      setActiveTab("admin-overview");
    }

    setMobileMenuOpen(false);
  };

  /* ============================================================
     LOGOUT
  ============================================================ */

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    setActiveTab("home");
  };

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <header className="sticky top-0 z-40 w-full bg-[#768c6e] text-[#F7F5EF] shadow-md transition-all duration-200 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between gap-4">
        {/* ======================================================
            BRAND
        ======================================================= */}

        <button
          onClick={() =>
            handleNavClick(
              user.role === "psychiatrist"
                ? "doctor-portal"
                : user.role === "admin"
                  ? "admin-overview"
                  : "home",
            )
          }
          className="flex items-center gap-2.5 text-left group shrink-0"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#F7F5EF] text-[#768c6e] flex items-center justify-center font-bold shadow-sm group-hover:scale-105 transition-transform">
            <Stethoscope className="w-6 h-6" />
          </div>

          <div>
            <span className="text-xl font-bold tracking-tight text-[#F7F5EF]">
              PsyNova
            </span>

            <span className="text-[10px] block font-medium text-[#F7F5EF]/80 tracking-widest uppercase">
              {user.role === "psychiatrist"
                ? "Doctor Portal"
                : user.role === "admin"
                  ? "Admin Portal"
                  : "Sri Lanka Telehealth"}
            </span>
          </div>
        </button>

        {/* ======================================================
            DESKTOP NAVIGATION
        ======================================================= */}

        <nav className="hidden md:flex items-center gap-1 lg:gap-2 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const IconComponent: LucideIcon | null = item.icon ?? null;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`px-3.5 py-2 rounded-full text-xs lg:text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? "bg-[#F7F5EF] text-[#768c6e] font-semibold shadow-sm"
                    : "text-[#F7F5EF]/90 hover:text-[#F7F5EF] hover:bg-white/10"
                }`}
              >
                {IconComponent && <IconComponent className="w-3.5 h-3.5" />}

                {item.label}
              </button>
            );
          })}
        </nav>

        {/* ======================================================
            DESKTOP ACCOUNT
        ======================================================= */}

        <div className="hidden sm:flex items-center gap-3 shrink-0">
          {user.role !== "guest" ? (
            <div className="flex items-center gap-2">
              {/* Account badge */}
              <button
                type="button"
                onClick={handleAccountClick}
                className="flex items-center gap-2.5 bg-white/15 border border-white/30 hover:bg-white/20 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium text-[#F7F5EF] cursor-pointer transition-all"
                title={
                  user.role === "psychiatrist"
                    ? "Open Doctor Dashboard"
                    : user.role === "admin"
                      ? "Open Admin Overview"
                      : "View My Account Dashboard"
                }
              >
                <div className="w-6 h-6 rounded-full bg-[#F7F5EF] text-[#768c6e] flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                  {user.name ? user.name.charAt(0) : "U"}
                </div>

                <div className="flex flex-col text-left max-w-[150px]">
                  <span className="font-bold text-xs truncate leading-tight">
                    {user.role === "psychiatrist"
                      ? `Dr. ${user.name}`
                      : user.name}
                  </span>

                  <span className="text-[10px] text-[#F7F5EF]/80 font-mono capitalize truncate">
                    {user.role === "admin"
                      ? "Administrator"
                      : user.role === "psychiatrist"
                        ? `Doctor${
                            user.slmcRegNo ? ` • SLMC ${user.slmcRegNo}` : ""
                          }`
                        : `${user.role}${
                            user.clientId ? ` • ${user.clientId}` : ""
                          }`}
                  </span>
                </div>
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-red-500/20 hover:bg-red-500/35 border border-red-300/40 text-red-100 font-semibold text-xs sm:text-sm transition-all shadow-xs"
                title="Log Out of Account"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <button
                onClick={onOpenRoleSelector}
                className="px-4 py-2 rounded-full border border-white/30 bg-white/10 hover:bg-white/20 font-medium text-xs sm:text-sm transition-all text-[#F7F5EF]"
              >
                Sign In
              </button>

              <button
                onClick={onOpenRoleSelector}
                className="px-4.5 py-2 rounded-full bg-[#F7F5EF] text-[#768c6e] hover:bg-white font-semibold text-xs sm:text-sm shadow-sm transition-all"
              >
                Sign Up / Login
              </button>
            </div>
          )}
        </div>

        {/* ======================================================
            MOBILE MENU BUTTON
        ======================================================= */}

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-xl text-[#F7F5EF] hover:bg-white/10"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* =======================================================
          MOBILE NAVIGATION
      ======================================================== */}

      {mobileMenuOpen && (
        <div className="md:hidden bg-[#768c6e] border-t border-white/15 px-4 pt-4 pb-6 space-y-2">
          {/* Navigation links */}
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const IconComponent: LucideIcon | null = item.icon ?? null;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                  isActive
                    ? "bg-[#F7F5EF] text-[#768c6e] font-semibold"
                    : "text-[#F7F5EF] hover:bg-white/10"
                }`}
              >
                {IconComponent && <IconComponent className="w-4 h-4" />}

                {item.label}
              </button>
            );
          })}

          {/* Mobile account section */}
          <div className="pt-3 border-t border-white/15 flex flex-col gap-2">
            {user.role !== "guest" ? (
              <div className="space-y-2">
                {/* Account information */}
                <button
                  type="button"
                  onClick={handleAccountClick}
                  className="w-full flex items-center gap-2.5 p-3 rounded-xl bg-white/10 border border-white/20 text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-[#F7F5EF] text-[#768c6e] flex items-center justify-center font-bold text-sm uppercase shrink-0">
                    {user.name ? user.name.charAt(0) : "U"}
                  </div>

                  <div className="min-w-0">
                    <div className="font-bold text-sm text-white truncate">
                      {user.role === "psychiatrist"
                        ? `Dr. ${user.name}`
                        : user.name}
                    </div>

                    <div className="text-xs text-white/70 capitalize truncate">
                      {user.role === "admin"
                        ? "Administrator"
                        : user.role === "psychiatrist"
                          ? `Doctor${
                              user.slmcRegNo ? ` • SLMC ${user.slmcRegNo}` : ""
                            }`
                          : `${user.role} (${user.email})`}
                    </div>
                  </div>
                </button>

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="w-full text-center py-2.5 rounded-xl bg-red-500/30 hover:bg-red-500/40 text-red-100 text-xs font-bold border border-red-200/30 flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenRoleSelector();
                }}
                className="w-full text-center py-2.5 rounded-xl bg-[#F7F5EF] text-[#768c6e] text-xs font-bold shadow-sm"
              >
                Sign In / Sign Up
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
