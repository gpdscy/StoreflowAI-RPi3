export enum StoreZone {
  TOP_LEFT = 'Top-Left',
  TOP_CENTER = 'Top-Center',
  TOP_RIGHT = 'Top-Right',
  MID_LEFT = 'Mid-Left',
  MID_CENTER = 'Mid-Center',
  MID_RIGHT = 'Mid-Right',
  BOTTOM_LEFT = 'Bottom-Left',
  BOTTOM_CENTER = 'Bottom-Center',
  BOTTOM_RIGHT = 'Bottom-Right'
}

export interface DetectionResult {
  personCount: number;
  zones: StoreZone[];
  timestamp: number;
}

export interface HourlyTraffic {
  hour: string;
  count: number;
}

export interface HeatmapData {
  zone: StoreZone;
  intensity: number; // 0 to 100
}

export interface AnalyticsState {
  totalVisitors: number;
  currentOccupancy: number;
  avgDwellTime: number; // in minutes
  hourlyTraffic: HourlyTraffic[];
  heatmapDistribution: Record<StoreZone, number>;
  lastUpdate: number;
}

export interface AISettings {
  serverUrl: string; // e.g., http://192.168.1.100:11434
  modelName: string; // e.g., llava, llama3.2-vision
}