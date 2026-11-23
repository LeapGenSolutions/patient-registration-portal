import { useState, useEffect } from "react";
import { HeartPulse, Loader2, ChevronRight, ChevronLeft, Check } from "lucide-react";
import Logo from "../components/Logo";
import { BASE_URL, PATIENT_PORTAL_URL } from "../constants";
import TermsDialog from "../components/TermsDialog";

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
  "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York",
  "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
  "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming"
];

const decodeToken = (token) => {
  try {
    const [, payloadBase64] = token.split(".");
    const normalized = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
};

const initialForm = {
  firstName: "", lastName: "", dateOfBirth: "", gender: "",
  email: "", phone: "", address: "", city: "", state: "", zip: "",
};

const initialErrors = {
  firstName: "", lastName: "", dateOfBirth: "", gender: "",
  phone: "", address: "", city: "", state: "", zip: "", consent: "",
};

export default function Register() {
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState(initialErrors);
  const [serverError, setServerError] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [consentToRecords, setConsentToRecords] = useState(false);
  const [isTermsDialogOpen, setIsTermsDialogOpen] = useState(false);

  useEffect(() => {
    document.title = "Register — Seismic Care";

    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.substring(1) : "";
    const params = new URLSearchParams(hash);
    const tokenFromUrl = params.get("id_token");
    const error = params.get("error");

    if (error) {
      setServerError(params.get("error_description") || error || "Login failed.");
      setIsVerifying(false);
      return;
    }

    const storedToken = sessionStorage.getItem("ciamIdToken");
    if (!tokenFromUrl && !storedToken) {
      window.location.href = PATIENT_PORTAL_URL;
      return;
    }

    const token = tokenFromUrl || storedToken;
    const payload = decodeToken(token);

    if (!payload) {
      setServerError("Invalid token. Please sign in again.");
      setIsVerifying(false);
      return;
    }

    const email = payload.email || payload.emails?.[0] || payload.preferred_username || "";
    const userId = payload.sub || payload.oid || "";

    setForm(prev => ({
      ...prev,
      email,
      firstName: payload.given_name || "",
      lastName: payload.family_name || "",
    }));

    if (tokenFromUrl) {
      sessionStorage.setItem("ciamIdToken", token);
      window.history.replaceState(null, "", window.location.pathname);
      verifyCIAMToken(token, email, userId);
    } else {
      setIsVerifying(false);
    }
  }, []);

  async function verifyCIAMToken(token, email, userId) {
    try {
      const res = await fetch(`${BASE_URL}/api/standalone/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token, email, userId, userType: "patient" }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || d.message || `Verification failed (${res.status})`);
      }

      const data = await res.json();
      if (data.token) sessionStorage.setItem("backendToken", data.token);

      // Already registered — send straight to patient-portal
      if (data.profileComplete === true) {
        sessionStorage.removeItem("ciamIdToken");
        window.location.href = `${PATIENT_PORTAL_URL}?backendToken=${encodeURIComponent(data.token)}`;
        return;
      }

      setIsVerifying(false);
    } catch (err) {
      if (err.message?.includes("expired") || err.message?.includes("Invalid")) {
        sessionStorage.removeItem("ciamIdToken");
        sessionStorage.removeItem("backendToken");
        window.location.href = PATIENT_PORTAL_URL;
        return;
      }
      setServerError(err.message || "Verification failed.");
      setIsVerifying(false);
    }
  }

  function validateStep(step) {
    const e = {};
    const nameRx = /^[a-zA-Z\s\-']+$/;

    if (step === 1) {
      if (!form.firstName.trim()) e.firstName = "Required";
      else if (!nameRx.test(form.firstName)) e.firstName = "Letters only";
      if (!form.lastName.trim()) e.lastName = "Required";
      else if (!nameRx.test(form.lastName)) e.lastName = "Letters only";
      if (!form.dateOfBirth) e.dateOfBirth = "Required";
      if (!form.gender) e.gender = "Required";
      if (form.phone && !/^\+?[\d\s\-().]{7,15}$/.test(form.phone))
        e.phone = "Invalid phone number";
    }

    if (step === 2) {
      if (!form.state) e.state = "Required";
      if (form.zip && !/^\d{5}$/.test(form.zip)) e.zip = "Must be 5 digits";
    }

    if (step === 3) {
      if (!agreeToTerms || !consentToRecords)
        e.consent = "Please accept all required agreements to continue";
    }

    return e;
  }

  function handleChange(e) {
    const { name, value } = e.target;
    let clean = value;
    if (name === "firstName" || name === "lastName")
      clean = value.replace(/[^a-zA-Z\s\-']/g, "");
    if (name === "zip")
      clean = value.replace(/\D/g, "").slice(0, 5);
    setForm(prev => ({ ...prev, [name]: clean }));
    setErrors(prev => ({ ...prev, [name]: "" }));
    setServerError("");
  }

  function handleSelect(name, value) {
    setForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: "" }));
    setServerError("");
  }

  function handleNext() {
    const errs = validateStep(currentStep);
    if (Object.keys(errs).length) { setErrors(prev => ({ ...prev, ...errs })); return; }
    setCurrentStep(prev => prev + 1);
  }

  function handleBack() {
    setCurrentStep(prev => prev - 1);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const errs = validateStep(3);
    if (Object.keys(errs).length) { setErrors(prev => ({ ...prev, ...errs })); return; }

    const token = sessionStorage.getItem("backendToken");
    if (!token) { setServerError("Session expired. Please sign in again."); return; }

    setIsSubmitting(true);
    setServerError("");

    try {
      const res = await fetch(`${BASE_URL}/api/standalone/patient/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          dateOfBirth: form.dateOfBirth,
          gender: form.gender,
          phone: form.phone.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state,
          zip: form.zip,
          termsAccepted: agreeToTerms,
          consentToRecords: consentToRecords,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Registration failed (${res.status})`);
      }

      // Clean up and send to patient-portal with backendToken
      sessionStorage.removeItem("ciamIdToken");
      window.location.href = `${PATIENT_PORTAL_URL}?backendToken=${encodeURIComponent(token)}`;

    } catch (err) {
      setServerError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 via-white to-cyan-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin h-8 w-8 text-cyan-600" />
          <p className="text-sm font-medium text-cyan-800">Verifying your account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 via-white to-cyan-50 px-4 py-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/80 to-cyan-50/90 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-2xl bg-white/95 p-8 rounded-2xl shadow-lg flex flex-col items-center border border-white/50">
        <div className="w-20 h-20 flex items-center justify-center mb-4">
          <Logo size="large" />
        </div>
        <h2 className="text-2xl font-extrabold text-[#0891b2] mb-1">Complete Your Profile</h2>
        <p className="mb-6 text-cyan-800 text-sm text-center">
          Please fill in your details to get started.
        </p>

        {/* Step indicator */}
        <div className="mb-6 flex w-full max-w-sm items-center justify-center gap-2">
          {[{ step: 1, label: "Identity" }, { step: 2, label: "Location" }, { step: 3, label: "Consent" }]
            .map(({ step, label }, index) => (
              <div key={step} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    currentStep > step ? "bg-cyan-600 text-white"
                    : currentStep === step ? "bg-[#0891b2] text-white"
                    : "bg-gray-100 text-gray-400 border border-gray-200"
                  }`}>
                    {currentStep > step ? <Check size={14} /> : step}
                  </div>
                  <span className={`text-xs font-medium ${currentStep === step ? "text-[#0891b2]" : "text-gray-400"}`}>
                    {label}
                  </span>
                </div>
                {index < 2 && (
                  <div className={`h-px w-12 mb-4 transition-all ${currentStep > step ? "bg-cyan-600" : "bg-gray-200"}`} />
                )}
              </div>
            ))}
        </div>

        {serverError && (
          <div className="w-full mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {serverError}
            <button onClick={() => window.location.href = PATIENT_PORTAL_URL} className="ml-2 underline font-medium">
              Back to login
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full">

          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#0891b2]">Step 1 of 3</p>
                <h3 className="text-lg font-semibold text-slate-900">Account & Credentials</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                  <input name="firstName" type="text" value={form.firstName} onChange={handleChange} placeholder="First"
                    className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-cyan-400 transition ${errors.firstName ? "border-red-400 bg-red-50" : "border-gray-300"}`} />
                  {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                  <input name="lastName" type="text" value={form.lastName} onChange={handleChange} placeholder="Last"
                    className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-cyan-400 transition ${errors.lastName ? "border-red-400 bg-red-50" : "border-gray-300"}`} />
                  {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth <span className="text-red-500">*</span></label>
                  <input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange}
                    max={new Date().toISOString().split("T")[0]}
                    className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-cyan-400 transition ${errors.dateOfBirth ? "border-red-400 bg-red-50" : "border-gray-300"}`} />
                  {errors.dateOfBirth && <p className="mt-1 text-xs text-red-500">{errors.dateOfBirth}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender at Birth <span className="text-red-500">*</span></label>
                  <select name="gender" value={form.gender} onChange={e => handleSelect("gender", e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-cyan-400 transition bg-white ${errors.gender ? "border-red-400 bg-red-50" : "border-gray-300"}`}>
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.gender && <p className="mt-1 text-xs text-red-500">{errors.gender}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} readOnly disabled
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed" />
                  <p className="mt-1 text-xs text-gray-400">From your Microsoft account.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number <span className="text-gray-400 text-xs">(optional)</span></label>
                  <input name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="+1 (555) 000-0000"
                    className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-cyan-400 transition ${errors.phone ? "border-red-400 bg-red-50" : "border-gray-300"}`} />
                  {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#0891b2]">Step 2 of 3</p>
                <h3 className="text-lg font-semibold text-slate-900">Location</h3>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address <span className="text-gray-400 text-xs">(optional)</span></label>
                <input name="address" type="text" value={form.address} onChange={handleChange} placeholder="Street Address"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-cyan-400 transition" />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City <span className="text-gray-400 text-xs">(optional)</span></label>
                  <input name="city" type="text" value={form.city} onChange={handleChange} placeholder="City"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-cyan-400 transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State <span className="text-red-500">*</span></label>
                  <select name="state" value={form.state} onChange={e => handleSelect("state", e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-cyan-400 transition bg-white ${errors.state ? "border-red-400 bg-red-50" : "border-gray-300"}`}>
                    <option value="">Select state</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {errors.state && <p className="mt-1 text-xs text-red-500">{errors.state}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code <span className="text-gray-400 text-xs">(optional)</span></label>
                  <input name="zip" type="text" value={form.zip} onChange={handleChange} placeholder="12345"
                    maxLength={5} inputMode="numeric"
                    className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-cyan-400 transition ${errors.zip ? "border-red-400 bg-red-50" : "border-gray-300"}`} />
                  {errors.zip && <p className="mt-1 text-xs text-red-500">{errors.zip}</p>}
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#0891b2]">Step 3 of 3</p>
                <h3 className="text-lg font-semibold text-slate-900">Security & Compliance</h3>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <input type="checkbox" id="agreeToTerms" checked={agreeToTerms}
                    onChange={e => { setAgreeToTerms(e.target.checked); setErrors(prev => ({ ...prev, consent: "" })); }}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-400 cursor-pointer" />
                  <label htmlFor="agreeToTerms" className="text-sm text-gray-700 cursor-pointer">
                    I agree to the{" "}
                    <button type="button" onClick={() => setIsTermsDialogOpen(true)}
                      className="font-medium text-[#0891b2] hover:underline">
                      Terms of Service and Privacy Policy
                    </button>. <span className="text-red-500">*</span>
                  </label>
                </div>
                <div className="flex items-start gap-3">
                  <input type="checkbox" id="consentToRecords" checked={consentToRecords}
                    onChange={e => { setConsentToRecords(e.target.checked); setErrors(prev => ({ ...prev, consent: "" })); }}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-400 cursor-pointer" />
                  <label htmlFor="consentToRecords" className="text-sm text-gray-700 cursor-pointer">
                    I consent to allow Seismic Care to retrieve my records from connected healthcare organizations.{" "}
                    <span className="text-red-500">*</span>
                  </label>
                </div>
                {errors.consent && <p className="text-xs text-red-500">{errors.consent}</p>}
              </div>
            </div>
          )}

          <div className={`mt-6 flex ${currentStep > 1 ? "justify-between" : "justify-end"}`}>
            {currentStep > 1 && (
              <button type="button" onClick={handleBack}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
                <ChevronLeft size={16} /> Back
              </button>
            )}
            {currentStep < 3 && (
              <button type="button" onClick={handleNext}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0891b2] hover:bg-[#0e7490] rounded-lg transition">
                Next <ChevronRight size={16} />
              </button>
            )}
            {currentStep === 3 && (
              <button type="submit" disabled={isSubmitting || !agreeToTerms || !consentToRecords}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0891b2] hover:bg-[#0e7490] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition">
                {isSubmitting
                  ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                  : <><HeartPulse size={16} /> Complete Secure Registration</>}
              </button>
            )}
          </div>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          © 2026 Seismic Health. All rights reserved.
        </div>
      </div>

      <TermsDialog open={isTermsDialogOpen} onOpenChange={setIsTermsDialogOpen} />

      <div className="absolute left-0 right-0 w-full pointer-events-none" style={{ zIndex: 5, bottom: "24px" }}>
        <svg height="80" width="100%" className="heartbeat-line opacity-50">
          <path d="M0,60 L30,60 L40,20 L50,70 L60,20 L70,70 L80,60 L100,60 L110,20 L120,70 L130,20 L140,70 L150,60 L180,60 L200,20 L220,70 L240,20 L260,70 L280,60 L300,60"
            fill="none" stroke="#06b6d4" strokeWidth="4" strokeDasharray="400" strokeDashoffset="400" />
        </svg>
        <style>{`
          .heartbeat-line path { animation: heartbeat 5s ease-in-out infinite; }
          @keyframes heartbeat { 0%{stroke-dashoffset:400} 50%{stroke-dashoffset:0} 100%{stroke-dashoffset:-400} }
          .animate-fadeIn { animation: fadeInUp 0.6s ease-out; }
          @keyframes fadeInUp { 0%{opacity:0;transform:translateY(10px)} 100%{opacity:1;transform:translateY(0)} }
        `}</style>
      </div>
    </div>
  );
}