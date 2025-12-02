import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  Camera, Users, Clock, Activity, Play, Pause, RefreshCw, AlertCircle, Eye, Settings, Save, X
} from 'lucide-react';

import StatsCard from './components/StatsCard';
import HeatmapGrid from './components/HeatmapGrid';
import { analyzeFrame } from './services/geminiService'; // Keeps the file name but logic is now Ollama
import { AnalyticsState, StoreZone, DetectionResult, AISettings } from './types';

// Mock initial data
const INITIAL_TRAFFIC = [
  { hour: '09:00', count: 12 },
  { hour: '10:00', count: 28 },
  { hour: '11:00', count: 45 },
  { hour: '12:00', count: 32 },
  { hour: '13:00', count: 15 },
  { hour: '14:00', count: 0 },
  { hour: '15:00', count: 0 },
];

const INITIAL_ZONES: Record<StoreZone, number> = {
  [StoreZone.TOP_LEFT]: 5,
  [StoreZone.TOP_CENTER]: 12,
  [StoreZone.TOP_RIGHT]: 3,
  [StoreZone.MID_LEFT]: 8,
  [StoreZone.MID_CENTER]: 25,
  [StoreZone.MID_RIGHT]: 7,
  [StoreZone.BOTTOM_LEFT]: 2,
  [StoreZone.BOTTOM_CENTER]: 15,
  [StoreZone.BOTTOM_RIGHT]: 4,
};

// Default Settings
const DEFAULT_SETTINGS: AISettings = {
  serverUrl: 'http://localhost:11434',
  modelName: 'llava', // Recommend llava, moondream, or llama3.2-vision
};

