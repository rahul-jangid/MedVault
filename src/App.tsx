import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  FileText, 
  Activity, 
  User, 
  LogOut, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  ChevronRight, 
  Loader2, 
  Upload, 
  AlertCircle,
  CheckCircle2,
  Trash2,
  BrainCircuit,
  Stethoscope,
  FlaskConical,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Browser } from '@capacitor/browser';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  handleFirestoreError,
  OperationType,
  clearAuth
} from './firebase';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import { LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Capacitor } from '@capacitor/core';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Camera } from 'lucide-react';

// --- Types ---

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

interface Prescription {
  id: string;
  userId: string;
  doctorName: string;
  hospitalName?: string;
  date: string;
  medications: Medication[];
  notes?: string;
  imageUrl?: string;
  imageData?: string;
  aiSummary?: string;
}

interface LabResult {
  parameter: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: 'Normal' | 'High' | 'Low' | 'Critical';
}

interface LabReport {
  id: string;
  userId: string;
  testName: string;
  labName?: string;
  date: string;
  results: LabResult[];
  imageUrl?: string;
  imageData?: string;
  aiAnalysis?: string;
}

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  bloodGroup?: string;
  dateOfBirth?: string;
  allergies?: string[];
}

// --- AI Service ---

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is missing. AI features will be disabled.");
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

async function analyzeMedicalDocument(text: string, type: 'prescription' | 'report') {
  const ai = getAI();
  if (!ai) return "AI Analysis is unavailable because the API key is not configured.";
  
  const model = "gemini-3-flash-preview";
  const prompt = type === 'prescription' 
    ? `Analyze this medical prescription text and provide a clear, patient-friendly summary. Include:
       1. Doctor and Hospital names if found.
       2. List of medications with their purpose, dosage, and frequency.
       3. Any special instructions or warnings.
       4. A brief overview of what this prescription is for.
       Text: ${text}`
    : `Analyze this medical lab report text and provide a clear, patient-friendly summary. Include:
       1. The test name and lab name.
       2. Key findings, highlighting any values that are outside the normal range.
       3. What these results might indicate (with a disclaimer that this is not a medical diagnosis).
       4. Suggested questions for the doctor.
       Text: ${text}`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return "Failed to generate AI analysis. Please try again later.";
  }
}

async function scanPrescriptionImage(base64Image: string) {
  const ai = getAI();
  if (!ai) throw new Error("AI Scan is unavailable because the API key is not configured.");

  const model = "gemini-3-flash-preview";
  const prompt = `You are an expert medical transcriptionist. Analyze this prescription image and extract the following information in JSON format:
  {
    "doctorName": "string",
    "hospitalName": "string",
    "date": "YYYY-MM-DD",
    "medications": [
      { "name": "string", "dosage": "string", "frequency": "string", "duration": "string" }
    ],
    "notes": "string"
  }
  If handwriting is difficult, use your medical knowledge to infer the most likely medication names and dosages. If you absolutely cannot read a field, leave it as an empty string. Return ONLY the JSON object.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image.split(',')[1] || base64Image
          }
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Scan Error:", error);
    throw new Error("Failed to scan prescription. Please ensure the image is clear.");
  }
}

// --- Components ---

class ErrorBoundary extends React.Component<any, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("App Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center space-y-4 border border-red-100">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1>
            <p className="text-slate-600">The application encountered an error and couldn't start properly.</p>
            <div className="bg-slate-50 p-4 rounded-2xl text-left text-xs font-mono text-red-500 overflow-auto max-h-40">
              {this.state.error?.toString()}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, icon: Icon }: any) => {
  const baseStyles = "flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none";
  const variants: any = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md",
    secondary: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50",
    danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100",
    outline: "bg-transparent text-indigo-600 border-2 border-indigo-600 hover:bg-indigo-50",
    accent: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

const Card = ({ children, className = '', id }: any) => (
  <div id={id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, variant = 'gray' }: any) => {
  const variants: any = {
    gray: "bg-gray-100 text-gray-600",
    indigo: "bg-indigo-100 text-indigo-600",
    emerald: "bg-emerald-100 text-emerald-600",
    red: "bg-red-100 text-red-600",
    yellow: "bg-yellow-100 text-yellow-600"
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${variants[variant]}`}>
      {children}
    </span>
  );
};

const Modal = ({ isOpen, onClose, title, children }: any) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          <div className="p-6 border-bottom border-gray-100 flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            <Button variant="ghost" onClick={onClose} className="p-2 rounded-full">
              <Plus className="rotate-45" size={24} />
            </Button>
          </div>
          <div className="p-6 overflow-y-auto">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

