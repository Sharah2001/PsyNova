"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  UserRole,
  User,
  Psychiatrist,
  Booking,
  Review,
  Complaint,
  PlatformSettings,
  BoostTier,
  PatientAccount,
} from "./types";
import {
  initialPlatformSettings,
  initialPsychiatrists,
  initialBookings,
  initialReviews,
  initialComplaints,
  initialPatients,
} from "./mockData";

import { isDashboardBooking, validateEmail, validatePassword } from "./utils";

interface PsyNovaContextType {
  user: User;
  setUserRole: (role: UserRole) => void;
  logout: () => void;
  loginUser: (
    email: string,
    password: string,
    role?: UserRole,
  ) => { success: boolean; error?: string };
  showRoleSelector: boolean;
  setShowRoleSelector: (show: boolean) => void;
  psychiatrists: Psychiatrist[];
  bookings: Booking[];
  refreshBookings: () => Promise<void>;
  refreshPsychiatrists: () => Promise<void>;
  reviews: Review[];
  complaints: Complaint[];
  platformSettings: PlatformSettings;
  patients: PatientAccount[];
  registerPatient: (patientData: {
    name: string;
    email: string;
    phone: string;
    district?: string;
    password?: string;
  }) => { success: boolean; patient?: PatientAccount; error?: string };

  // Actions
  boostPsychiatrist: (
    doctorId: string,
    tier: BoostTier,
  ) => { success: boolean; message: string };
  unboostPsychiatrist: (doctorId: string) => void;
  updateDoctorStatus: (
    doctorId: string,
    status: "approved" | "pending" | "suspended",
  ) => void;
  addDoctor: (doc: Partial<Psychiatrist>) => void;
  uploadDoctorDoc: (doctorId: string, docName: string) => void;
  deleteDoctorDoc: (doctorId: string, docId: string) => void;
  addDoctorSlot: (
    doctorId: string,
    slot: {
      id: string;
      datetime: string;
      durationMins: number;
      status: "available";
    },
  ) => void;

  // Booking actions
  createBooking: (bookingData: {
    doctorId: string;
    slotId: string;
    slotDatetime: string;
    patientName: string;
    patientEmail: string;
    patientContact: string;
  }) => { success: boolean; booking?: Booking; error?: string };
  addConfirmedBooking: (booking: Booking) => void;
  cancelBooking: (bookingId: string, note?: string) => void;
  completeBooking: (bookingId: string) => void;
  markPayoutPaid: (bookingId: string) => void;

  // Review actions
  addReview: (doctorId: string, rating: number, text: string) => void;
  voteHelpfulReview: (reviewId: string) => void;
  flagReview: (reviewId: string, note?: string) => void;
  unflagReview: (reviewId: string) => void;
  deleteReview: (reviewId: string) => void;

  // Complaint actions
  addComplaint: (bookingId: string, reason: string, details: string) => void;
  resolveComplaint: (
    complaintId: string,
    proofUrl: string,
    note: string,
  ) => void;

  // Settings
  updatePlatformSettings: (settings: Partial<PlatformSettings>) => void;

  // Account
  deactivatePatientAccount: () => void;
}

const PsyNovaContext = createContext<PsyNovaContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "psynova_state_v2";

const initialGuestUser: User = {
  id: "usr-guest",
  email: "visitor@psynova.lk",
  name: "Guest Visitor",
  role: "guest",
};

