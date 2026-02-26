import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Settings, User, Bell, Shield, LogOut, Save, Loader2, Eye, EyeOff,
  Camera, Trash2, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProfileData {
  full_name: string;
  bio: string;
  company: string;
  designation: string;
  industry: string;
  location: string;
  batch: string;
  department: string;
  skills: string[];
  interests: string[];
  social_links: { linkedin?: string; github?: string; twitter?: string; website?: string };
  is_mentor: boolean;
  is_hiring: boolean;
}

const defaultProfile: ProfileData = {
  full_name: "", bio: "", company: "", designation: "", industry: "",
  location: "", batch: "", department: "", skills: [], interests: [],
  social_links: {}, is_mentor: false, is_hiring: false,
};

interface DesktopNotifPrefs {
  mentorship: boolean;
  referral: boolean;
  event: boolean;
  ai: boolean;
  message: boolean;
  campaign: boolean;
  opportunity: boolean;
  reengagement: boolean;
  general: boolean;
  desktop_enabled: boolean;
}

const defaultDesktopPrefs: DesktopNotifPrefs = {
  mentorship: true, referral: true, event: true, ai: true, message: true,
  campaign: true, opportunity: true, reengagement: false, general: true, desktop_enabled: true,
};

interface PrivacyPrefs {
  show_email: boolean;
  show_location: boolean;
  show_company: boolean;
  allow_messages: boolean;
  show_in_directory: boolean;
}

