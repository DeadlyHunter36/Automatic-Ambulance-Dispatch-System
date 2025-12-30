
import { Dispatch, Ambulance, DispatchStatus, LatLng } from '../types';

type Callback = (data: any) => void;

class MockSocketService {
  private listeners: Record<string, Callback[]> = {};

  on(event: string, callback: Callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event: string, data: any) {
    console.debug(`[Socket Emit] ${event}`, data);
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  private async fetchRoute(start: LatLng, end: LatLng) {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`
    );
    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('Routing failed');
    }
    return data.routes[0].geometry.coordinates.map((coord: [number, number]) => ({
      lat: coord[1],
      lng: coord[0]
    }));
  }

  // Multi-stage simulation: Patient Pickup -> Loading -> Hospital Dropoff
  async simulateDriverMovement(dispatchId: string, start: LatLng, patientLoc: LatLng, hospitals: LatLng[]) {
    try {
      // PHASE 1: TRAVEL TO PATIENT
      this.emit('dispatch_status_update', { dispatchId, status: DispatchStatus.EN_ROUTE });
      const pathToPatient = await this.fetchRoute(start, patientLoc);
      this.emit('path_update', { dispatchId, path: pathToPatient });

      await this.driveAlongPath(dispatchId, pathToPatient);
      
      // ARRIVED AT PATIENT
      this.emit('dispatch_status_update', { dispatchId, status: DispatchStatus.ARRIVED });
      this.emit('path_update', { dispatchId, path: [] });

      // PHASE 2: LOADING PATIENT (10 SECONDS)
      this.emit('dispatch_status_update', { dispatchId, status: DispatchStatus.LOADING_PATIENT });
      await new Promise(resolve => setTimeout(resolve, 10000));

      // PHASE 3: TRAVEL TO NEAREST HOSPITAL
      this.emit('dispatch_status_update', { dispatchId, status: DispatchStatus.EN_ROUTE_TO_HOSPITAL });
      
      // Find nearest hospital from patient location
      const nearestHospital = hospitals.reduce((prev, curr) => {
        const d1 = Math.sqrt(Math.pow(patientLoc.lat - prev.lat, 2) + Math.pow(patientLoc.lng - prev.lng, 2));
        const d2 = Math.sqrt(Math.pow(patientLoc.lat - curr.lat, 2) + Math.pow(patientLoc.lng - curr.lng, 2));
        return d2 < d1 ? curr : prev;
      });

      const pathToHospital = await this.fetchRoute(patientLoc, nearestHospital);
      this.emit('path_update', { dispatchId, path: pathToHospital });

      await this.driveAlongPath(dispatchId, pathToHospital);

      // ARRIVED AT HOSPITAL
      this.emit('dispatch_status_update', { dispatchId, status: DispatchStatus.COMPLETED });
      this.emit('path_update', { dispatchId, path: [] });

    } catch (error) {
      console.error("Advanced Simulation Error:", error);
      this.emit('dispatch_status_update', { dispatchId, status: DispatchStatus.COMPLETED });
    }
  }

  private async driveAlongPath(dispatchId: string, path: LatLng[]) {
    if (path.length < 2) return;

    // Simulation settings
    const segmentDuration = 300; // ms per segment
    const frameRate = 16; // ~60fps
    const framesPerSegment = Math.floor(segmentDuration / frameRate);

    for (let i = 0; i < path.length - 1; i++) {
      const startPoint = path[i];
      const endPoint = path[i + 1];

      for (let frame = 1; frame <= framesPerSegment; frame++) {
        const progress = frame / framesPerSegment;
        
        // Linear interpolation for smooth movement
        const currentLat = startPoint.lat + (endPoint.lat - startPoint.lat) * progress;
        const currentLng = startPoint.lng + (endPoint.lng - startPoint.lng) * progress;

        this.emit('driver_location_update', {
          dispatchId,
          location: { lat: currentLat, lng: currentLng }
        });

        await new Promise(resolve => setTimeout(resolve, frameRate));
      }
    }
  }
}

export const socket = new MockSocketService();
