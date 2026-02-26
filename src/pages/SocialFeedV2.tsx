import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, MessageCircle, Share2, MoreHorizontal, Send, Image, Smile,
  TrendingUp, Calendar, Plus, X, ChevronDown, ChevronUp, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Comment {
  id: string;
  author: string;
  initials: string;
  content: string;
  time: string;
  replies: Comment[];
}

interface Post {
  id: number;
  author: string;
  initials: string;
  role: string;
  time: string;
  content: string;
  likes: number;
  comments: Comment[];
  liked: boolean;
}

interface Story {
  id: string;
  name: string;
  initials: string;
  content: string;
  time: string;
  views: number;
  viewed: boolean;
}

const mockStories: Story[] = [
  { id: "s1", name: "Your Story", initials: "+", content: "", time: "", views: 0, viewed: false },
  { id: "s2", name: "Priya S.", initials: "PS", content: "Just got promoted to Staff Engineer at Google! 🎉🚀", time: "2h ago", views: 89, viewed: false },
  { id: "s3", name: "Arjun M.", initials: "AM", content: "Attending the AI summit this weekend. Who else is going? 🤖", time: "5h ago", views: 45, viewed: false },
  { id: "s4", name: "Maya P.", initials: "MP", content: "Mentored 3 students today. Feels amazing to give back! 💛", time: "8h ago", views: 120, viewed: true },
  { id: "s5", name: "Vikram S.", initials: "VS", content: "We're hiring! 10 open positions at Flipkart. DM me.", time: "12h ago", views: 210, viewed: true },
];

const initialPosts: Post[] = [
  {
    id: 1, author: "Priya Sharma", initials: "PS", role: "Senior Engineer at Google", time: "2h ago",
    content: "Thrilled to announce that our team at Google just launched a new AI-powered accessibility feature! 🚀 Grateful to my alma mater for sparking my passion in AI. #AlumniPride",
    likes: 234, liked: false,
    comments: [
      { id: "c1", author: "Arjun Mehta", initials: "AM", content: "Congratulations! This is amazing work! 👏", time: "1h ago", replies: [
        { id: "c1r1", author: "Priya Sharma", initials: "PS", content: "Thank you Arjun! Means a lot coming from you.", time: "45m ago", replies: [] },
      ]},
      { id: "c2", author: "Maya Patel", initials: "MP", content: "So proud of you! Let's catch up at the next meetup.", time: "30m ago", replies: [] },
    ],
  },
  {
    id: 2, author: "Arjun Mehta", initials: "AM", role: "Product Manager at Microsoft", time: "5h ago",
    content: "Looking for talented fresh graduates interested in Product Management. 3 open positions at Microsoft India. DM me or drop your resume — happy to refer alumni! 💼",
    likes: 189, liked: true,
    comments: [
      { id: "c3", author: "Ravi Kumar", initials: "RK", content: "Just sent you a DM! Would love to apply.", time: "4h ago", replies: [] },
    ],
  },
  {
    id: 3, author: "Maya Patel", initials: "MP", role: "VP Growth at Razorpay", time: "1d ago",
    content: "Just completed my 50th mentoring session through AlumniOS! The skill gap analyzer really helped me understand what students need. 🎯",
    likes: 312, liked: false,
    comments: [],
  },
];

const trendingTopics = [
  { tag: "#AIinTech", count: "2.4k" },
  { tag: "#AlumniHiring", count: "1.8k" },
  { tag: "#StartupLife", count: "1.2k" },
  { tag: "#MentorshipMatters", count: "980" },
];

const upcomingEvents = [
  { title: "AI/ML Alumni Meetup", date: "Mar 5", attendees: 145 },
  { title: "Annual Reunion 2026", date: "Apr 12", attendees: 520 },
  { title: "Startup Pitch Night", date: "Mar 18", attendees: 89 },
];

function CommentThread({ comment, depth = 0, onReply }: { comment: Comment; depth?: number; onReply: (parentId: string, content: string) => void }) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [showReplies, setShowReplies] = useState(depth < 1);

  return (
    <div className={depth > 0 ? "ml-8 border-l-2 border-border pl-3" : ""}>
      <div className="flex gap-2 py-2">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="bg-accent/10 text-accent text-[10px] font-heading">{comment.initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="bg-secondary rounded-lg px-3 py-2">
            <span className="text-xs font-semibold text-card-foreground">{comment.author}</span>
            <p className="text-xs text-card-foreground mt-0.5">{comment.content}</p>
          </div>
          <div className="flex items-center gap-3 mt-1 px-1">
            <span className="text-[10px] text-muted-foreground">{comment.time}</span>
            <button onClick={() => setShowReplyInput(!showReplyInput)} className="text-[10px] text-muted-foreground hover:text-accent font-medium">Reply</button>
          </div>
          {showReplyInput && (
            <div className="flex gap-2 mt-2">
              <input
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && replyContent.trim()) { onReply(comment.id, replyContent.trim()); setReplyContent(""); setShowReplyInput(false); } }}
                placeholder="Write a reply..."
                className="flex-1 bg-secondary rounded-md px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none"
              />
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { if (replyContent.trim()) { onReply(comment.id, replyContent.trim()); setReplyContent(""); setShowReplyInput(false); } }}>
                <Send className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
      {comment.replies.length > 0 && (
        <>
          {!showReplies && (
            <button onClick={() => setShowReplies(true)} className="flex items-center gap-1 text-[10px] text-accent ml-9 mb-1">
              <ChevronDown className="h-3 w-3" /> {comment.replies.length} {comment.replies.length === 1 ? "reply" : "replies"}
            </button>
          )}
          {showReplies && comment.replies.map((r) => (
            <CommentThread key={r.id} comment={r} depth={depth + 1} onReply={onReply} />
          ))}
        </>
      )}
    </div>
  );
}