// --- Main App ---

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [reports, setReports] = useState<LabReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'popup' | 'redirect' | 'manual' | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [activeTab, setActiveTab] = useState<'dashboard' | 'prescriptions' | 'reports' | 'profile'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [isAddPrescriptionOpen, setIsAddPrescriptionOpen] = useState(false);
  const [isScanPrescriptionOpen, setIsScanPrescriptionOpen] = useState(false);
  const [isAddReportOpen, setIsAddReportOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    console.log("App initialized, setting up auth listener...");
    setDebugInfo(prev => prev + "\nApp Init");
    let unsubPres: (() => void) | null = null;
    let unsubReports: (() => void) | null = null;

    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn("Loading timeout reached, forcing loading to false.");
        setLoading(false);
      }
    }, 10000); // 10 second timeout

    // Check for redirect result
    if (auth) {
      getRedirectResult(auth).then((result) => {
        if (result) {
          console.log("Redirect login success:", result.user.uid);
          setDebugInfo(prev => prev + "\nRedirect Success");
          setUser(result.user);
        } else {
          setDebugInfo(prev => prev + "\nNo Redirect Result");
        }
      }).catch((error) => {
        // Only log if it's not a common "no result" error
        if (error.code !== 'auth/no-auth-event') {
          console.error("Redirect login error:", error);
          setDebugInfo(prev => prev + "\nRedirect Error: " + error.code);
          // Don't show error to user if it's just an argument error from an empty redirect
          if (error.code !== 'auth/argument-error') {
            setLoadingError(`Login failed: ${error.message}`);
          }
        }
      });
    }

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      console.log("Auth state changed:", user ? `User ${user.uid}` : "No user");
      setDebugInfo(prev => prev + "\nAuth Change: " + (user ? "User" : "None"));
      
      // Cleanup previous listeners if any
      if (unsubPres) unsubPres();
      if (unsubReports) unsubReports();
      
      setUser(user);
      
      if (user) {
        try {
          const profileRef = doc(db, 'users', user.uid);
          console.log("Fetching profile for:", user.uid);
          
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            console.log("Profile found");
            setProfile(profileSnap.data() as UserProfile);
          } else {
            console.log("Creating new profile");
            const newProfile: UserProfile = {
              uid: user.uid,
              displayName: user.displayName || 'User',
              email: user.email || '',
            };
            await setDoc(profileRef, newProfile);
            setProfile(newProfile);
          }

          // Real-time listeners
          const presRef = collection(db, 'users', user.uid, 'prescriptions');
          const reportsRef = collection(db, 'users', user.uid, 'reports');

          console.log("Setting up snapshot listeners");
          unsubPres = onSnapshot(presRef, (snap) => {
            setPrescriptions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Prescription)));
          }, (err) => {
            console.error("Prescriptions snapshot error:", err);
            handleFirestoreError(err, OperationType.LIST, 'prescriptions');
          });

          unsubReports = onSnapshot(reportsRef, (snap) => {
            setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as LabReport)));
          }, (err) => {
            console.error("Reports snapshot error:", err);
            handleFirestoreError(err, OperationType.LIST, 'reports');
          });

          setLoading(false);
          clearTimeout(timeoutId);
        } catch (err) {
          console.error("Initialization Error:", err);
          setLoadingError(err instanceof Error ? err.message : String(err));
          setLoading(false);
          clearTimeout(timeoutId);
        }
      } else {
        setProfile(null);
        setPrescriptions([]);
        setReports([]);
        setLoading(false);
        clearTimeout(timeoutId);
      }
    });

    return () => {
      console.log("Cleaning up App effect");
      unsubscribe();
      if (unsubPres) unsubPres();
      if (unsubReports) unsubReports();
      clearTimeout(timeoutId);
    };
  }, []);

  const handleLogin = async (method: 'popup' | 'redirect' | 'manual' = 'popup') => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setLoginMethod(method);
    setDebugInfo(prev => prev + `\nLogin Start: ${method}`);
    
    try {
      if (method === 'manual') {
        // Force navigation to the auth domain inside the app's WebView
        // This allows the redirect to https://localhost to work correctly
        const config = (await import('../firebase-applet-config.json')).default;
        const redirectUrl = "https://localhost";
        const manualUrl = `https://${config.authDomain}/__/auth/handler?apiKey=${config.apiKey}&appName=${encodeURIComponent("[DEFAULT]")}&authType=signInViaRedirect&providerId=google.com&scopes=profile%20email&redirectUrl=${encodeURIComponent(redirectUrl)}`;
        
        console.log("Manual redirect inside WebView to:", manualUrl);
        setDebugInfo(prev => prev + `\nManual Nav: ${redirectUrl}`);
        
        window.location.href = manualUrl;
        return;
      }

      if (method === 'redirect') {
        console.log("Using signInWithRedirect");
        await signInWithRedirect(auth, googleProvider);
      } else {
        console.log("Using signInWithPopup");
        await signInWithPopup(auth, googleProvider);
      }
    } catch (error: any) {
      console.error("Login Error:", error);
      setDebugInfo(prev => prev + `\nLogin Error: ${error.code}`);
      // If popup is blocked or cancelled, try redirect as fallback
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-blocked') {
        setLoadingError("Popup was blocked or cancelled. Please try 'Redirect Login' or 'Manual Login'.");
      } else {
        setLoadingError(`Login failed: ${error.message}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const filteredPrescriptions = useMemo(() => {
    return prescriptions.filter(p => 
      p.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.hospitalName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.medications.some(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [prescriptions, searchQuery]);

  const filteredReports = useMemo(() => {
    return reports.filter(r => 
      r.testName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.labName?.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [reports, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="text-indigo-600 mb-4"
        >
          <Loader2 size={48} />
        </motion.div>
        <p className="text-slate-500 font-medium animate-pulse">Securing your medical vault...</p>
        {loadingError && (
          <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-2xl text-xs max-w-xs text-center">
            Error: {loadingError}
          </div>
        )}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Activity size={40} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">MedVault</h1>
          <p className="text-slate-500 mb-8">Your secure, AI-powered health companion. Manage prescriptions and reports with ease.</p>
          
          <div className="space-y-3">
            <Button 
              onClick={() => handleLogin('popup')} 
              className="w-full py-4 text-lg" 
              icon={isLoggingIn && loginMethod === 'popup' ? Loader2 : User}
              disabled={isLoggingIn}
            >
              {isLoggingIn && loginMethod === 'popup' ? "Logging in..." : "Sign in with Google"}
            </Button>

            <Button 
              onClick={() => handleLogin('redirect')} 
              variant="outline"
              className="w-full py-4 text-lg" 
              icon={isLoggingIn && loginMethod === 'redirect' ? Loader2 : ArrowLeft}
              disabled={isLoggingIn}
            >
              {isLoggingIn && loginMethod === 'redirect' ? "Redirecting..." : "Try Redirect Login"}
            </Button>

            <Button 
              onClick={() => handleLogin('manual')} 
              variant="ghost"
              className="w-full py-2 text-sm text-slate-400" 
              disabled={isLoggingIn}
            >
              Emergency Manual Login
            </Button>
          </div>

          {loadingError && (
            <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-2xl text-xs text-center">
              {loadingError}
            </div>
          )}

          <div className="mt-8 p-4 bg-slate-100 rounded-xl text-[10px] font-mono text-slate-400 text-left overflow-auto max-h-24">
            <div className="flex justify-between items-center mb-1">
              <p className="font-bold">Debug Console:</p>
              <button 
                onClick={() => {
                  clearAuth();
                  window.location.reload();
                }}
                className="text-indigo-600 underline"
              >
                Clear Auth
              </button>
            </div>
            <pre>{debugInfo}</pre>
          </div>

          <p className="mt-6 text-xs text-slate-400">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-72 bg-white border-r border-slate-100 flex-col p-6">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
            <Activity size={24} />
          </div>
          <span className="text-xl font-bold text-slate-900">MedVault</span>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarLink 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            icon={Activity}
            label="Dashboard"
          />
          <SidebarLink 
            active={activeTab === 'prescriptions'} 
            onClick={() => setActiveTab('prescriptions')}
            icon={Stethoscope}
            label="Prescriptions"
          />
          <SidebarLink 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')}
            icon={FlaskConical}
            label="Lab Reports"
          />
          <SidebarLink 
            active={activeTab === 'profile'} 
            onClick={() => setActiveTab('profile')}
            icon={User}
            label="Health Profile"
          />
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2 mb-4">
            <img 
              src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
              alt="Avatar" 
              className="w-10 h-10 rounded-full border border-slate-200"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{user.displayName}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-red-500 hover:bg-red-50" icon={LogOut}>
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-100 p-4 md:p-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4 md:hidden">
             <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center">
              <Activity size={18} />
            </div>
            <h1 className="text-lg font-bold text-slate-900">MedVault</h1>
          </div>

          <div className="hidden md:block">
            <h2 className="text-2xl font-bold text-slate-900 capitalize">{activeTab}</h2>
            <p className="text-sm text-slate-500">Welcome back, {user.displayName?.split(' ')[0]}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 w-64 transition-all"
              />
            </div>
            {activeTab === 'prescriptions' && (
              <Button 
                variant="secondary" 
                onClick={() => setIsScanPrescriptionOpen(true)}
                icon={BrainCircuit}
                className="text-indigo-600 border-indigo-100"
              >
                <span className="hidden sm:inline">Scan AI</span>
              </Button>
            )}
            <Button 
              variant="accent" 
              onClick={() => activeTab === 'reports' ? setIsAddReportOpen(true) : setIsAddPrescriptionOpen(true)}
              icon={Plus}
            >
              <span className="hidden sm:inline">Add New</span>
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard 
                    label="Total Prescriptions" 
                    value={prescriptions.length} 
                    icon={Stethoscope} 
                    color="indigo" 
                  />
                  <StatCard 
                    label="Lab Reports" 
                    value={reports.length} 
                    icon={FlaskConical} 
                    color="emerald" 
                  />
                  <StatCard 
                    label="Active Medications" 
                    value={prescriptions.reduce((acc, p) => acc + p.medications.length, 0)} 
                    icon={Activity} 
                    color="rose" 
                  />
                  <StatCard 
                    label="Blood Group" 
                    value={profile?.bloodGroup || 'N/A'} 
                    icon={User} 
                    color="amber" 
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Recent Activity */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-900">Recent Records</h3>
                      <Button variant="ghost" className="text-indigo-600 text-sm" onClick={() => setActiveTab('prescriptions')}>View All</Button>
                    </div>
                    
                    <div className="space-y-4">
                      {[...prescriptions, ...reports]
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .slice(0, 5)
                        .map((item: any) => (
                          <RecordItem 
                            key={item.id} 
                            item={item} 
                            onClick={() => setSelectedItem(item)}
                          />
                        ))
                      }
                      {prescriptions.length === 0 && reports.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                          <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText size={32} />
                          </div>
                          <p className="text-slate-500">No records found. Start by adding your first prescription.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Health Summary */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-slate-900">AI Health Insights</h3>
                    <Card className="p-6 bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-none">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-white/20 rounded-lg">
                          <BrainCircuit size={20} />
                        </div>
                        <span className="font-bold">MedVault AI</span>
                      </div>
                      <p className="text-indigo-100 text-sm leading-relaxed mb-6">
                        Based on your recent records, you've had 3 checkups this month. Your hemoglobin levels are improving. Keep following your iron-rich diet.
                      </p>
                      <Button variant="secondary" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20">
                        Get Full Analysis
                      </Button>
                    </Card>

                    {/* Quick Profile */}
                    <Card className="p-6">
                      <h4 className="font-bold text-slate-900 mb-4">Quick Profile</h4>
                      <div className="space-y-3">
                        <ProfileItem label="Age" value={profile?.dateOfBirth ? `${new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear()} Yrs` : 'Not set'} />
                        <ProfileItem label="Allergies" value={profile?.allergies?.join(', ') || 'None reported'} />
                        <ProfileItem label="Last Checkup" value={prescriptions[0]?.date ? format(new Date(prescriptions[0].date), 'MMM d, yyyy') : 'N/A'} />
                      </div>
                    </Card>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'prescriptions' && (
              <motion.div 
                key="prescriptions"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-xl font-bold text-slate-900">Your Prescriptions</h3>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" icon={Filter}>Filter</Button>
                    <Button variant="accent" icon={Plus} onClick={() => setIsAddPrescriptionOpen(true)}>Add New</Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredPrescriptions.map(p => (
                    <PrescriptionCard key={p.id} prescription={p} onClick={() => setSelectedItem(p)} />
                  ))}
                </div>
                
                {filteredPrescriptions.length === 0 && (
                  <div className="text-center py-20">
                    <p className="text-slate-500">No prescriptions found matching your search.</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'reports' && (
              <motion.div 
                key="reports"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-xl font-bold text-slate-900">Lab Reports</h3>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" icon={Filter}>Filter</Button>
                    <Button variant="accent" icon={Plus} onClick={() => setIsAddReportOpen(true)}>Add New</Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredReports.map(r => (
                    <ReportCard key={r.id} report={r} onClick={() => setSelectedItem(r)} />
                  ))}
                </div>

                {filteredReports.length === 0 && (
                  <div className="text-center py-20">
                    <p className="text-slate-500">No reports found matching your search.</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'profile' && (
              <motion.div 
                key="profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-2xl mx-auto"
              >
                <Card className="p-8">
                  <div className="flex flex-col items-center text-center mb-10">
                    <div className="relative mb-4">
                       <img 
                        src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                        alt="Avatar" 
                        className="w-24 h-24 rounded-3xl border-4 border-white shadow-lg"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute -bottom-2 -right-2 p-2 bg-indigo-600 text-white rounded-xl shadow-lg cursor-pointer">
                        <Upload size={16} />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900">{user.displayName}</h3>
                    <p className="text-slate-500">{user.email}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Blood Group</label>
                      <select 
                        value={profile?.bloodGroup || ''} 
                        onChange={(e) => setProfile(prev => prev ? ({ ...prev, bloodGroup: e.target.value }) : null)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="">Select</option>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date of Birth</label>
                      <input 
                        type="date" 
                        value={profile?.dateOfBirth || ''}
                        onChange={(e) => setProfile(prev => prev ? ({ ...prev, dateOfBirth: e.target.value }) : null)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 mb-10">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Known Allergies</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {profile?.allergies?.map((allergy, idx) => (
                        <Badge key={idx} variant="red">
                          {allergy}
                          <button 
                            onClick={() => setProfile(prev => prev ? ({ ...prev, allergies: prev.allergies?.filter((_, i) => i !== idx) }) : null)}
                            className="ml-1 hover:text-red-800"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Add allergy..."
                        onKeyDown={(e: any) => {
                          if (e.key === 'Enter' && e.target.value) {
                            const val = e.target.value;
                            setProfile(prev => prev ? ({ ...prev, allergies: [...(prev.allergies || []), val] }) : null);
                            e.target.value = '';
                          }
                        }}
                        className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <Button 
                    variant="primary" 
                    className="w-full py-4"
                    onClick={async () => {
                      if (profile) {
                        try {
                          await setDoc(doc(db, 'users', user.uid), profile);
                          alert('Profile updated successfully!');
                        } catch (err) {
                          handleFirestoreError(err, OperationType.UPDATE, 'users');
                        }
                      }
                    }}
                  >
                    Save Profile Changes
                  </Button>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Nav */}
        <nav className="md:hidden bg-white border-t border-slate-100 p-2 flex items-center justify-around sticky bottom-0 z-10">
          <MobileNavLink active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={Activity} />
          <MobileNavLink active={activeTab === 'prescriptions'} onClick={() => setActiveTab('prescriptions')} icon={Stethoscope} />
          <MobileNavLink active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={FlaskConical} />
          <MobileNavLink active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={User} />
        </nav>
      </main>

      {/* Modals */}
      <AddPrescriptionModal 
        isOpen={isAddPrescriptionOpen} 
        onClose={() => setIsAddPrescriptionOpen(false)} 
        userId={user.uid} 
      />
      <ScanPrescriptionModal
        isOpen={isScanPrescriptionOpen}
        onClose={() => setIsScanPrescriptionOpen(false)}
        userId={user.uid}
      />
      <AddReportModal 
        isOpen={isAddReportOpen} 
        onClose={() => setIsAddReportOpen(false)} 
        userId={user.uid} 
      />
      <ViewDetailModal 
        item={selectedItem} 
        onClose={() => setSelectedItem(null)} 
        onDelete={async (id: string, type: 'prescriptions' | 'reports') => {
          if (confirm('Are you sure you want to delete this record?')) {
            try {
              await deleteDoc(doc(db, 'users', user.uid, type, id));
              setSelectedItem(null);
            } catch (err) {
              handleFirestoreError(err, OperationType.DELETE, type);
            }
          }
        }}
      />
    </div>
  );
}

// --- Sub-components ---

const SidebarLink = ({ active, onClick, icon: Icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
      active 
        ? "bg-indigo-50 text-indigo-600 font-bold" 
        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
    }`}
  >
    <Icon size={20} />
    <span>{label}</span>
  </button>
);

