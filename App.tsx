
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Role, Dispatch, Ambulance, DispatchStatus, LatLng } from './types';
import { socket } from './services/mockSocket';
import GoogleMap from './components/GoogleMap';

const HOSPITAL_LOCATION: LatLng = { lat: 12.9716, lng: 77.5946 }; 
const DEFAULT_ZOOM = 13;

const NEARBY_HOSPITALS = [
  { name: "LifeLink Central Hospital", location: HOSPITAL_LOCATION },
  { name: "St. Mary's Medical Center", location: { lat: 13.0108, lng: 77.5550 } },
  { name: "City Trauma Center", location: { lat: 12.9279, lng: 77.6271 } },
  { name: "East Side General", location: { lat: 12.9800, lng: 77.7000 } },
  { name: "West Gate Health", location: { lat: 12.9600, lng: 77.5300 } },
  { name: "Apollo Specialty Jayanagar", location: { lat: 12.9400, lng: 77.5800 } },
  { name: "Jayadeva Institute of Cardiology", location: { lat: 12.9204, lng: 77.5930 } },
  { name: "Fortis Hospital Bannerghatta", location: { lat: 12.8950, lng: 77.5980 } },
  { name: "Narayana Health City", location: { lat: 12.8123, lng: 77.6945 } },
  { name: "Sakra World Hospital", location: { lat: 12.9262, lng: 77.6787 } },
  { name: "Aster RV Hospital", location: { lat: 12.9134, lng: 77.5824 } },
  { name: "Rainbow Children's Hospital", location: { lat: 12.8980, lng: 77.6150 } },
  { name: "Manipal Hospital Sarjapur", location: { lat: 12.9155, lng: 77.6655 } },
  { name: "St. John's Medical College", location: { lat: 12.9325, lng: 77.6225 } },
];

const calculateETA = (p1: LatLng, p2: LatLng): string => {
  const dist = Math.sqrt(Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lng - p2.lng, 2)) * 111;
  const mins = Math.ceil(dist / 0.42);
  if (mins <= 1) return "Under 1 min";
  return `${mins} mins`;
};

const getDistance = (p1: LatLng, p2: LatLng): number => {
  return Math.sqrt(Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lng - p2.lng, 2));
};

const generateInitialAmbulances = (): Ambulance[] => {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `AMB-${(i + 1).toString().padStart(2, '0')}`,
    name: `Ambulance ${i + 1}`,
    phone: `+91 ${Math.floor(6000000000 + Math.random() * 3999999999)}`,
    location: {
      lat: HOSPITAL_LOCATION.lat + (Math.random() - 0.5) * 0.12,
      lng: HOSPITAL_LOCATION.lng + (Math.random() - 0.5) * 0.12
    },
    status: 'AVAILABLE' as const
  }));
};

