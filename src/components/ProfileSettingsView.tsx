import { type ChangeEvent, type FormEvent, useState } from 'react';
import { CheckCircle2, LogOut, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { DatasetRecord, ReportRecord, UserActivityItem, UserCategory, UserProfile } from '../types';

interface ProfileSettingsViewProps {
  mode: 'profile' | 'settings';
  user: UserProfile;
  activities: UserActivityItem[];
  datasets: DatasetRecord[];
  reports: ReportRecord[];
  onUserUpdated: (user: UserProfile) => void;
  onLogout: () => void;
}

const CATEGORIES: UserCategory[] = ['Student', 'Researcher', 'Scientist', 'Teacher', 'General user'];

export function ProfileSettingsView({
  mode,
  user,
  activities,
  datasets,
  reports,
  onUserUpdated,
  onLogout,
}: ProfileSettingsViewProps) {
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone || '');
  const [institution, setInstitution] = useState(user.institution || '');
  const [country, setCountry] = useState(user.country);
  const [userCategory, setUserCategory] = useState<UserCategory>(user.userCategory);
  const [profileImage, setProfileImage] = useState(user.profileImage || '/src/assets/images/avatar_researcher_1795608908462.jpg');

  const [notifyAnalysis, setNotifyAnalysis] = useState(user.notifyAnalysis);
  const [notifySecurity, setNotifySecurity] = useState(user.notifySecurity);
  const [notifyDigest, setNotifyDigest] = useState(user.notifyDigest);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);
    setSaving(true);
    try {
      const res = await apiRequest<{ user: UserProfile; message: string }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          phone,
          institution,
          country,
          userCategory,
          profileImage,
          notifyAnalysis,
          notifySecurity,
          notifyDigest,
        }),
      });
      onUserUpdated(res.user);
      setStatusMsg(res.message);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);
    setSaving(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      setStatusMsg(res.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  }

  function handlePhotoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_200_000) {
      setErrorMsg('Profile image must be smaller than 1.2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfileImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#141E1A]">
            {mode === 'profile' ? 'Researcher Profile' : 'Account & Notification Settings'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage personal details, institutional affiliation, security credentials, and notification preferences.
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">{errorMsg}</div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        <form onSubmit={handleSaveProfile} className="lg:col-span-7 bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-4">
            <img
              src={profileImage || '/src/assets/images/avatar_researcher_1795608908462.jpg'}
              alt={`${user.fullName} profile photograph`}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-full object-cover border border-[#D8E6DF]"
            />
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-[#141E1A]">{user.fullName}</p>
              <p className="text-xs text-slate-500">{user.email} · {user.emailVerified ? 'Verified' : 'Unverified'}</p>
              <label className="inline-block text-xs font-semibold text-[#064E3B] hover:underline cursor-pointer">
                Change Profile Photograph
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Institution / Organization</label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">User Category</label>
            <select
              value={userCategory}
              onChange={(e) => setUserCategory(e.target.value as UserCategory)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-2.5 text-sm">
            <p className="font-semibold text-[#141E1A] text-xs">Notification Preferences</p>
            <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyAnalysis}
                onChange={(e) => setNotifyAnalysis(e.target.checked)}
                className="rounded border-slate-300 text-emerald-700"
              />
              Notify when eDNA dataset analysis completes
            </label>
            <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={notifySecurity}
                onChange={(e) => setNotifySecurity(e.target.checked)}
                className="rounded border-slate-300 text-emerald-700"
              />
              Security &amp; sign-in activity notifications
            </label>
            <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyDigest}
                onChange={(e) => setNotifyDigest(e.target.checked)}
                className="rounded border-slate-300 text-emerald-700"
              />
              Weekly biodiversity summary digest
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-[#064E3B] hover:bg-[#053F30] text-white text-sm font-semibold cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Profile & Preferences'}
          </button>
        </form>

        <div className="lg:col-span-5 space-y-6">
          {/* Password Update */}
          <form onSubmit={handleChangePassword} className="bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-3.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#064E3B]" />
              <h2 className="text-base font-semibold text-[#141E1A]">Change Password</h2>
            </div>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New strong password"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2 px-4 rounded-lg border border-[#064E3B] text-[#064E3B] hover:bg-[#ECFDF5] text-sm font-semibold cursor-pointer"
            >
              Update Password
            </button>
          </form>

          {/* Activity & Datasets Snapshot */}
          <div className="bg-white border border-[#D8E6DF] rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#141E1A]">Account Summary &amp; Login Activity</h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#F6FAF8] border border-[#D8E6DF]">
                <p className="text-slate-500">Uploaded Datasets</p>
                <p className="text-xl font-mono font-bold text-[#064E3B] tabular-nums mt-0.5">{datasets.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F6FAF8] border border-[#D8E6DF]">
                <p className="text-slate-500">Saved Reports</p>
                <p className="text-xl font-mono font-bold text-[#064E3B] tabular-nums mt-0.5">{reports.length}</p>
              </div>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {activities.map((act) => (
                <div key={act.activity_id} className="text-xs border-b border-slate-100 pb-2">
                  <p className="font-medium text-slate-800">{act.description}</p>
                  <p className="text-[11px] font-mono text-slate-400">
                    {act.activity_type} · {new Date(act.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