const App: React.FC = () => {
  // --- State ---
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings State (persisted in localStorage in a real app)
  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    const saved = localStorage.getItem('storeflow_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [analytics, setAnalytics] = useState<AnalyticsState>({
    totalVisitors: 142,
    currentOccupancy: 8,
    avgDwellTime: 4.5,
    hourlyTraffic: INITIAL_TRAFFIC,
    heatmapDistribution: INITIAL_ZONES,
    lastUpdate: Date.now(),
  });

  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<number | null>(null);

  // --- Settings Handler ---
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('storeflow_settings', JSON.stringify(aiSettings));
    setShowSettings(false);
  };

  // --- Camera Setup ---
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 640 } } // Low res is fine for AI
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setVideoError(null);
      }
    } catch (err) {
      console.error("Camera Error:", err);
      setVideoError("Unable to access camera. Please ensure permissions are granted.");
      setIsMonitoring(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (isMonitoring) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isMonitoring]);

  // --- AI Processing Logic (Ollama) ---
  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;

    setIsProcessing(true);
    try {
      // Draw video frame to canvas
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to base64
      const base64Image = canvas.toDataURL('image/jpeg', 0.8);

      // Call Ollama Service
      const result: DetectionResult | null = await analyzeFrame(base64Image, aiSettings);

      if (result) {
        updateAnalytics(result);
      } else {
        console.warn("No result from AI");
      }

    } catch (e) {
      console.error("Processing error", e);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, aiSettings]);

  // --- State Updates ---
  const updateAnalytics = (result: DetectionResult) => {
    setAnalytics(prev => {
      // 1. Update Heatmap
      const newHeatmap = { ...prev.heatmapDistribution };
      result.zones.forEach(zone => {
        newHeatmap[zone] = (newHeatmap[zone] || 0) + 1;
      });

      // 2. Update Traffic
      const diff = Math.max(0, result.personCount - prev.currentOccupancy);
      const newTotal = prev.totalVisitors + diff;

      // 3. Update Hourly
      const currentHourStr = new Date().getHours().toString().padStart(2, '0') + ':00';
      const newTraffic = prev.hourlyTraffic.map(t => {
        if (t.hour === currentHourStr) {
          return { ...t, count: t.count + diff };
        }
        return t;
      });

      return {
        ...prev,
        currentOccupancy: result.personCount,
        totalVisitors: newTotal,
        hourlyTraffic: newTraffic,
        heatmapDistribution: newHeatmap,
        lastUpdate: Date.now()
      };
    });
  };

  // --- Polling Interval ---
  useEffect(() => {
    if (isMonitoring) {
      // Local LLM might be slower, keep 10s or increase if needed
      intervalRef.current = window.setInterval(captureAndAnalyze, 10000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isMonitoring, captureAndAnalyze]);


  // --- UI Render ---
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 md:p-8 relative">
      
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5" /> Local AI Configuration
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Ollama Server URL</label>
                <input 
                  type="text" 
                  value={aiSettings.serverUrl}
                  onChange={e => setAiSettings({...aiSettings, serverUrl: e.target.value})}
                  placeholder="http://localhost:11434"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Ensure <code>OLLAMA_ORIGINS="*"</code> is set on your server.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Model Name</label>
                <input 
                  type="text" 
                  value={aiSettings.modelName}
                  onChange={e => setAiSettings({...aiSettings, modelName: e.target.value})}
                  placeholder="llava"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Must be a vision-capable model (e.g., llava, moondream, qwen-vl).
                </p>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 text-slate-300 hover:bg-slate-700 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md flex items-center gap-2 transition-colors"
                >
                  <Save size={16} /> Save Config
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Activity className="text-indigo-500 w-8 h-8" />
            StoreFlow AI
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Powered by Ollama ({aiSettings.modelName})
          </p>
        </div>
        
        <div className="flex items-center gap-4 bg-slate-800 p-2 rounded-lg border border-slate-700">
           {isMonitoring ? (
             <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-500 rounded animate-pulse">
               <span className="w-2 h-2 rounded-full bg-green-500"></span>
               <span className="text-xs font-bold uppercase">Live</span>
             </div>
           ) : (
             <div className="flex items-center gap-2 px-3 py-1 bg-slate-700 text-slate-400 rounded">
               <span className="w-2 h-2 rounded-full bg-slate-500"></span>
               <span className="text-xs font-bold uppercase">Offline</span>
             </div>
           )}
           
           <button
            onClick={() => setIsMonitoring(!isMonitoring)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
              isMonitoring 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
           >
             {isMonitoring ? <><Pause size={18} /> Stop Monitor</> : <><Play size={18} /> Start Monitor</>}
           </button>

           <button 
             onClick={() => setShowSettings(true)}
             className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
             title="Settings"
           >
             <Settings size={20} />
           </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Left Column: Stats */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatsCard 
              title="Current Occupancy" 
              value={analytics.currentOccupancy} 
              icon={Users} 
              trend={isMonitoring ? "Live tracking" : "Last known"} 
              trendUp={true} 
            />
            <StatsCard 
              title="Total Visitors (Today)" 
              value={analytics.totalVisitors} 
              icon={Eye} 
              trend="+12% vs avg" 
              trendUp={true} 
            />
            <StatsCard 
              title="Avg. Dwell Time" 
              value={`${analytics.avgDwellTime} min`} 
              icon={Clock} 
              trend="-1.2 min" 
              trendUp={false} 
            />
          </div>

          {/* Traffic Chart */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-white mb-6">Hourly Traffic Flow</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.hourlyTraffic}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="hour" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                    itemStyle={{ color: '#818cf8' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#6366f1" fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Feed & Heatmap */}
        <div className="space-y-6">
          
          {/* Camera Feed Container */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Camera size={18} /> Live Feed
              </h3>
              {isProcessing && <span className="text-xs text-indigo-400 animate-pulse">AI Analyzing...</span>}
            </div>
            
            <div className="relative aspect-video bg-black flex items-center justify-center">
              {videoError ? (
                <div className="text-center p-4 text-red-400 flex flex-col items-center">
                   <AlertCircle className="mb-2" />
                   <p className="text-sm">{videoError}</p>
                </div>
              ) : (
                <>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className={`w-full h-full object-cover ${!isMonitoring ? 'hidden' : ''}`}
                  />
                  {!isMonitoring && (
                    <div className="text-slate-500 flex flex-col items-center">
                      <Camera className="w-12 h-12 mb-2 opacity-50" />
                      <p className="text-sm">Camera Off</p>
                    </div>
                  )}
                  {/* Hidden Canvas for capture */}
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {/* Overlay for detecting zones visualization (Visual Flourish) */}
                  {isMonitoring && (
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20">
                      {[...Array(9)].map((_, i) => (
                        <div key={i} className="border border-white/30"></div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Heatmap Container */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">Zone Heatmap</h3>
              <button 
                onClick={() => setAnalytics(prev => ({...prev, heatmapDistribution: INITIAL_ZONES}))}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
              >
                <RefreshCw size={12} /> Reset
              </button>
            </div>
            <HeatmapGrid distribution={analytics.heatmapDistribution} />
            <div className="mt-4 flex justify-between text-xs text-slate-400 px-2">
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-500/20 rounded-full"></div> Low Traffic</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-yellow-500/40 rounded-full"></div> Moderate</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500/60 rounded-full"></div> High Traffic</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default App;