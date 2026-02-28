import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, MessageCircle, Share2, MoreHorizontal, Send, Image, Smile,
  TrendingUp, Calendar, Plus, X, ChevronDown, ChevronUp, Eye, Loader2, Trash2, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface DbPost {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  profile?: { full_name: string; designation: string | null; company: string | null };
}

interface DbComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  profile?: { full_name: string };
  replies?: DbComment[];
}

interface DbStory {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  expires_at: string;
  profile?: { full_name: string };
  views_count?: number;
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
}

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function CommentThread({ comment, onReply, canModerate, onDelete }: { comment: DbComment; onReply: (parentId: string, content: string) => void; canModerate?: boolean; onDelete?: (commentId: string) => void }) {
  const [showReply, setShowReply] = useState(false);
  const [reply, setReply] = useState("");
  const [showReplies, setShowReplies] = useState(false);
  const name = comment.profile?.full_name || "Alumni";

  return (
    <div>
      <div className="flex gap-2 py-2">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="bg-accent/10 text-accent text-[10px] font-heading">{getInitials(name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="bg-secondary rounded-lg px-3 py-2 group relative">
            <span className="text-xs font-semibold text-card-foreground">{name}</span>
            <p className="text-xs text-card-foreground mt-0.5">{comment.content}</p>
            {canModerate && onDelete && (
              <button onClick={() => onDelete(comment.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10" title="Delete comment">
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 px-1">
            <span className="text-[10px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
            <button onClick={() => setShowReply(!showReply)} className="text-[10px] text-muted-foreground hover:text-accent font-medium">Reply</button>
          </div>
          {showReply && (
            <div className="flex gap-2 mt-2">
              <input value={reply} onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && reply.trim()) { onReply(comment.id, reply.trim()); setReply(""); setShowReply(false); } }}
                placeholder="Write a reply..." className="flex-1 bg-secondary rounded-md px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none" />
            </div>
          )}
        </div>
      </div>
      {(comment.replies || []).length > 0 && (
        <div className="ml-8 border-l-2 border-border pl-3">
          {!showReplies && (
            <button onClick={() => setShowReplies(true)} className="flex items-center gap-1 text-[10px] text-accent mb-1">
              <ChevronDown className="h-3 w-3" /> {comment.replies!.length} replies
            </button>
          )}
          {showReplies && comment.replies!.map((r) => (
            <CommentThread key={r.id} comment={r} onReply={onReply} canModerate={canModerate} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SocialFeedV2() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<DbPost[]>([]);
  const [stories, setStories] = useState<DbStory[]>([]);
  const [postContent, setPostContent] = useState("");
  const [activeStory, setActiveStory] = useState<DbStory | null>(null);
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [postComments, setPostComments] = useState<Record<string, DbComment[]>>({});
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  const canModerate = userRoles.includes("moderator") || userRoles.includes("super_admin");

  // Fetch user roles
  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      setUserRoles(data?.map((r) => r.role) || []);
    });
  }, [user]);

  // Fetch posts with profiles
  const fetchPosts = async () => {
    const { data } = await supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(50);
    if (!data) return;
    const userIds = [...new Set(data.map((p) => p.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, designation, company").in("user_id", userIds);
    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
    setPosts(data.map((p) => ({ ...p, profile: profileMap.get(p.user_id) || { full_name: "Alumni", designation: null, company: null } })));
  };

  // Fetch stories
  const fetchStories = async () => {
    const { data } = await supabase.from("stories").select("*").order("created_at", { ascending: false });
    if (!data) return;
    const userIds = [...new Set(data.map((s) => s.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
    setStories(data.map((s) => ({ ...s, profile: profileMap.get(s.user_id) || { full_name: "Alumni" } })));
  };

  // Fetch user's likes
  const fetchLikes = async () => {
    if (!user) return;
    const { data } = await supabase.from("post_likes").select("post_id").eq("user_id", user.id);
    if (data) setLikedPosts(new Set(data.map((l) => l.post_id)));
  };

  useEffect(() => {
    Promise.all([fetchPosts(), fetchStories(), fetchLikes()]).then(() => setLoading(false));
    // Realtime for new posts
    const ch = supabase.channel("feed-posts").on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () => fetchPosts()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // Fetch comments for a post
  const fetchComments = async (postId: string) => {
    const { data } = await supabase.from("comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
    if (!data) return;
    const userIds = [...new Set(data.map((c) => c.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
    const flat = data.map((c) => ({ ...c, profile: profileMap.get(c.user_id) || { full_name: "Alumni" }, replies: [] as DbComment[] }));
      const map = new Map<string, DbComment>();
      const roots: DbComment[] = [];
      flat.forEach((c) => map.set(c.id, c));
      flat.forEach((c) => {
        if (c.parent_id && map.has(c.parent_id)) {
          map.get(c.parent_id)!.replies!.push(c);
        } else {
          roots.push(c);
        }
      });
      setPostComments((prev) => ({ ...prev, [postId]: roots }));
  };

  const toggleComments = (postId: string) => {
    const next = !showComments[postId];
    setShowComments((prev) => ({ ...prev, [postId]: next }));
    if (next && !postComments[postId]) fetchComments(postId);
  };

  const toggleLike = async (postId: string, currentLikes: number) => {
    if (!user) return;
    const liked = likedPosts.has(postId);
    if (liked) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
      await supabase.from("posts").update({ likes_count: Math.max(0, currentLikes - 1) }).eq("id", postId);
      setLikedPosts((prev) => { const n = new Set(prev); n.delete(postId); return n; });
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count - 1) } : p));
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
      await supabase.from("posts").update({ likes_count: currentLikes + 1 }).eq("id", postId);
      setLikedPosts((prev) => new Set(prev).add(postId));
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p));
    }
  };

  const createPost = async () => {
    if (!postContent.trim() || !user) return;
    const { error } = await supabase.from("posts").insert({ content: postContent.trim(), user_id: user.id });
    if (error) { toast.error(error.message); return; }
    setPostContent("");
    toast.success("Post published!");
    fetchPosts();
  };

  const addComment = async (postId: string, parentId?: string) => {
    if (!user) return;
    const content = parentId ? undefined : commentInputs[postId]?.trim();
    if (!parentId && !content) return;
    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      content: content || "",
      parent_id: parentId || null,
    });
    if (error) { toast.error(error.message); return; }
    if (!parentId) setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    fetchComments(postId);
  };

  const addReply = async (postId: string, parentId: string, content: string) => {
    if (!user) return;
    await supabase.from("comments").insert({ post_id: postId, user_id: user.id, content, parent_id: parentId });
    fetchComments(postId);
  };

  const deletePost = async (postId: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) { toast.error(error.message); return; }
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    toast.success("Post deleted by moderator");
  };

  const deleteComment = async (postId: string, commentId: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) { toast.error(error.message); return; }
    fetchComments(postId);
    toast.success("Comment deleted by moderator");
  };

  const userInitials = user?.email?.substring(0, 2).toUpperCase() || "YO";

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Community Feed</h1>
          <p className="text-muted-foreground text-sm">Stay connected with your alumni network</p>
        </div>

        {/* Stories */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {stories.map((story) => {
            const name = story.profile?.full_name || "Alumni";
            return (
              <button key={story.id} onClick={() => setActiveStory(story)} className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="h-16 w-16 rounded-full p-[3px] bg-gradient-to-br from-accent to-warning">
                  <div className="h-full w-full rounded-full bg-card flex items-center justify-center">
                    <span className="font-heading font-bold text-sm text-accent">{getInitials(name)}</span>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground w-14 text-center truncate">{name.split(" ")[0]}</span>
              </button>
            );
          })}
          {stories.length === 0 && <p className="text-xs text-muted-foreground">No active stories</p>}
        </div>

        <Dialog open={!!activeStory} onOpenChange={() => setActiveStory(null)}>
          <DialogContent className="sm:max-w-md bg-primary border-none">
            {activeStory && (
              <div className="text-center py-8">
                <div className="flex items-center gap-2 justify-center mb-6">
                  <Avatar className="h-8 w-8"><AvatarFallback className="bg-accent/20 text-accent font-heading text-xs">{getInitials(activeStory.profile?.full_name || "")}</AvatarFallback></Avatar>
                  <span className="text-sm font-medium text-primary-foreground">{activeStory.profile?.full_name}</span>
                  <span className="text-xs text-primary-foreground/50">{timeAgo(activeStory.created_at)}</span>
                </div>
                <p className="text-lg text-primary-foreground font-medium leading-relaxed">{activeStory.content}</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Composer */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <div className="flex gap-3">
            <Avatar className="h-10 w-10 shrink-0"><AvatarFallback className="bg-accent text-accent-foreground font-heading text-sm">{userInitials}</AvatarFallback></Avatar>
            <div className="flex-1">
              <textarea value={postContent} onChange={(e) => setPostContent(e.target.value)} placeholder="Share an update, achievement, or opportunity..." className="w-full bg-secondary rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none min-h-[80px]" />
              <div className="flex items-center justify-between mt-3">
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm"><Image className="h-4 w-4 text-muted-foreground" /></Button>
                  <Button variant="ghost" size="sm"><Smile className="h-4 w-4 text-muted-foreground" /></Button>
                </div>
                <Button variant="hero" size="sm" onClick={createPost} disabled={!postContent.trim()}>
                  <Send className="h-4 w-4" /> Post
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Posts */}
        {posts.map((post, i) => {
          const name = post.profile?.full_name || "Alumni";
          const role = [post.profile?.designation, post.profile?.company].filter(Boolean).join(" at ") || "Alumni";
          const liked = likedPosts.has(post.id);
          const comments = postComments[post.id] || [];

          return (
            <motion.div key={post.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-card border border-border rounded-xl p-5 shadow-card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10"><AvatarFallback className="bg-accent/10 text-accent font-heading text-sm">{getInitials(name)}</AvatarFallback></Avatar>
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">{role} • {timeAgo(post.created_at)}</p>
                  </div>
                </div>
                {(canModerate || post.user_id === user?.id) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => deletePost(post.id)} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> {canModerate && post.user_id !== user?.id ? "Delete (Moderator)" : "Delete"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <p className="text-sm text-card-foreground leading-relaxed mb-4">{post.content}</p>
              {post.image_url && <img src={post.image_url} alt="" className="rounded-lg mb-4 max-h-80 w-full object-cover" />}
              <div className="flex items-center gap-1 pt-3 border-t border-border">
                <Button variant="ghost" size="sm" onClick={() => toggleLike(post.id, post.likes_count)} className={liked ? "text-destructive" : "text-muted-foreground"}>
                  <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {post.likes_count}
                </Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => toggleComments(post.id)}>
                  <MessageCircle className="h-4 w-4" /> {post.comments_count}
                </Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground"><Share2 className="h-4 w-4" /> Share</Button>
              </div>

              <AnimatePresence>
                {showComments[post.id] && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 pt-3 border-t border-border">
                    {comments.map((c) => <CommentThread key={c.id} comment={c} onReply={(pid, content) => addReply(post.id, pid, content)} canModerate={canModerate} onDelete={(commentId) => deleteComment(post.id, commentId)} />)}
                    <div className="flex gap-2 mt-2">
                      <input value={commentInputs[post.id] || ""} onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && addComment(post.id)} placeholder="Write a comment..."
                        className="flex-1 bg-secondary rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none" />
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => addComment(post.id)}><Send className="h-3 w-3" /></Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {posts.length === 0 && (
          <div className="text-center py-12 bg-card border border-border rounded-xl shadow-card">
            <MessageCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No posts yet. Be the first to share!</p>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-4 hidden lg:block">
        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <h3 className="font-heading font-semibold text-card-foreground text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" /> Trending
          </h3>
          <div className="space-y-3">
            {[{ tag: "#AIinTech", count: "2.4k" }, { tag: "#AlumniHiring", count: "1.8k" }, { tag: "#StartupLife", count: "1.2k" }].map((t) => (
              <div key={t.tag} className="flex items-center justify-between">
                <span className="text-sm font-medium text-info">{t.tag}</span>
                <span className="text-xs text-muted-foreground">{t.count} posts</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <h3 className="font-heading font-semibold text-card-foreground text-sm mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-accent" /> Upcoming Events
          </h3>
          <div className="space-y-3">
            {[{ title: "AI/ML Alumni Meetup", date: "Mar 5", attendees: 145 }, { title: "Annual Reunion 2026", date: "Apr 12", attendees: 520 }].map((e) => (
              <div key={e.title} className="p-3 bg-secondary rounded-lg">
                <p className="text-sm font-medium text-foreground">{e.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{e.date} • {e.attendees} attending</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
