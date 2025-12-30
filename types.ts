
export enum Role {
  PATIENT = 'PATIENT',
  DRIVER = 'DRIVER'
}

export enum DispatchStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  EN_ROUTE = 'EN_ROUTE',
  ARRIVED = 'ARRIVED',
  LOADING_PATIENT = 'LOADING_PATIENT',
  EN_ROUTE_TO_HOSPITAL = 'EN_ROUTE_TO_HOSPITAL',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Dispatch {
  id: string;
  patientName: string;
  patientPhone: string;
  location: LatLng;
  status: DispatchStatus;
  driverId?: string;
  ambulanceId?: string;
  eta?: string;
  createdAt: number;
}

export interface Ambulance {
  id: string;
  name: string;
  phone: string;
  location: LatLng;
  status: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
}

export interface SystemState {
  role: Role;
  activeDispatches: Dispatch[];
  ambulances: Ambulance[];
}