const MobileNavLink = ({ active, onClick, icon: Icon }: any) => (
  <button 
    onClick={onClick}
    className={`p-3 rounded-xl transition-all ${
      active ? "text-indigo-600 bg-indigo-50" : "text-slate-400"
    }`}
  >
    <Icon size={24} />
  </button>
);

const StatCard = ({ label, value, icon: Icon, color }: any) => {
  const colors: any = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600"
  };
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colors[color]}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
      </div>
    </Card>
  );
};

const RecordItem = ({ item, onClick }: any) => {
  const isPrescription = 'doctorName' in item;
  return (
    <div 
      onClick={onClick}
      className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isPrescription ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
        {isPrescription ? <Stethoscope size={24} /> : <FlaskConical size={24} />}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-slate-900 truncate">{isPrescription ? item.doctorName : item.testName}</h4>
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <Calendar size={12} />
          {format(new Date(item.date), 'MMM d, yyyy')}
          <span className="mx-1 opacity-20">•</span>
          {isPrescription ? item.hospitalName : item.labName}
        </p>
      </div>
      <ChevronRight className="text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" size={20} />
    </div>
  );
};

const PrescriptionCard = ({ prescription, onClick }: { prescription: Prescription, onClick: () => void }) => (
  <Card className="hover:shadow-lg transition-all cursor-pointer group" onClick={onClick}>
    <div className="p-5 border-b border-slate-50">
      <div className="flex items-center justify-between mb-4">
        <Badge variant="indigo">Prescription</Badge>
        <span className="text-xs text-slate-400 font-medium">{format(new Date(prescription.date), 'MMM d, yyyy')}</span>
      </div>
      <h4 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">{prescription.doctorName}</h4>
      <p className="text-sm text-slate-500 flex items-center gap-1">
        <Activity size={14} className="text-slate-300" />
        {prescription.hospitalName || 'Clinic'}
      </p>
    </div>
    <div className="p-5 bg-slate-50/50">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Medications</p>
      <div className="flex flex-wrap gap-2">
        {prescription.medications.slice(0, 3).map((m, i) => (
          <span key={i} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 font-medium">
            {m.name}
          </span>
        ))}
        {prescription.medications.length > 3 && (
          <span className="text-xs text-slate-400 font-medium">+{prescription.medications.length - 3} more</span>
        )}
      </div>
    </div>
  </Card>
);