export default function SocialFeedV2() {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [postContent, setPostContent] = useState("");
  const [stories, setStories] = useState(mockStories);
  const [activeStory, setActiveStory] = useState<Story | null>(null);

  const toggleLike = (id: number) => {
    setPosts((prev) => prev.map((p) =>
      p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
    ));
  };

  const [showComments, setShowComments] = useState<Record<number, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});

  const addComment = (postId: number) => {
    const content = commentInputs[postId]?.trim();
    if (!content) return;
    const newComment: Comment = { id: `c${Date.now()}`, author: "You", initials: "YO", content, time: "now", replies: [] };
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments: [...p.comments, newComment] } : p));
    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
  };

  const addReply = (postId: number, parentId: string, content: string) => {
    const newReply: Comment = { id: `r${Date.now()}`, author: "You", initials: "YO", content, time: "now", replies: [] };
    const addReplyToComment = (comments: Comment[]): Comment[] =>
      comments.map((c) => c.id === parentId ? { ...c, replies: [...c.replies, newReply] } : { ...c, replies: addReplyToComment(c.replies) });
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments: addReplyToComment(p.comments) } : p));
  };

  const createPost = () => {
    if (!postContent.trim()) return;
    const newPost: Post = {
      id: Date.now(), author: "You", initials: "YO", role: "Alumni", time: "now",
      content: postContent.trim(), likes: 0, comments: [], liked: false,
    };
    setPosts((prev) => [newPost, ...prev]);
    setPostContent("");
    toast.success("Post published!");
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Community Feed</h1>
          <p className="text-muted-foreground text-sm">Stay connected with your alumni network</p>
        </div>

        {/* Stories */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {stories.map((story) => (
            <button
              key={story.id}
              onClick={() => { if (story.content) { setActiveStory(story); setStories((prev) => prev.map((s) => s.id === story.id ? { ...s, viewed: true } : s)); } }}
              className="flex flex-col items-center gap-1.5 shrink-0"
            >
              <div className={`h-16 w-16 rounded-full p-0.5 ${
                story.id === "s1" ? "border-2 border-dashed border-muted-foreground/30"
                : story.viewed ? "border-2 border-muted-foreground/20"
                : "bg-gradient-to-br from-accent to-warning border-0 p-[3px]"
              }`}>
                <div className="h-full w-full rounded-full bg-card flex items-center justify-center">
                  {story.id === "s1" ? (
                    <Plus className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <span className="font-heading font-bold text-sm text-accent">{story.initials}</span>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground w-14 text-center truncate">{story.name}</span>
            </button>
          ))}
        </div>

        {/* Story viewer modal */}
        <Dialog open={!!activeStory} onOpenChange={() => setActiveStory(null)}>
          <DialogContent className="sm:max-w-md bg-primary border-none">
            {activeStory && (
              <div className="text-center py-8">
                <div className="flex items-center gap-2 justify-center mb-6">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-accent/20 text-accent font-heading text-xs">{activeStory.initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-primary-foreground">{activeStory.name}</span>
                  <span className="text-xs text-primary-foreground/50">{activeStory.time}</span>
                </div>
                <p className="text-lg text-primary-foreground font-medium leading-relaxed">{activeStory.content}</p>
                <div className="flex items-center justify-center gap-1 mt-6 text-primary-foreground/40">
                  <Eye className="h-3.5 w-3.5" />
                  <span className="text-xs">{activeStory.views} views</span>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Composer */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <div className="flex gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="bg-accent text-accent-foreground font-heading text-sm">YO</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="Share an update, achievement, or opportunity..."
                className="w-full bg-secondary rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none min-h-[80px]"
              />
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
        {posts.map((post, i) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-card border border-border rounded-xl p-5 shadow-card"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-accent/10 text-accent font-heading text-sm">{post.initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-card-foreground">{post.author}</p>
                  <p className="text-xs text-muted-foreground">{post.role} • {post.time}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>

            <p className="text-sm text-card-foreground leading-relaxed mb-4">{post.content}</p>

            <div className="flex items-center gap-1 pt-3 border-t border-border">
              <Button
                variant="ghost" size="sm"
                onClick={() => toggleLike(post.id)}
                className={post.liked ? "text-destructive" : "text-muted-foreground"}
              >
                <Heart className={`h-4 w-4 ${post.liked ? "fill-current" : ""}`} /> {post.likes}
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setShowComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}>
                <MessageCircle className="h-4 w-4" /> {post.comments.length}
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <Share2 className="h-4 w-4" /> Share
              </Button>
            </div>

            {/* Comments */}
            <AnimatePresence>
              {showComments[post.id] && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 pt-3 border-t border-border">
                  {post.comments.map((c) => (
                    <CommentThread key={c.id} comment={c} onReply={(parentId, content) => addReply(post.id, parentId, content)} />
                  ))}
                  <div className="flex gap-2 mt-2">
                    <input
                      value={commentInputs[post.id] || ""}
                      onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && addComment(post.id)}
                      placeholder="Write a comment..."
                      className="flex-1 bg-secondary rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none"
                    />
                    <Button variant="ghost" size="sm" className="h-8" onClick={() => addComment(post.id)}>
                      <Send className="h-3 w-3" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Sidebar */}
      <div className="space-y-4 hidden lg:block">
        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <h3 className="font-heading font-semibold text-card-foreground text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" /> Trending
          </h3>
          <div className="space-y-3">
            {trendingTopics.map((t) => (
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
            {upcomingEvents.map((e) => (
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