const defaultPrivacyPrefs: PrivacyPrefs = {
  show_email: false, show_location: true, show_company: true,
  allow_messages: true, show_in_directory: true,
};

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileData>(defaultProfile);
  const [notifPrefs, setNotifPrefs] = useState<DesktopNotifPrefs>(defaultDesktopPrefs);
  const [notifPrefsLoaded, setNotifPrefsLoaded] = useState(false);
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [privacyPrefs, setPrivacyPrefs] = useState<PrivacyPrefs>(defaultPrivacyPrefs);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [interestInput, setInterestInput] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      if (data) {
        setProfile({
          full_name: data.full_name || "",
          bio: data.bio || "",
          company: data.company || "",
          designation: data.designation || "",
          industry: data.industry || "",
          location: data.location || "",
          batch: data.batch || "",
          department: data.department || "",
          skills: data.skills || [],
          interests: data.interests || [],
          social_links: (data.social_links as any) || {},
          is_mentor: data.is_mentor || false,
          is_hiring: data.is_hiring || false,
        });
        setAvatarUrl(data.avatar_url || null);
      }

      // Load notification preferences
      const { data: np } = await supabase.from("notification_preferences").select("*").eq("user_id", user.id).single();
      if (np) {
        setNotifPrefs({
          mentorship: np.mentorship, referral: np.referral, event: np.event, ai: np.ai,
          message: np.message, campaign: np.campaign, opportunity: np.opportunity,
          reengagement: np.reengagement, general: np.general, desktop_enabled: np.desktop_enabled,
        });
        setNotifPrefsLoaded(true);
      } else {
        // Insert default row
        await supabase.from("notification_preferences").insert({ user_id: user.id });
        setNotifPrefsLoaded(true);
      }

      setLoading(false);
    };
    load();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: profile.full_name,
      bio: profile.bio,
      company: profile.company,
      designation: profile.designation,
      industry: profile.industry,
      location: profile.location,
      batch: profile.batch,
      department: profile.department,
      skills: profile.skills,
      interests: profile.interests,
      social_links: profile.social_links,
      is_mentor: profile.is_mentor,
      is_hiring: profile.is_hiring,
    }).eq("user_id", user.id);
    if (error) toast.error(error.message);
    else toast.success("Profile updated!");
    setSaving(false);
  };

  const addSkill = () => {
    if (skillInput.trim() && !profile.skills.includes(skillInput.trim())) {
      setProfile({ ...profile, skills: [...profile.skills, skillInput.trim()] });
      setSkillInput("");
    }
  };

  const addInterest = () => {
    if (interestInput.trim() && !profile.interests.includes(interestInput.trim())) {
      setProfile({ ...profile, interests: [...profile.interests, interestInput.trim()] });
      setInterestInput("");
    }
  };

  const changePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated!");
      setShowPasswordDialog(false);
      setPasswordForm({ newPassword: "", confirmPassword: "" });
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }

    setUploadingAvatar(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) { toast.error(uploadError.message); setUploadingAvatar(false); return; }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
    if (updateError) toast.error(updateError.message);
    else { setAvatarUrl(url); toast.success("Avatar updated!"); }
    setUploadingAvatar(false);
  };

  const removeAvatar = async () => {
    if (!user) return;
    setUploadingAvatar(true);
    // List and remove files in user folder
    const { data: files } = await supabase.storage.from("avatars").list(user.id);
    if (files && files.length > 0) {
      await supabase.storage.from("avatars").remove(files.map((f) => `${user.id}/${f.name}`));
    }
    await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", user.id);
    setAvatarUrl(null);
    toast.success("Avatar removed");
    setUploadingAvatar(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6 text-accent" /> Settings
        </h1>
        <p className="text-muted-foreground text-sm">Manage your profile, notifications, privacy, and account</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-1.5 text-xs">
            <User className="h-3.5 w-3.5" /> Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1.5 text-xs">
            <Bell className="h-3.5 w-3.5" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center gap-1.5 text-xs">
            <Shield className="h-3.5 w-3.5" /> Privacy
          </TabsTrigger>
          <TabsTrigger value="account" className="flex items-center gap-1.5 text-xs">
            <Lock className="h-3.5 w-3.5" /> Account
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-6 shadow-card space-y-6">
            {/* Avatar & Name */}
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Avatar className="h-16 w-16">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="Avatar" />}
                  <AvatarFallback className="bg-accent text-accent-foreground font-heading text-xl">
                    {profile.full_name?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  {uploadingAvatar ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
                  <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} disabled={uploadingAvatar} />
                </label>
                {avatarUrl && (
                  <button onClick={removeAvatar} disabled={uploadingAvatar} className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="flex-1">
                <Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} placeholder="Full Name" className="text-lg font-heading font-semibold" />
                <p className="text-xs text-muted-foreground mt-1">Hover avatar to change photo</p>
              </div>
            </div>

            <Textarea value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="Write a short bio..." rows={3} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Company</Label>
                <Input value={profile.company} onChange={(e) => setProfile({ ...profile, company: e.target.value })} placeholder="Company name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Designation</Label>
                <Input value={profile.designation} onChange={(e) => setProfile({ ...profile, designation: e.target.value })} placeholder="Job title" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Industry</Label>
                <Input value={profile.industry} onChange={(e) => setProfile({ ...profile, industry: e.target.value })} placeholder="e.g. Technology" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Location</Label>
                <Input value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} placeholder="City, Country" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Batch</Label>
                <Input value={profile.batch} onChange={(e) => setProfile({ ...profile, batch: e.target.value })} placeholder="e.g. 2020" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Department</Label>
                <Input value={profile.department} onChange={(e) => setProfile({ ...profile, department: e.target.value })} placeholder="e.g. Computer Science" />
              </div>
            </div>

            {/* Skills */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Skills</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {profile.skills.map((s) => (
                  <Badge key={s} className="bg-accent/10 text-accent border-accent/20 cursor-pointer" onClick={() => setProfile({ ...profile, skills: profile.skills.filter((x) => x !== s) })}>
                    {s} ×
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={skillInput} onChange={(e) => setSkillInput(e.target.value)} placeholder="Add a skill" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())} />
                <Button variant="outline" size="sm" onClick={addSkill}>Add</Button>
              </div>
            </div>

            {/* Interests */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Interests</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {profile.interests.map((i) => (
                  <Badge key={i} className="bg-primary/10 text-primary border-primary/20 cursor-pointer" onClick={() => setProfile({ ...profile, interests: profile.interests.filter((x) => x !== i) })}>
                    {i} ×
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={interestInput} onChange={(e) => setInterestInput(e.target.value)} placeholder="Add an interest" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInterest())} />
                <Button variant="outline" size="sm" onClick={addInterest}>Add</Button>
              </div>
            </div>

            {/* Social Links */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Social Links</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input value={profile.social_links.linkedin || ""} onChange={(e) => setProfile({ ...profile, social_links: { ...profile.social_links, linkedin: e.target.value } })} placeholder="LinkedIn URL" />
                <Input value={profile.social_links.github || ""} onChange={(e) => setProfile({ ...profile, social_links: { ...profile.social_links, github: e.target.value } })} placeholder="GitHub URL" />
                <Input value={profile.social_links.twitter || ""} onChange={(e) => setProfile({ ...profile, social_links: { ...profile.social_links, twitter: e.target.value } })} placeholder="Twitter URL" />
                <Input value={profile.social_links.website || ""} onChange={(e) => setProfile({ ...profile, social_links: { ...profile.social_links, website: e.target.value } })} placeholder="Website URL" />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={profile.is_mentor} onCheckedChange={(v) => setProfile({ ...profile, is_mentor: v })} />
                <Label className="text-sm">Available as Mentor</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={profile.is_hiring} onCheckedChange={(v) => setProfile({ ...profile, is_hiring: v })} />
                <Label className="text-sm">Currently Hiring</Label>
              </div>
            </div>

            <Button variant="hero" onClick={saveProfile} disabled={saving} className="w-full sm:w-auto">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Profile
            </Button>
          </motion.div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-6 shadow-card space-y-6">
            {/* Master Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
              <div>
                <h3 className="font-heading font-semibold text-card-foreground">Desktop Notifications</h3>
                <p className="text-xs text-muted-foreground">Receive browser push alerts when the tab is in the background</p>
              </div>
              <Switch checked={notifPrefs.desktop_enabled} onCheckedChange={(v) => setNotifPrefs({ ...notifPrefs, desktop_enabled: v })} />
            </div>

            <Separator />

            <div className={notifPrefs.desktop_enabled ? "" : "opacity-50 pointer-events-none"}>
              <h3 className="font-heading font-semibold text-card-foreground mb-1">Alert Types</h3>
              <p className="text-xs text-muted-foreground mb-4">Choose which notification types trigger desktop alerts</p>
              <div className="space-y-4">
                {([
                  ["mentorship", "Mentorship", "Mentor matching, requests, and session updates"],
                  ["referral", "Referrals", "Referral requests and status changes"],
                  ["event", "Events", "Event invitations, RSVPs, and reminders"],
                  ["opportunity", "Jobs & Opportunities", "New job postings and opportunities matching your profile"],
                  ["message", "Messages", "Direct messages from other alumni"],
                  ["ai", "AI Insights", "AI-powered recommendations and career suggestions"],
                  ["campaign", "Campaigns", "Fundraising campaigns and institutional updates"],
                  ["reengagement", "Re-engagement", "Suggestions when you've been away for a while"],
                  ["general", "General", "System announcements and other updates"],
                ] as const).map(([key, label, desc]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <Switch checked={notifPrefs[key]} onCheckedChange={(v) => setNotifPrefs({ ...notifPrefs, [key]: v })} />
                  </div>
                ))}
              </div>
            </div>

            <Button variant="hero" disabled={savingNotifs} onClick={async () => {
              if (!user) return;
              setSavingNotifs(true);
              const { error } = await supabase.from("notification_preferences").update({
                mentorship: notifPrefs.mentorship, referral: notifPrefs.referral, event: notifPrefs.event,
                ai: notifPrefs.ai, message: notifPrefs.message, campaign: notifPrefs.campaign,
                opportunity: notifPrefs.opportunity, reengagement: notifPrefs.reengagement,
                general: notifPrefs.general, desktop_enabled: notifPrefs.desktop_enabled,
              }).eq("user_id", user.id);
              if (error) toast.error(error.message);
              else toast.success("Notification preferences saved!");
              setSavingNotifs(false);
            }} className="w-full sm:w-auto">
              {savingNotifs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Preferences
            </Button>
          </motion.div>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-6 shadow-card space-y-6">
            <div>
              <h3 className="font-heading font-semibold text-card-foreground mb-1">Visibility Controls</h3>
              <p className="text-xs text-muted-foreground mb-4">Control what others can see on your profile</p>
              <div className="space-y-4">
                {([
                  ["show_email", "Show Email Address", "Allow other alumni to see your email"],
                  ["show_location", "Show Location", "Display your city/country on your profile"],
                  ["show_company", "Show Company & Role", "Display your current workplace"],
                  ["show_in_directory", "Appear in Directory", "Show your profile in the alumni directory search"],
                  ["allow_messages", "Allow Direct Messages", "Let other alumni send you messages"],
                ] as const).map(([key, label, desc]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <Switch checked={privacyPrefs[key]} onCheckedChange={(v) => setPrivacyPrefs({ ...privacyPrefs, [key]: v })} />
                  </div>
                ))}
              </div>
            </div>

            <Button variant="hero" onClick={() => toast.success("Privacy settings saved!")} className="w-full sm:w-auto">
              <Save className="h-4 w-4" /> Save Privacy Settings
            </Button>
          </motion.div>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-6 shadow-card space-y-4">
              <h3 className="font-heading font-semibold text-card-foreground">Account Information</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">Email Address</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <Badge className="bg-success/10 text-success border-success/20">Verified</Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">Password</p>
                    <p className="text-xs text-muted-foreground">Last changed: Unknown</p>
                  </div>
                  <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">Change Password</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                            placeholder="New password"
                          />
                          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                          </button>
                        </div>
                        <Input
                          type="password"
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                          placeholder="Confirm new password"
                        />
                        <Button onClick={changePassword} className="w-full">Update Password</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-card space-y-4">
              <h3 className="font-heading font-semibold text-card-foreground">Sessions</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-card-foreground">Sign out of all devices</p>
                  <p className="text-xs text-muted-foreground">This will sign you out everywhere</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" /> Sign Out
                </Button>
              </div>
            </div>

            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-6 space-y-4">
              <h3 className="font-heading font-semibold text-destructive">Danger Zone</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-card-foreground">Delete Account</p>
                  <p className="text-xs text-muted-foreground">Permanently delete your account and all data</p>
                </div>
                <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Delete Account?</DialogTitle></DialogHeader>
                    <p className="text-sm text-muted-foreground">This action is irreversible. All your data will be permanently deleted. Please contact an administrator to proceed with account deletion.</p>
                    <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
