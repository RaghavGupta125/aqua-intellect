import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Wifi, WifiOff } from 'lucide-react';
import { getSocket } from '../../services/socket';

const routeLabels = {
  '/': 'Dashboard',
  '/facilities': 'Facilities',
  '/alarms': 'Alarms',
};

function getBreadcrumb(pathname) {
  if (routeLabels[pathname]) return routeLabels[pathname];
  if (pathname.startsWith('/plants/')) return 'Plant Detail';
  if (pathname.includes('/plants')) return 'Plants';
  return 'Aqua Intellect';
}

export default function TopBar() {
  const location = useLocation();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) setConnected(true);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return (
    <header className="h-12 bg-white border-b border-surface-border flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="text-sm font-medium text-ink">{getBreadcrumb(location.pathname)}</h1>
      <div className="flex items-center gap-2">
        {connected ? (
          <span className="flex items-center gap-1.5 text-xs text-green-600">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 live-dot" />
            Live
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <WifiOff size={12} />
            Offline
          </span>
        )}
      </div>
    </header>
  );
}
