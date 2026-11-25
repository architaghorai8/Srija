/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  Database,
  FileText,
  FlaskConical,
  FolderOpen,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  User,
  X,
} from 'lucide-react';
import { AdminControlCenter } from './components/AdminControlCenter';
import { AnalyzeEdnaView } from './components/AnalyzeEdnaView';
import { AuthPages } from './components/AuthPages';
import { BiodiversityView } from './components/BiodiversityView';
import { DashboardHome } from './components/DashboardHome';
import { DnaLogo } from './components/DnaLogo';
import { LearningResourcesView } from './components/LearningResourcesView';
import { MyDatasetsView } from './components/MyDatasetsView';
import { ProfileSettingsView } from './components/ProfileSettingsView';
import { ReportsView } from './components/ReportsView';
import { SpeciesDatabaseView } from './components/SpeciesDatabaseView';
import { SplashScreen } from './components/SplashScreen';
import { TaxonomyExplorerView } from './components/TaxonomyExplorerView';
import { apiRequest, setAuthToken } from './lib/api';
import type {
  AppPage,
  DatasetRecord,
  NotificationItem,
  ReportRecord,
  TaxonomicResult,
  UserActivityItem,
  UserProfile,
} from './types';

export default function App() {
  const [pathname, setPathname] = useState<string>(() => window.location.pathname);
  const [stage, setStage] = useState<'splash' | 'auth' | 'public-learning' | 'app'>('splash');
  const [activePage, setActivePage] = useState<AppPage>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState({
    totalDatasets: 0,
    totalSpeciesIdentified: 0,
    totalTaxonomicGroups: 0,
    averageBiodiversityIndex: 0,
  });
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [taxa, setTaxa] = useState<TaxonomicResult[]>([]);
  const [activities, setActivities] = useState<UserActivityItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const refreshWorkspace = useCallback(async () => {
    try {
      const [meRes, dashRes, repRes] = await Promise.all([
        apiRequest<{
          user: UserProfile;
          activities: UserActivityItem[];
          notifications: NotificationItem[];
        }>('/api/auth/me'),
        apiRequest<{
          summary: {
            totalDatasets: number;
            totalSpeciesIdentified: number;
            totalTaxonomicGroups: number;
            averageBiodiversityIndex: number;
          };
          datasets: DatasetRecord[];
          taxa: TaxonomicResult[];
          activities: UserActivityItem[];
        }>('/api/dashboard/summary'),
        apiRequest<{ reports: ReportRecord[] }>('/api/reports'),
      ]);
      setUser(meRes.user);
      setNotifications(meRes.notifications);
      setSummary(dashRes.summary);
      setDatasets(dashRes.datasets);
      setTaxa(dashRes.taxa);
      setActivities(dashRes.activities);
      setReports(repRes.reports);
    } catch {
      // Token expired or invalid
    }
  }, []);

  // Hidden Admin Control Center route — never linked from normal UI
  if (pathname === '/secure-control-center') {
    return (
      <AdminControlCenter
        onExitToApp={() => {
          window.history.pushState({}, '', '/');
          setPathname('/');
          setStage('splash');
        }}
      />
    );
  }

  function handleAuthSuccess(loggedInUser: UserProfile) {
    setUser(loggedInUser);
    setStage('app');
    setActivePage('dashboard');
    refreshWorkspace();
  }

  function handleLogout() {
    setAuthToken(null);
    setUser(null);
    setDatasets([]);
    setTaxa([]);
    setActivities([]);
    setNotifications([]);
    setReports([]);
    setStage('auth');
  }

  async function markNotificationsRead() {
    await apiRequest('/api/auth/notifications/read-all', { method: 'POST' }).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })));
  }

  if (stage === 'splash') {
    return (
      <SplashScreen
        onGetStarted={() => setStage('auth')}
        onExploreLearning={() => setStage('public-learning')}
      />
    );
  }

  if (stage === 'public-learning') {
    return (
      <div className="min-h-screen bg-[#F6FAF8]">
        <header className="bg-white border-b border-[#D8E6DF] px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <DnaLogo size={32} />
            <span className="font-semibold text-[#141E1A]">eDNA BioScope</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStage('splash')}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setStage('auth')}
              className="px-4 py-2 rounded-lg bg-[#064E3B] text-white text-xs font-semibold cursor-pointer"
            >
              Sign In / Register
            </button>
          </div>
        </header>
        <main className="max-w-6xl mx-auto p-6 sm:p-10">
          <LearningResourcesView />
        </main>
      </div>
    );
  }

  if (stage === 'auth' || !user) {
    return (
      <AuthPages
        onBackToSplash={() => setStage('splash')}
        onAuthSuccess={handleAuthSuccess}
      />
    );
  }

  const navItems: Array<{ id: AppPage; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'analyze', label: 'Analyze eDNA', icon: FlaskConical },
    { id: 'datasets', label: 'My Datasets', icon: FolderOpen },
    { id: 'taxonomy', label: 'Taxonomy Explorer', icon: GitBranch },
    { id: 'biodiversity', label: 'Biodiversity Assessment', icon: BarChart3 },
    { id: 'species', label: 'Species Database', icon: Database },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'learning', label: 'Learning Resources', icon: BookOpen },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const unreadCount = notifications.filter((n) => !n.read).length;
  const activeLabel = navItems.find((n) => n.id === activePage)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-[#F6FAF8] text-[#141E1A] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-[#06291F] text-white shrink-0">
        <div className="px-5 py-5 border-b border-emerald-400/15 flex items-center gap-3">
          <DnaLogo size={32} inverted />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">eDNA BioScope</p>
            <p className="text-[11px] text-emerald-300/80 truncate">Discover · Identify · Conserve</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-500 text-[#04241A] font-semibold'
                    : 'text-emerald-100/80 hover:bg-emerald-900/50 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-emerald-400/15">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-emerald-100/80 hover:bg-emerald-900/60 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
          <aside className="relative z-10 w-64 bg-[#06291F] text-white flex flex-col h-full">
            <div className="px-5 py-4 border-b border-emerald-400/15 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <DnaLogo size={28} inverted />
                <span className="text-sm font-semibold">eDNA BioScope</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation menu"
                className="p-1 text-emerald-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActivePage(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium cursor-pointer ${
                      isActive ? 'bg-emerald-500 text-[#04241A] font-semibold' : 'text-emerald-100/80'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-emerald-400/15">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-emerald-100/80 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-[#D8E6DF] px-5 sm:px-8 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-xs sm:text-sm text-slate-500 truncate">
              <span>eDNA BioScope</span>
              <span className="mx-2">/</span>
              <span className="font-semibold text-[#141E1A]">{activeLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 relative">
            <button
              type="button"
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications && unreadCount > 0) markNotificationsRead();
              }}
              aria-label="Toggle notifications"
              className="relative p-2 rounded-lg border border-slate-200 hover:bg-[#F6FAF8] text-slate-700 cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-mono">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActivePage('profile')}
              className="flex items-center gap-2.5 pl-2 pr-3 py-1 rounded-lg border border-slate-200 hover:bg-[#F6FAF8] cursor-pointer"
            >
              <img
                src={user.profileImage || '/src/assets/images/avatar_researcher_1795608908462.jpg'}
                alt={user.fullName}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover"
              />
              <span className="hidden sm:inline text-xs font-semibold text-slate-800 max-w-[140px] truncate">
                {user.fullName}
              </span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-12 w-80 bg-white border border-[#D8E6DF] rounded-xl shadow-lg p-4 z-50 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-semibold text-[#141E1A]">Notifications</span>
                  <button
                    type="button"
                    onClick={() => setShowNotifications(false)}
                    className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3">No notifications yet.</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {notifications.map((n) => (
                      <div key={n.notification_id} className="py-2 text-xs">
                        <p className="font-semibold text-slate-900">{n.title}</p>
                        <p className="text-slate-600 mt-0.5">{n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-8 max-w-7xl w-full mx-auto">
          {activePage === 'dashboard' && (
            <DashboardHome
              user={user}
              summary={summary}
              datasets={datasets}
              taxa={taxa}
              activities={activities}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'analyze' && (
            <AnalyzeEdnaView
              onAnalysisComplete={() => {
                refreshWorkspace();
              }}
            />
          )}

          {activePage === 'datasets' && (
            <MyDatasetsView
              datasets={datasets}
              onRefresh={refreshWorkspace}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'taxonomy' && <TaxonomyExplorerView taxa={taxa} />}

          {activePage === 'biodiversity' && <BiodiversityView datasets={datasets} taxa={taxa} />}

          {activePage === 'species' && <SpeciesDatabaseView userTaxa={taxa} />}

          {activePage === 'reports' && (
            <ReportsView
              datasets={datasets}
              reports={reports}
              onReportCreated={refreshWorkspace}
            />
          )}

          {activePage === 'learning' && <LearningResourcesView />}

          {(activePage === 'profile' || activePage === 'settings') && (
            <ProfileSettingsView
              mode={activePage}
              user={user}
              activities={activities}
              datasets={datasets}
              reports={reports}
              onUserUpdated={(updated) => setUser(updated)}
              onLogout={handleLogout}
            />
          )}
        </main>
      </div>
    </div>
  );
}