const App: React.FC = () => {
  const [role, setRole] = useState<Role>(Role.PATIENT);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [ambulances, setAmbulances] = useState<Ambulance[]>(generateInitialAmbulances());
  const [myLocation, setMyLocation] = useState<LatLng>(HOSPITAL_LOCATION);
  const [activeDispatch, setActiveDispatch] = useState<Dispatch | null>(null);
  const [activePath, setActivePath] = useState<LatLng[]>([]);
  const [currentDriverId, setCurrentDriverId] = useState<string>('AMB-01');
  
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'success' | 'warning' } | null>(null);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [tempSelectedLocation, setTempSelectedLocation] = useState<LatLng | null>(null);
  const [hoverLocation, setHoverLocation] = useState<LatLng | null>(null);

  const ongoingDispatches = useMemo(() => {
    return dispatches.filter(d => d.status !== DispatchStatus.COMPLETED && d.status !== DispatchStatus.CANCELLED);
  }, [dispatches]);

  const activeDriverJob = useMemo(() => {
    return dispatches.find(d => d.driverId === currentDriverId && d.status !== DispatchStatus.COMPLETED);
  }, [dispatches, currentDriverId]);

  const activeAmbulance = useMemo(() => {
    return ambulances.find(a => a.id === currentDriverId);
  }, [ambulances, currentDriverId]);

  const activeAmbulanceName = activeAmbulance?.name || 'Unknown Unit';
  const activeAmbulancePhone = activeAmbulance?.phone || 'N/A';

  useEffect(() => {
    if (role === Role.PATIENT && !activeDispatch && ongoingDispatches.length > 0) {
      setActiveDispatch(ongoingDispatches[ongoingDispatches.length - 1]);
    }
  }, [role, activeDispatch, ongoingDispatches]);

  useEffect(() => {
    if (role === Role.DRIVER && !activeDriverJob) {
      const firstActiveDispatch = dispatches.find(d => 
        d.status === DispatchStatus.ASSIGNED || 
        d.status === DispatchStatus.EN_ROUTE || 
        d.status === DispatchStatus.LOADING_PATIENT ||
        d.status === DispatchStatus.EN_ROUTE_TO_HOSPITAL
      );
      if (firstActiveDispatch && firstActiveDispatch.driverId) {
        setCurrentDriverId(firstActiveDispatch.driverId);
      }
    }
  }, [role, dispatches, activeDriverJob]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("Location access denied, using default.")
      );
    }
  }, []);

  useEffect(() => {
    const handleNewDispatch = (newDispatch: Dispatch) => {
      setDispatches(prev => {
        if (prev.some(d => d.id === newDispatch.id)) return prev;
        return [...prev, newDispatch];
      });
      if (role === Role.DRIVER && !activeDriverJob && newDispatch.driverId) {
        setCurrentDriverId(newDispatch.driverId);
      }
    };

    const handleStatusUpdate = ({ dispatchId, status }: { dispatchId: string, status: DispatchStatus }) => {
      setDispatches(prev => prev.map(d => d.id === dispatchId ? { ...d, status } : d));
      
      setActiveDispatch(prev => {
        if (prev?.id === dispatchId) {
          return { ...prev, status };
        }
        return prev;
      });

      if (status === DispatchStatus.ARRIVED && role === Role.PATIENT) {
        showNotification("Ambulance arrived. Loading patient...", "info");
      }
      if (status === DispatchStatus.COMPLETED) {
        if (activeDispatch?.id === dispatchId) {
          showNotification("You have arrived at the hospital facility.", "success");
          setActivePath([]);
          setActiveDispatch(null);
        }
      }
    };

    const handleLocationUpdate = ({ dispatchId, location }: { dispatchId: string, location: LatLng }) => {
      setAmbulances(prevAmbs => {
        const d = dispatches.find(disp => disp.id === dispatchId);
        if (d && d.driverId) {
           return prevAmbs.map(a => a.id === d.driverId ? { ...a, location } : a);
        }
        return prevAmbs;
      });

      setDispatches(prev => prev.map(d => {
        if (d.id === dispatchId) {
          let targetLoc = d.location;
          if (d.status === DispatchStatus.EN_ROUTE_TO_HOSPITAL) {
             targetLoc = NEARBY_HOSPITALS.reduce((p, c) => 
               getDistance(location, c.location) < getDistance(location, p.location) ? c : p
             ).location;
          }
          return { ...d, eta: calculateETA(location, targetLoc) };
        }
        return d;
      }));

      if (activeDispatch && activeDispatch.id === dispatchId) {
        setActiveDispatch(prev => {
          if (!prev) return null;
          let targetLoc = prev.location;
          if (prev.status === DispatchStatus.EN_ROUTE_TO_HOSPITAL) {
             targetLoc = NEARBY_HOSPITALS.reduce((p, c) => 
               getDistance(location, c.location) < getDistance(location, p.location) ? c : p
             ).location;
          }
          return { ...prev, eta: calculateETA(location, targetLoc) };
        });
      }
    };

    const handlePathUpdate = ({ dispatchId, path }: { dispatchId: string, path: LatLng[] }) => {
      if (activeDispatch && activeDispatch.id === dispatchId) {
        setActivePath(path);
      }
      if (role === Role.DRIVER && activeDriverJob?.id === dispatchId) {
        setActivePath(path);
      }
    };

    socket.on('new_dispatch_request', handleNewDispatch);
    socket.on('dispatch_status_update', handleStatusUpdate);
    socket.on('driver_location_update', handleLocationUpdate);
    socket.on('path_update', handlePathUpdate);

    return () => {};
  }, [dispatches, activeDispatch, role, activeDriverJob]);

  const showNotification = (message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const startLocationSelection = () => {
    setIsSelectingLocation(true);
    setTempSelectedLocation(null);
    setHoverLocation(myLocation);
  };

  const cancelSelection = () => {
    setIsSelectingLocation(false);
    setTempSelectedLocation(null);
    setHoverLocation(null);
  };

  const handleConfirmAmbulanceRequest = () => {
    if (!tempSelectedLocation) return;

    const availableAmbs = ambulances.filter(a => a.status === 'AVAILABLE');
    let assignedAmbulance: Ambulance | null = null;

    if (availableAmbs.length > 0) {
      assignedAmbulance = availableAmbs.reduce((prev, curr) => {
        const prevDist = getDistance(tempSelectedLocation!, prev.location);
        const currDist = getDistance(tempSelectedLocation!, curr.location);
        return currDist < prevDist ? curr : prev;
      });
    }

    const initialEta = assignedAmbulance ? calculateETA(assignedAmbulance.location, tempSelectedLocation) : undefined;

    const newDispatch: Dispatch = {
      id: `DISP-${Math.random().toString(36).substr(2, 9)}`,
      patientName: "John Doe",
      patientPhone: "+91 9876543210",
      location: tempSelectedLocation,
      status: assignedAmbulance ? DispatchStatus.ASSIGNED : DispatchStatus.PENDING,
      driverId: assignedAmbulance?.id,
      eta: initialEta,
      createdAt: Date.now()
    };

    setActiveDispatch(newDispatch);
    setDispatches(prev => [...prev, newDispatch]);
    socket.emit('new_dispatch_request', newDispatch);

    if (assignedAmbulance) {
      const driverId = assignedAmbulance.id;
      setAmbulances(prev => prev.map(a => a.id === driverId ? { ...a, status: 'BUSY' } : a));
      socket.simulateDriverMovement(
        newDispatch.id, 
        assignedAmbulance.location, 
        tempSelectedLocation, 
        NEARBY_HOSPITALS.map(h => h.location)
      );
      showNotification(`Assigned ${assignedAmbulance.name}. Multi-stage dispatch active.`, "success");
      setCurrentDriverId(driverId);
    }

    setIsSelectingLocation(false);
    setTempSelectedLocation(null);
    setHoverLocation(null);
  };

  const openGoogleMaps = (location: LatLng) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
    window.open(url, '_blank');
  };

  const onMapClick = useCallback((location: LatLng) => {
    if (isSelectingLocation) {
      setTempSelectedLocation(location);
    }
  }, [isSelectingLocation]);

  const onMouseMove = useCallback((location: LatLng) => {
    if (isSelectingLocation) {
      setHoverLocation(location);
    }
  }, [isSelectingLocation]);

  const onMouseOut = useCallback(() => {
    if (isSelectingLocation) {
      setHoverLocation(null);
    }
  }, [isSelectingLocation]);

  return (
    <div className="flex flex-col h-full relative">
      {notification && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[2000] w-full max-w-md px-4 pointer-events-none transition-all duration-300 animate-in slide-in-from-top">
          <div className={`p-4 rounded-2xl shadow-2xl flex items-center gap-4 border ${
            notification.type === 'success' ? 'bg-green-600 text-white border-green-400' :
            notification.type === 'warning' ? 'bg-amber-500 text-white border-amber-300' :
            'bg-blue-600 text-white border-blue-400'
          }`}>
            <div className="bg-white/20 p-2 rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="font-bold text-sm">{notification.message}</p>
          </div>
        </div>
      )}

      <header className="bg-white border-b px-6 py-4 flex justify-between items-center z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center text-white shadow-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tighter text-gray-900 leading-none">LifeLink</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Advanced Dispatch Engine</p>
          </div>
        </div>

        <nav className="flex bg-gray-100 p-1 rounded-full text-xs font-bold">
          {(['PATIENT', 'DRIVER'] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`px-4 py-1.5 rounded-full transition-all ${
                role === r ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {r}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <aside className="w-full md:w-96 bg-white border-r flex flex-col z-10 overflow-y-auto">
          {role === Role.PATIENT && (
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Emergency Assistance</h2>
                <p className="text-gray-500 text-sm">
                  {activeDispatch?.status === DispatchStatus.LOADING_PATIENT 
                    ? "Medical team has arrived and is preparing you for transport."
                    : activeDispatch?.status === DispatchStatus.EN_ROUTE_TO_HOSPITAL
                    ? "Transporting to the nearest medical facility."
                    : "Request an immediate ambulance by selecting your location on the map."}
                </p>
              </div>

              {!activeDispatch ? (
                <div className="space-y-6">
                  {!isSelectingLocation ? (
                    <button
                      onClick={startLocationSelection}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3"
                    >
                      <svg className="w-6 h-6 animate-pulse" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
                      REQUEST AMBULANCE
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <button
                        disabled={!tempSelectedLocation}
                        onClick={handleConfirmAmbulanceRequest}
                        className={`w-full py-4 px-6 rounded-2xl font-bold shadow-xl transition-all ${tempSelectedLocation ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'}`}
                      >
                        CONFIRM LOCATION
                      </button>
                      <button onClick={cancelSelection} className="w-full text-gray-500 font-bold py-3">CANCEL</button>
                    </div>
                  )}

                  {ongoingDispatches.length > 0 && (
                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest">Ongoing Emergencies</h3>
                      {ongoingDispatches.map(d => (
                        <div 
                          key={d.id} 
                          onClick={() => setActiveDispatch(d)}
                          className="p-4 rounded-2xl bg-gray-50 border hover:border-red-500 cursor-pointer transition-all group"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black uppercase bg-white px-2 py-0.5 rounded border">{d.status}</span>
                            <span className="text-[10px] font-bold text-gray-400">{d.eta || 'Calculated live'}</span>
                          </div>
                          <p className="text-sm font-bold text-gray-800">Unit assigned to scene</p>
                          <p className="text-xs text-red-600 font-bold mt-1 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">Track Live GPS →</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className={`p-5 rounded-2xl border-2 ${
                    activeDispatch.status === DispatchStatus.LOADING_PATIENT ? 'bg-blue-50 border-blue-200 animate-pulse' : 
                    activeDispatch.status === DispatchStatus.EN_ROUTE_TO_HOSPITAL ? 'bg-orange-50 border-orange-200' :
                    'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black uppercase bg-white px-2 py-1 rounded shadow-sm border">{activeDispatch.status}</span>
                      <span className="text-xs font-bold text-gray-400">{new Date(activeDispatch.createdAt).toLocaleTimeString()}</span>
                    </div>
                    
                    {activeDispatch.status === DispatchStatus.LOADING_PATIENT ? (
                      <div className="space-y-3">
                        <h3 className="font-bold text-blue-900 text-lg">Loading Patient...</h3>
                        <p className="text-sm text-blue-700 leading-relaxed">Stabilizing for transport. Stay calm.</p>
                        <div className="w-full h-1.5 bg-blue-200 rounded-full overflow-hidden">
                           <div className="h-full bg-blue-600 animate-progress"></div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <h3 className={`font-bold text-lg ${activeDispatch.status === DispatchStatus.EN_ROUTE_TO_HOSPITAL ? 'text-orange-900' : 'text-red-900'}`}>
                            {activeDispatch.status === DispatchStatus.EN_ROUTE_TO_HOSPITAL ? 'Heading to Hospital' : 'Ambulance Responding'}
                          </h3>
                          <p className={`text-sm mt-1 ${activeDispatch.status === DispatchStatus.EN_ROUTE_TO_HOSPITAL ? 'text-orange-700' : 'text-red-700'}`}>
                            Optimal street route active.
                          </p>
                        </div>
                        
                        <div className={`flex items-center gap-3 p-3 rounded-xl ${activeDispatch.status === DispatchStatus.EN_ROUTE_TO_HOSPITAL ? 'bg-orange-600/10' : 'bg-red-600/10'}`}>
                          <svg className="w-5 h-5 text-current opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <div>
                             <p className="text-[10px] uppercase font-black opacity-60">Live Arrival Estimate</p>
                             <p className="text-lg font-black tracking-tight">{activeDispatch.eta || "Calculating..."}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => setActiveDispatch(null)}
                    className="w-full text-xs font-bold text-gray-400 hover:text-red-600 transition-colors py-2"
                  >
                    View All Ongoing Requests
                  </button>
                </div>
              )}
            </div>
          )}

          {role === Role.DRIVER && (
            <div className="p-6 flex flex-col h-full">
              <div className="mb-6">
                <div className="flex justify-between items-start">
                  <h2 className="text-2xl font-bold tracking-tight">Navigation Unit</h2>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-gray-400 leading-none mb-1">My Contact</p>
                    <p className="text-sm font-black text-red-600 font-mono">{activeAmbulancePhone}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Selected Vehicle</label>
                  <select 
                    value={currentDriverId}
                    onChange={(e) => setCurrentDriverId(e.target.value)}
                    className="w-full bg-gray-100 border-none rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500"
                  >
                    {ambulances.map(a => (
                      <option key={a.id} value={a.id}>{a.name} {dispatches.some(d => d.driverId === a.id && d.status !== DispatchStatus.COMPLETED) ? '🚨' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-2xl relative overflow-hidden flex-shrink-0">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-widest leading-none">{activeAmbulanceName}</span>
                    <span className="text-[10px] font-mono text-gray-500 mt-1">{activeAmbulancePhone}</span>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${activeDriverJob ? 'bg-green-500 animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.6)]' : 'bg-gray-600'}`}></div>
                </div>
                
                {activeDriverJob ? (
                  <div className="space-y-6">
                    {activeDriverJob.status === DispatchStatus.LOADING_PATIENT ? (
                      <div className="text-center py-6 space-y-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/20 border border-blue-500/50 rounded-full mb-2">
                           <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">LOADING PATIENT</h3>
                        <p className="text-xs text-blue-300 font-bold uppercase tracking-widest">Hold Position: 10s Medical Prep</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 ${activeDriverJob.status === DispatchStatus.EN_ROUTE_TO_HOSPITAL ? 'bg-orange-600' : 'bg-red-600'} rounded-xl flex items-center justify-center font-black text-2xl shadow-lg`}>
                            {activeDriverJob.status === DispatchStatus.EN_ROUTE_TO_HOSPITAL ? 'H' : 'A'}
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-white uppercase tracking-tighter">
                              {activeDriverJob.status === DispatchStatus.EN_ROUTE_TO_HOSPITAL ? 'To Hospital' : 'To Patient'}
                            </h3>
                            <div className="flex items-center gap-1.5 text-blue-300">
                               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                               <p className="text-xs font-black uppercase tracking-widest">{activeDriverJob.eta || "Calculating..."}</p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                          <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-widest font-black">Destination</p>
                          <p className="text-lg font-bold text-white leading-tight">
                            {activeDriverJob.status === DispatchStatus.EN_ROUTE_TO_HOSPITAL ? 'Nearest Medical Center' : activeDriverJob.patientName}
                          </p>
                          {activeDriverJob.status !== DispatchStatus.EN_ROUTE_TO_HOSPITAL && (
                            <div className="mt-2 flex items-center gap-2">
                              <svg className="w-3.5 h-3.5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>
                              <p className="text-xs font-mono font-bold text-green-400">{activeDriverJob.patientPhone}</p>
                            </div>
                          )}
                          <p className="text-[10px] text-blue-300 font-mono mt-2 opacity-50">
                            COORD: {activeDriverJob.location.lat.toFixed(6)}, {activeDriverJob.location.lng.toFixed(6)}
                          </p>
                        </div>
                        
                        <button 
                          onClick={() => openGoogleMaps(activeDriverJob.location)}
                          className="w-full bg-white/10 hover:bg-white/20 border border-white/10 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                        >
                          OPEN EXTERNAL GPS
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5 shadow-inner">
                      <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </div>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Waiting for Response</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

        <section className="flex-1 relative bg-gray-200">
          {isSelectingLocation && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] pointer-events-none">
              <div className="bg-red-600 text-white px-6 py-2 rounded-full shadow-2xl font-bold animate-bounce flex items-center gap-2 border-2 border-white/20">
                Identify Emergency Target
              </div>
            </div>
          )}

          <GoogleMap
            center={myLocation}
            zoom={DEFAULT_ZOOM}
            onMapClick={onMapClick}
            onMouseMove={onMouseMove}
            onMouseOut={onMouseOut}
            path={activePath}
            markers={[
              ...NEARBY_HOSPITALS.map(h => ({
                position: h.location,
                title: h.name,
                icon: 'https://cdn-icons-png.flaticon.com/512/3063/3063205.png'
              })),
              ...(isSelectingLocation && tempSelectedLocation ? [{
                position: tempSelectedLocation,
                title: "Emergency Location",
                icon: 'https://cdn-icons-png.flaticon.com/512/564/564619.png'
              }] : []),
              ...ambulances.map(a => {
                const isAssignedAmbulance = role === Role.PATIENT && activeDispatch?.driverId === a.id;
                const shouldAnimate = isAssignedAmbulance && (activeDispatch?.status === DispatchStatus.ARRIVED || activeDispatch?.status === DispatchStatus.LOADING_PATIENT);
                
                return {
                  position: a.location,
                  title: a.name,
                  icon: 'https://cdn-icons-png.flaticon.com/512/3448/3448327.png',
                  className: shouldAnimate ? 'marker-arrival-pulse' : ''
                };
              }),
              ...(role === Role.PATIENT && activeDispatch ? [{
                position: activeDispatch.location,
                title: "Emergency Scene",
                icon: 'https://cdn-icons-png.flaticon.com/512/564/564619.png'
              }] : []),
              ...(role === Role.DRIVER ? [{
                position: ambulances.find(a => a.id === currentDriverId)?.location || myLocation,
                title: `You (${activeAmbulanceName})`,
                icon: 'https://cdn-icons-png.flaticon.com/512/3448/3448327.png'
              }] : [])
            ]}
          />

          <div className="absolute top-4 right-4 space-y-2 pointer-events-none">
             <div className="glass-effect p-3 rounded-2xl shadow-lg border border-white flex items-center gap-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-black uppercase text-gray-800">Advanced Road Routing</span>
            </div>
            {activeDriverJob && (
              <div className="glass-effect p-3 rounded-2xl shadow-lg border border-red-200 flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                <span className="text-[10px] font-black uppercase text-red-600">Active Emergency Ops</span>
              </div>
            )}
          </div>
        </section>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .animate-progress {
          animation: progress 10s linear forwards;
        }
      `}} />
    </div>
  );
};

export default App;