import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Send, Check, CheckCheck, Search, ArrowLeft, Loader2, Plus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ConversationPeer {
  user_id: string;
  full_name: string;
  last_message: string;
  last_time: string;
  unread: number;
}

interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  is_read: boolean;
  created_at: string;
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
}

function timeLabel(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [peers, setPeers] = useState<ConversationPeer[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [alumniSearch, setAlumniSearch] = useState("");
  const [alumniResults, setAlumniResults] = useState<{ user_id: string; full_name: string; designation: string | null; company: string | null }[]>([]);
  const [searchingAlumni, setSearchingAlumni] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build conversation list from messages table
  const fetchConversations = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    const peerMap = new Map<string, { last_message: string; last_time: string; unread: number }>();
    data.forEach((m) => {
      const peerId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      if (!peerMap.has(peerId)) {
        peerMap.set(peerId, {
          last_message: m.content,
          last_time: m.created_at,
          unread: (!m.is_read && m.receiver_id === user.id) ? 1 : 0,
        });
      } else if (!m.is_read && m.receiver_id === user.id) {
        const existing = peerMap.get(peerId)!;
        existing.unread += 1;
      }
    });

    const peerIds = Array.from(peerMap.keys());
    if (peerIds.length === 0) { setPeers([]); setLoading(false); return; }

    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", peerIds);
    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p.full_name]));

    const result: ConversationPeer[] = peerIds.map((id) => ({
      user_id: id,
      full_name: profileMap.get(id) || "Alumni",
      ...peerMap.get(id)!,
    }));

    setPeers(result);
    setLoading(false);
  };

  // Fetch messages for active chat
  const fetchMessages = async (peerId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);

    // Mark received messages as read
    await supabase.from("messages").update({ is_read: true, read_at: new Date().toISOString() })
      .eq("sender_id", peerId).eq("receiver_id", user.id).eq("is_read", false);
  };

  useEffect(() => { fetchConversations(); }, [user]);

  useEffect(() => {
    if (activeChat) fetchMessages(activeChat);
  }, [activeChat]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Realtime messages
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("dm-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${user.id}` }, (payload) => {
        const msg = payload.new as ChatMessage;
        if (msg.sender_id === activeChat) {
          setMessages((prev) => [...prev, msg]);
          supabase.from("messages").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", msg.id);
        }
        fetchConversations();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const updated = payload.new as ChatMessage;
        setMessages((prev) => prev.map((m) => m.id === updated.id ? updated : m));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, activeChat]);

  const sendMessage = async () => {
    if (!messageInput.trim() || !activeChat || !user) return;
    const { error } = await supabase.from("messages").insert({
      content: messageInput.trim(),
      sender_id: user.id,
      receiver_id: activeChat,
    });
    if (error) { toast.error(error.message); return; }
    setMessageInput("");
    fetchMessages(activeChat);
    fetchConversations();
  };

  const filteredPeers = peers.filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase()));
  const activePeer = peers.find((p) => p.user_id === activeChat);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  // Search alumni for new conversation
  const searchAlumni = async (q: string) => {
    setAlumniSearch(q);
    if (q.trim().length < 2) { setAlumniResults([]); return; }
    setSearchingAlumni(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, designation, company")
      .neq("user_id", user?.id || "")
      .ilike("full_name", `%${q}%`)
      .limit(10);
    setAlumniResults(data || []);
    setSearchingAlumni(false);
  };

  const startConversation = (peerId: string) => {
    setShowNewChat(false);
    setAlumniSearch("");
    setAlumniResults([]);
    setActiveChat(peerId);
    // Add to peers if not already there
    const existing = peers.find((p) => p.user_id === peerId);
    if (!existing) {
      const alumniProfile = alumniResults.find((a) => a.user_id === peerId);
      setPeers((prev) => [{
        user_id: peerId,
        full_name: alumniProfile?.full_name || "Alumni",
        last_message: "",
        last_time: new Date().toISOString(),
        unread: 0,
      }, ...prev]);
    }
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] bg-card border border-border rounded-xl overflow-hidden shadow-card">
      {/* New Conversation Dialog */}
      <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">New Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={alumniSearch}
                onChange={(e) => searchAlumni(e.target.value)}
                placeholder="Search alumni by name..."
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {searchingAlumni && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>}
              {!searchingAlumni && alumniSearch.length >= 2 && alumniResults.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No alumni found</p>
              )}
              {alumniResults.map((a) => (
                <button
                  key={a.user_id}
                  onClick={() => startConversation(a.user_id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-left"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-accent/10 text-accent font-heading text-xs">{getInitials(a.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-card-foreground truncate">{a.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[a.designation, a.company].filter(Boolean).join(" at ") || "Alumni"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conversation list */}
      <div className={`w-full sm:w-80 border-r border-border flex flex-col shrink-0 ${activeChat ? "hidden sm:flex" : "flex"}`}>
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-heading font-semibold text-card-foreground">Messages</h2>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowNewChat(true)}>
              <Plus className="h-4 w-4 text-accent" />
            </Button>
          </div>
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations..." className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredPeers.length === 0 && (
            <div className="text-center py-12 px-4">
              <Send className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No conversations yet</p>
            </div>
          )}
          {filteredPeers.map((c) => (
            <button key={c.user_id} onClick={() => setActiveChat(c.user_id)}
              className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-secondary/50 transition-colors text-left ${activeChat === c.user_id ? "bg-secondary" : ""}`}>
              <Avatar className="h-10 w-10"><AvatarFallback className="bg-accent/10 text-accent font-heading text-sm">{getInitials(c.full_name)}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-card-foreground truncate">{c.full_name}</span>
                  <span className="text-[10px] text-muted-foreground">{timeLabel(c.last_time)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{c.last_message}</p>
              </div>
              {c.unread > 0 && (
                <Badge className="bg-accent text-accent-foreground text-[10px] h-5 w-5 p-0 flex items-center justify-center rounded-full">{c.unread}</Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col ${!activeChat ? "hidden sm:flex" : "flex"}`}>
        {activeChat && activePeer ? (
          <>
            <div className="h-14 border-b border-border flex items-center gap-3 px-4 shrink-0">
              <Button variant="ghost" size="icon" className="sm:hidden h-8 w-8" onClick={() => setActiveChat(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Avatar className="h-8 w-8"><AvatarFallback className="bg-accent/10 text-accent font-heading text-xs">{getInitials(activePeer.full_name)}</AvatarFallback></Avatar>
              <p className="text-sm font-medium text-card-foreground">{activePeer.full_name}</p>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => (
                <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.sender_id === user?.id ? "bg-primary text-primary-foreground rounded-br-md" : "bg-secondary text-foreground rounded-bl-md"
                  }`}>
                    <p>{m.content}</p>
                    <div className={`flex items-center gap-1 mt-1 ${m.sender_id === user?.id ? "justify-end" : ""}`}>
                      <span className="text-[10px] opacity-60">{new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                      {m.sender_id === user?.id && (m.is_read ? <CheckCheck className="h-3 w-3 opacity-60" /> : <Check className="h-3 w-3 opacity-40" />)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="border-t border-border p-3 flex gap-2">
              <Input value={messageInput} onChange={(e) => setMessageInput(e.target.value)} placeholder="Type a message..." className="flex-1" />
              <Button variant="hero" size="icon" type="submit" disabled={!messageInput.trim()}><Send className="h-4 w-4" /></Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <Send className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