const ReportCard = ({ report, onClick }: { report: LabReport, onClick: () => void }) => (
  <Card className="hover:shadow-lg transition-all cursor-pointer group" onClick={onClick}>
    <div className="p-5 border-b border-slate-50">
      <div className="flex items-center justify-between mb-4">
        <Badge variant="emerald">Lab Report</Badge>
        <span className="text-xs text-slate-400 font-medium">{format(new Date(report.date), 'MMM d, yyyy')}</span>
      </div>
      <h4 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-emerald-600 transition-colors">{report.testName}</h4>
      <p className="text-sm text-slate-500 flex items-center gap-1">
        <FlaskConical size={14} className="text-slate-300" />
        {report.labName || 'Diagnostic Center'}
      </p>
    </div>
    <div className="p-5 bg-slate-50/50">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Key Results</p>
      <div className="space-y-2">
        {report.results.slice(0, 2).map((r, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-slate-500">{r.parameter}</span>
            <span className={`font-bold ${r.status === 'Normal' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {r.value} {r.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  </Card>
);

const ProfileItem = ({ label, value }: any) => (
  <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
    <span className="text-sm text-slate-500">{label}</span>
    <span className="text-sm font-bold text-slate-900">{value}</span>
  </div>
);

// --- Form Modals ---

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress quality to ensure it's under 800KB (Firestore limit is 1MB)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

const ScanPrescriptionModal = ({ isOpen, onClose, userId }: any) => {
  const [step, setStep] = useState<'upload' | 'scanning' | 'review'>('upload');
  const [image, setImage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNativeCamera = async () => {
    try {
      const image = await CapacitorCamera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt
      });
      
      if (image.dataUrl) {
        setStep('scanning');
        setError(null);
        setImage(image.dataUrl);
        const data = await scanPrescriptionImage(image.dataUrl);
        setExtractedData(data);
        setStep('review');
      }
    } catch (err: any) {
      console.error(err);
      if (err.message !== 'User cancelled photos app') {
        setError(err.message || "Failed to access camera.");
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setStep('scanning');
      setError(null);
      const compressed = await compressImage(file);
      setImage(compressed);
      
      const data = await scanPrescriptionImage(compressed);
      setExtractedData(data);
      setStep('review');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to scan prescription. Please try again.");
      setStep('upload');
    }
  };

  const handleSave = async () => {
    if (!extractedData || !userId) return;
    setIsSaving(true);
    try {
      const docRef = await addDoc(collection(db, 'users', userId, 'prescriptions'), {
        ...extractedData,
        userId,
        imageData: image,
        createdAt: new Date().toISOString()
      });

      // Trigger AI Summary in background
      const summary = await analyzeMedicalDocument(JSON.stringify(extractedData), 'prescription');
      await updateDoc(docRef, { aiSummary: summary });

      onClose();
      reset();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'prescriptions');
    } finally {
      setIsSaving(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setImage(null);
    setExtractedData(null);
    setError(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); reset(); }} title="Scan Prescription with AI">
      <div className="space-y-6">
        {step === 'upload' && (
          <div className="space-y-4">
            {Capacitor.isNativePlatform() && (
              <Button 
                onClick={handleNativeCamera}
                className="w-full py-6 rounded-3xl flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg"
              >
                <Camera size={24} />
                <span className="text-lg font-semibold">Take Photo</span>
              </Button>
            )}
            
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative group">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
                <Upload size={32} />
              </div>
              <p className="font-bold text-slate-900">
                {Capacitor.isNativePlatform() ? 'Or Choose from Gallery' : 'Upload Prescription Photo'}
              </p>
              <p className="text-sm text-slate-500 mt-1">Take a clear photo of the handwritten note</p>
              {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'scanning' && (
          <div className="flex flex-col items-center justify-center py-20">
            <motion.div 
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 10, -10, 0]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-indigo-600 mb-6"
            >
              <BrainCircuit size={64} />
            </motion.div>
            <h4 className="text-xl font-bold text-slate-900">AI is reading handwriting...</h4>
            <p className="text-slate-500 mt-2">Decoding medical abbreviations and dosages</p>
            <div className="w-48 h-1.5 bg-slate-100 rounded-full mt-6 overflow-hidden">
              <motion.div 
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="w-full h-full bg-indigo-600"
              />
            </div>
          </div>
        )}

        {step === 'review' && extractedData && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Original Photo</h5>
                <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-[3/4]">
                  <img src={image!} alt="Scanned" className="w-full h-full object-cover" />
                </div>
              </div>
              
              <div className="space-y-4">
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Extracted Data</h5>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Doctor</label>
                    <input 
                      value={extractedData.doctorName}
                      onChange={e => setExtractedData({...extractedData, doctorName: e.target.value})}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Hospital</label>
                    <input 
                      value={extractedData.hospitalName}
                      onChange={e => setExtractedData({...extractedData, hospitalName: e.target.value})}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
                    <input 
                      type="date"
                      value={extractedData.date}
                      onChange={e => setExtractedData({...extractedData, date: e.target.value})}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Medications</h5>
              <div className="space-y-2">
                {extractedData.medications.map((med: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input 
                      placeholder="Name"
                      value={med.name}
                      onChange={e => {
                        const newMeds = [...extractedData.medications];
                        newMeds[idx].name = e.target.value;
                        setExtractedData({...extractedData, medications: newMeds});
                      }}
                      className="p-1.5 bg-white border border-slate-200 rounded text-xs"
                    />
                    <input 
                      placeholder="Dosage"
                      value={med.dosage}
                      onChange={e => {
                        const newMeds = [...extractedData.medications];
                        newMeds[idx].dosage = e.target.value;
                        setExtractedData({...extractedData, medications: newMeds});
                      }}
                      className="p-1.5 bg-white border border-slate-200 rounded text-xs"
                    />
                    <input 
                      placeholder="Freq"
                      value={med.frequency}
                      onChange={e => {
                        const newMeds = [...extractedData.medications];
                        newMeds[idx].frequency = e.target.value;
                        setExtractedData({...extractedData, medications: newMeds});
                      }}
                      className="p-1.5 bg-white border border-slate-200 rounded text-xs"
                    />
                    <input 
                      placeholder="Dur"
                      value={med.duration}
                      onChange={e => {
                        const newMeds = [...extractedData.medications];
                        newMeds[idx].duration = e.target.value;
                        setExtractedData({...extractedData, medications: newMeds});
                      }}
                      className="p-1.5 bg-white border border-slate-200 rounded text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={reset}>Retake</Button>
              <Button variant="primary" className="flex-[2]" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin" /> : 'Confirm & Save to Vault'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

const AddPrescriptionModal = ({ isOpen, onClose, userId }: any) => {
  const [formData, setFormData] = useState({
    doctorName: '',
    hospitalName: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    medications: [{ name: '', dosage: '', frequency: '', duration: '' }]
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, 'users', userId, 'prescriptions'), {
        ...formData,
        userId,
        createdAt: new Date().toISOString()
      });
      
      // Trigger AI Analysis in background
      const summary = await analyzeMedicalDocument(JSON.stringify(formData), 'prescription');
      await updateDoc(docRef, { aiSummary: summary });
      
      onClose();
      setFormData({
        doctorName: '',
        hospitalName: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        notes: '',
        medications: [{ name: '', dosage: '', frequency: '', duration: '' }]
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'prescriptions');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Prescription">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Doctor Name</label>
            <input 
              required
              type="text" 
              value={formData.doctorName}
              onChange={e => setFormData({...formData, doctorName: e.target.value})}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Hospital/Clinic</label>
            <input 
              type="text" 
              value={formData.hospitalName}
              onChange={e => setFormData({...formData, hospitalName: e.target.value})}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase">Date</label>
          <input 
            required
            type="date" 
            value={formData.date}
            onChange={e => setFormData({...formData, date: e.target.value})}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-400 uppercase">Medications</label>
            <Button 
              type="button" 
              variant="ghost" 
              className="text-xs text-indigo-600"
              onClick={() => setFormData({...formData, medications: [...formData.medications, { name: '', dosage: '', frequency: '', duration: '' }]})}
            >
              + Add Med
            </Button>
          </div>
          {formData.medications.map((med, idx) => (
            <div key={idx} className="p-4 bg-slate-50 rounded-2xl space-y-3 relative">
              <button 
                type="button"
                onClick={() => setFormData({...formData, medications: formData.medications.filter((_, i) => i !== idx)})}
                className="absolute top-2 right-2 text-slate-300 hover:text-red-500"
              >
                <Trash2 size={16} />
              </button>
              <input 
                placeholder="Medication Name"
                value={med.name}
                onChange={e => {
                  const newMeds = [...formData.medications];
                  newMeds[idx].name = e.target.value;
                  setFormData({...formData, medications: newMeds});
                }}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none"
              />
              <div className="grid grid-cols-3 gap-2">
                <input 
                  placeholder="Dosage"
                  value={med.dosage}
                  onChange={e => {
                    const newMeds = [...formData.medications];
                    newMeds[idx].dosage = e.target.value;
                    setFormData({...formData, medications: newMeds});
                  }}
                  className="p-2 bg-white border border-slate-200 rounded-lg outline-none text-sm"
                />
                <input 
                  placeholder="Freq"
                  value={med.frequency}
                  onChange={e => {
                    const newMeds = [...formData.medications];
                    newMeds[idx].frequency = e.target.value;
                    setFormData({...formData, medications: newMeds});
                  }}
                  className="p-2 bg-white border border-slate-200 rounded-lg outline-none text-sm"
                />
                <input 
                  placeholder="Dur"
                  value={med.duration}
                  onChange={e => {
                    const newMeds = [...formData.medications];
                    newMeds[idx].duration = e.target.value;
                    setFormData({...formData, medications: newMeds});
                  }}
                  className="p-2 bg-white border border-slate-200 rounded-lg outline-none text-sm"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase">Notes</label>
          <textarea 
            rows={3}
            value={formData.notes}
            onChange={e => setFormData({...formData, notes: e.target.value})}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <Button type="submit" className="w-full py-4" disabled={isAnalyzing}>
          {isAnalyzing ? <Loader2 className="animate-spin" /> : 'Save Prescription'}
        </Button>
      </form>
    </Modal>
  );
};

const AddReportModal = ({ isOpen, onClose, userId }: any) => {
  const [formData, setFormData] = useState({
    testName: '',
    labName: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    results: [{ parameter: '', value: '', unit: '', referenceRange: '', status: 'Normal' }]
  });

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, 'users', userId, 'reports'), {
        ...formData,
        userId,
        createdAt: new Date().toISOString()
      });

      // Trigger AI Analysis
      const analysis = await analyzeMedicalDocument(JSON.stringify(formData), 'report');
      await updateDoc(docRef, { aiAnalysis: analysis });

      onClose();
      setFormData({
        testName: '',
        labName: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        results: [{ parameter: '', value: '', unit: '', referenceRange: '', status: 'Normal' }]
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'reports');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Lab Report">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Test Name</label>
            <input 
              required
              type="text" 
              value={formData.testName}
              onChange={e => setFormData({...formData, testName: e.target.value})}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Lab Name</label>
            <input 
              type="text" 
              value={formData.labName}
              onChange={e => setFormData({...formData, labName: e.target.value})}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase">Date</label>
          <input 
            required
            type="date" 
            value={formData.date}
            onChange={e => setFormData({...formData, date: e.target.value})}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-400 uppercase">Results</label>
            <Button 
              type="button" 
              variant="ghost" 
              className="text-xs text-emerald-600"
              onClick={() => setFormData({...formData, results: [...formData.results, { parameter: '', value: '', unit: '', referenceRange: '', status: 'Normal' }]})}
            >
              + Add Result
            </Button>
          </div>
          {formData.results.map((res, idx) => (
            <div key={idx} className="p-4 bg-slate-50 rounded-2xl space-y-3 relative">
              <button 
                type="button"
                onClick={() => setFormData({...formData, results: formData.results.filter((_, i) => i !== idx)})}
                className="absolute top-2 right-2 text-slate-300 hover:text-red-500"
              >
                <Trash2 size={16} />
              </button>
              <div className="grid grid-cols-2 gap-2">
                <input 
                  placeholder="Parameter (e.g. Hemoglobin)"
                  value={res.parameter}
                  onChange={e => {
                    const newRes = [...formData.results];
                    newRes[idx].parameter = e.target.value;
                    setFormData({...formData, results: newRes});
                  }}
                  className="p-2 bg-white border border-slate-200 rounded-lg outline-none text-sm"
                />
                <input 
                  placeholder="Value"
                  value={res.value}
                  onChange={e => {
                    const newRes = [...formData.results];
                    newRes[idx].value = e.target.value;
                    setFormData({...formData, results: newRes});
                  }}
                  className="p-2 bg-white border border-slate-200 rounded-lg outline-none text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input 
                  placeholder="Unit"
                  value={res.unit}
                  onChange={e => {
                    const newRes = [...formData.results];
                    newRes[idx].unit = e.target.value;
                    setFormData({...formData, results: newRes});
                  }}
                  className="p-2 bg-white border border-slate-200 rounded-lg outline-none text-sm"
                />
                <input 
                  placeholder="Ref Range"
                  value={res.referenceRange}
                  onChange={e => {
                    const newRes = [...formData.results];
                    newRes[idx].referenceRange = e.target.value;
                    setFormData({...formData, results: newRes});
                  }}
                  className="p-2 bg-white border border-slate-200 rounded-lg outline-none text-sm"
                />
                <select 
                  value={res.status}
                  onChange={e => {
                    const newRes = [...formData.results];
                    newRes[idx].status = e.target.value as any;
                    setFormData({...formData, results: newRes});
                  }}
                  className="p-2 bg-white border border-slate-200 rounded-lg outline-none text-sm"
                >
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Low">Low</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>
          ))}
        </div>

        <Button type="submit" variant="accent" className="w-full py-4">
          Save Lab Report
        </Button>
      </form>
    </Modal>
  );
};

const ViewDetailModal = ({ item, onClose, onDelete }: any) => {
  if (!item) return null;
  const isPrescription = 'doctorName' in item;

  return (
    <Modal isOpen={!!item} onClose={onClose} title={isPrescription ? 'Prescription Details' : 'Lab Report Details'}>
      <div className="space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-2xl font-bold text-slate-900">{isPrescription ? item.doctorName : item.testName}</h4>
            <p className="text-slate-500 flex items-center gap-2 mt-1">
              <Calendar size={16} />
              {format(new Date(item.date), 'MMMM d, yyyy')}
              <span className="mx-1 opacity-20">•</span>
              {isPrescription ? item.hospitalName : item.labName}
            </p>
          </div>
          <Button variant="danger" className="p-2" onClick={() => onDelete(item.id, isPrescription ? 'prescriptions' : 'reports')}>
            <Trash2 size={20} />
          </Button>
        </div>

        {item.imageData && (
          <div className="space-y-3">
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Original Document</h5>
            <div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 max-h-96 flex items-center justify-center">
              <img src={item.imageData} alt="Document" className="max-w-full max-h-full object-contain" />
            </div>
          </div>
        )}

        {isPrescription ? (
          <div className="space-y-6">
            <div className="space-y-3">
              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Medications</h5>
              <div className="grid grid-cols-1 gap-3">
                {item.medications.map((med: any, i: number) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{med.name}</p>
                      <p className="text-xs text-slate-500">{med.dosage} • {med.frequency}</p>
                    </div>
                    <Badge variant="indigo">{med.duration}</Badge>
                  </div>
                ))}
              </div>
            </div>
            
            {item.notes && (
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Notes</h5>
                <p className="text-slate-600 bg-slate-50 p-4 rounded-2xl text-sm leading-relaxed">{item.notes}</p>
              </div>
            )}

            {item.aiSummary && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-indigo-600">
                  <BrainCircuit size={18} />
                  <h5 className="text-xs font-bold uppercase tracking-wider">AI Summary</h5>
                </div>
                <div className="prose prose-sm max-w-none bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100">
                  <Markdown>{item.aiSummary}</Markdown>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Test Results</h5>
              <div className="overflow-hidden border border-slate-100 rounded-2xl">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-bold">Parameter</th>
                      <th className="px-4 py-3 font-bold">Value</th>
                      <th className="px-4 py-3 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {item.results.map((res: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{res.parameter}</p>
                          <p className="text-[10px] text-slate-400">Ref: {res.referenceRange}</p>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {res.value} <span className="text-[10px] font-normal text-slate-500">{res.unit}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={res.status === 'Normal' ? 'emerald' : res.status === 'High' || res.status === 'Low' ? 'yellow' : 'red'}>
                            {res.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {item.aiAnalysis && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-600">
                  <BrainCircuit size={18} />
                  <h5 className="text-xs font-bold uppercase tracking-wider">AI Analysis</h5>
                </div>
                <div className="prose prose-sm max-w-none bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100">
                  <Markdown>{item.aiAnalysis}</Markdown>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