export const PsyNovaProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isStoreInitialized, setIsStoreInitialized] = useState(false);
  const [user, setUser] = useState<User>(initialGuestUser);
  const [showRoleSelector, setShowRoleSelector] = useState<boolean>(false);
  const [psychiatrists, setPsychiatrists] =
    useState<Psychiatrist[]>(initialPsychiatrists);
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [complaints, setComplaints] = useState<Complaint[]>(initialComplaints);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(
    initialPlatformSettings,
  );
  const [patients, setPatients] = useState<PatientAccount[]>(initialPatients);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  const registerPatient = (patientData: {
    name: string;
    email: string;
    phone: string;
    district?: string;
    password?: string;
  }): { success: boolean; patient?: PatientAccount; error?: string } => {
    // Email validation
    const emailVal = validateEmail(patientData.email);
    if (!emailVal.isValid) {
      return { success: false, error: emailVal.error };
    }

    // Password validation (if provided)
    if (patientData.password) {
      const passVal = validatePassword(patientData.password);
      if (!passVal.isValid) {
        return { success: false, error: passVal.error };
      }
    }

    const cleanEmail = patientData.email.trim().toLowerCase();
    const existingIndex = patients.findIndex(
      (p) => p.email.toLowerCase() === cleanEmail,
    );
    if (existingIndex >= 0) {
      const existing = patients[existingIndex];
      const updatedPatient: PatientAccount = {
        ...existing,
        name: patientData.name || existing.name,
        phone: patientData.phone || existing.phone,
        district: patientData.district || existing.district,
        password: patientData.password || existing.password,
      };
      setPatients((prev) =>
        prev.map((p, idx) => (idx === existingIndex ? updatedPatient : p)),
      );
      return { success: true, patient: updatedPatient };
    }

    const newPatient: PatientAccount = {
      id: `pat-${Date.now()}`,
      clientId: `PN-PAT-${Math.floor(10000 + Math.random() * 90000)}`,
      name: patientData.name || "Registered Patient",
      email: patientData.email.trim(),
      phone: patientData.phone || "",
      district: patientData.district || "Colombo",
      password: patientData.password || "Pass12#",
      status: "Active",
      createdAt: new Date().toISOString(),
    };

    setPatients((prev) => [newPatient, ...prev]);

    // Update current active user
    setUser({
      id: newPatient.id,
      email: newPatient.email,
      name: newPatient.name,
      role: "patient",
      clientId: newPatient.clientId,
    });

    // Save to PostgreSQL database
    fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPatient),
    }).catch((e) => console.error("Patient database save error:", e));

    return { success: true, patient: newPatient };
  };

  const loginUser = (
    emailInput: string,
    passwordInput: string,
    roleRequested?: UserRole,
  ): { success: boolean; error?: string } => {
    const emailVal = validateEmail(emailInput);
    if (!emailVal.isValid) {
      return { success: false, error: emailVal.error };
    }

    const passVal = validatePassword(passwordInput);
    if (!passVal.isValid) {
      return { success: false, error: passVal.error };
    }

    const cleanEmail = emailInput.trim().toLowerCase();

    if (roleRequested === "psychiatrist") {
      const doctor = psychiatrists.find(
        (d) =>
          d.name.toLowerCase().includes(cleanEmail) ||
          cleanEmail.includes("doc") ||
          cleanEmail.includes("dr"),
      );
      const activeDoc = doctor || psychiatrists[0];
      setUser({
        id: "usr-doc1",
        email: cleanEmail,
        name: activeDoc ? activeDoc.name : "Dr. Ananda Wickramasinghe",
        role: "psychiatrist",
        slmcRegNo: activeDoc ? activeDoc.slmcRegNo : "SLMC-38491",
        doctorId: activeDoc ? activeDoc.id : "doc-1",
      });
      setShowRoleSelector(false);
      return { success: true };
    }

    if (roleRequested === "admin") {
      setUser({
        id: "adm-1",
        email: cleanEmail,
        name: "System Platform Admin",
        role: "admin",
      });
      setShowRoleSelector(false);
      return { success: true };
    }

    // Patient login & credential check
    const foundPatient = patients.find(
      (p) => p.email.toLowerCase() === cleanEmail,
    );
    if (!foundPatient) {
      return {
        success: false,
        error:
          "No registered account found with this email. Please check your email or Sign Up for a new account.",
      };
    }

    // Password matching check
    if (foundPatient.password && foundPatient.password !== passwordInput) {
      return {
        success: false,
        error:
          "Incorrect password for this email account. Please check your password and try again.",
      };
    }

    setUser({
      id: foundPatient.id,
      email: foundPatient.email,
      name: foundPatient.name,
      role: "patient",
      clientId: foundPatient.clientId,
    });
    setShowRoleSelector(false);
    return { success: true };
  };

  const logout = () => {
    setUser({
      id: "usr-guest",
      email: "visitor@psynova.lk",
      name: "Guest Visitor",
      role: "guest",
    });
  };

  const refreshBookings = async (): Promise<void> => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch("/api/bookings", {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
          },
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `Failed to load bookings: HTTP ${response.status}${errorBody ? ` - ${errorBody}` : ""}`,
          );
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          console.error("[PsyNova] Invalid bookings API response:", data);
          return;
        }

        const mockBookingIds = [
          "BK-84920",
          "BK-77312",
          "BK-65109",
          "BK-52490",
          "BK-91823",
        ];

        const actualBookings = data.filter(
          (booking: Booking) => !mockBookingIds.includes(booking.id),
        );

        setBookings(actualBookings.filter(isDashboardBooking));

        console.log(
          `[PsyNova] Refreshed ${actualBookings.length} booking(s) from PostgreSQL.`,
        );
        return;
      } catch (error) {
        lastError = error;

        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 500));
        }
      }
    }

    console.error(
      "[PsyNova] Booking refresh failed after 3 attempts:",
      lastError,
    );

    // Keep existing bookings during brief API/server restarts.
  };

  const refreshPsychiatrists = async (): Promise<void> => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch("/api/psychiatrists", {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
          },
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `Failed to load psychiatrists: HTTP ${response.status}${errorBody ? ` - ${errorBody}` : ""}`,
          );
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          console.error("[PsyNova] Invalid psychiatrists API response:", data);
          return;
        }

        setPsychiatrists(data);
        console.log(
          `[PsyNova] Refreshed ${data.length} psychiatrist slot lists.`,
        );
        return;
      } catch (error) {
        lastError = error;

        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 500));
        }
      }
    }

    console.error(
      "[PsyNova] Psychiatrist refresh failed after 3 attempts:",
      lastError,
    );
  };

  useEffect(() => {
    if (!isStoreInitialized) return;

    let mounted = true;

    const syncBookings = async () => {
      if (!mounted) return;

      try {
        await Promise.all([refreshBookings(), refreshPsychiatrists()]);
      } catch (error) {
        console.error(
          "[PsyNova] Automatic availability synchronization failed:",
          error,
        );
      }
    };

    // Refresh immediately after initial store loading
    void syncBookings();

    // Refresh every 5 seconds so booked slots disappear for other users instantly.
    const interval = setInterval(() => {
      void syncBookings();
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [isStoreInitialized]);

  // Initial load from localStorage & NestJS backend API routes
  useEffect(() => {
    const isMockBooking = (id: string) =>
      ["BK-84920", "BK-77312", "BK-65109", "BK-52490", "BK-91823"].includes(id);
    const isMockPatient = (id: string) =>
      ["pat-1", "pat-2", "pat-3", "pat-4", "pat-5", "pat-6"].includes(id);

    const initStore = async () => {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);

        if (saved?.trim()) {
          let parsed: any = null;

          try {
            parsed = JSON.parse(saved);
          } catch (parseError) {
            console.warn(
              `[PsyNova Store] Invalid localStorage data for "${LOCAL_STORAGE_KEY}". Clearing corrupted state.`,
              parseError,
            );

            localStorage.removeItem(LOCAL_STORAGE_KEY);
          }

          if (parsed && typeof parsed === "object") {
            if (parsed.user) {
              setUser(parsed.user);
            }

            if (
              parsed.psychiatrists &&
              Array.isArray(parsed.psychiatrists) &&
              parsed.psychiatrists.length > 0
            ) {
              setPsychiatrists(parsed.psychiatrists);
            }

            if (parsed.bookings && Array.isArray(parsed.bookings)) {
              const actualBookings = parsed.bookings.filter(
                (b: any) => !isMockBooking(b.id),
              );
              setBookings(actualBookings.filter(isDashboardBooking));
            }

            if (
              parsed.reviews &&
              Array.isArray(parsed.reviews) &&
              parsed.reviews.length > 0
            ) {
              setReviews(parsed.reviews);
            }

            if (
              parsed.complaints &&
              Array.isArray(parsed.complaints) &&
              parsed.complaints.length > 0
            ) {
              setComplaints(parsed.complaints);
            }

            if (parsed.platformSettings) {
              setPlatformSettings(parsed.platformSettings);
            }

            if (parsed.patients && Array.isArray(parsed.patients)) {
              const actualPatients = parsed.patients.filter(
                (p: any) => !isMockPatient(p.id),
              );
              setPatients(actualPatients);
            }
          }
        }
      } catch (e) {
        console.error("Error loading saved PsyNova state:", e);
      } finally {
        setIsHydrated(true);
        setIsStoreInitialized(true);
      }
      try {
        const [
          docsRes,
          bookingsRes,
          reviewsRes,
          complaintsRes,
          settingsRes,
          patientsRes,
        ] = await Promise.all([
          fetch("/api/psychiatrists"),
          fetch("/api/bookings"),
          fetch("/api/reviews"),
          fetch("/api/complaints"),
          fetch("/api/settings"),
          fetch("/api/patients"),
        ]);

        if (docsRes.ok) {
          const docs = await docsRes.json();
          if (Array.isArray(docs) && docs.length > 0) setPsychiatrists(docs);
        }
        if (bookingsRes.ok) {
          const bks = await bookingsRes.json();

          if (Array.isArray(bks)) {
            const actualBks = bks.filter((b: any) => !isMockBooking(b.id));

            setBookings(actualBks.filter(isDashboardBooking));

            console.log(
              `[PsyNova] Initial booking load: ${actualBks.length} booking(s).`,
            );
          } else {
            console.error(
              "[PsyNova] /api/bookings returned invalid data:",
              bks,
            );
          }
        }
        if (reviewsRes.ok) {
          const revs = await reviewsRes.json();
          if (Array.isArray(revs) && revs.length > 0) setReviews(revs);
        }
        if (complaintsRes.ok) {
          const cmps = await complaintsRes.json();
          if (Array.isArray(cmps) && cmps.length > 0) setComplaints(cmps);
        }
        if (settingsRes.ok) {
          const stgs = await settingsRes.json();
          if (stgs) setPlatformSettings(stgs);
        }
        if (patientsRes.ok) {
          const pats = await patientsRes.json();
          if (Array.isArray(pats)) {
            const actualPats = pats.filter((p: any) => !isMockPatient(p.id));
            setPatients(actualPats);
          }
        }
      } catch (err) {
        console.error(
          "NestJS Backend connection error, fallback to local state:",
          err,
        );
      }
    };

    initStore();
  }, []);

  // Sync state to localStorage (only after initial hydration to prevent overwriting)
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({
          user,
          psychiatrists,
          bookings,
          reviews,
          complaints,
          platformSettings,
          patients,
        }),
      );
    } catch (e) {
      console.error("Failed to save state:", e);
    }
  }, [
    isHydrated,
    user,
    psychiatrists,
    bookings,
    reviews,
    complaints,
    platformSettings,
    patients,
  ]);

  // Reminder dispatch is handled server-side by the booking reminder scanner.
  // Keeping the client out of this loop avoids duplicate 5-minute reminders.

  // Handle role selection
  const setUserRole = (role: UserRole) => {
    let newUser: User = {
      id: "usr-1",
      email: "user@psynova.lk",
      name: "User",
      role,
    };

    if (role === "patient") {
      const latestPatient = patients[0];
      if (latestPatient) {
        newUser = {
          id: latestPatient.id,
          email: latestPatient.email,
          name: latestPatient.name,
          role: "patient",
          clientId: latestPatient.clientId,
        };
      } else {
        newUser = {
          id: `pat-${Date.now()}`,
          email: "",
          name: "Patient User",
          role: "patient",
          clientId: `PN-PAT-${Math.floor(10000 + Math.random() * 90000)}`,
        };
      }
    } else if (role === "psychiatrist") {
      newUser = {
        id: "usr-doc1",
        email: "dr.ananda@psynova.lk",
        name: "Dr. Ananda Wickramasinghe",
        role: "psychiatrist",
        slmcRegNo: "SLMC-38491",
        doctorId: "doc-1",
      };
    } else if (role === "admin") {
      newUser = {
        id: "adm-1",
        email: "admin.platform@psynova.lk",
        name: "System Platform Admin",
        role: "admin",
      };
    } else {
      newUser = {
        id: "usr-guest",
        email: "visitor@psynova.lk",
        name: "Guest Visitor",
        role: "guest",
      };
    }

    setUser(newUser);
    setShowRoleSelector(false);
  };

  // Boost Psychiatrist (Strict 9 Max limit enforcement with NestJS backend sync)
  const boostPsychiatrist = (doctorId: string, tier: BoostTier) => {
    const currentlyBoostedCount = psychiatrists.filter(
      (d) => d.isBoosted && d.id !== doctorId,
    ).length;
    if (currentlyBoostedCount >= platformSettings.maxBoostedDoctors) {
      return {
        success: false,
        message: `Boost limit reached! Maximum ${platformSettings.maxBoostedDoctors} psychiatrists can be boosted platform-wide at any time.`,
      };
    }

    const normalizedTier = tier === "3-day" ? "3-day" : "1-day";
    const amount = normalizedTier === "3-day" ? 1400 : 500;
    const orderId = `BOOST|${doctorId}|${normalizedTier}|${Date.now()}`;

    fetch("/api/payments/payhere", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "checkout-params",
        type: "boost",
        doctorId,
        tier: normalizedTier,
        orderId,
        amount,
        customerName: user.name || "Doctor",
        customerEmail: user.email || "doctor@psynova.lk",
        customerPhone: "",
      }),
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok || !data?.checkoutUrl || !data?.params) {
          throw new Error(data?.error || "Failed to initialize boost payment");
        }

        const form = document.createElement("form");
        form.method = "POST";
        form.action = data.checkoutUrl;

        Object.entries(data.params).forEach(([key, value]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = String(key);
          input.value = String(value ?? "");
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
      })
      .catch((error) => {
        console.error("Boost payment initialization failed:", error);
      });

    return {
      success: true,
      message: `Redirecting to PayHere for the ${normalizedTier} profile boost payment of LKR ${amount.toLocaleString()}.`,
    };
  };

  const unboostPsychiatrist = (doctorId: string) => {
    setPsychiatrists((prev) =>
      prev.map((doc) => {
        if (doc.id === doctorId) {
          return {
            ...doc,
            isBoosted: false,
            boostTier: "none",
            boostExpiry: null,
          };
        }
        return doc;
      }),
    );

    fetch("/api/psychiatrists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unboost", doctorId }),
    }).catch((e) => console.error("NestJS sync error:", e));
  };

  const updateDoctorStatus = (
    doctorId: string,
    status: "approved" | "pending" | "suspended",
  ) => {
    setPsychiatrists((prev) =>
      prev.map((doc) => {
        if (doc.id === doctorId) {
          return { ...doc, status };
        }
        return doc;
      }),
    );

    fetch("/api/psychiatrists", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorId, status }),
    }).catch((e) => console.error("NestJS sync error:", e));
  };

  const addDoctor = (doc: Partial<Psychiatrist>) => {
    const newDoc: Psychiatrist = {
      id: `doc-${Date.now()}`,
      name: doc.name || "Dr. New Doctor",
      title: doc.title || "Consultant Psychiatrist",
      slmcRegNo: doc.slmcRegNo || "SLMC-PENDING",
      status: "pending",
      isBoosted: false,
      boostTier: "none",
      boostExpiry: null,
      photo:
        doc.photo ||
        "https://images.unsplash.com/photo-1537368910025-700350fe46c7?q=80&w=600&auto=format&fit=crop",
      bio: doc.bio || "New practitioner registration.",
      languages: doc.languages || ["English", "Sinhala"],
      sessionFormats: doc.sessionFormats || ["Video Telehealth"],
      specialties: doc.specialties || ["General Psychiatry"],
      district: doc.district || "Colombo",
      feeLkr: doc.feeLkr || 5000,
      rating: 0,
      reviewCount: 0,
      ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      upcomingSlots: [],
      documents: [
        {
          id: `doc-${Date.now()}-1`,
          name: "SLMC_Registration_Application.pdf",
          url: "#",
          uploadDate: new Date().toISOString().split("T")[0],
          status: "Pending",
        },
      ],
    };
    setPsychiatrists((prev) => [newDoc, ...prev]);
  };

  const uploadDoctorDoc = (doctorId: string, docName: string) => {
    setPsychiatrists((prev) =>
      prev.map((doc) => {
        if (doc.id === doctorId) {
          const newDoc = {
            id: `doc-file-${Date.now()}`,
            name: docName || "SLMC_Qualification_Doc.pdf",
            url: "#",
            uploadDate: new Date().toISOString().split("T")[0],
            status: "Pending" as const,
          };
          return {
            ...doc,
            documents: [newDoc, ...doc.documents],
          };
        }
        return doc;
      }),
    );
  };

  const deleteDoctorDoc = (doctorId: string, docId: string) => {
    setPsychiatrists((prev) =>
      prev.map((doc) => {
        if (doc.id === doctorId) {
          return {
            ...doc,
            documents: doc.documents.filter((d) => d.id !== docId),
          };
        }
        return doc;
      }),
    );
  };

  const addDoctorSlot = (
    doctorId: string,
    slot: {
      id: string;
      datetime: string;
      durationMins: number;
      status: "available";
    },
  ) => {
    // Update frontend immediately
    setPsychiatrists((prev) =>
      prev.map((doc) => {
        if (doc.id !== doctorId) return doc;

        return {
          ...doc,
          upcomingSlots: [slot, ...doc.upcomingSlots],
        };
      }),
    );

    // Persist the slot to PostgreSQL
    fetch("/api/psychiatrists", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "add-slot",
        doctorId,
        slot,
      }),
    })
      .then(async (res) => {
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to save doctor slot");
        }

        console.log(
          `[PsyNova] Slot ${slot.id} saved for doctor ${doctorId}`,
          data,
        );
      })
      .catch((error) => {
        console.error("[PsyNova] Failed to save doctor slot:", error);

        // Roll back frontend state if PostgreSQL save failed
        setPsychiatrists((prev) =>
          prev.map((doc) => {
            if (doc.id !== doctorId) return doc;

            return {
              ...doc,
              upcomingSlots: doc.upcomingSlots.filter(
                (existingSlot) => existingSlot.id !== slot.id,
              ),
            };
          }),
        );
      });
  };

  // Create Booking wrapped in slot checking
  const createBooking = (data: {
    doctorId: string;
    slotId: string;
    slotDatetime: string;
    patientName: string;
    patientEmail: string;
    patientContact: string;
  }) => {
    const doctor = psychiatrists.find((d) => d.id === data.doctorId);
    if (!doctor) return { success: false, error: "Psychiatrist not found" };

    const slot = doctor.upcomingSlots.find((s) => s.id === data.slotId);
    if (!slot || slot.status === "booked") {
      return {
        success: false,
        error:
          "This consultation slot has already been reserved. Please select another time.",
      };
    }

    const fee = doctor.feeLkr;
    const commission = Math.round(
      fee * (platformSettings.commissionRate / 100),
    );
    const netDoctor = fee - commission;

    const newBooking: Booking = {
      id: `BK-${Math.floor(10000 + Math.random() * 90000)}`,
      patientId: user.id || "pat-1",
      patientName: data.patientName || user.name,
      patientEmail: data.patientEmail || user.email,
      patientContact: data.patientContact,
      doctorId: doctor.id,
      doctorName: doctor.name,
      slotId: data.slotId,
      doctorPhoto: doctor.photo,
      slotDatetime: data.slotDatetime,
      feeLkr: fee,
      platformCommissionLkr: commission,
      netDoctorEarningLkr: netDoctor,
      status: "confirmed",
      paymentStatus: "paid",
      payhereRef: `PAYHERE-${Math.floor(1000000 + Math.random() * 9000000)}`,
      bookedBy: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      videoLink: `https://meet.psynova.lk/room/PN-CONF-${Math.floor(1000 + Math.random() * 9000)}`,
      confirmationSmsSent: false,
      reminder5MinSent: false,
      createdAt: new Date().toISOString(),
      statusHistory: [
        { status: "pending", timestamp: new Date().toISOString() },
        {
          status: "confirmed",
          timestamp: new Date().toISOString(),
          note: "Payment verified via PayHere (LKR)",
        },
      ],
    };

    // Mark slot as booked immediately and refresh from server so it disappears
    // for concurrent users before the payment confirmation completes.
    setPsychiatrists((prev) =>
      prev.map((d) => {
        if (d.id === doctor.id) {
          return {
            ...d,
            upcomingSlots: d.upcomingSlots.map((s) =>
              s.id === data.slotId ? { ...s, status: "booked" } : s,
            ),
          };
        }
        return d;
      }),
    );
    void refreshPsychiatrists();

    setBookings((prev) => [
      newBooking,
      ...prev.filter((existing) => existing.id !== newBooking.id),
    ]);

    // Ensure patient is in registered patients list
    registerPatient({
      name: data.patientName || user.name,
      email: data.patientEmail || user.email,
      phone: data.patientContact,
    });

    // Sync booking to backend repository
    fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newBooking),
    }).catch((e) => console.error("Booking backend sync error:", e));

    // Automatically dispatch SMS booking confirmation immediately upon successful payment
    if (data.patientContact) {
      console.log(
        `[Auto SMS] Firing automated post-payment SMS to ${data.patientContact}`,
      );
      fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "booking-confirmation",
          booking: newBooking,
        }),
      })
        .then(async (res) => {
          const result = await res.json();
          if (res.ok && result.success && result.status === "DELIVERED") {
            await fetch("/api/bookings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "confirmation-sms-sent",
                bookingId: newBooking.id,
              }),
            });
            setBookings((prev) => [
              {
                ...newBooking,
                confirmationSmsSent: true,
                confirmationSmsSentAt: new Date().toISOString(),
              },
              ...prev.filter((b) => b.id !== newBooking.id),
            ]);
          }
        })
        .catch((err) =>
          console.error("Auto SMS booking confirmation error:", err),
        );

      fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "doctor-alert", booking: newBooking }),
      }).catch((err) => console.error("Auto SMS doctor alert error:", err));
    }

    return { success: true, booking: newBooking };
  };

  const addConfirmedBooking = (booking: Booking) => {
    const bookingWithSmsMeta: Booking = {
      ...booking,
      confirmationSmsSent: false,
    };

    setBookings((prev) => [
      bookingWithSmsMeta,
      ...prev.filter((existing) => existing.id !== bookingWithSmsMeta.id),
    ]);

    if (booking.doctorId) {
      setPsychiatrists((prev) =>
        prev.map((d) => {
          if (d.id === booking.doctorId) {
            return {
              ...d,
              upcomingSlots: d.upcomingSlots.map((s) =>
                s.datetime === booking.slotDatetime
                  ? { ...s, status: "booked" }
                  : s,
              ),
            };
          }
          return d;
        }),
      );
      void refreshPsychiatrists();
    }

    // Automatically fire SMS confirmation to patient phone number if not already fired
    if (booking.patientContact) {
      console.log(
        `[Auto SMS] Firing automated post-payment SMS for confirmed booking ${booking.id} to ${booking.patientContact}`,
      );
      fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "booking-confirmation",
          booking: bookingWithSmsMeta,
        }),
      })
        .then(async (res) => {
          const result = await res.json();
          if (res.ok && result.success && result.status === "DELIVERED") {
            await fetch("/api/bookings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "confirmation-sms-sent",
                bookingId: bookingWithSmsMeta.id,
              }),
            });
            setBookings((prev) => [
              {
                ...bookingWithSmsMeta,
                confirmationSmsSent: true,
                confirmationSmsSentAt: new Date().toISOString(),
              },
              ...prev.filter((b) => b.id !== bookingWithSmsMeta.id),
            ]);
          }
        })
        .catch((err) =>
          console.error("Auto SMS booking confirmation error:", err),
        );

      fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "doctor-alert",
          booking: bookingWithSmsMeta,
        }),
      }).catch((err) => console.error("Auto SMS doctor alert error:", err));
    }
  };

  const cancelBooking = (bookingId: string, note?: string) => {
    const actor =
      user.role === "admin"
        ? "ADMIN"
        : user.role === "psychiatrist"
          ? "DOCTOR"
          : "PATIENT";

    const resolutionType = actor === "PATIENT" ? "none" : "refund";

    fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "cancel",
        bookingId,
        actor,
        resolutionType,
        note: note || "Cancelled by user/admin",
      }),
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Failed to cancel booking");
        }

        setBookings((prev) => prev.map((b) => (b.id === bookingId ? data : b)));
      })
      .catch((error) => {
        console.error("Booking cancellation failed:", error);
      });
  };

  const completeBooking = (bookingId: string) => {
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === bookingId) {
          return {
            ...b,
            status: "completed",
            paymentStatus:
              b.paymentStatus === "paid" ? "payout_pending" : b.paymentStatus,
            statusHistory: [
              ...b.statusHistory,
              {
                status: "completed",
                timestamp: new Date().toISOString(),
                note: "Consultation marked completed",
              },
            ],
          };
        }
        return b;
      }),
    );
  };

  const markPayoutPaid = (bookingId: string) => {
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === bookingId) {
          return {
            ...b,
            paymentStatus: "payout_completed",
          };
        }
        return b;
      }),
    );
  };

  const addReview = (doctorId: string, rating: number, text: string) => {
    const doctor = psychiatrists.find((d) => d.id === doctorId);
    const newReview: Review = {
      id: `rev-${Date.now()}`,
      doctorId,
      doctorName: doctor?.name || "Psychiatrist",
      patientName: user.name || "Verified Patient",
      patientDistrict: "Colombo",
      rating,
      date: new Date().toISOString().split("T")[0],
      text,
      isVerified: true,
      helpfulCount: 0,
    };

    setReviews((prev) => [newReview, ...prev]);

    // Update doctor's rating stats
    if (doctor) {
      const newReviewCount = doctor.reviewCount + 1;
      const newDist = {
        ...doctor.ratingDistribution,
        [rating]:
          (doctor.ratingDistribution[rating as 1 | 2 | 3 | 4 | 5] || 0) + 1,
      };
      const totalStars = doctor.rating * doctor.reviewCount + rating;
      const newAvg = parseFloat((totalStars / newReviewCount).toFixed(2));

      setPsychiatrists((prev) =>
        prev.map((d) => {
          if (d.id === doctorId) {
            return {
              ...d,
              rating: newAvg,
              reviewCount: newReviewCount,
              ratingDistribution: newDist,
            };
          }
          return d;
        }),
      );
    }
  };

  const voteHelpfulReview = (reviewId: string) => {
    setReviews((prev) =>
      prev.map((r) => {
        if (r.id === reviewId) {
          return { ...r, helpfulCount: r.helpfulCount + 1 };
        }
        return r;
      }),
    );
  };

  const flagReview = (reviewId: string, note?: string) => {
    setReviews((prev) =>
      prev.map((r) => {
        if (r.id === reviewId) {
          return {
            ...r,
            flagged: true,
            adminNote: note || "Flagged for audit review",
          };
        }
        return r;
      }),
    );
  };

  const unflagReview = (reviewId: string) => {
    setReviews((prev) =>
      prev.map((r) => {
        if (r.id === reviewId) {
          return { ...r, flagged: false, adminNote: undefined };
        }
        return r;
      }),
    );
  };

  const deleteReview = (reviewId: string) => {
    setReviews((prev) => prev.filter((r) => r.id !== reviewId));
  };

  const addComplaint = (bookingId: string, reason: string, details: string) => {
    const booking = bookings.find((b) => b.id === bookingId);
    const newComplaint: Complaint = {
      id: `CMP-${Math.floor(1000 + Math.random() * 9000)}`,
      bookingId,
      patientId: user.id || "pat-1",
      patientName: user.name || "Patient",
      doctorId: booking?.doctorId || "doc-1",
      doctorName: booking?.doctorName || "Psychiatrist",
      reason,
      details,
      status: "Pending",
      createdAt: new Date().toISOString(),
    };

    setComplaints((prev) => [newComplaint, ...prev]);
  };

  const resolveComplaint = (
    complaintId: string,
    proofUrl: string,
    note: string,
  ) => {
    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id === complaintId) {
          return {
            ...c,
            status: "Resolved",
            resolutionProof: proofUrl || "Proof_Document_Uploaded.pdf",
            resolutionNote:
              note || "Issue resolved by administration refund protocol.",
          };
        }
        return c;
      }),
    );
  };

  const updatePlatformSettings = (settings: Partial<PlatformSettings>) => {
    setPlatformSettings((prev) => ({ ...prev, ...settings }));
  };

  const deactivatePatientAccount = () => {
    setUser((prev) => ({
      ...prev,
      deactivatedAt: new Date().toISOString(),
    }));
  };

  return (
    <PsyNovaContext.Provider
      value={{
        user,
        setUserRole,
        logout,
        loginUser,
        showRoleSelector,
        setShowRoleSelector,
        psychiatrists,
        bookings,
        refreshPsychiatrists,
        reviews,
        complaints,
        platformSettings,
        patients,
        registerPatient,
        boostPsychiatrist,
        unboostPsychiatrist,
        updateDoctorStatus,
        addDoctor,
        uploadDoctorDoc,
        deleteDoctorDoc,
        addDoctorSlot,
        createBooking,
        addConfirmedBooking,
        cancelBooking,
        completeBooking,
        markPayoutPaid,
        addReview,
        voteHelpfulReview,
        flagReview,
        unflagReview,
        deleteReview,
        addComplaint,
        resolveComplaint,
        updatePlatformSettings,
        deactivatePatientAccount,
        refreshBookings,
      }}
    >
      {children}
    </PsyNovaContext.Provider>
  );
};

export const usePsyNova = () => {
  const context = useContext(PsyNovaContext);
  if (!context) {
    throw new Error("usePsyNova must be used within a PsyNovaProvider");
  }
  return context;
};
